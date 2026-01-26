import { Module } from '@nestjs/common';
import { TtsMicroserviceController } from './tts.controller';
import { TtsService } from './tts.service';
import { TtsProviderFactory } from './providers/tts.factory';
import { ElevenLabsTtsProvider } from './providers/elevenlabs.provider';
import { MeloTtsProvider } from './providers/melotts.provider';

import { ConfigModule } from '@nestjs/config';

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

    {
      provide: 'TTS_PROVIDERS',
      useFactory: (
        elevenLabs: ElevenLabsTtsProvider,
        melotts: MeloTtsProvider,
      ) => [elevenLabs, melotts],
      inject: [ElevenLabsTtsProvider, MeloTtsProvider],
    },
  ],
  exports: [TtsService],
})
export class TtsModule {}
