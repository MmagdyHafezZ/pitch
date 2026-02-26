import { Module } from '@nestjs/common';
import { PlatformController } from './platform.controller';
import { PlatformService } from './platform.service';
import { PlatformRepository } from './platform.repository';
import { LtiPrismaModule } from '../prisma/lti-prisma.module';

@Module({
  imports: [LtiPrismaModule],
  controllers: [PlatformController],
  providers: [PlatformService, PlatformRepository],
  exports: [PlatformService, PlatformRepository],
})
export class PlatformModule {}
