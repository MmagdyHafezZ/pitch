import {
  Injectable,
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TtsProvider, TtsOptions, TtsResult } from './tts.provider';

@Injectable()
export class MeloTtsProvider implements TtsProvider {
  readonly name = 'melotts';
  readonly description = 'Cloudflare MeloTTS neural text-to-speech';

  private readonly apiToken: string;
  private readonly accountId: string;
  private readonly baseUrl: string;

  // MeloTTS supports these languages
  private readonly supportedLanguages = [
    'en',
    'es',
    'fr',
    'de',
    'it',
    'ja',
    'zh',
    'ko',
  ];

  // Voice options - MeloTTS uses language codes as voices
  readonly voices = [
    'en - English',
    'es - Spanish',
    'fr - French',
    'de - German',
    'it - Italian',
    'ja - Japanese',
    'zh - Chinese',
    'ko - Korean',
  ];

  constructor(private readonly config: ConfigService) {
    this.apiToken = this.config.getOrThrow<string>('CLOUDFLARE_API_TOKEN');
    this.accountId = this.config.getOrThrow<string>('CLOUDFLARE_ACCOUNT_ID');
    this.baseUrl = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/ai/run/@cf/myshell-ai/melotts`;
  }

  async synthesize(text: string, options?: TtsOptions): Promise<TtsResult> {
    try {
      // Extract language from voice option or default to 'en'
      let lang = 'en';
      if (options?.voice) {
        const voiceMatch = options.voice.match(/^([a-z]{2})/i);
        if (
          voiceMatch &&
          this.supportedLanguages.includes(voiceMatch[1].toLowerCase())
        ) {
          lang = voiceMatch[1].toLowerCase();
        } else if (options.language) {
          lang = this.validateLanguage(options.language);
        }
      } else if (options?.language) {
        lang = this.validateLanguage(options.language);
      }

      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: text,
          lang,
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        if (response.status === 400) {
          throw new BadRequestException(
            `Cloudflare MeloTTS error: ${errorData}`,
          );
        }
        if (response.status === 401 || response.status === 403) {
          console.log('MeloTTS auth error:', errorData);
          throw new InternalServerErrorException(
            'Invalid Cloudflare API credentials',
          );
        }
        throw new InternalServerErrorException(
          `Cloudflare MeloTTS failed with status ${response.status}`,
        );
      }

      const data = (await response.json()) as {
        success: boolean;
        result: {
          audio: string; // base64 encoded audio
        };
      };

      if (!data.success || !data.result?.audio) {
        throw new InternalServerErrorException(
          'Cloudflare MeloTTS returned invalid response',
        );
      }

      // Decode base64 audio to Buffer
      const audioBuffer = Buffer.from(data.result.audio, 'base64');

      return {
        audioBuffer,
        contentType: 'audio/mpeg', // MeloTTS returns MP3 audio
      };
    } catch (err) {
      // Re-throw BadRequestException as-is
      if (err instanceof BadRequestException) throw err;
      if (err instanceof InternalServerErrorException) throw err;

      // Log unexpected errors but don't leak internal details
      console.error('MeloTTS synthesis error:', err);
      throw new InternalServerErrorException(
        'Cloudflare MeloTTS synthesis failed',
      );
    }
  }

  private validateLanguage(lang: string): string {
    const normalizedLang = lang.toLowerCase().split('-')[0];
    if (this.supportedLanguages.includes(normalizedLang)) {
      return normalizedLang;
    }
    throw new BadRequestException(
      `Unsupported language "${lang}". Supported languages: ${this.supportedLanguages.join(', ')}`,
    );
  }
}
