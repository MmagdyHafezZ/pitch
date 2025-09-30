import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { Transport, MicroserviceOptions } from '@nestjs/microservices';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { MicroserviceExceptionFilter } from './common/filters/microservice-exception.filter';
import {
  MICROSERVICES_CONFIG,
  getRabbitMQUrl,
  getQueueOptions,
} from './config/microservices.config';
import { PrismaClientExceptionFilter } from './common/filters/prisma-exception.filter';

async function bootstrap() {
  // Buffer logs until the logger is fully initialized
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const logger = new Logger('Bootstrap');
  app.useLogger(logger);

  app.use(helmet());
  app.use(compression());

  // HTTP request logging (common/combined/dev)
  app.use(morgan(process.env.MORGAN_FORMAT ?? 'combined'));

  // CORS
  app.enableCors({
    origin: true, // or provide an array/domain pattern
    credentials: true,
  });

  // API prefix & versioning
  app.setGlobalPrefix('api');
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // Global validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strip unknown properties
      forbidNonWhitelisted: false, // set true to throw on unknown
      transform: true, // auto-transform payloads to DTO types
      transformOptions: { enableImplicitConversion: true },
      validationError: { target: false }, // don't expose original objects in errors
    }),
  );

  // Global exception filter for microservices
  app.useGlobalFilters(
    new MicroserviceExceptionFilter(),
    new PrismaClientExceptionFilter(),
  );

  // Swagger / OpenAPI setup
  const config = new DocumentBuilder()
    .setTitle(process.env.SWAGGER_TITLE ?? 'My API')
    .setDescription(process.env.SWAGGER_DESCRIPTION ?? 'REST API documentation')
    .setVersion(process.env.SWAGGER_VERSION ?? '1.0.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'bearer',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup(process.env.SWAGGER_PATH ?? 'docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
    customSiteTitle: process.env.SWAGGER_SITE_TITLE ?? 'API Docs',
  });

  // Connect microservices for message pattern handling
  MICROSERVICES_CONFIG.forEach(({ queue }) => {
    const microserviceOptions: MicroserviceOptions = {
      transport: Transport.RMQ,
      options: {
        urls: [getRabbitMQUrl()],
        queue,
        queueOptions: getQueueOptions(),
      },
    };
    app.connectMicroservice(microserviceOptions);
    logger.log(`🔗 Connected microservice queue: ${queue}`);
  });

  // Start all microservices
  await app.startAllMicroservices();
  logger.log('🚀 All microservices started');

  // Graceful shutdown (SIGTERM/SIGINT)
  app.enableShutdownHooks();
  const port = parseInt(process.env.PORT ?? '8001', 10);
  await app.listen(port);

  const baseUrl = await app.getUrl();
  logger.log(`🚀 Server running at ${baseUrl}`);
  logger.log(
    `📘 Swagger UI at ${baseUrl}/${process.env.SWAGGER_PATH ?? 'docs'}`,
  );
}
void bootstrap();
