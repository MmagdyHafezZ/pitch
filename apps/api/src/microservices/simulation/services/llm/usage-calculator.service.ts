import { Injectable } from '@nestjs/common';
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
  constructor(
    private readonly capabilitiesRegistry: ModelCapabilitiesRegistry,
  ) {}

  normalizeUsage(input: UsageCalculationInput): LLMUsageDto {
    const capabilities = this.capabilitiesRegistry.getCapabilities(
      input.model,
      input.providerName,
    );

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

    const costUsd =
      input.providerUsage?.costUsd ??
      this.calculateCost(promptTokens, completionTokens, capabilities);

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
  ): number {
    const inputCost =
      (promptTokens / 1_000_000) * capabilities.pricing.inputTokensPerMillion;
    const outputCost =
      (completionTokens / 1_000_000) *
      capabilities.pricing.outputTokensPerMillion;
    return inputCost + outputCost;
  }
}
