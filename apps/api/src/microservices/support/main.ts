// apps/support/src/main.ts
import { config } from 'dotenv';
import { join } from 'path';
config({ path: join(__dirname, '../../../../.env') });

import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ValidationPipe, Logger, BadRequestException } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { SupportModule } from './support.module';

import { MicroserviceExceptionFilter } from '@pitch/shared-backend/filters/microservice-exception.filter';
import { PrismaClientExceptionFilter } from '@pitch/shared-backend/filters/prisma-exception.filter';
import { RpcExceptionLoggingFilter } from '@pitch/shared-backend/filters/rpc-exception.filter';
import {
  getQueueOptions,
  getRabbitMQUrl,
  getRabbitMQUrls,
} from './config/rabbitmq.config';
import {
  buildRabbitMqQueueTopology,
  provisionRabbitMqTopology,
} from '../../config/rabbitmq-topology';

async function bootstrap() {
  const logger = new Logger('SupportMicroservice');
  const rabbitmqUrl = getRabbitMQUrl();
  const queueName = process.env.SUPPORT_RMQ_QUEUE || 'support_queue';
  const httpPort = process.env.SUPPORT_HTTP_PORT || 3006;

  await provisionRabbitMqTopology(rabbitmqUrl, [
    buildRabbitMqQueueTopology(queueName),
  ]);

  const app = await NestFactory.create(SupportModule);

  app.enableCors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  });

  const microservice = app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: getRabbitMQUrls(),
      queue: queueName,
      queueOptions: getQueueOptions(rabbitmqUrl),
      noAck: true,
      prefetchCount: 10,
    },
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors) => {
        return new BadRequestException({
          message: 'Validation failed',
          errors,
        });
      },
    }),
  );

  // HTTP + microservice exception filters
  app.useGlobalFilters(
    new MicroserviceExceptionFilter(),
    new PrismaClientExceptionFilter(),
  );

  // RMQ-specific filter
  microservice.useGlobalFilters(new RpcExceptionLoggingFilter());

  const swaggerPath =
    process.env.SUPPORT_SWAGGER_PATH ?? process.env.SWAGGER_PATH ?? 'docs';

  const swaggerConfig = new DocumentBuilder()
    .setTitle(process.env.SUPPORT_SWAGGER_TITLE ?? 'Support API')
    .setDescription(
      process.env.SUPPORT_SWAGGER_DESCRIPTION ??
        'Support microservice HTTP endpoints',
    )
    .setVersion(process.env.SUPPORT_SWAGGER_VERSION ?? '1.0.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'bearer',
    )
    .build();

  type SwaggerApp = Parameters<typeof SwaggerModule.createDocument>[0];
  const swaggerApp = app as unknown as SwaggerApp;

  const swaggerDocument = SwaggerModule.createDocument(
    swaggerApp,
    swaggerConfig,
  );

  SwaggerModule.setup(swaggerPath, swaggerApp, swaggerDocument, {
    swaggerOptions: { persistAuthorization: true },
    customSiteTitle:
      process.env.SUPPORT_SWAGGER_SITE_TITLE ?? 'Support API Docs',
  });

  await app.startAllMicroservices();
  logger.log(`RabbitMQ microservice is listening on ${queueName}`);

  await app.listen(httpPort);
  logger.log(`HTTP server is listening on port ${httpPort}`);
  logger.log(`Swagger UI: http://localhost:${httpPort}/${swaggerPath}`);
  logger.log(`Health: http://localhost:${httpPort}/health`);
}

void bootstrap();
