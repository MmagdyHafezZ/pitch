import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import {
  getQueueOptions,
  getRabbitMQUrl,
} from '../../../config/microservices.config';

import { TeamService } from './services/team.service';
import { TeamRepository } from './repositories/team.repository';
import { TeamController } from './controllers/team.controller';
import { ElevatedAccessGuard } from '../guards/elevated-access.guard';
import { TeamInviteEmailService } from './services/team-invite-email.service';
import { NotificationModule } from '../notifications/notification.module';
import { TeamInviteExpiryCronService } from './services/team-invite-expiry-cron.service';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    NotificationModule,
    UserModule,
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
  controllers: [TeamController],
  providers: [
    TeamService,
    TeamRepository,
    TeamInviteEmailService,
    TeamInviteExpiryCronService,
    ElevatedAccessGuard,
  ],
  exports: [TeamService, TeamRepository],
})
export class TeamModule {}
