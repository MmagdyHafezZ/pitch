import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PhoneCallService } from './phone-call.service';
import { PhoneProviderFactory } from './providers/phone.factory';
import { VapiPhoneProvider } from './providers/vapi.provider';
import { PhoneCallController } from './phone.controller';
import { SimulationPrismaService } from '../prisma/simulation-prisma.service';
import { VapiContextService } from './vapi-context.service';
import { VapiConfigService } from './vapi-config.service';
import { TtsModule } from '../tts/tts.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TtsModule,
  ],
  controllers: [PhoneCallController],
  providers: [
    PhoneCallService,
    PhoneProviderFactory,
    VapiPhoneProvider,
    VapiConfigService,
    VapiContextService,
    SimulationPrismaService,
    {
      provide: 'PHONE_PROVIDERS',
      useFactory: (vapi: VapiPhoneProvider) => [vapi],
      inject: [VapiPhoneProvider],
    },
  ],
  exports: [PhoneCallService, VapiConfigService, VapiContextService],
})
export class PhoneModule {}
