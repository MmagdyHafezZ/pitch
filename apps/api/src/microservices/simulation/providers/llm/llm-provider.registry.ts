import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ILLMProvider, ProviderError } from './llm-provider.interface';

/**
 * LLM Provider Registry
 * Manages all registered LLM providers and routes requests to the appropriate provider
 */
@Injectable()
export class LLMProviderRegistry implements OnModuleInit {
  private readonly logger = new Logger(LLMProviderRegistry.name);
  private readonly providers = new Map<string, ILLMProvider>();
  private readonly modelToProvider = new Map<string, string>();

  onModuleInit() {
    this.logger.log(`Initialized with ${this.providers.size} LLM providers`);
    for (const [name] of this.providers.entries()) {
      this.logger.log(`  - ${name}`);
    }
  }

  /**
   * Register a provider
   * Should be called during module initialization
   */
  register(provider: ILLMProvider): void {
    if (this.providers.has(provider.name)) {
      this.logger.warn(
        `Provider ${provider.name} already registered, overwriting`,
      );
    }
    this.providers.set(provider.name, provider);
    this.logger.log(`Registered LLM provider: ${provider.name}`);
  }

  /**
   * Get a provider by name
   * Throws if provider not found
   */
  getProvider(name: string): ILLMProvider {
    const provider = this.providers.get(name.toLowerCase());
    if (!provider) {
      throw new ProviderError(
        name,
        'PROVIDER_NOT_FOUND',
        `Provider "${name}" is not registered. Available providers: ${Array.from(this.providers.keys()).join(', ')}`,
      );
    }
    return provider;
  }

  /**
   * Get a provider that supports a specific model
   * Tries to infer provider from model name if not explicitly specified
   */
  getProviderForModel(model: string, preferredProvider?: string): ILLMProvider {
    if (preferredProvider) {
      const provider = this.getProvider(preferredProvider);
      if (!provider.supportsModel(model)) {
        throw new ProviderError(
          preferredProvider,
          'MODEL_NOT_SUPPORTED',
          `Provider "${preferredProvider}" does not support model "${model}"`,
        );
      }
      return provider;
    }

    const cachedProvider = this.modelToProvider.get(model);
    if (cachedProvider) {
      return this.getProvider(cachedProvider);
    }

    const inferredProvider = this.inferProviderFromModel(model);
    if (inferredProvider) {
      this.modelToProvider.set(model, inferredProvider.name);
      return inferredProvider;
    }

    for (const provider of this.providers.values()) {
      if (provider.supportsModel(model)) {
        this.modelToProvider.set(model, provider.name);
        return provider;
      }
    }

    throw new ProviderError(
      'unknown',
      'MODEL_NOT_SUPPORTED',
      `No registered provider supports model "${model}". Available providers: ${Array.from(this.providers.keys()).join(', ')}`,
    );
  }

  /**
   * Infer provider from model name
   * Uses common prefixes and patterns
   */
  private inferProviderFromModel(model: string): ILLMProvider | null {
    const modelLower = model.toLowerCase();

    if (
      modelLower.startsWith('gpt-') ||
      modelLower.startsWith('o1-') ||
      modelLower.startsWith('text-davinci') ||
      modelLower.startsWith('text-embedding')
    ) {
      return this.providers.get('openai') || null;
    }

    if (modelLower.startsWith('claude-')) {
      return this.providers.get('anthropic') || null;
    }

    if (
      modelLower.includes('granite') ||
      modelLower.includes('llama') ||
      modelLower.startsWith('ibm/')
    ) {
      return this.providers.get('watsonx') || null;
    }

    if (modelLower.includes('azure')) {
      return this.providers.get('azure') || null;
    }

    return null;
  }

  /**
   * List all registered providers
   */
  listProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Check if a provider is registered
   */
  hasProvider(name: string): boolean {
    return this.providers.has(name.toLowerCase());
  }

  /**
   * Get all providers that support a specific capability
   */
  getProvidersWithCapability(
    capability: 'streaming' | 'tools' | 'vision' | 'audio',
  ): ILLMProvider[] {
    const result: ILLMProvider[] = [];

    for (const provider of this.providers.values()) {
      const models = this.getModelsForProvider(provider.name);
      if (models.length > 0) {
        const capabilities = provider.getModelCapabilities(models[0]);

        switch (capability) {
          case 'streaming':
            if (capabilities.supportsStreaming) result.push(provider);
            break;
          case 'tools':
            if (capabilities.supportsTools) result.push(provider);
            break;
          case 'vision':
            if (capabilities.supportsVision) result.push(provider);
            break;
          case 'audio':
            if (capabilities.supportsAudio) result.push(provider);
            break;
        }
      }
    }

    return result;
  }

  /**
   * Get all models supported by a provider
   * This is a helper method - providers should ideally expose this
   */
  private getModelsForProvider(providerName: string): string[] {
    const commonModels: Record<string, string[]> = {
      openai: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'],
      watsonx: ['llama-3-70b-instruct'],
      anthropic: ['claude-3-5-sonnet-20241022', 'claude-3-opus-20240229'],
    };

    return commonModels[providerName.toLowerCase()] || [];
  }
}
