import { Injectable, Logger } from '@nestjs/common';
import { LLMProviderRegistry } from '../../providers/llm/llm-provider.registry';
import { ModelCapabilities } from '../../providers/llm/llm-provider.interface';

const DEFAULT_CAPABILITIES: ModelCapabilities = {
  maxTokens: 8192,
  maxOutputTokens: 2048,
  supportsStreaming: true,
  supportsTools: false,
  supportsVision: false,
  supportsAudio: false,
  supportedModalities: ['text'],
  pricing: {
    inputTokensPerMillion: 3.0,
    outputTokensPerMillion: 9.0,
  },
};

@Injectable()
export class ModelCapabilitiesRegistry {
  private readonly logger = new Logger(ModelCapabilitiesRegistry.name);

  constructor(private readonly providerRegistry: LLMProviderRegistry) {}

  getCapabilities(model: string, providerName?: string): ModelCapabilities {
    try {
      const provider = providerName
        ? this.providerRegistry.getProvider(providerName)
        : this.providerRegistry.getProviderForModel(model);

      return provider.getModelCapabilities(model);
    } catch (error) {
      this.logger.warn(
        `Falling back to default model capabilities for model=${model}: ${String(
          (error as Error)?.message || error,
        )}`,
      );
      return DEFAULT_CAPABILITIES;
    }
  }
}
