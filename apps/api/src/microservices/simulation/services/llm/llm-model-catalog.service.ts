import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '@pitch/shared-backend/redis/index';
import { RedisKeys, RedisTTL } from '../redis/redis-key-patterns';

type CatalogCacheEntry = {
  models: string[];
  fetchedAt: number;
};

/**
 * Rich metadata parsed from the Watsonx /ml/v1/foundation_model_specs API.
 * Fields are optional because not every model record exposes all of them.
 */
export type WatsonxModelSpec = {
  /** Total context window (input + output) in tokens */
  maxSequenceLength?: number;
  /** Maximum tokens the model can generate in one response */
  maxOutputTokens?: number;
  /** Human-readable display label, e.g. "Granite 13B Chat v2" */
  label?: string;
  /** Supported task IDs, e.g. ["text_generation"] */
  tasks?: string[];
  /** Parameter count string, e.g. "13B" */
  numberParams?: string;
};

@Injectable()
export class LLMModelCatalogService {
  private readonly logger = new Logger(LLMModelCatalogService.name);
  private readonly cacheTtlMs: number;
  private readonly cacheTtlSeconds: number;
  private refreshPromise: Promise<void> | null = null;

  /**
   * In-memory Watsonx model specs populated when the catalog is refreshed.
   * Accessed synchronously by WatsonxProvider.getModelCapabilities().
   */
  private readonly watsonxSpecsCache = new Map<string, WatsonxModelSpec>();

  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {
    const ttlSeconds = Number(
      this.configService.get('LLM_MODEL_CATALOG_CACHE_TTL_SECONDS') ??
        RedisTTL.LLM_MODEL_CATALOG,
    );
    this.cacheTtlSeconds = Number.isFinite(ttlSeconds)
      ? ttlSeconds
      : RedisTTL.LLM_MODEL_CATALOG;
    this.cacheTtlMs = this.cacheTtlSeconds * 1000;
  }

  /**
   * Returns the cached Watsonx model spec for the given model ID.
   * Returns null if the catalog has not been loaded yet or the model is unknown.
   * This method is synchronous so providers can call it inside getModelCapabilities().
   */
  getWatsonxModelSpec(modelId: string): WatsonxModelSpec | null {
    return this.watsonxSpecsCache.get(modelId) ?? null;
  }

  async listModels(provider: string): Promise<string[]> {
    const entry = await this.loadProviderCache(provider);
    const isStale = !entry || Date.now() - entry.fetchedAt > this.cacheTtlMs;
    if (isStale) {
      await this.refreshIfNeeded();
      const refreshed = await this.loadProviderCache(provider);
      return refreshed?.models ?? entry?.models ?? [];
    }
    return entry.models;
  }

  async refreshIfNeeded(): Promise<void> {
    if (this.refreshPromise) {
      await this.refreshPromise;
      return;
    }

    this.refreshPromise = (async () => {
      const providers = ['openai', 'watsonx'];
      const now = Date.now();
      const entries = await Promise.all(
        providers.map((provider) => this.loadProviderCache(provider)),
      );
      const staleProviders = providers.filter((provider, index) => {
        const entry = entries[index];
        if (!entry) return true;
        return now - entry.fetchedAt > this.cacheTtlMs;
      });

      if (staleProviders.length === 0) {
        return;
      }

      await this.refreshProviders(staleProviders);
    })().finally(() => {
      this.refreshPromise = null;
    });

    await this.refreshPromise;
  }

  private async refreshProviders(providers: string[]): Promise<void> {
    const tasks: Promise<void>[] = [];
    if (providers.includes('openai')) {
      const openaiRequest = this.buildOpenAiRequest();
      if (openaiRequest) {
        tasks.push(
          this.refreshProvider(
            'openai',
            openaiRequest.url,
            openaiRequest.headers,
            (payload) => this.parseOpenAiModels(payload),
          ),
        );
      }
    }
    if (providers.includes('watsonx')) {
      const watsonxRequest = await this.buildWatsonxRequest();
      if (watsonxRequest) {
        // Watsonx gets its own refresh path so we can also parse model specs.
        tasks.push(
          this.refreshWatsonxProvider(
            watsonxRequest.url,
            watsonxRequest.headers,
          ),
        );
      }
    }

    await Promise.all(tasks);
  }

  private buildOpenAiRequest(): {
    url: string;
    headers: Record<string, string>;
  } | null {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    const authHeader = this.configService.get<string>(
      'OPENAI_MODELS_AUTH_HEADER',
    );
    const url =
      this.configService.get<string>('OPENAI_MODELS_URL') ||
      'https://api.openai.com/v1/models';

    const headers: Record<string, string> = {
      Accept: 'application/json',
    };

    if (authHeader) {
      headers.Authorization = authHeader;
    } else if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
    }

