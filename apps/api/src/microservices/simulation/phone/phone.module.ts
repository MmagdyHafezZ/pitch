import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PhoneCallService } from './phone-call.service';
import { PhoneProviderFactory } from './providers/phone.factory';
import { TwilioPhoneProvider } from './providers/twilio.provider';
import { VapiPhoneProvider } from './providers/vapi.provider';
import { PhoneCallController } from './phone.controller';
import { SimulationPrismaService } from '../prisma/simulation-prisma.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
  ],
  controllers: [PhoneCallController],
  providers: [
    PhoneCallService,
    PhoneProviderFactory,
    TwilioPhoneProvider,
    VapiPhoneProvider,
    SimulationPrismaService,
    {
      provide: 'PHONE_PROVIDERS',
      useFactory: (twilio: TwilioPhoneProvider, vapi: VapiPhoneProvider) => [
        twilio,
        vapi,
      ],
      inject: [TwilioPhoneProvider, VapiPhoneProvider],
    },
  ],
  exports: [PhoneCallService],
})
export class PhoneModule {}
