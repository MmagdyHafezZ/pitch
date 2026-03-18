import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Observable, Subscription } from 'rxjs';
import { Annotation, END, START, StateGraph } from '@langchain/langgraph';
import { RunnableConfig, RunnableLambda } from '@langchain/core/runnables';
import { LangChainTracer } from '@langchain/core/tracers/tracer_langchain';
import { LLMProviderRegistry } from '../../providers/llm/llm-provider.registry';
import {
  ProviderError,
  ProviderInvalidRequestError,
} from '../../providers/llm/llm-provider.interface';
import {
  LLMRequestDto,
  LLMResponseDto,
  LLMStreamChunkDto,
} from '../../dto/llm.dto';
import { LLMRequestContext } from './llm-context.types';
import { LLMRoutingConfigService } from './llm-routing-config.service';
import {
  LLMRouteTarget,
  LLMRoutingConfig,
  LLMRoutingHints,
  LLMRoutingStrategy,
} from './llm-routing.types';

const RouterState = Annotation.Root({
  request: Annotation<LLMRequestDto>,
  context: Annotation<LLMRequestContext | undefined>,
  routes: Annotation<LLMRouteTarget[]>,
  attempt: Annotation<number>,
  selectedRoute: Annotation<LLMRouteTarget | null>,
  response: Annotation<LLMResponseDto | null>,
  error: Annotation<ProviderError | null>,
  strategy: Annotation<LLMRoutingStrategy | null>,
});

type RouterStateType = typeof RouterState.State;

@Injectable()
export class LLMRouterService {
  private readonly logger = new Logger(LLMRouterService.name);
  private readonly tracingEnabled: boolean;
  private tracer?: LangChainTracer;
  private readonly graph: ReturnType<typeof this.buildGraph>;

  constructor(
    private readonly providerRegistry: LLMProviderRegistry,
    private readonly routingConfigService: LLMRoutingConfigService,
    private readonly configService: ConfigService,
  ) {
    const langsmithTracing =
      this.configService.get<string>('LANGSMITH_TRACING') ||
      this.configService.get<string>('LANGCHAIN_TRACING_V2');
    this.tracingEnabled = langsmithTracing === 'true';

    // Initialize graph after all class properties are set
    this.graph = this.buildGraph();
  }

  async complete(
    request: LLMRequestDto,
    context?: LLMRequestContext,
  ): Promise<{ response: LLMResponseDto; route: LLMRouteTarget }> {
    const result = await this.graph.invoke(
      {
        request,
        context,
        attempt: 0,
      },
      this.buildRunConfig('llm.complete', request, context),
    );

    if (!result.response) {
      throw (
        result.error ??
        new ProviderError(
          'router',
          'UNKNOWN_ERROR',
          'LLM routing failed without a response',
        )
      );
    }

    return {
      response: result.response,
      route: result.selectedRoute ?? result.routes[0],
    };
  }

  stream(
    request: LLMRequestDto,
    context?: LLMRequestContext,
    onRouteSelected?: (route: LLMRouteTarget) => void,
  ): Observable<LLMStreamChunkDto> {
    return new Observable((subscriber) => {
      let routes: LLMRouteTarget[] = [];
      let strategy: LLMRoutingStrategy | null = null;
      let attempt = 0;
      let currentSubscription: Subscription | null = null;
      let sawContent = false;

      const start = async () => {
        const config = await this.routingConfigService.getActiveConfig({
          orgId: context?.orgId,
          userId: context?.userId,
        });
        const plan = this.buildRoutePlan(request, config);
        routes = plan.routes;
        strategy = plan.strategy;
        attempt = 0;
        await attemptRoute();
      };

      const attemptRoute = async () => {
        const route = routes[attempt];
        if (!route) {
          subscriber.error(
            new ProviderInvalidRequestError(
              'router',
              'No available routes for request',
            ),
          );
          return;
        }

        try {
          onRouteSelected?.(route);
          const provider = this.providerRegistry.getProvider(route.provider);
          const effectiveConfig = {
            ...request.config,
            provider: route.provider,
            model: route.model,
          };

          provider.validateConfig(effectiveConfig);
          currentSubscription = provider
            .stream(request.messages, effectiveConfig, context?.abortSignal)
            .subscribe({
              next: (chunk) => {
                if (chunk.delta) {
                  sawContent = true;
                }
                subscriber.next(chunk);
              },
              error: (error) => {
                const normalized = this.normalizeError(
                  error,
                  route.provider,
                  route.model,
                );
                if (
                  !sawContent &&
                  this.shouldRetry(normalized, strategy) &&
                  attempt + 1 < routes.length &&
                  this.withinAttemptLimit(attempt + 1, strategy)
                ) {
                  attempt += 1;
                  attemptRoute().catch((err) => subscriber.error(err));
                  return;
                }
                subscriber.error(normalized);
              },
              complete: () => {
                subscriber.complete();
              },
            });
        } catch (error) {
          const normalized = this.normalizeError(
            error,
            route.provider,
            route.model,
          );
          if (
            !sawContent &&
            this.shouldRetry(normalized, strategy) &&
            attempt + 1 < routes.length &&
            this.withinAttemptLimit(attempt + 1, strategy)
          ) {
            attempt += 1;
            await attemptRoute();
            return;
          }
          subscriber.error(normalized);
        }
      };

      start().catch((error) => subscriber.error(error));

      return () => {
        if (currentSubscription) {
          currentSubscription.unsubscribe();
        }
      };
    });
  }

