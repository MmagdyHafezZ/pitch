import { LLMProviderRegistry } from '../../providers/llm/llm-provider.registry';
import {
  ILLMProvider,
  ModelCapabilities,
  ProviderError,
} from '../../providers/llm/llm-provider.interface';

const capabilities: ModelCapabilities = {
  maxTokens: 2048,
  maxOutputTokens: 512,
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

const openaiProvider: ILLMProvider = {
  name: 'openai',
  supportsModel: (model) => model.startsWith('gpt-'),
  complete: jest.fn(),
  stream: jest.fn() as any,
  validateConfig: jest.fn(),
  getModelCapabilities: () => capabilities,
};

const watsonxProvider: ILLMProvider = {
  name: 'watsonx',
  supportsModel: (model) => model.includes('granite'),
  complete: jest.fn(),
  stream: jest.fn() as any,
  validateConfig: jest.fn(),
  getModelCapabilities: () => capabilities,
};

describe('LLMProviderRegistry', () => {
  it('registers and fetches providers', () => {
    const registry = new LLMProviderRegistry();
    registry.register(openaiProvider);

    expect(registry.hasProvider('openai')).toBe(true);
    expect(registry.listProviders()).toEqual(['openai']);
  });

  it('infers provider from model when preferred not supplied', () => {
    const registry = new LLMProviderRegistry();
    registry.register(openaiProvider);
    registry.register(watsonxProvider);

    expect(registry.getProviderForModel('gpt-4').name).toBe('openai');
    expect(registry.getProviderForModel('granite-13b').name).toBe('watsonx');
  });

  it('throws when preferred provider does not support model', () => {
    const registry = new LLMProviderRegistry();
    registry.register(openaiProvider);

    expect(() => registry.getProviderForModel('granite-13b', 'openai')).toThrow(
      ProviderError,
    );
  });
});
