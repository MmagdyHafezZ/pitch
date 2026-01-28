import { Injectable, Logger } from '@nestjs/common';
import { Observable, Subscription } from 'rxjs';
import {
  LLMRequestDto,
  LLMResponseDto,
  LLMStreamChunkDto,
  LLMMessageDto,
  LLMUsageDto,
} from '../../dto/llm.dto';
import { UsageCalculatorService } from './usage-calculator.service';
import { SimulationPrismaService } from '../../prisma/simulation-prisma.service';
import { LLMRouterService } from './llm-router.service';
import { LLMRequestContext } from './llm-context.types';
import { ProviderError } from '../../providers/llm/llm-provider.interface';
import { LLMRouteTarget } from './llm-routing.types';
import type { ILLMMessage } from '../../schemas/mongodb';

@Injectable()
export class LLMService {
  private readonly logger = new Logger(LLMService.name);
  private readonly activeStreams = new Map<string, Subscription>();

  constructor(
    private readonly router: LLMRouterService,
    private readonly usageCalculator: UsageCalculatorService,
    private readonly prisma: SimulationPrismaService,
  ) {}

  async complete(
    request: LLMRequestDto,
    context?: LLMRequestContext,
  ): Promise<LLMResponseDto> {
    const startedAt = Date.now();
    try {
      const { response, route } = await this.router.complete(request, context);
      const latencyMs = Date.now() - startedAt;
      const effectiveRequest = this.applyRoute(request, route);
      response.providerMeta = {
        ...response.providerMeta,
        provider: route.provider,
        model: route.model,
      };

      const usage = this.usageCalculator.normalizeUsage({
        messages: effectiveRequest.messages,
        responseText: response.content,
        model: route.model,
        providerName: route.provider,
        providerUsage: response.usage,
      });

      response.usage = usage;

      await this.persistMetric(request, usage, latencyMs, route.provider);
      return response;
    } catch (error) {
      const providerName =
        error instanceof ProviderError ? error.provider : 'unknown';
      const model = this.getErrorModel(error, request.config.model);
      this.logger.warn(
        `LLM completion failed (${providerName}${model ? `/${model}` : ''}): ${String(
          (error as Error)?.message ?? error,
        )}`,
      );
      throw error;
    }
  }

  stream(
    request: LLMRequestDto,
    context?: LLMRequestContext,
  ): Observable<LLMStreamChunkDto> {
    const startedAt = Date.now();
    let content = '';
    let timeToFirstTokenMs: number | null = null;
    let activeRoute: LLMRouteTarget | null = null;

    return new Observable((subscriber) => {
      const subscription = this.router
        .stream(request, context, (route) => {
          activeRoute = route;
        })
        .subscribe({
          next: (chunk) => {
            if (chunk.delta) {
              content += chunk.delta;
              if (timeToFirstTokenMs === null) {
                timeToFirstTokenMs = Date.now() - startedAt;
              }
            }

            if (chunk.done) {
              const route = activeRoute ?? {
                provider: request.config.provider ?? 'unknown',
                model: request.config.model,
              };
              const latencyMs = Date.now() - startedAt;
              const usage = this.usageCalculator.normalizeUsage({
                messages: request.messages,
                responseText: content,
                model: route.model,
                providerName: route.provider,
                providerUsage: chunk.usage,
              });

              chunk.usage = usage;
              const effectiveRequest = this.applyRoute(request, route);

              void this.persistMetric(
                effectiveRequest,
                usage,
                latencyMs,
                route.provider,
              );
              subscriber.next(chunk);
              subscriber.complete();
              return;
            }

            subscriber.next(chunk);
          },
          error: (error) => {
            const providerName =
              error instanceof ProviderError ? error.provider : 'unknown';
            const model = this.getErrorModel(error, request.config.model);
            this.logger.warn(
              `LLM stream failed (${providerName}${model ? `/${model}` : ''}): ${String(
                (error as Error)?.message ?? error,
              )}`,
            );
            subscriber.error(error as Error);
          },
          complete: () => {
            if (!subscriber.closed) {
              subscriber.complete();
            }
          },
        });

      if (context?.requestId) {
        this.activeStreams.set(context.requestId, subscription);
      }

      return () => {
        if (context?.requestId) {
          this.activeStreams.delete(context.requestId);
        }
        subscription.unsubscribe();
      };
    });
  }

  private applyRoute(
    request: LLMRequestDto,
    route: LLMRouteTarget,
  ): LLMRequestDto {
    return {
      ...request,
      config: {
        ...request.config,
        provider: route.provider,
        model: route.model,
      },
    };
  }

  cancel(requestId: string): boolean {
    const subscription = this.activeStreams.get(requestId);
    if (!subscription) {
      return false;
    }

    subscription.unsubscribe();
    this.activeStreams.delete(requestId);
    return true;
  }

  private getErrorModel(error: unknown, fallback?: string): string | undefined {
    if (!(error instanceof ProviderError)) {
      return fallback;
    }
    const details =
      error.details && typeof error.details === 'object'
        ? (error.details as Record<string, unknown>)
        : undefined;
    const model = details?.model;
    return typeof model === 'string' ? model : fallback;
  }

  private async persistMetric(
    request: LLMRequestDto,
    usage: LLMUsageDto,
    latencyMs: number,
    providerName: string,
  ): Promise<void> {
    try {
      const sessionMemberId = await this.resolveSessionMemberId(request);
      if (!sessionMemberId) {
        this.logger.warn(
          `Skipping metric persistence: no sessionMemberId for session ${request.sessionId}`,
        );
        return;
      }

      await this.prisma.metric.create({
        data: {
          sessionMemberId,
          tokensInput: usage.promptTokens,
          tokensOutput: usage.completionTokens,
          latencyMs,
          costUsd: usage.costUsd,
          model: `${providerName}:${request.config.model}`,
        },
      });
    } catch (error) {
      this.logger.warn(
        `Failed to persist metric: ${String((error as Error)?.message || error)}`,
      );
    }
  }

  private async resolveSessionMemberId(
    request: LLMRequestDto,
  ): Promise<string | null> {
    if (request.sessionMemberId) {
      return request.sessionMemberId;
    }

    if (request.userId) {
      const member = await this.prisma.client.sessionMember.findUnique({
        where: {
          sessionId_userId: {
            sessionId: request.sessionId,
            userId: request.userId,
          },
        },
        select: { id: true },
      });
      return member?.id ?? null;
    }

    return null;
  }

  private convertMessages(messages: LLMMessageDto[]): ILLMMessage[] {
    return messages.map((message) => ({
      role: message.role,
      content: this.stringifyContent(message.content),
      name: message.name,
      toolCallId: message.toolCallId,
    }));
  }

  private stringifyContent(
    content?: string | Array<{ type: string; [key: string]: any }>,
  ): string {
    if (!content) return '';
    if (typeof content === 'string') return content;

    return content
      .map((part) => {
        if (part.type === 'text') {
          return (part.text as string | undefined) || '';
        }
        if (part.type === 'image') {
          return `[image:${(part.url as string | undefined) || 'unknown'}]`;
        }
        if (part.type === 'audio') {
          return `[audio:${(part.url as string | undefined) || 'unknown'}]`;
        }
        return '';
      })
      .join(' ')
      .trim();
  }
}