  private buildGraph() {
    const graph = new StateGraph(RouterState);
    graph.addNode('resolveRoutes', this.resolveRoutes);
    graph.addNode('invoke', this.invokeRoute);
    graph.addNode('fallback', this.advanceRoute);
    // @ts-expect-error - LangGraph type definitions are overly strict
    graph.addEdge(START, 'resolveRoutes');
    // @ts-expect-error - LangGraph type definitions are overly strict
    graph.addEdge('resolveRoutes', 'invoke');
    // @ts-expect-error - LangGraph type definitions are overly strict
    graph.addConditionalEdges('invoke', this.routeAfterInvoke, {
      fallback: 'fallback',
      end: END,
    });
    // @ts-expect-error - LangGraph type definitions are overly strict
    graph.addEdge('fallback', 'invoke');
    return graph.compile();
  }

  private resolveRoutes = async (state: RouterStateType) => {
    const config = await this.routingConfigService.getActiveConfig({
      orgId: state.context?.orgId,
      userId: state.context?.userId,
    });
    const plan = this.buildRoutePlan(state.request, config);

    return {
      routes: plan.routes,
      strategy: plan.strategy,
      attempt: 0,
      selectedRoute: plan.routes[0],
      response: null,
      error: null,
    };
  };

  private invokeRoute = async (state: RouterStateType) => {
    const route = state.routes[state.attempt] ?? state.routes[0];
    if (!route) {
      return {
        error: new ProviderInvalidRequestError(
          'router',
          'No available routes for request',
        ),
      };
    }

    try {
      const provider = this.providerRegistry.getProvider(route.provider);
      const effectiveConfig = {
        ...state.request.config,
        provider: route.provider,
        model: route.model,
      };
      provider.validateConfig(effectiveConfig);
      const runnable = RunnableLambda.from(async () =>
        provider.complete(state.request.messages, effectiveConfig),
      );
      const response = await runnable.invoke(
        {},
        this.buildRunConfig(
          `llm.complete.${route.provider}`,
          state.request,
          state.context,
          route,
        ),
      );

      return {
        response,
        selectedRoute: route,
        error: null,
      };
    } catch (error) {
      return {
        error: this.normalizeError(error, route.provider, route.model),
        selectedRoute: route,
      };
    }
  };

  private routeAfterInvoke = (state: RouterStateType) => {
    if (!state.error) {
      return 'end';
    }

    if (!this.shouldRetry(state.error, state.strategy)) {
      return 'end';
    }

    if (!this.withinAttemptLimit(state.attempt + 1, state.strategy)) {
      return 'end';
    }

    if (state.attempt + 1 >= state.routes.length) {
      return 'end';
    }

    return 'fallback';
  };

  private advanceRoute = (state: RouterStateType) => ({
    attempt: state.attempt + 1,
    error: null,
  });

  private buildRoutePlan(
    request: LLMRequestDto,
    config: LLMRoutingConfig,
  ): { routes: LLMRouteTarget[]; strategy: LLMRoutingStrategy } {
    const hints = (request.config.routing ?? {}) as LLMRoutingHints;
    const hasExplicitRoute =
      Boolean(request.config.provider) ||
      (request.config.model && request.config.model !== 'auto');
    const mode =
      hints.mode ?? (hasExplicitRoute ? 'manual' : (config.mode ?? 'manual'));
    const strategy: LLMRoutingStrategy = {
      ...config.strategy,
      mode,
      select: hints.strategy ?? config.strategy?.select ?? 'balanced',
    };

    const fallbacks = this.mergeFallbacks(hints.fallbacks, config.fallbacks);
    const baseRoute =
      mode === 'auto'
        ? this.pickAutoRoute(request, config, hints, strategy)
        : this.resolveManualRoute(request, config);

    return {
      routes: this.dedupeRoutes([baseRoute, ...fallbacks]),
      strategy,
    };
  }

