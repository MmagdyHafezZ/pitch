import { Module } from '@nestjs/common';
import { TtsController } from './tts.controller';
import { TtsService } from './tts.service';
import { TtsProviderFactory } from './providers/tts.factory';
import { OpenAiTtsProvider } from './providers/openai.provider';
import { PollyTtsProvider } from './providers/polly.provider';
import { ElevenLabsTtsProvider } from './providers/elevenlabs.provider';

import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
  ],
  controllers: [TtsController],
  providers: [
    TtsService,
    TtsProviderFactory,
    OpenAiTtsProvider,
    PollyTtsProvider,
    ElevenLabsTtsProvider,

    {
      provide: 'TTS_PROVIDERS',
      useFactory: (
        openai: OpenAiTtsProvider,
        polly: PollyTtsProvider,
        elevenLabs: ElevenLabsTtsProvider,
      ) => [openai, polly, elevenLabs],
      inject: [OpenAiTtsProvider, PollyTtsProvider, ElevenLabsTtsProvider],
    },
  ],
  exports: [TtsService],
})
export class TtsModule {}
