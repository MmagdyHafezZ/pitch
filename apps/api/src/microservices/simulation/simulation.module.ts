import { Module } from '@nestjs/common';
import { TtsModule } from './tts/tts.module';

@Module({
  imports: [TtsModule],
  providers: [],
  exports: [TtsModule],
})
export class SimulationModule {}
