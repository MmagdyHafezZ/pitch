import { Injectable } from '@nestjs/common';
import { TtsProvider, TtsOptions, TtsResult } from './tts.provider';

@Injectable()
export class PollyTtsProvider implements TtsProvider {
  readonly name = 'polly';

  async synthesize(text: string, options?: TtsOptions): Promise<TtsResult> {
    // Placeholder – replace with AWS Polly SDK
    const audioBuffer = Buffer.from(`FAKE_POLLY_AUDIO:${text}`);

    return {
      audioBuffer,
      contentType: 'audio/mpeg',
    };
  }
}