  private resolveManualRoute(
    request: LLMRequestDto,
    config: LLMRoutingConfig,
  ): LLMRouteTarget {
    const providerHint = request.config.provider?.toLowerCase();
    const modelHint = request.config.model?.toLowerCase();

    if (modelHint && config.aliases?.[modelHint]) {
      return config.aliases[modelHint];
    }

    if (providerHint && modelHint && modelHint !== 'auto') {
      return { provider: providerHint, model: request.config.model };
    }

    if (providerHint) {
      const defaultModel =
        config.providers?.[providerHint]?.defaultModel ??
        config.defaultRoute.model;
      return { provider: providerHint, model: defaultModel };
    }

    if (modelHint && modelHint !== 'auto') {
      try {
        const provider = this.providerRegistry.getProviderForModel(
          request.config.model,
        );
        return { provider: provider.name, model: request.config.model };
      } catch {
        this.logger.warn(
          `Unable to resolve provider for model=${request.config.model}, using default route`,
        );
      }
    }

    return config.defaultRoute;
  }

  private pickAutoRoute(
    request: LLMRequestDto,
    config: LLMRoutingConfig,
    hints: LLMRoutingHints,
    strategy: LLMRoutingStrategy,
  ): LLMRouteTarget {
    const candidates =
      hints.candidates && hints.candidates.length > 0
        ? hints.candidates
        : this.routesFromConfig(config);

    const ruled = this.applyRules(request, config, candidates);
    const filtered = this.filterByRequirements(request, hints, ruled);

    if (filtered.length === 0) {
      return config.defaultRoute;
    }

    return this.selectCandidate(filtered, strategy.select ?? 'balanced');
  }

  private routesFromConfig(config: LLMRoutingConfig): LLMRouteTarget[] {
    if (!config.providers || Object.keys(config.providers).length === 0) {
      return [config.defaultRoute];
    }

    const routes: LLMRouteTarget[] = [];
    for (const [provider, entry] of Object.entries(config.providers)) {
      if (entry.models && entry.models.length > 0) {
        entry.models.forEach((model) =>
          routes.push({ provider, model: model }),
        );
      } else if (entry.defaultModel) {
        routes.push({ provider, model: entry.defaultModel });
      }
    }

    if (routes.length === 0) {
      routes.push(config.defaultRoute);
    }

    return routes;
  }

  private applyRules(
    request: LLMRequestDto,
    config: LLMRoutingConfig,
    candidates: LLMRouteTarget[],
  ): LLMRouteTarget[] {
    if (!config.rules || config.rules.length === 0) {
      return candidates;
    }

    const matches = config.rules.filter((rule) => {
      if (rule.when.model && rule.when.model !== request.config.model) {
        return false;
      }
      if (
        rule.when.provider &&
        rule.when.provider !== request.config.provider
      ) {
        return false;
      }
      if (rule.when.modalities) {
        if (!request.config.modalities) {
          return false;
        }
        if (
          !rule.when.modalities.every((m) =>
            request.config.modalities?.includes(m),
          )
        ) {
          return false;
        }
      }
      return true;
    });

    if (matches.length === 0) {
      return candidates;
    }

    return this.dedupeRoutes([
      ...matches.map((match) => match.route),
      ...candidates,
    ]);
  }

  private filterByRequirements(
    request: LLMRequestDto,
    hints: LLMRoutingHints,
    candidates: LLMRouteTarget[],
  ): LLMRouteTarget[] {
    const required = new Set<string>();
    if (hints.require) {
      hints.require.forEach((req) => required.add(req));
    }
    if (request.config.stream) {
      required.add('streaming');
    }
    if (request.config.tools && request.config.tools.length > 0) {
      required.add('tools');
    }
    if (request.config.modalities?.includes('image')) {
      required.add('vision');
    }
    if (request.config.modalities?.includes('audio')) {
      required.add('audio');
    }

    if (required.size === 0) {
      return candidates;
    }

    return candidates.filter((candidate) => {
      try {
        const provider = this.providerRegistry.getProvider(candidate.provider);
        const capabilities = provider.getModelCapabilities(candidate.model);
        if (required.has('streaming') && !capabilities.supportsStreaming) {
          return false;
        }
        if (required.has('tools') && !capabilities.supportsTools) {
          return false;
        }
        if (required.has('vision') && !capabilities.supportsVision) {
          return false;
        }
        if (required.has('audio') && !capabilities.supportsAudio) {
          return false;
        }
        return true;
      } catch {
        return false;
      }
    });
  }

