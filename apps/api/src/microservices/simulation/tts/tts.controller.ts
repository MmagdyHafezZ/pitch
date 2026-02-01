import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { toRpcException } from '@pitch/shared-backend/helpers/exceptions';
import { TtsService } from './tts.service';
import { TTS_SERVICE_PATTERNS } from '@pitch/shared-backend/interfaces/message-patterns.interface';
import { Observable } from 'rxjs';

type SpeakRequest = {
  text: string;
  provider: string;
  options?: {
    voice?: string;
    language?: string;
    format?: 'mp3' | 'wav' | 'ogg';
    sampleRate?: number;
  };
};

type SpeakResponse = {
  audioBase64: string;
  contentType: string;
};

@Controller()
export class TtsMicroserviceController {
  private readonly logger = new Logger(TtsMicroserviceController.name);

  constructor(private readonly ttsService: TtsService) {}

  @MessagePattern(TTS_SERVICE_PATTERNS.SPEAK)
  async speak(@Payload() data: SpeakRequest): Promise<SpeakResponse> {
    try {
      this.logger.log(
        `TTS speak - provider=${data.provider}, voice=${data.options?.voice ?? 'default'}`,
      );

      const result = await this.ttsService.synthesize(
        data.text,
        data.provider,
        data.options,
      );

      return {
        // Buffer -> base64 for safe transport over RabbitMQ
        audioBase64: result.audioBuffer.toString('base64'),
        contentType: result.contentType,
      };
    } catch (error) {
      this.logger.error('TTS speak failed', error);
      throw toRpcException(error);
    }
  }

  @MessagePattern(TTS_SERVICE_PATTERNS.STREAM)
  stream(@Payload() data: SpeakRequest): Observable<SpeakResponse> {
    try {
      this.logger.log(
        `TTS stream - provider=${data.provider}, voice=${data.options?.voice ?? 'default'}`,
      );

      return new Observable<SpeakResponse>((subscriber) => {
        (async () => {
          try {
            const result = await this.ttsService.synthesizeStream(
              data.text,
              data.provider,
              data.options,
            );

            for await (const chunk of result.audioStream) {
              subscriber.next({
                audioBase64: Buffer.from(chunk).toString('base64'),
                contentType: result.contentType,
              });
            }

            subscriber.complete();
          } catch (err) {
            subscriber.error(err);
          }
        })();
      });
    } catch (error) {
      this.logger.error('TTS stream failed', error);
      throw toRpcException(error);
    }
  }

  @MessagePattern(TTS_SERVICE_PATTERNS.LIST_PROVIDERS)
  listProviders() {
    try {
      this.logger.log('TTS list providers');
      return this.ttsService.listProviders();
    } catch (error) {
      this.logger.error('Failed to list providers', error);
      throw toRpcException(error);
    }
  }

  @MessagePattern(TTS_SERVICE_PATTERNS.GET_VOICES)
  getVoices(@Payload() data: { provider: string }) {
    try {
      this.logger.log(`TTS get voices - provider=${data.provider}`);
      return {
        provider: data.provider,
        voices: this.ttsService.getVoices(data.provider),
      };
    } catch (error) {
      this.logger.error('Failed to get voices', error);
      throw toRpcException(error);
    }
  }
}
