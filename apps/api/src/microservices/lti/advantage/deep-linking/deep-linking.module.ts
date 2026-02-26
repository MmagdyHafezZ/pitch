import { Module } from '@nestjs/common';
import { DeepLinkingService } from './deep-linking.service';
import { PlatformModule } from '../../platform/platform.module';
import { LtiV1p3Module } from '../../v1.3/lti-v1.3.module';
import { LtiPrismaModule } from '../../prisma/lti-prisma.module';

@Module({
  imports: [LtiPrismaModule, PlatformModule, LtiV1p3Module],
  providers: [DeepLinkingService],
  exports: [DeepLinkingService],
})
export class DeepLinkingModule {}
