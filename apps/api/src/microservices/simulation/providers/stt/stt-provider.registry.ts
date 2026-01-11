import { Injectable, Logger } from '@nestjs/common';
import { ISTTProvider, STTProviderError } from './stt-provider.interface';

@Injectable()
export class STTProviderRegistry {
  private readonly logger = new Logger(STTProviderRegistry.name);
  private readonly providers = new Map<string, ISTTProvider>();

  register(provider: ISTTProvider): void {
    if (this.providers.has(provider.name)) {
      this.logger.warn(
        `STT provider ${provider.name} already registered, overwriting`,
      );
    }
    this.providers.set(provider.name, provider);
  }

  getProvider(name: string): ISTTProvider {
    const provider = this.providers.get(name.toLowerCase());
    if (!provider) {
      throw new STTProviderError(
        name,
        'PROVIDER_NOT_FOUND',
        `STT provider "${name}" not registered`,
      );
    }
    return provider;
  }

  getDefaultProvider(): ISTTProvider {
    const provider = this.providers.values().next().value as
      | ISTTProvider
      | undefined;
    if (!provider) {
      throw new STTProviderError(
        'default',
        'PROVIDER_NOT_FOUND',
        'No STT providers registered',
      );
    }
    return provider;
  }

  listProviders(): string[] {
    return Array.from(this.providers.keys());
  }
}