    if (!headers.Authorization) {
      this.logger.warn('OpenAI model catalog skipped: missing API key');
      return null;
    }

    return { url, headers };
  }

  private async buildWatsonxRequest(): Promise<{
    url: string;
    headers: Record<string, string>;
  } | null> {
    const urlOverride = this.configService.get<string>(
      'WATSONX_MODEL_SPECS_URL',
    );
    const baseUrl =
      this.configService.get<string>('WATSONX_URL') ||
      'https://us-south.ml.cloud.ibm.com';
    const version =
      this.configService.get<string>('WATSONX_MODEL_SPECS_VERSION') ||
      '2024-05-01';
    const url =
      urlOverride ||
      `${baseUrl.replace(/\/$/, '')}/ml/v1/foundation_model_specs?version=${version}`;

    const headers: Record<string, string> = {
      Accept: 'application/json',
    };

    const authHeader = this.configService.get<string>(
      'WATSONX_MODEL_SPECS_AUTH_HEADER',
    );
    if (authHeader) {
      headers.Authorization = authHeader;
      return { url, headers };
    }

    const token = await this.getWatsonxAccessToken();
    if (!token) {
      this.logger.warn('Watsonx model catalog skipped: missing API key');
      return null;
    }

    headers.Authorization = `Bearer ${token}`;
    return { url, headers };
  }

  private async refreshProvider(
    provider: string,
    url: string,
    headers: Record<string, string>,
    parser: (payload: unknown) => string[],
  ): Promise<void> {
    try {
      const response = await fetch(url, { headers });
      if (!response.ok) {
        this.logger.warn(
          `Model catalog error for ${provider}: ${response.status} ${response.statusText}`,
        );
        return;
      }

      const payload: unknown = await response.json();
      const models = this.normalizeModels(parser(payload));
      if (models.length === 0) {
        this.logger.warn(`Model catalog returned no models for ${provider}`);
      }

      const fetchedAt = Date.now();
      await this.redisService.set(
        this.catalogCacheKey(provider),
        {
          models,
          fetchedAt,
        } satisfies CatalogCacheEntry,
        { ttl: this.cacheTtlSeconds },
      );
    } catch (error) {
      this.logger.error(
        `Failed to refresh ${provider} model catalog: ${String(
          (error as Error)?.message ?? error,
        )}`,
      );
    }
  }

  /**
   * Watsonx-specific refresh: fetches /ml/v1/foundation_model_specs, stores
   * model IDs in the Redis catalog cache, and also populates the in-memory
   * specs cache with token-limit metadata for each model.
   */
  private async refreshWatsonxProvider(
    url: string,
    headers: Record<string, string>,
  ): Promise<void> {
    try {
      const response = await fetch(url, { headers });
      if (!response.ok) {
        this.logger.warn(
          `Model catalog error for watsonx: ${response.status} ${response.statusText}`,
        );
        return;
      }

      const payload: unknown = await response.json();
      const { models, specs } = this.parseWatsonxPayload(payload);
      const normalizedModels = this.normalizeModels(models);

      if (normalizedModels.length === 0) {
        this.logger.warn(`Model catalog returned no models for watsonx`);
      }

      // Persist model IDs to Redis (same as the generic path)
      const fetchedAt = Date.now();
      await this.redisService.set(
        this.catalogCacheKey('watsonx'),
        { models: normalizedModels, fetchedAt } satisfies CatalogCacheEntry,
        { ttl: this.cacheTtlSeconds },
      );

      // Store specs in-memory (not persisted to Redis — cheap to re-derive)
      this.watsonxSpecsCache.clear();
      for (const [modelId, spec] of specs.entries()) {
        this.watsonxSpecsCache.set(modelId, spec);
      }

      this.logger.log(
        `Watsonx catalog refreshed: ${normalizedModels.length} models, ` +
          `${specs.size} specs loaded`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to refresh watsonx model catalog: ${String(
          (error as Error)?.message ?? error,
        )}`,
      );
    }
  }

  /**
   * Parse the Watsonx foundation_model_specs response, extracting both model
   * IDs and rich model metadata (token limits, tasks, etc.).
   */
  private parseWatsonxPayload(payload: unknown): {
    models: string[];
    specs: Map<string, WatsonxModelSpec>;
  } {
    const models: string[] = [];
    const specs = new Map<string, WatsonxModelSpec>();

    if (!payload || typeof payload !== 'object') {
      return { models, specs };
    }

    const data = payload as {
      resources?: unknown;
      data?: unknown;
      models?: unknown;
      results?: unknown;
    };

    const items = Array.isArray(data.resources)
      ? data.resources
      : Array.isArray(data.data)
        ? data.data
        : Array.isArray(data.models)
          ? data.models
          : Array.isArray(data.results)
            ? data.results
            : [];

    for (const item of items) {
      if (!item || typeof item !== 'object') continue;
      const entry = item as Record<string, unknown>;

      const modelId =
        (entry.model_id as string | undefined) ??
        (entry.modelId as string | undefined) ??
        (entry.id as string | undefined) ??
        (entry.name as string | undefined);

      if (!modelId) continue;
      models.push(modelId);

      // Parse rich spec data from model_limits
      const spec: WatsonxModelSpec = {};

      const limits = entry.model_limits as Record<string, unknown> | undefined;
      if (limits && typeof limits === 'object') {
        const maxSeq = limits.max_sequence_length ?? limits.maxSequenceLength;
        if (typeof maxSeq === 'number' && maxSeq > 0) {
          spec.maxSequenceLength = maxSeq;
        }
        const maxOut = limits.max_output_tokens ?? limits.maxOutputTokens;
        if (typeof maxOut === 'number' && maxOut > 0) {
          spec.maxOutputTokens = maxOut;
        }
      }

      if (typeof entry.label === 'string') {
        spec.label = entry.label;
      }

      if (typeof entry.number_params === 'string') {
        spec.numberParams = entry.number_params;
      }

      const supportedTasks = entry.supported_tasks;
      if (Array.isArray(supportedTasks)) {
        spec.tasks = supportedTasks
          .map((t: unknown) => {
            if (!t || typeof t !== 'object') return undefined;
            return (t as Record<string, unknown>).id as string | undefined;
          })
          .filter((id): id is string => Boolean(id));
      }

      specs.set(modelId, spec);
    }

    return { models, specs };
  }

  private parseOpenAiModels(payload: unknown): string[] {
    if (!payload || typeof payload !== 'object') {
      return [];
    }

    const data = payload as {
      data?: unknown;
      models?: unknown;
    };

    const items = Array.isArray(data.data)
      ? data.data
      : Array.isArray(data.models)
        ? data.models
        : [];

    return items
      .map((item) => {
        if (!item || typeof item !== 'object') return undefined;
        const entry = item as Record<string, unknown>;
        return (
          (entry.id as string | undefined) ??
          (entry.model as string | undefined) ??
          (entry.name as string | undefined)
        );
      })
      .filter((value): value is string => Boolean(value));
  }

  private catalogCacheKey(provider: string): string {
    return RedisKeys.llmCatalog(provider.toLowerCase());
  }

  private async loadProviderCache(
    provider: string,
  ): Promise<CatalogCacheEntry | null> {
    return (
      (await this.redisService.get<CatalogCacheEntry>(
        this.catalogCacheKey(provider),
      )) ?? null
    );
  }

  private normalizeModels(models: string[]): string[] {
    return Array.from(new Set(models)).sort();
  }

  private async getWatsonxAccessToken(): Promise<string | null> {
    const apiKey = this.configService.get<string>('WATSONX_API_KEY');
    if (!apiKey) {
      return null;
    }

    const cachedToken = await this.redisService.get<string>(
      RedisKeys.llmAuthToken('watsonx'),
    );
    if (cachedToken) {
      return cachedToken;
    }

    try {
      const response = await fetch('https://iam.cloud.ibm.com/identity/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'urn:ibm:params:oauth:grant-type:apikey',
          apikey: apiKey,
        }),
      });

      if (!response.ok) {
        this.logger.warn(
          `Watsonx IAM token error: ${response.status} ${response.statusText}`,
        );
        return null;
      }

      const payload = (await response.json()) as {
        access_token?: string;
        expires_in?: number;
      };

      if (!payload.access_token) {
        return null;
      }

      const expiresIn = payload.expires_in ?? 3600;
      const ttlSeconds = Math.max(expiresIn - 300, 60);
      await this.redisService.set(
        RedisKeys.llmAuthToken('watsonx'),
        payload.access_token,
        { ttl: ttlSeconds },
      );
      return payload.access_token;
    } catch (error) {
      this.logger.warn(
        `Failed to fetch Watsonx IAM token: ${String(
          (error as Error)?.message ?? error,
        )}`,
      );
      return null;
    }
  }
}
