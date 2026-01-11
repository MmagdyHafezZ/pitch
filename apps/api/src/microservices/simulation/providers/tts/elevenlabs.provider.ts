import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ITTSProvider,
  TTSProviderAuthError,
  TTSProviderRequestError,
  TTSRequest,
  TTSResponse,
} from './tts-provider.interface';

@Injectable()
export class ElevenLabsProvider implements ITTSProvider {
  readonly name = 'elevenlabs';
  private readonly logger = new Logger(ElevenLabsProvider.name);
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly defaultVoiceId: string;
  private readonly defaultModel: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('ELEVENLABS_API_KEY') || '';
    this.baseUrl =
      this.configService.get<string>('ELEVENLABS_BASE_URL') ||
      'https://api.elevenlabs.io';
    this.defaultVoiceId =
      this.configService.get<string>('ELEVENLABS_VOICE_ID') || '';
    this.defaultModel =
      this.configService.get<string>('ELEVENLABS_MODEL_ID') ||
      'eleven_turbo_v2';

    if (!this.apiKey) {
      this.logger.warn('ELEVENLABS_API_KEY not configured');
    }
  }

  supportsVoice(voice?: string): boolean {
    return !!(voice || this.defaultVoiceId);
  }

  async synthesize(request: TTSRequest): Promise<TTSResponse> {
    if (!this.apiKey) {
      throw new TTSProviderAuthError(this.name, {
        message: 'ELEVENLABS_API_KEY is not configured',
      });
    }

    const voiceId = request.voice || this.defaultVoiceId;
    if (!voiceId) {
      throw new TTSProviderRequestError(this.name, 'voice is required');
    }

    const outputFormat = this.resolveOutputFormat(request.format);
    const url = `${this.baseUrl}/v1/text-to-speech/${voiceId}?output_format=${outputFormat}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'xi-api-key': this.apiKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text: request.text,
        model_id: request.model || this.defaultModel,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
      }),
    });

    if (!response.ok) {
      const message = await response.text();
      this.logger.warn(`ElevenLabs error: ${response.status} ${message}`);
      throw new TTSProviderRequestError(this.name, message, {
        status: response.status,
      });
    }

    const audioBuffer = Buffer.from(await response.arrayBuffer());

    return {
      audioBuffer,
      format: outputFormat,
      providerMeta: {
        requestId: response.headers.get('x-request-id') || undefined,
      },
    };
  }

  private resolveOutputFormat(format?: string): string {
    if (!format) return 'mp3_44100_128';
    const normalized = format.toLowerCase();

    if (normalized === 'wav' || normalized === 'pcm') {
      return 'pcm_16000';
    }

    if (normalized === 'opus') {
      return 'opus_48000';
    }

    return 'mp3_44100_128';
  }
}
