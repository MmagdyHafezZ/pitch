import { Module } from '@nestjs/common';
import { SubscriptionService } from './services/subscription.service';
import { SubscriptionRepository } from './repositories/subscription.repository';
import { SubscriptionController } from './controllers/subscription.controller';
import { PlansModule } from '../plans/plans.module';
import { CoinsModule } from '../coins/coins.module';
import { ElevatedAccessGuard } from '../guards/elevated-access.guard';
import { TeamRepository } from '../team/repositories/team.repository';

@Module({
  imports: [PlansModule, CoinsModule],
  controllers: [SubscriptionController],
  providers: [
    SubscriptionService,
    SubscriptionRepository,
    ElevatedAccessGuard,
    TeamRepository,
  ],
  exports: [SubscriptionService, SubscriptionRepository],
})
export class SubscriptionModule {}
