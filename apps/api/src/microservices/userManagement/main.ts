import { config } from 'dotenv';
import { join } from 'path';
config({ path: join(__dirname, '../../../../.env') });

import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ValidationPipe } from '@nestjs/common';
import { UserMicroserviceModule } from './user-microservice.module';
import { RpcExceptionLoggingFilter } from '@pitch/shared-backend/filters/rpc-exception.filter';
import {
  getQueueOptions,
  getRabbitMQUrl,
} from '../../config/microservices.config';
import {
  buildRabbitMqQueueTopology,
  provisionRabbitMqTopology,
} from '../../config/rabbitmq-topology';

async function bootstrap() {
  await provisionRabbitMqTopology(getRabbitMQUrl(), [
    buildRabbitMqQueueTopology('user_queue'),
  ]);

  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    UserMicroserviceModule,
    {
      transport: Transport.RMQ,
      options: {
        urls: [getRabbitMQUrl()],
        queue: 'user_queue',
        queueOptions: getQueueOptions(),
        noAck: true,
        prefetchCount: 10,
      },
    },
  );

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new RpcExceptionLoggingFilter());

  await app.listen();
}

void bootstrap();
