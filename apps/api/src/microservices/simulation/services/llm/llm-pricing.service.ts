import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '@pitch/shared-backend/redis/index';
import { RedisKeys, RedisTTL } from '../redis/redis-key-patterns';

export type ModelPricing = {
  inputTokensPerMillion: number;
  outputTokensPerMillion: number;
  imageTokens?: number;
  audioSecondsToTokens?: number;
};

type PricingCacheEntry = {
  pricing: Map<string, ModelPricing>;
  fetchedAt: number;
};

type PricingCachePayload = {
  pricing: Record<string, ModelPricing>;
  fetchedAt: number;
};

/**
 * Helicone model registry — public, keyless, covers 111 models across all
 * major providers (OpenAI, Anthropic, Google, Mistral, DeepSeek, etc.).
 * Returns pricing as $/M tokens in `pricing.prompt` / `pricing.completion`.
 */
const HELICONE_REGISTRY_URL =
  'https://api.helicone.ai/v1/public/model-registry/models';

/**
 * Static pricing table — last-resort fallback for models not in Helicone
 * (primarily Watsonx when WATSONX_PRICING_URL is not configured).
 * Prefix matching is applied so versioned IDs resolve via base entry.
 */
const STATIC_PRICING: Readonly<Record<string, Record<string, ModelPricing>>> = {
  watsonx: {
    'ibm/granite-13b-chat-v2': {
      inputTokensPerMillion: 0.35,
      outputTokensPerMillion: 0.35,
    },
    'ibm/granite-20b-chat-v2': {
      inputTokensPerMillion: 0.7,
      outputTokensPerMillion: 0.7,
    },
    'ibm/granite-34b-code-instruct': {
      inputTokensPerMillion: 0.7,
      outputTokensPerMillion: 0.7,
    },
    'meta-llama/llama-3-8b-instruct': {
      inputTokensPerMillion: 0.4,
      outputTokensPerMillion: 0.4,
    },
    'meta-llama/llama-3-70b-instruct': {
      inputTokensPerMillion: 2.4,
      outputTokensPerMillion: 2.4,
    },
    'mistralai/mixtral-8x7b-instruct-v01': {
      inputTokensPerMillion: 1.6,
      outputTokensPerMillion: 1.6,
    },
  },
};

@Injectable()
export class LLMPricingService {
  private readonly logger = new Logger(LLMPricingService.name);
  private readonly cacheTtlMs: number;
  private readonly cacheTtlSeconds: number;
  private readonly pricingCache = new Map<string, PricingCacheEntry>();
  private refreshPromise: Promise<void> | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {
    const ttlSeconds = Number(
      this.configService.get('LLM_PRICING_CACHE_TTL_SECONDS') ??
        RedisTTL.LLM_PRICING,
    );
    this.cacheTtlSeconds = Number.isFinite(ttlSeconds)
      ? ttlSeconds
      : RedisTTL.LLM_PRICING;
    this.cacheTtlMs = this.cacheTtlSeconds * 1000;
  }

  getPricing(provider: string, model: string): ModelPricing | undefined {
    const providerKey = provider.toLowerCase();
    const cached = this.pricingCache.get(providerKey);
    if (!cached || Date.now() - cached.fetchedAt > this.cacheTtlMs) {
      void this.refreshIfNeeded();
    }
    // Live data from external URL takes precedence; fall back to static table.
    return cached?.pricing.get(model) ?? this.getStaticPricing(provider, model);
  }

  /**
   * Look up pricing from the embedded static table.
   * Tries an exact model-ID match first, then longest-prefix match so that
   * versioned IDs like `gpt-4o-2024-08-06` resolve to the `gpt-4o` entry.
   */
  private getStaticPricing(
    provider: string,
    model: string,
  ): ModelPricing | undefined {
    const table = STATIC_PRICING[provider.toLowerCase()];
    if (!table) return undefined;

    if (table[model]) return table[model];

    let best: ModelPricing | undefined;
    let bestLen = 0;
    for (const [key, pricing] of Object.entries(table)) {
      if (model.startsWith(key) && key.length > bestLen) {
        best = pricing;
        bestLen = key.length;
      }
    }
    return best;
  }

  async refreshIfNeeded(): Promise<void> {
    if (this.refreshPromise) {
      await this.refreshPromise;
      return;
    }

    this.refreshPromise = (async () => {
      const now = Date.now();

      // Use '_helicone' as the sentinel for all Helicone-covered providers,
      // and 'watsonx' separately for the dedicated-URL path.
      const sentinels = ['_helicone', 'watsonx'];
      const entries = await Promise.all(
        sentinels.map((key) => this.loadProviderCache(key)),
      );
      const stale = sentinels.some((_, index) => {
        const entry = entries[index];
        return !entry || now - entry.fetchedAt > this.cacheTtlMs;
      });

      if (!stale) {
        return;
      }

      await this.refreshProviders([]);
    })().finally(() => {
      this.refreshPromise = null;
    });

    await this.refreshPromise;
  }

