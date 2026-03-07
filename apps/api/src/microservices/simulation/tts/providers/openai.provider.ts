import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { TtsOptions, TtsProvider, TtsResult } from './tts.provider';

const OPENAI_TTS_VOICES = [
  'alloy',
  'ash',
  'ballad',
  'cedar',
  'coral',
  'echo',
  'marin',
  'sage',
  'shimmer',
  'verse',
] as const;

const OPENAI_TTS_MODELS = ['gpt-4o-mini-tts', 'tts-1', 'tts-1-hd'] as const;

type OpenAITtsVoice = (typeof OPENAI_TTS_VOICES)[number];
type OpenAITtsModel = (typeof OPENAI_TTS_MODELS)[number];

@Injectable()
export class OpenAITtsProvider implements TtsProvider {
  readonly name = 'openai';
  readonly description = 'OpenAI text-to-speech';
  readonly voices = [...OPENAI_TTS_VOICES];
  readonly models = [...OPENAI_TTS_MODELS];

  private readonly logger = new Logger(OpenAITtsProvider.name);
  private readonly apiKey: string | undefined;
  private readonly defaultVoice: OpenAITtsVoice;
  private readonly defaultModel: OpenAITtsModel;
  private readonly client: OpenAI;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('OPENAI_API_KEY') ?? undefined;
    this.defaultVoice = this.resolveVoice(
      this.config.get<string>('OPENAI_TTS_DEFAULT_VOICE') ?? 'alloy',
    );
    this.defaultModel = this.resolveModel(
      this.config.get<string>('OPENAI_TTS_DEFAULT_MODEL') ?? 'gpt-4o-mini-tts',
    );
    this.client = new OpenAI({
      apiKey: this.apiKey || 'placeholder',
      timeout: 60000,
      maxRetries: 1,
    });

    if (!this.apiKey) {
      this.logger.warn(
        'OPENAI_API_KEY not configured; OpenAI TTS provider will be unavailable',
      );
    }
  }

  async synthesize(text: string, options?: TtsOptions): Promise<TtsResult> {
    if (!this.apiKey) {
      throw new InternalServerErrorException('OpenAI TTS is not configured');
    }

    const voice = this.resolveVoice(options?.voice);
    const model = this.resolveModel(options?.model);
    const responseFormat = this.resolveFormat(options?.format);

    try {
      const request: Parameters<typeof this.client.audio.speech.create>[0] = {
        model,
        voice,
        input: text,
        format: responseFormat,
      };
      const response = await this.client.audio.speech.create(request);

      const audioBuffer = Buffer.from(await response.arrayBuffer());

      return {
        audioBuffer,
        contentType: this.resolveContentType(responseFormat),
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        `OpenAI TTS failed for model=${model}, voice=${voice}`,
        error as Error,
      );
      throw new InternalServerErrorException('OpenAI TTS failed');
    }
  }

  private resolveVoice(input?: string): OpenAITtsVoice {
    if (!input) {
      return this.defaultVoice;
    }

    const normalized = input.trim().toLowerCase();
    const match = OPENAI_TTS_VOICES.find((voice) => voice === normalized);
    if (!match) {
      throw new BadRequestException(
        `Unknown OpenAI voice "${input}". Valid voices: ${OPENAI_TTS_VOICES.join(', ')}`,
      );
    }

    return match;
  }

  private resolveModel(input?: string): OpenAITtsModel {
    if (!input) {
      return this.defaultModel;
    }

    const normalized = input.trim().toLowerCase();
    const match = OPENAI_TTS_MODELS.find((model) => model === normalized);
    if (!match) {
      throw new BadRequestException(
        `Unknown OpenAI TTS model "${input}". Valid models: ${OPENAI_TTS_MODELS.join(', ')}`,
      );
    }

    return match;
  }

  private resolveFormat(format?: TtsOptions['format']): 'mp3' | 'wav' | 'opus' {
    if (format === 'wav') {
      return 'wav';
    }

    if (format === 'ogg') {
      return 'opus';
    }

    return 'mp3';
  }

  private resolveContentType(format: 'mp3' | 'wav' | 'opus'): string {
    switch (format) {
      case 'wav':
        return 'audio/wav';
      case 'opus':
        return 'audio/ogg';
      default:
        return 'audio/mpeg';
    }
  }
}
