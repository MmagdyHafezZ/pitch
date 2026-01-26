import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '@pitch/shared-backend/redis/index';
import { RedisKeys, RedisTTL } from '../redis/redis-key-patterns';

type CatalogCacheEntry = {
  models: string[];
  fetchedAt: number;
};

@Injectable()
export class LLMModelCatalogService {
  private readonly logger = new Logger(LLMModelCatalogService.name);
  private readonly cacheTtlMs: number;
  private readonly cacheTtlSeconds: number;
  private refreshPromise: Promise<void> | null = null;

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
        tasks.push(
          this.refreshProvider(
            'watsonx',
            watsonxRequest.url,
            watsonxRequest.headers,
            (payload) => this.parseWatsonxModels(payload),
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

      const payload = await response.json();
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

  private parseWatsonxModels(payload: unknown): string[] {
    if (!payload || typeof payload !== 'object') {
      return [];
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

    return items
      .map((item) => {
        if (!item || typeof item !== 'object') return undefined;
        const entry = item as Record<string, unknown>;
        return (
          (entry.model_id as string | undefined) ??
          (entry.modelId as string | undefined) ??
          (entry.id as string | undefined) ??
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
