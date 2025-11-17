import { Module } from '@nestjs/common';
import { LtiController } from './controllers/lti.controller';
import { LtiService } from './services/lti.service';
import { LaunchService } from './services/launch.service';
import { GradeService } from './services/grade.service';
import { LtiRepository } from './repositories/lti.repository';

@Module({
  controllers: [LtiController],
  providers: [LtiService, LaunchService, GradeService, LtiRepository],
  exports: [LtiService],
})
export class LtiModule {}
