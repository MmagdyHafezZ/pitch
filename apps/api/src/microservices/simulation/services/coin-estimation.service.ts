import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LLMPricingService } from './llm/llm-pricing.service';

/**
 * Tokens-per-minute model used to estimate session cost.
 * Voice/video sessions are more terse; text sessions allow longer replies.
 */
const TOKENS_PER_MINUTE: Record<
  string,
  { turnsPerMin: number; avgInputTokens: number; avgOutputTokens: number }
> = {
  voice: { turnsPerMin: 3, avgInputTokens: 400, avgOutputTokens: 100 },
  video: { turnsPerMin: 3, avgInputTokens: 400, avgOutputTokens: 100 },
  phone: { turnsPerMin: 3, avgInputTokens: 400, avgOutputTokens: 100 },
  text: { turnsPerMin: 2, avgInputTokens: 600, avgOutputTokens: 220 },
};

const DEFAULT_SESSION_DURATION_MINUTES: Record<string, number> = {
  voice: 15,
  video: 15,
  phone: 15,
  text: 20,
};

/** Fallback pricing when Helicone hasn't loaded yet (cheap baseline). */
const FALLBACK_INPUT_PRICE_PER_M = 0.5;
const FALLBACK_OUTPUT_PRICE_PER_M = 1.5;

export interface CoinEstimate {
  estimatedCoins: number;
  estimatedCostUsd: number;
  coinPriceUsd: number;
  markupMultiplier: number;
  model: string;
  provider: string;
  durationMinutes: number;
}

@Injectable()
export class CoinEstimationService {
  private readonly logger = new Logger(CoinEstimationService.name);

  constructor(
    private readonly pricingService: LLMPricingService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Estimate coins required for a session BEFORE it starts.
   *
   * Formula:
   *   rawCostUsd = (inputTokens / 1M × inputPrice) + (outputTokens / 1M × outputPrice)
   *   effectiveCostUsd = rawCostUsd × markupMultiplier
   *   estimatedCoins = ceil(effectiveCostUsd / coinPriceUsd)
   *
   * The markup covers infrastructure overhead, TTS costs, and service margin.
   */
  async estimate(args: {
    model: string;
    provider?: string;
    sessionType: string;
    durationMinutes?: number;
  }): Promise<CoinEstimate> {
    // Pre-warm pricing cache so getPricing() has live data
    await this.pricingService.refreshIfNeeded();

    const provider = (args.provider ?? 'openai').toLowerCase();
    const model = args.model;
    const sessionType = args.sessionType?.toLowerCase() ?? 'text';

    const tpm = TOKENS_PER_MINUTE[sessionType] ?? TOKENS_PER_MINUTE.text;
    const durationMinutes =
      args.durationMinutes ??
      DEFAULT_SESSION_DURATION_MINUTES[sessionType] ??
      15;

    const totalInputTokens =
      tpm.turnsPerMin * durationMinutes * tpm.avgInputTokens;
    const totalOutputTokens =
      tpm.turnsPerMin * durationMinutes * tpm.avgOutputTokens;

    const pricing = this.pricingService.getPricing(provider, model);
    const inputPricePerM =
      (pricing?.inputTokensPerMillion ?? 0) > 0
        ? pricing!.inputTokensPerMillion
        : FALLBACK_INPUT_PRICE_PER_M;
    const outputPricePerM =
      (pricing?.outputTokensPerMillion ?? 0) > 0
        ? pricing!.outputTokensPerMillion
        : FALLBACK_OUTPUT_PRICE_PER_M;

    const rawCostUsd =
      (totalInputTokens / 1_000_000) * inputPricePerM +
      (totalOutputTokens / 1_000_000) * outputPricePerM;

    const markupMultiplier = Number(
      this.config.get('COIN_MARKUP_MULTIPLIER') ?? 1.3,
    );
    const coinPriceUsd = Number(this.config.get('COIN_PRICE_USD') ?? 0.1);

    const effectiveCostUsd = rawCostUsd * markupMultiplier;
    // Minimum 1 coin so the reservation always exists (enables adjustment at end)
    const estimatedCoins = Math.max(
      1,
      Math.ceil(effectiveCostUsd / coinPriceUsd),
    );

    this.logger.debug(
      `Coin estimate: model=${provider}/${model} duration=${durationMinutes}m ` +
        `rawCost=$${rawCostUsd.toFixed(6)} markup=${markupMultiplier} ` +
        `effectiveCost=$${effectiveCostUsd.toFixed(6)} ` +
        `estimatedCoins=${estimatedCoins} coinPriceUsd=${coinPriceUsd}`,
    );

    return {
      estimatedCoins,
      estimatedCostUsd: effectiveCostUsd,
      coinPriceUsd,
      markupMultiplier,
      model,
      provider,
      durationMinutes,
    };
  }

  /**
   * Convert actual LLM cost (USD) to coins using the same markup.
   * Returns a signed delta: negative = refund, positive = extra charge.
   */
  costToSignedDelta(args: {
    actualCostUsd: number;
    estimatedCoins: number;
    coinPriceUsd: number;
    markupMultiplier?: number;
  }): number {
    const markup =
      args.markupMultiplier ??
      Number(this.config.get('COIN_MARKUP_MULTIPLIER') ?? 1.3);
    const effectiveActualCost = args.actualCostUsd * markup;
    const actualCoins = Math.ceil(effectiveActualCost / args.coinPriceUsd);
    return actualCoins - args.estimatedCoins;
  }
}
