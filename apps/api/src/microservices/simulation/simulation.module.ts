import { Module } from '@nestjs/common';
import { TtsModule } from './tts/tts.module';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-secret-key',
      signOptions: { expiresIn: '150m' },
    }),
    TtsModule,
  ],
  providers: [],
  exports: [TtsModule],
})
export class SimulationModule {}
