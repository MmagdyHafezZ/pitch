import { Injectable, Inject } from '@nestjs/common';
import { TtsProvider } from './tts.provider';

@Injectable()
export class TtsProviderFactory {
  constructor(
    @Inject('TTS_PROVIDERS')
    private readonly providers: TtsProvider[],
  ) {}

  getProvider(name?: string): TtsProvider {
    if (!name) {
      return this.providers[0];
    }

    const provider = this.providers.find((p) => p.name === name);
    if (!provider) {
      throw new Error(`TTS provider "${name}" not registered`);
    }

    return provider;
  }

  listProviders() {
    return this.providers.map((p) => ({
      name: p.name,
      description: p.description,
      voices: p.voices || [],
      models: p.models || [],
    }));
  }

  getVoices(providerName: string): string[] {
    const provider = this.getProvider(providerName);

    if (!provider.voices || provider.voices.length === 0) {
      return [];
    }

    return provider.voices;
  }

  getModels(providerName: string): string[] {
    const provider = this.getProvider(providerName);

    if (!provider.models || provider.models.length === 0) {
      return [];
    }

    return provider.models;
  }
}
