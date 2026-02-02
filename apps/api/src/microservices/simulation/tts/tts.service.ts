import { Injectable, forwardRef, Inject } from '@nestjs/common';
import { TtsProviderFactory } from './providers/tts.factory';
import {
  TtsOptions,
  TtsResult,
  TtsStreamResult,
} from './providers/tts.provider';

@Injectable()
export class TtsService {
  constructor(
    @Inject(forwardRef(() => TtsProviderFactory))
    private readonly providerFactory: TtsProviderFactory,
  ) {}

  async synthesize(
    text: string,
    providerName?: string,
    options?: TtsOptions,
  ): Promise<TtsResult> {
    const provider = this.providerFactory.getProvider(providerName);
    return provider.synthesize(text, options);
  }

  async synthesizeStream(
    text: string,
    providerName?: string,
    options?: TtsOptions,
  ): Promise<TtsStreamResult> {
    const provider = this.providerFactory.getProvider(providerName);
    if (!provider.synthesizeStream) {
      throw new Error(
        `TTS provider "${providerName || provider.name}" does not support streaming`,
      );
    }

    return provider.synthesizeStream(text, options);
  }

  listProviders() {
    return this.providerFactory.listProviders();
  }

  getVoices(providerName: string): string[] {
    return this.providerFactory.getVoices(providerName);
  }
}
