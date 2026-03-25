import { forwardRef, Logger, Module } from '@nestjs/common';

import { UserService } from './services/user.service';
import { PhoneVerificationService } from './services/phone-verification.service';
import { UserRepository } from './repositories/user.repository';
import { UserController } from './controllers/user.controller';
import { AuthModule } from '../auth/auth.module';
import { VERIFICATION_SMS_SENDER } from './services/providers/verification-sms.provider';
import { TwilioVerificationSmsProvider } from './services/providers/twilio-verification-sms.provider';

@Module({
  imports: [forwardRef(() => AuthModule)],
  controllers: [UserController],
  providers: [
    UserService,
    PhoneVerificationService,
    UserRepository,
    Logger,
    TwilioVerificationSmsProvider,
    {
      provide: VERIFICATION_SMS_SENDER,
      useExisting: TwilioVerificationSmsProvider,
    },
  ],
  exports: [UserService, PhoneVerificationService, UserRepository],
})
export class UserModule {}
