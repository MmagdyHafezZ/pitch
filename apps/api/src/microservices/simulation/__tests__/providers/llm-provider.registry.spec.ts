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

  it('returns the preferred provider when it supports the model', () => {
    const registry = new LLMProviderRegistry();
    registry.register(openaiProvider);

    expect(registry.getProviderForModel('gpt-4', 'openai')).toBe(
      openaiProvider,
    );
  });

  it('throws when preferred provider does not support model', () => {
    const registry = new LLMProviderRegistry();
    registry.register(openaiProvider);

    expect(() => registry.getProviderForModel('granite-13b', 'openai')).toThrow(
      ProviderError,
    );
  });

  it('throws when provider is not registered', () => {
    const registry = new LLMProviderRegistry();

    expect(() => registry.getProvider('missing')).toThrow(ProviderError);
    expect(() => registry.getProviderForModel('gpt-4', 'missing')).toThrow(
      ProviderError,
    );
  });

  it('warns and overwrites when registering duplicates', () => {
    const registry = new LLMProviderRegistry();
    registry.register(openaiProvider);
    registry.register(openaiProvider);

    expect(registry.listProviders()).toEqual(['openai']);
  });

  it('uses cached provider for repeated model lookups', () => {
    const registry = new LLMProviderRegistry();
    const provider: ILLMProvider = {
      name: 'custom',
      supportsModel: jest.fn(() => true),
      complete: jest.fn(),
      stream: jest.fn() as any,
      validateConfig: jest.fn(),
      getModelCapabilities: () => capabilities,
    };

    registry.register(provider);

    expect(registry.getProviderForModel('custom-model').name).toBe('custom');
    expect(registry.getProviderForModel('custom-model').name).toBe('custom');
    expect(provider.supportsModel).toHaveBeenCalledTimes(1);
  });

  it('infers anthropic and azure providers from model names', () => {
    const registry = new LLMProviderRegistry();
    const anthropicProvider: ILLMProvider = {
      name: 'anthropic',
      supportsModel: () => true,
      complete: jest.fn(),
      stream: jest.fn() as any,
      validateConfig: jest.fn(),
      getModelCapabilities: () => capabilities,
    };
    const azureProvider: ILLMProvider = {
      name: 'azure',
      supportsModel: () => true,
      complete: jest.fn(),
      stream: jest.fn() as any,
      validateConfig: jest.fn(),
      getModelCapabilities: () => capabilities,
    };

    registry.register(anthropicProvider);
    registry.register(azureProvider);

    expect(registry.getProviderForModel('claude-3-opus').name).toBe(
      'anthropic',
    );
    expect(registry.getProviderForModel('azure-gpt-4').name).toBe('azure');
  });

  it('returns providers with requested capabilities', () => {
    const registry = new LLMProviderRegistry();
    const streamingProvider: ILLMProvider = {
      name: 'openai',
      supportsModel: () => true,
      complete: jest.fn(),
      stream: jest.fn() as any,
      validateConfig: jest.fn(),
      getModelCapabilities: () => ({
        ...capabilities,
        supportsStreaming: true,
      }),
    };
    const audioProvider: ILLMProvider = {
      name: 'watsonx',
      supportsModel: () => true,
      complete: jest.fn(),
      stream: jest.fn() as any,
      validateConfig: jest.fn(),
      getModelCapabilities: () => ({ ...capabilities, supportsAudio: true }),
    };
    const unknownProvider: ILLMProvider = {
      name: 'custom',
      supportsModel: () => true,
      complete: jest.fn(),
      stream: jest.fn() as any,
      validateConfig: jest.fn(),
      getModelCapabilities: () => ({
        ...capabilities,
        supportsStreaming: true,
      }),
    };

    registry.register(streamingProvider);
    registry.register(audioProvider);
    registry.register(unknownProvider);

    const streaming = registry.getProvidersWithCapability('streaming');
    const audio = registry.getProvidersWithCapability('audio');

    expect(streaming.map((p) => p.name)).toContain('openai');
    expect(audio.map((p) => p.name)).toContain('watsonx');
    expect(streaming.map((p) => p.name)).not.toContain('custom');
  });

  it('throws when no provider supports the model', () => {
    const registry = new LLMProviderRegistry();
    registry.register(openaiProvider);

    expect(() => registry.getProviderForModel('unknown-model')).toThrow(
      ProviderError,
    );
  });
});
