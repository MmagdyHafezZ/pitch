import { Injectable } from '@nestjs/common';
import { TtsProvider, TtsOptions, TtsResult } from './tts.provider';

@Injectable()
export class OpenAiTtsProvider implements TtsProvider {
  readonly name = 'openai';

  async synthesize(text: string, options?: TtsOptions): Promise<TtsResult> {
    // Placeholder – replace with real SDK call
    const audioBuffer = Buffer.from(`FAKE_OPENAI_AUDIO:${text}`);

    return {
      audioBuffer,
      contentType: 'audio/mpeg',
    };
  }
}
