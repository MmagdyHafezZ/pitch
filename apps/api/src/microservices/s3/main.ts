import { config } from 'dotenv';
import { join } from 'path';
config({ path: join(__dirname, '../../../../.env') });

import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ValidationPipe } from '@nestjs/common';
import { S3Module } from './s3.module';
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
    buildRabbitMqQueueTopology('s3_queue'),
  ]);

  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    S3Module,
    {
      transport: Transport.RMQ,
      options: {
        urls: [getRabbitMQUrl()],
        queue: 's3_queue',
        queueOptions: getQueueOptions(),
        noAck: false,
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
