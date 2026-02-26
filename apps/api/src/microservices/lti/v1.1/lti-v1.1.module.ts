import { Module } from '@nestjs/common';
import { LtiV1p1Controller } from './controllers/lti-v1.1.controller';
import { LtiV1p1Service } from './services/lti-v1.1.service';
import { PlatformModule } from '../platform/platform.module';
import { LtiPrismaModule } from '../prisma/lti-prisma.module';

@Module({
  imports: [LtiPrismaModule, PlatformModule],
  controllers: [LtiV1p1Controller],
  providers: [LtiV1p1Service],
  exports: [LtiV1p1Service],
})
export class LtiV1p1Module {}