  private async refreshProviders(_providers: string[]): Promise<void> {
    // Helicone covers openai, anthropic, google, mistral, deepseek, xai, etc.
    await this.refreshFromHelicone();

    // Watsonx is not in Helicone — use dedicated URL if configured
    const watsonxUrl = this.configService.get<string>('WATSONX_PRICING_URL');
    if (watsonxUrl) {
      const apiKey = this.configService.get<string>('WATSONX_PRICING_API_KEY');
      const authHeader = this.configService.get<string>(
        'WATSONX_PRICING_AUTH_HEADER',
      );
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (authHeader) headers.Authorization = authHeader;
      else if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
      await this.refreshProvider('watsonx', watsonxUrl, headers);
    }
  }

  /**
   * Fetch the Helicone model registry and populate per-provider caches.
   * Covers 100+ models across OpenAI, Anthropic, Google, Mistral, DeepSeek, xAI, etc.
   * No API key required.
   */
  private async refreshFromHelicone(): Promise<void> {
    try {
      const response = await fetch(HELICONE_REGISTRY_URL, {
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) {
        this.logger.warn(
          `Helicone registry returned ${response.status} ${response.statusText}`,
        );
        return;
      }

      const payload: unknown = await response.json();
      const providerMaps = this.parseHeliconeRegistry(payload);
      const fetchedAt = Date.now();

      for (const [provider, pricing] of Object.entries(providerMaps)) {
        this.pricingCache.set(provider, { pricing, fetchedAt });
        await this.redisService.set(
          this.pricingCacheKey(provider),
          {
            pricing: this.mapToRecord(pricing),
            fetchedAt,
          } satisfies PricingCachePayload,
          { ttl: this.cacheTtlSeconds },
        );
      }

      // Write staleness sentinel so refreshIfNeeded() can detect expiry
      this.pricingCache.set('_helicone', {
        pricing: new Map(),
        fetchedAt,
      });
      await this.redisService.set(
        this.pricingCacheKey('_helicone'),
        { pricing: {}, fetchedAt } satisfies PricingCachePayload,
        { ttl: this.cacheTtlSeconds },
      );

      this.logger.log(
        `Helicone pricing refreshed: ${Object.keys(providerMaps).length} providers, ` +
          `${Object.values(providerMaps).reduce((s, m) => s + m.size, 0)} models`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to refresh Helicone pricing: ${String((error as Error)?.message ?? error)}`,
      );
    }
  }

  /**
   * Parse the Helicone model registry response into a per-provider pricing map.
   * Each model may have multiple provider endpoints; we index by both the
   * canonical model ID and the provider-specific providerModelId.
   */
  private parseHeliconeRegistry(
    payload: unknown,
  ): Record<string, Map<string, ModelPricing>> {
    const maps: Record<string, Map<string, ModelPricing>> = {};
    if (!payload || typeof payload !== 'object') return maps;

    const root = payload as { data?: { models?: unknown[] } };
    const models = Array.isArray(root.data?.models) ? root.data.models : [];

    for (const model of models) {
      if (!model || typeof model !== 'object') continue;
      const m = model as {
        id?: string;
        endpoints?: Array<{
          provider?: string;
          pricing?: unknown;
          endpoint?: { providerModelId?: string };
        }>;
      };
      const modelId = m.id;
      if (!modelId || !Array.isArray(m.endpoints)) continue;

      for (const ep of m.endpoints) {
        const provider = ep.provider?.toLowerCase();
        if (!provider) continue;

        const pricing = this.normalizePricing(ep.pricing);
        if (!pricing) continue;

        maps[provider] ??= new Map();
        maps[provider].set(modelId, pricing);

        // Also index the provider-specific model ID (e.g. "gpt-4o-2024-08-06")
        const providerModelId = ep.endpoint?.providerModelId;
        if (providerModelId && providerModelId !== modelId) {
          maps[provider].set(providerModelId, pricing);
        }
      }
    }

    return maps;
  }

  private async refreshProvider(
    provider: string,
    url: string,
    headers: Record<string, string>,
  ): Promise<void> {
    try {
      const response = await fetch(url, { headers });
      if (!response.ok) {
        this.logger.warn(
          `Pricing API error for ${provider}: ${response.status} ${response.statusText}`,
        );
        return;
      }

      const payload: unknown = await response.json();
      const pricing = this.parsePricingPayload(payload);
      if (pricing.size === 0) {
        this.logger.warn(`Pricing API returned no models for ${provider}`);
      }

      const fetchedAt = Date.now();
      this.pricingCache.set(provider.toLowerCase(), {
        pricing,
        fetchedAt,
      });
      await this.redisService.set(
        this.pricingCacheKey(provider),
        {
          pricing: this.mapToRecord(pricing),
          fetchedAt,
        } satisfies PricingCachePayload,
        { ttl: this.cacheTtlSeconds },
      );
    } catch (error) {
      this.logger.error(
        `Failed to refresh ${provider} pricing: ${String(
          (error as Error)?.message ?? error,
        )}`,
      );
    }
  }

  private parsePricingPayload(payload: unknown): Map<string, ModelPricing> {
    const map = new Map<string, ModelPricing>();
    if (!payload || typeof payload !== 'object') {
      return map;
    }

    const data = payload as {
      models?: unknown;
      data?: unknown;
      pricing?: unknown;
    };

    const items = Array.isArray(data.models)
      ? data.models
      : Array.isArray(data.data)
        ? data.data
        : [];

    for (const item of items) {
      if (!item || typeof item !== 'object') continue;
      const entry = item as Record<string, unknown>;
      const modelId =
        (entry.id as string | undefined) ??
        (entry.model as string | undefined) ??
        (entry.name as string | undefined);
      if (!modelId) continue;

      const pricing = this.normalizePricing(entry.pricing ?? entry);
      if (!pricing) continue;

      map.set(modelId, pricing);
    }

    if (data.pricing && typeof data.pricing === 'object') {
      const pricingEntries = data.pricing as Record<string, unknown>;
      for (const [modelId, value] of Object.entries(pricingEntries)) {
        const pricing = this.normalizePricing(value);
        if (!pricing) continue;
        map.set(modelId, pricing);
      }
    }

    return map;
  }

  private normalizePricing(value: unknown): ModelPricing | null {
    if (!value || typeof value !== 'object') {
      return null;
    }

    const pricing = value as Record<string, unknown>;
    const input = this.readNumber(
      pricing.inputTokensPerMillion ??
        pricing.inputPer1M ??
        pricing.promptTokensPerMillion ??
        pricing.promptPer1M ??
        pricing.prompt, // Helicone field name
    );
    const output = this.readNumber(
      pricing.outputTokensPerMillion ??
        pricing.outputPer1M ??
        pricing.completionTokensPerMillion ??
        pricing.completionPer1M ??
        pricing.completion, // Helicone field name
    );

    if (input == null && output == null) {
      return null;
    }

    const imageTokens = this.readNumber(pricing.imageTokens);
    const audioSecondsToTokens = this.readNumber(pricing.audioSecondsToTokens);

    return {
      inputTokensPerMillion: input ?? 0,
      outputTokensPerMillion: output ?? 0,
      imageTokens: imageTokens ?? undefined,
      audioSecondsToTokens: audioSecondsToTokens ?? undefined,
    };
  }

  private readNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string' && value.trim() !== '') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  }

  private pricingCacheKey(provider: string): string {
    return RedisKeys.llmPricing(provider.toLowerCase());
  }

  private async loadProviderCache(
    provider: string,
  ): Promise<PricingCacheEntry | null> {
    const key = provider.toLowerCase();
    const cached = this.pricingCache.get(key);
    if (cached && Date.now() - cached.fetchedAt <= this.cacheTtlMs) {
      return cached;
    }

    const stored = await this.redisService.get<PricingCachePayload>(
      this.pricingCacheKey(key),
    );
    if (stored?.pricing && typeof stored.pricing === 'object') {
      const entry: PricingCacheEntry = {
        pricing: this.recordToMap(stored.pricing),
        fetchedAt: stored.fetchedAt,
      };
      this.pricingCache.set(key, entry);
      return entry;
    }

    return cached ?? null;
  }

  private mapToRecord(
    pricing: Map<string, ModelPricing>,
  ): Record<string, ModelPricing> {
    const record: Record<string, ModelPricing> = {};
    for (const [model, value] of pricing.entries()) {
      record[model] = value;
    }
    return record;
  }

  private recordToMap(
    pricing: Record<string, ModelPricing>,
  ): Map<string, ModelPricing> {
    const map = new Map<string, ModelPricing>();
    for (const [model, value] of Object.entries(pricing)) {
      if (!value || typeof value !== 'object') continue;
      map.set(model, value);
    }
    return map;
  }
}
