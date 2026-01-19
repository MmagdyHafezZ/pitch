import { Module } from '@nestjs/common';
import { TtsController } from './tts.controller';
import { TtsService } from './tts.service';
import { TtsProviderFactory } from './providers/tts.factory';
import { OpenAiTtsProvider } from './providers/openai.provider';
import { PollyTtsProvider } from './providers/polly.provider';

@Module({
  controllers: [TtsController],
  providers: [
    TtsService,
    TtsProviderFactory,
    OpenAiTtsProvider,
    PollyTtsProvider,

    {
      provide: 'TTS_PROVIDERS',
      useFactory: (openai: OpenAiTtsProvider, polly: PollyTtsProvider) => [
        openai,
        polly,
      ],
      inject: [OpenAiTtsProvider, PollyTtsProvider],
    },
  ],
})
export class TtsModule {}
