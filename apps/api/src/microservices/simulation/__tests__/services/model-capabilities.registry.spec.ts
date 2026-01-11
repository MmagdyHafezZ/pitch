import { ModelCapabilitiesRegistry } from '../../services/llm/model-capabilities.registry';
import { LLMProviderRegistry } from '../../providers/llm/llm-provider.registry';
import {
  ILLMProvider,
  ModelCapabilities,
} from '../../providers/llm/llm-provider.interface';

const capabilities: ModelCapabilities = {
  maxTokens: 4096,
  maxOutputTokens: 1024,
  supportsStreaming: true,
  supportsTools: false,
  supportsVision: false,
  supportsAudio: false,
  supportedModalities: ['text'],
  pricing: {
    inputTokensPerMillion: 1,
    outputTokensPerMillion: 2,
  },
};

const provider: ILLMProvider = {
  name: 'stub',
  supportsModel: () => true,
  complete: jest.fn(),
  stream: jest.fn() as any,
  validateConfig: jest.fn(),
  getModelCapabilities: () => capabilities,
};

describe('ModelCapabilitiesRegistry', () => {
  it('returns provider capabilities when available', () => {
    const registry = new LLMProviderRegistry();
    registry.register(provider);
    const service = new ModelCapabilitiesRegistry(registry);

    const result = service.getCapabilities('stub-model', 'stub');

    expect(result.maxTokens).toBe(4096);
    expect(result.pricing.inputTokensPerMillion).toBe(1);
  });

  it('falls back to default when provider lookup fails', () => {
    const registry = new LLMProviderRegistry();
    const service = new ModelCapabilitiesRegistry(registry);

    const result = service.getCapabilities('unknown-model');

    expect(result.maxTokens).toBe(8192);
    expect(result.supportsStreaming).toBe(true);
  });
});
