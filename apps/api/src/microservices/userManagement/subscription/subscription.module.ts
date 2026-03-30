import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { SubscriptionService } from './services/subscription.service';
import { SubscriptionRepository } from './repositories/subscription.repository';
import { SubscriptionController } from './controllers/subscription.controller';
import { PlansModule } from '../plans/plans.module';
import { CoinsModule } from '../coins/coins.module';
import { SubscriptionAccessGuard } from '../guards/subscription-access.guard';
import { TeamRepository } from '../team/repositories/team.repository';
import {
  getQueueOptions,
  getRabbitMQUrls,
} from '@pitch/shared-backend/config/microservices.config';
import { NotificationModule } from '../notifications/notification.module';
import { UserModule } from '../user/user.module';
import { PlanChangeNotificationService } from './services/plan-change-notification.service';

@Module({
  imports: [
    PlansModule,
    CoinsModule,
    NotificationModule,
    UserModule,
    ClientsModule.register([
      {
        name: 'SUPPORT_SERVICE',
        transport: Transport.RMQ,
        options: {
          urls: getRabbitMQUrls(),
          queue: process.env.SUPPORT_RMQ_QUEUE || 'support_queue',
          queueOptions: getQueueOptions(),
        },
      },
    ]),
  ],
  controllers: [SubscriptionController],
  providers: [
    SubscriptionService,
    SubscriptionRepository,
    PlanChangeNotificationService,
    SubscriptionAccessGuard,
    TeamRepository,
  ],
  exports: [SubscriptionService, SubscriptionRepository],
})
export class SubscriptionModule {}
