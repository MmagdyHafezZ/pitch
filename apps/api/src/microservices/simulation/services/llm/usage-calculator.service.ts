import { Injectable, Logger } from '@nestjs/common';
import { LLMMessageDto, LLMUsageDto } from '../../dto/llm.dto';
import { ModelCapabilitiesRegistry } from './model-capabilities.registry';
import { ModelCapabilities } from '../../providers/llm/llm-provider.interface';

interface UsageCalculationInput {
  messages: LLMMessageDto[];
  responseText?: string;
  model: string;
  providerName?: string;
  providerUsage?: Partial<LLMUsageDto>;
}

@Injectable()
export class UsageCalculatorService {
  private readonly logger = new Logger(UsageCalculatorService.name);

  constructor(
    private readonly capabilitiesRegistry: ModelCapabilitiesRegistry,
  ) {}

  normalizeUsage(input: UsageCalculationInput): LLMUsageDto {
    const capabilities = this.capabilitiesRegistry.getCapabilities(
      input.model,
      input.providerName,
    );

    const tokenSource = {
      prompt:
        input.providerUsage?.promptTokens != null ? 'provider' : 'estimated',
      completion:
        input.providerUsage?.completionTokens != null
          ? 'provider'
          : 'estimated',
    };

    const promptTokens =
      input.providerUsage?.promptTokens ??
      this.estimatePromptTokens(input.messages, capabilities);

    const completionTokens =
      input.providerUsage?.completionTokens ??
      this.estimateTokens(input.responseText || '');

    const totalTokens =
      input.providerUsage?.totalTokens ?? promptTokens + completionTokens;

    const estimated =
      input.providerUsage?.estimated ??
      !(
        input.providerUsage?.promptTokens != null &&
        input.providerUsage?.completionTokens != null
      );

    const hasPricing = this.hasPricing(capabilities.pricing);
    const costUsd =
      input.providerUsage?.costUsd ??
      (hasPricing
        ? this.calculateCost(promptTokens, completionTokens, capabilities)
        : undefined);

    this.logger.debug(
      `[${input.providerName ?? 'unknown'}/${input.model}] ` +
        `prompt=${promptTokens}(${tokenSource.prompt}) ` +
        `completion=${completionTokens}(${tokenSource.completion}) ` +
        `total=${totalTokens} ` +
        `pricing=${hasPricing ? `in=$${capabilities.pricing.inputTokensPerMillion}/M out=$${capabilities.pricing.outputTokensPerMillion}/M` : 'none'} ` +
        `costUsd=${costUsd != null ? `$${costUsd.toFixed(6)}` : 'null (no pricing)'}`,
    );

    if (!hasPricing) {
      this.logger.warn(
        `No pricing data for model "${input.model}" (provider: ${input.providerName ?? 'unknown'}) — costUsd will be null, coin adjustment will refund full reservation`,
      );
    }

    return {
      promptTokens,
      completionTokens,
      totalTokens,
      costUsd,
      estimated,
    };
  }

  private estimatePromptTokens(
    messages: LLMMessageDto[],
    capabilities: ModelCapabilities,
  ): number {
    let tokens = 0;

    for (const message of messages) {
      if (typeof message.content === 'string') {
        tokens += this.estimateTokens(message.content);
        continue;
      }

      if (Array.isArray(message.content)) {
        for (const part of message.content) {
          if (part.type === 'text') {
            tokens += this.estimateTokens(part.text);
          } else if (part.type === 'image') {
            tokens += capabilities.pricing.imageTokens ?? 765;
          } else if (part.type === 'audio') {
            tokens += capabilities.pricing.audioSecondsToTokens ?? 0;
          }
        }
      }
    }

    return tokens;
  }

  private estimateTokens(text: string): number {
    if (!text) return 0;
    return Math.ceil(text.length / 4);
  }

  private calculateCost(
    promptTokens: number,
    completionTokens: number,
    capabilities: ModelCapabilities,
  ): number | undefined {
    if (!this.hasPricing(capabilities.pricing)) {
      return undefined;
    }
    const inputCost =
      (promptTokens / 1_000_000) * capabilities.pricing.inputTokensPerMillion;
    const outputCost =
      (completionTokens / 1_000_000) *
      capabilities.pricing.outputTokensPerMillion;
    const rawCost = inputCost + outputCost;
    const offsetPct = Number(process.env.DEFAULT_EXPENSES_OFFSET_PERCENT ?? 10);
    const finalCost = rawCost + rawCost * (offsetPct / 100);

    this.logger.debug(
      `calculateCost: input=$${inputCost.toFixed(6)} output=$${outputCost.toFixed(6)} ` +
        `raw=$${rawCost.toFixed(6)} offset=${offsetPct}% final=$${finalCost.toFixed(6)}`,
    );

    return finalCost;
  }

  private hasPricing(pricing: ModelCapabilities['pricing']): boolean {
    return (
      (pricing.inputTokensPerMillion ?? 0) > 0 ||
      (pricing.outputTokensPerMillion ?? 0) > 0
    );
  }
}
