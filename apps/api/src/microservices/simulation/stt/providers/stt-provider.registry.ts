import { ISTTProvider } from './stt-provider.interface';

export class STTProviderRegistry {
  private readonly providers = new Map<string, ISTTProvider>();
  private defaultProvider: ISTTProvider | null = null;

  register(provider: ISTTProvider): void {
    this.providers.set(provider.name, provider);
    if (!this.defaultProvider) {
      this.defaultProvider = provider;
    }
  }

  getProvider(name: string): ISTTProvider {
    const provider = this.providers.get(name);
    if (!provider) {
      throw new Error(`STT provider "${name}" not registered`);
    }
    return provider;
  }

  getDefaultProvider(): ISTTProvider {
    if (!this.defaultProvider) {
      throw new Error('No STT providers registered');
    }
    return this.defaultProvider;
  }

  listProviders(): string[] {
    return Array.from(this.providers.keys());
  }
}
