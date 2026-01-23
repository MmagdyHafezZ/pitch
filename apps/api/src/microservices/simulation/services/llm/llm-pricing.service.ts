import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

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

@Injectable()
export class LLMPricingService {
  private readonly logger = new Logger(LLMPricingService.name);
  private readonly cacheTtlMs: number;
  private readonly pricingCache = new Map<string, PricingCacheEntry>();
  private refreshPromise: Promise<void> | null = null;

  constructor(private readonly configService: ConfigService) {
    const ttlSeconds = Number(
      this.configService.get('LLM_PRICING_CACHE_TTL_SECONDS') ?? '21600',
    );
    this.cacheTtlMs = Number.isFinite(ttlSeconds)
      ? ttlSeconds * 1000
      : 21600 * 1000;
  }

  getPricing(provider: string, model: string): ModelPricing | undefined {
    void this.refreshIfNeeded();
    const cached = this.pricingCache.get(provider.toLowerCase());
    return cached?.pricing.get(model);
  }

  async refreshIfNeeded(): Promise<void> {
    if (this.refreshPromise) {
      await this.refreshPromise;
      return;
    }

    const now = Date.now();
    const stale = Array.from(this.pricingCache.values()).some(
      (entry) => now - entry.fetchedAt > this.cacheTtlMs,
    );

    if (!stale && this.pricingCache.size > 0) {
      return;
    }

    this.refreshPromise = this.refreshAll().finally(() => {
      this.refreshPromise = null;
    });

    await this.refreshPromise;
  }

  private async refreshAll(): Promise<void> {
    const openaiUrl = this.configService.get<string>('OPENAI_PRICING_URL');
    const watsonxUrl = this.configService.get<string>('WATSONX_PRICING_URL');

    await Promise.all([
      openaiUrl
        ? this.refreshProvider('openai', openaiUrl, this.buildHeaders('OPENAI'))
        : Promise.resolve(),
      watsonxUrl
        ? this.refreshProvider(
            'watsonx',
            watsonxUrl,
            this.buildHeaders('WATSONX'),
          )
        : Promise.resolve(),
    ]);
  }

  private buildHeaders(prefix: 'OPENAI' | 'WATSONX'): Record<string, string> {
    const apiKey = this.configService.get<string>(`${prefix}_PRICING_API_KEY`);
    const authHeader = this.configService.get<string>(
      `${prefix}_PRICING_AUTH_HEADER`,
    );
    const headers: Record<string, string> = {
      Accept: 'application/json',
    };

    if (authHeader) {
      headers.Authorization = authHeader;
      return headers;
    }

    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
    }

    return headers;
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

      const payload = await response.json();
      const pricing = this.parsePricingPayload(payload);
      if (pricing.size === 0) {
        this.logger.warn(`Pricing API returned no models for ${provider}`);
      }

      this.pricingCache.set(provider.toLowerCase(), {
        pricing,
        fetchedAt: Date.now(),
      });
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
        pricing.promptPer1M,
    );
    const output = this.readNumber(
      pricing.outputTokensPerMillion ??
        pricing.outputPer1M ??
        pricing.completionTokensPerMillion ??
        pricing.completionPer1M,
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
}
