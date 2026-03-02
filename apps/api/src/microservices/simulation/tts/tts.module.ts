import { Module } from '@nestjs/common';
import { TtsMicroserviceController } from './tts.controller';
import { TtsService } from './tts.service';
import { TtsProviderFactory } from './providers/tts.factory';
import { ElevenLabsTtsProvider } from './providers/elevenlabs.provider';
import { MeloTtsProvider } from './providers/melotts.provider';
import { OpenAITtsProvider } from './providers/openai.provider';
import type { TtsProvider } from './providers/tts.provider';

import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
  ],
  controllers: [TtsMicroserviceController],
  providers: [
    TtsService,
    TtsProviderFactory,
    ElevenLabsTtsProvider,
    MeloTtsProvider,
    OpenAITtsProvider,

    {
      provide: 'TTS_PROVIDERS',
      useFactory: (
        configService: ConfigService,
        elevenLabs: ElevenLabsTtsProvider,
        melotts: MeloTtsProvider,
        openai: OpenAITtsProvider,
      ) => {
        const providers: TtsProvider[] = [elevenLabs, melotts];
        if (configService.get<string>('OPENAI_API_KEY')) {
          providers.push(openai);
        }
        return providers;
      },
      inject: [
        ConfigService,
        ElevenLabsTtsProvider,
        MeloTtsProvider,
        OpenAITtsProvider,
      ],
    },
  ],
  exports: [TtsService],
})
export class TtsModule {}
