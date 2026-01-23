import { Module } from '@nestjs/common';
import { SubscriptionService } from './services/subscription.service';
import { SubscriptionRepository } from './repositories/subscription.repository';
import { SubscriptionController } from './controllers/subscription.controller';
import { PlansModule } from '../plans/plans.module';
import { TeamModule } from '../team/team.module';
import { ElevatedAccessGuard } from '../guards/elevated-access.guard';

@Module({
  imports: [PlansModule, TeamModule],
  controllers: [SubscriptionController],
  providers: [SubscriptionService, SubscriptionRepository, ElevatedAccessGuard],
  exports: [SubscriptionService],
})
export class SubscriptionModule {}
