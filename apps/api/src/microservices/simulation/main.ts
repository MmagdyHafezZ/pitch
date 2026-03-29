import { config } from 'dotenv';
import { join } from 'path';
config({ path: join(__dirname, '../../../../.env') });

import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { SimulationModule } from './simulation.module';
import { MicroserviceExceptionFilter } from '@pitch/shared-backend/filters/microservice-exception.filter';
import { PrismaClientExceptionFilter } from '@pitch/shared-backend/filters/prisma-exception.filter';
import { RpcExceptionLoggingFilter } from '@pitch/shared-backend/filters/rpc-exception.filter';
import { getRabbitMQUrls } from './config/rabbitmq.config';

async function bootstrap() {
  const logger = new Logger('SimulationMicroservice');
  const httpPort = process.env.SIMULATION_HTTP_PORT || 3001;

  const app = await NestFactory.create(SimulationModule);

  app.enableCors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  });

  const microservice = app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: getRabbitMQUrls(),
      queue: 'simulation_queue',
      queueOptions: {
        durable: true,
      },
      noAck: true,
      prefetchCount: 10,
    },
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(
    new MicroserviceExceptionFilter(),
    new PrismaClientExceptionFilter(),
  );
  microservice.useGlobalFilters(new RpcExceptionLoggingFilter());

  const swaggerPath =
    process.env.SIMULATION_SWAGGER_PATH ?? process.env.SWAGGER_PATH ?? 'docs';
  const swaggerConfig = new DocumentBuilder()
    .setTitle(process.env.SIMULATION_SWAGGER_TITLE ?? 'Simulation API')
    .setDescription(
      process.env.SIMULATION_SWAGGER_DESCRIPTION ??
        'Simulation microservice HTTP endpoints',
    )
    .setVersion(process.env.SIMULATION_SWAGGER_VERSION ?? '1.0.0')
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
      process.env.SIMULATION_SWAGGER_SITE_TITLE ?? 'Simulation API Docs',
  });

  await app.startAllMicroservices();
  logger.log('RabbitMQ microservice is listening on simulation_queue');

  await app.listen(httpPort);
  logger.log(`HTTP server is listening on port ${httpPort}`);
  logger.log(`Swagger UI: http://localhost:${httpPort}/${swaggerPath}`);
  logger.log(`Test endpoint: http://localhost:${httpPort}/simulation/llm/test`);
}

void bootstrap();
