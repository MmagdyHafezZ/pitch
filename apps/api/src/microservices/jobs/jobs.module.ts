import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ChallengeSchedulerService } from './services/challenge-scheduler.service';
import {
  getRabbitMQUrl,
  getQueueOptions,
} from '../../config/microservices.config';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ClientsModule.registerAsync([
      {
        name: 'SIMULATION_SERVICE',
        imports: [ConfigModule],
        useFactory: (_configService: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [getRabbitMQUrl()],
            queue: 'simulation_queue',
            queueOptions: getQueueOptions(),
          },
        }),
        inject: [ConfigService],
      },
    ]),
  ],
  providers: [ChallengeSchedulerService],
})
export class JobsModule {}
