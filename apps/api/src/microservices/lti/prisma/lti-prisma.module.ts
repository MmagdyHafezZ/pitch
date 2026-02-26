import { Module } from '@nestjs/common';
import { LtiPrismaService } from './lti-prisma.service';

/**
 * Shared module that provides and exports LtiPrismaService.
 * All sub-modules that need database access should import this module.
 */
@Module({
  providers: [LtiPrismaService],
  exports: [LtiPrismaService],
})
export class LtiPrismaModule {}