  private selectCandidate(
    candidates: LLMRouteTarget[],
    strategy: LLMRoutingStrategy['select'],
  ): LLMRouteTarget {
    if (candidates.length === 1) {
      return candidates[0];
    }

    if (strategy === 'cost') {
      return candidates.reduce((best, candidate) => {
        const bestScore = this.scoreCost(best);
        const nextScore = this.scoreCost(candidate);
        return nextScore < bestScore ? candidate : best;
      });
    }

    if (strategy === 'quality') {
      return candidates.reduce((best, candidate) => {
        const bestScore = this.scoreQuality(best);
        const nextScore = this.scoreQuality(candidate);
        return nextScore > bestScore ? candidate : best;
      });
    }

    if (strategy === 'latency') {
      return candidates.reduce((best, candidate) => {
        const bestWeight = best.weight ?? 0;
        const nextWeight = candidate.weight ?? 0;
        return nextWeight > bestWeight ? candidate : best;
      });
    }

    return candidates.reduce((best, candidate) => {
      const bestWeight = best.weight ?? 0;
      const nextWeight = candidate.weight ?? 0;
      return nextWeight > bestWeight ? candidate : best;
    });
  }

  private scoreCost(route: LLMRouteTarget): number {
    try {
      const provider = this.providerRegistry.getProvider(route.provider);
      const pricing = provider.getModelCapabilities(route.model).pricing;
      const hasPricing =
        (pricing.inputTokensPerMillion ?? 0) > 0 ||
        (pricing.outputTokensPerMillion ?? 0) > 0;
      if (!hasPricing) {
        return Number.POSITIVE_INFINITY;
      }
      return pricing.inputTokensPerMillion + pricing.outputTokensPerMillion;
    } catch {
      return Number.POSITIVE_INFINITY;
    }
  }

  private scoreQuality(route: LLMRouteTarget): number {
    try {
      const provider = this.providerRegistry.getProvider(route.provider);
      const capabilities = provider.getModelCapabilities(route.model);
      let score = capabilities.maxTokens;
      if (capabilities.supportsTools) score += 5000;
      if (capabilities.supportsVision) score += 2000;
      return score;
    } catch {
      return 0;
    }
  }

  private mergeFallbacks(
    requestFallbacks?: LLMRouteTarget[],
    configFallbacks?: LLMRouteTarget[],
  ): LLMRouteTarget[] {
    const merged = [...(requestFallbacks ?? []), ...(configFallbacks ?? [])];
    return this.dedupeRoutes(merged);
  }

  private dedupeRoutes(routes: LLMRouteTarget[]): LLMRouteTarget[] {
    const seen = new Set<string>();
    const result: LLMRouteTarget[] = [];
    for (const route of routes) {
      const key = `${route.provider}:${route.model}`;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(route);
    }
    return result;
  }

  private shouldRetry(
    error: ProviderError,
    strategy: LLMRoutingStrategy | null,
  ): boolean {
    const retryOn =
      strategy?.retryOn ??
      (['RATE_LIMIT', 'TIMEOUT', 'API_ERROR', 'UNKNOWN_ERROR'] as const);
    return retryOn.some((code) => code === error.code);
  }

  private withinAttemptLimit(
    attempt: number,
    strategy: LLMRoutingStrategy | null,
  ): boolean {
    const maxAttempts = strategy?.maxAttempts;
    if (!maxAttempts) {
      return true;
    }
    return attempt < maxAttempts;
  }

  private normalizeError(
    error: unknown,
    provider: string,
    model?: string,
  ): ProviderError {
    if (error instanceof ProviderError) {
      const detailRecord =
        error.details && typeof error.details === 'object'
          ? (error.details as Record<string, unknown>)
          : undefined;
      const detailModel =
        typeof detailRecord?.model === 'string'
          ? detailRecord.model
          : undefined;

      if (model && !detailModel) {
        // Create a new error with updated details since details is readonly
        const mergedDetails = detailRecord
          ? { ...detailRecord, model }
          : { model };
        return new ProviderError(
          error.provider,
          error.code,
          error.message,
          mergedDetails,
        );
      }
      return error;
    }

    return new ProviderError(
      provider,
      'UNKNOWN_ERROR',
      (error as Error)?.message || 'Unknown error occurred',
      { error, model },
    );
  }

  private buildRunConfig(
    runName: string,
    request: LLMRequestDto,
    context?: LLMRequestContext,
    route?: LLMRouteTarget,
  ): RunnableConfig {
    const callbacks = this.getCallbacks();
    const tags = [
      'simulation',
      'llm',
      route?.provider ?? request.config.provider ?? 'router',
    ];
    if (context?.purpose) {
      tags.push(context.purpose);
    }

    const metadata: Record<string, unknown> = {
      sessionId: request.sessionId,
      turnId: request.turnId,
      provider: route?.provider ?? request.config.provider,
      model: route?.model ?? request.config.model,
      requestId: context?.requestId,
      purpose: context?.purpose,
    };

    return {
      runName,
      tags,
      metadata,
      callbacks: callbacks ?? undefined,
    };
  }

  private getCallbacks() {
    if (!this.tracingEnabled) {
      return undefined;
    }

    if (!this.tracer) {
      const projectName = this.configService.get<string>('LANGSMITH_PROJECT');
      this.tracer = new LangChainTracer({ projectName });
    }

    return [this.tracer];
  }
}
