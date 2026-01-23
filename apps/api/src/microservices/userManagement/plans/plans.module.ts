import { Module } from '@nestjs/common';
import { PlanController } from './controllers/plans.controller';
import { PlanService } from './services/plans.service';
import { PlanRepository } from './repositories/plans.repository';

@Module({
  controllers: [PlanController],
  providers: [PlanService, PlanRepository],
  exports: [PlanService],
})
export class PlansModule {}
