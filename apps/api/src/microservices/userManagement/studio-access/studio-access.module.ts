import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { StudioAccessController } from './controllers/studio-access.controller';
import { StudioAccessService } from './services/studio-access.service';
import { UserModule } from '../user/user.module';
import { TeamModule } from '../team/team.module';
import { PlansModule } from '../plans/plans.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import {
  getQueueOptions,
  getRabbitMQUrl,
} from '../../../config/microservices.config';
import { NotificationModule } from '../notifications/notification.module';
import { StudioAccessEmailService } from './services/studio-access-email.service';

@Module({
  imports: [
    UserModule,
    TeamModule,
    PlansModule,
    SubscriptionModule,
    NotificationModule,
    ClientsModule.register([
      {
        name: 'SUPPORT_SERVICE',
        transport: Transport.RMQ,
        options: {
          urls: [getRabbitMQUrl()],
          queue: process.env.SUPPORT_RMQ_QUEUE || 'support_queue',
          queueOptions: getQueueOptions(),
        },
      },
    ]),
  ],
  controllers: [StudioAccessController],
  providers: [StudioAccessService, StudioAccessEmailService],
  exports: [StudioAccessService],
})
export class StudioAccessModule {}
