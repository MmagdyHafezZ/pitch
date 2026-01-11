import { Injectable, Logger } from '@nestjs/common';
import { ITTSProvider, TTSProviderError } from './tts-provider.interface';

@Injectable()
export class TTSProviderRegistry {
  private readonly logger = new Logger(TTSProviderRegistry.name);
  private readonly providers = new Map<string, ITTSProvider>();

  register(provider: ITTSProvider): void {
    if (this.providers.has(provider.name)) {
      this.logger.warn(
        `TTS provider ${provider.name} already registered, overwriting`,
      );
    }
    this.providers.set(provider.name, provider);
  }

  getProvider(name: string): ITTSProvider {
    const provider = this.providers.get(name.toLowerCase());
    if (!provider) {
      throw new TTSProviderError(
        name,
        'PROVIDER_NOT_FOUND',
        `TTS provider "${name}" not registered`,
      );
    }
    return provider;
  }

  getDefaultProvider(): ITTSProvider {
    const provider = this.providers.get('elevenlabs');
    if (!provider) {
      throw new TTSProviderError(
        'default',
        'PROVIDER_NOT_FOUND',
        'Default TTS provider not registered',
      );
    }
    return provider;
  }

  listProviders(): string[] {
    return Array.from(this.providers.keys());
  }
}
