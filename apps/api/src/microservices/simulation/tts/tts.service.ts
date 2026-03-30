import { Injectable, forwardRef, Inject, Logger } from '@nestjs/common';
import { TtsProviderFactory } from './providers/tts.factory';
import {
  TtsOptions,
  TtsProvider,
  TtsResult,
  TtsStreamResult,
} from './providers/tts.provider';

@Injectable()
export class TtsService {
  private readonly logger = new Logger(TtsService.name);

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
    try {
      return await provider.synthesize(text, options);
    } catch (error) {
      const fallback = await this.tryMeloFallback(
        provider,
        text,
        options,
        error,
      );
      if (fallback) {
        return fallback;
      }
      throw error;
    }
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

    try {
      return await provider.synthesizeStream(text, options);
    } catch (error) {
      const fallback = await this.tryMeloFallback(
        provider,
        text,
        options,
        error,
      );
      if (!fallback) {
        throw error;
      }

      return {
        audioStream: this.bufferToStream(fallback.audioBuffer),
        contentType: fallback.contentType,
      };
    }
  }

  listProviders() {
    return this.providerFactory.listProviders();
  }

  getVoices(providerName: string): string[] {
    return this.providerFactory.getVoices(providerName);
  }

  getModels(providerName: string): string[] {
    return this.providerFactory.getModels(providerName);
  }

  private shouldFallbackToMelo(
    provider: TtsProvider,
    options?: TtsOptions,
  ): boolean {
    return provider.name === 'elevenlabs' && options?.format !== 'pcm';
  }

  private buildMeloOptions(options?: TtsOptions): TtsOptions | undefined {
    if (!options) {
      return undefined;
    }

    const meloOptions: TtsOptions = {};
    if (options.voice) {
      meloOptions.voice = options.voice;
    }
    if (options.language) {
      meloOptions.language = options.language;
    }
    if (options.accent) {
      meloOptions.accent = options.accent;
    }

    return Object.keys(meloOptions).length > 0 ? meloOptions : undefined;
  }

  private async tryMeloFallback(
    provider: TtsProvider,
    text: string,
    options: TtsOptions | undefined,
    error: unknown,
  ): Promise<TtsResult | null> {
    if (!this.shouldFallbackToMelo(provider, options)) {
      return null;
    }

    let meloProvider: TtsProvider;
    try {
      meloProvider = this.providerFactory.getProvider('melotts');
    } catch {
      return null;
    }

    this.logger.warn(
      `TTS failed for provider=${provider.name}. Falling back to melotts. reason=${this.toErrorMessage(error)}`,
    );
    try {
      return await meloProvider.synthesize(
        text,
        this.buildMeloOptions(options),
      );
    } catch (fallbackError) {
      this.logger.warn(
        `TTS melotts fallback failed. reason=${this.toErrorMessage(fallbackError)}`,
      );
      return null;
    }
  }

  private async *bufferToStream(buffer: Buffer): AsyncIterable<Uint8Array> {
    await Promise.resolve();
    yield new Uint8Array(buffer);
  }

  private toErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
