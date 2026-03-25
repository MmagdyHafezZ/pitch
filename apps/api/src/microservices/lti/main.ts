import { config } from 'dotenv';
import { join } from 'path';
config({ path: join(__dirname, '../../../../.env') });

import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ValidationPipe } from '@nestjs/common';
import { LtiModule } from './lti.module';
import { RpcExceptionLoggingFilter } from '@pitch/shared-backend/filters/rpc-exception.filter';
import { getRabbitMQUrl } from '../../config/microservices.config';
import {
  buildRabbitMqQueueTopology,
  provisionRabbitMqTopology,
} from '../../config/rabbitmq-topology';

async function bootstrap() {
  await provisionRabbitMqTopology(getRabbitMQUrl(), [
    buildRabbitMqQueueTopology('lti_queue'),
  ]);

  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    LtiModule,
    {
      transport: Transport.RMQ,
      options: {
        urls: [getRabbitMQUrl()],
        queue: 'lti_queue',
        queueOptions: {
          durable: true,
        },
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
