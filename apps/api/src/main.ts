/* eslint-disable */
import 'dotenv/config';
import { json, urlencoded } from 'express';
import { NestFactory } from '@nestjs/core';
import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { MicroserviceExceptionFilter } from '@pitch/shared-backend/filters/microservice-exception.filter';
import { PrismaClientExceptionFilter } from '@pitch/shared-backend/filters/prisma-exception.filter';
import { runStartupHealthChecks } from '@pitch/shared-backend/utils/startup-health-checks';
import {
  createMicroserviceOptions,
  getRabbitMQUrl,
  getRabbitMQUrls,
  MICROSERVICES_CONFIG,
} from '@pitch/shared-backend/config/microservices.config';
import { provisionRabbitMqTopology } from './config/rabbitmq-topology';
import { PrismaClient } from '@prisma/user-client';
import { withAccelerate } from '@prisma/extension-accelerate';
import { resolvePrismaRuntimeConfig } from './config/prisma-runtime.config';
import {
  normalizeError,
  safeStringify,
} from '@pitch/shared-backend/utils/error-logging';
import { initializeObservability } from './observability/otel';

@Catch()
export class LogAllHttpExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('HTTP');
  catch(exception: unknown, host: ArgumentsHost): unknown {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<any>();
    const req = ctx.getRequest<any>();
    const requestContext = {
      method: req?.method,
      url: req?.originalUrl ?? req?.url,
      params: req?.params,
      query: req?.query,
      body: req?.body,
      requestId:
        (req?.headers?.['x-request-id'] as string | undefined) ??
        (req?.headers?.['x-correlation-id'] as string | undefined),
      userId: req?.user?.id,
    };

    if (exception instanceof HttpException) {
      const rawStatus = exception.getStatus();
      const status = typeof rawStatus === 'number' ? rawStatus : 500;
      const payload = exception.getResponse();
      const error = normalizeError(exception);

      this.logger.error(
        `${status} ${req.method} ${req.url} -> ${safeStringify(payload)}`,
        error.stack,
      );
      this.logger.error(
        `HTTP exception context: ${safeStringify({
          status,
          payload,
          request: requestContext,
          error,
        })}`,
      );

      return res
        .status(status)
        .json(
          typeof payload === 'object'
            ? payload
            : { statusCode: status, message: payload },
        );
    }

    const error = normalizeError(exception);
    const rawError = exception as
      | {
          status?: unknown;
          statusCode?: unknown;
          response?: {
            statusCode?: unknown;
            message?: unknown;
            error?: unknown;
          };
          message?: unknown;
          error?: unknown;
        }
      | undefined;
    const extractedStatus =
      (typeof rawError?.statusCode === 'number' && rawError.statusCode) ||
      (typeof rawError?.status === 'number' && rawError.status) ||
      (typeof rawError?.response?.statusCode === 'number' &&
        rawError.response.statusCode) ||
      500;
    const extractedMessage =
      (typeof rawError?.response?.message === 'string' &&
        rawError.response.message) ||
      (Array.isArray(rawError?.response?.message) &&
        rawError.response?.message
          .filter((item): item is string => typeof item === 'string')
          .join(', ')) ||
      (typeof rawError?.message === 'string' && rawError.message) ||
      (typeof rawError?.error === 'string' && rawError.error) ||
      error.message ||
      'Internal server error';

    this.logger.error(
      `${extractedStatus} ${req.method} ${req.url} -> ${extractedMessage}`,
      error.stack,
    );
    this.logger.error(
      `HTTP unknown exception context: ${safeStringify({
        status: extractedStatus,
        message: extractedMessage,
        request: requestContext,
        error,
        raw: exception,
      })}`,
    );

    return res.status(extractedStatus).json({
      statusCode: extractedStatus,
      message: extractedMessage,
      timestamp: new Date().toISOString(),
    });
  }
}

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const observability = initializeObservability(
    process.env.OTEL_SERVICE_NAME || 'pitch-api',
    process.env.npm_package_version || '0.0.1',
  );

  try {
    const rabbitmqUrls = getRabbitMQUrls();
    const { url, useAccelerate } = resolvePrismaRuntimeConfig(
      process.env.USER_DATABASE_URL,
      process.env.USER_DIRECT_URL,
    );
    const basePrisma = new PrismaClient(
      url
        ? {
            datasources: {
              db: {
                url,
              },
            },
          }
        : undefined,
    );
    const prisma = useAccelerate
      ? (basePrisma.$extends(withAccelerate()) as unknown as PrismaClient)
      : basePrisma;
    await runStartupHealthChecks(rabbitmqUrls, prisma);
    await provisionRabbitMqTopology(getRabbitMQUrl());
  } catch {
    logger.error(
      'Startup checks or RabbitMQ topology provisioning failed. Exiting...',
    );
    process.exit(1);
  }

  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    bodyParser: false,
  });
  app.useLogger(observability.logger);

  app.use(observability.requestMiddleware);
  // Increase body-parser limits: images can be a few MB inline; PDFs go via multipart.
  app.use(json({ limit: '5mb' }));
  app.use(urlencoded({ extended: true, limit: '5mb' }));

  app.use(helmet());
  app.use(compression());
  app.use(
    morgan(process.env.MORGAN_FORMAT ?? 'combined', {
      stream: observability.morganStream,
    }),
  );
  app.use(cookieParser());

  app.enableCors({
    origin: [
      'http://localhost:3000',
      'http://localhost:3001',
      process.env.FRONTEND_URL || 'http://localhost:3000',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  });

  app.setGlobalPrefix('api');
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      validationError: { target: false },
      exceptionFactory: (errors) =>
        new BadRequestException({ message: 'Validation failed', errors }),
    }),
  );

  app.useGlobalFilters(
    new MicroserviceExceptionFilter(),
    new PrismaClientExceptionFilter(),
    new LogAllHttpExceptionsFilter(),
  );

  const config = new DocumentBuilder()
    .setTitle(process.env.SWAGGER_TITLE ?? 'PITCH API')
    .setDescription(
      process.env.SWAGGER_DESCRIPTION ?? 'PITCH API documentation',
    )
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

  const microserviceName = process.env.MICROSERVICE;

  try {
    if (microserviceName) {
      const cfg =
        MICROSERVICES_CONFIG.find((c) => c.name === microserviceName) ??
        MICROSERVICES_CONFIG.find(
          (c) => c.name.toLowerCase() === microserviceName.toLowerCase(),
        );

      if (!cfg) {
        logger.error(
          `❌ MICROSERVICE="${microserviceName}" not found in MICROSERVICES_CONFIG`,
        );
        process.exit(1);
      }

      logger.log(
        `🚀 Starting single microservice: ${cfg.name} (queue=${cfg.queue})`,
      );

      app.connectMicroservice(createMicroserviceOptions(cfg.queue));
      await app.startAllMicroservices();
    } else {
      logger.log('🚀 Starting ALL microservices');
      for (const cfg of MICROSERVICES_CONFIG) {
        logger.log(
          `📡 Connecting microservice: ${cfg.name} (queue=${cfg.queue})`,
        );
        app.connectMicroservice(createMicroserviceOptions(cfg.queue));
      }
      await app.startAllMicroservices();
    }

    logger.log('✅ Microservices started successfully');
    const microservices = app.getMicroservices();
    logger.log(`📊 Number of connected microservices: ${microservices.length}`);
  } catch (error) {
    const details = normalizeError(error);
    logger.error(
      `❌ Failed to start microservices: ${details.message}`,
      details.stack,
    );
    logger.error(`Error details: ${safeStringify(details)}`);
    throw error;
  }

  app.enableShutdownHooks();
  let telemetryShutdownStarted = false;
  const flushObservability = async () => {
    if (telemetryShutdownStarted) {
      return;
    }
    telemetryShutdownStarted = true;
    await observability.shutdown();
  };
  process.once('SIGTERM', () => {
    void flushObservability();
  });
  process.once('SIGINT', () => {
    void flushObservability();
  });
  process.once('beforeExit', () => {
    void flushObservability();
  });

  const port = parseInt(process.env.PORT ?? '8000', 10);
  await app.listen(port, '0.0.0.0');

  const baseUrl = await app.getUrl();
  logger.log(`🚀 Server running at ${baseUrl}`);
  logger.log(
    `📘 Swagger UI at ${baseUrl}/${process.env.SWAGGER_PATH ?? 'docs'}`,
  );
  logger.log(`🌐 RabbitMQ URLs: ${getRabbitMQUrls().join(', ')}`);
  logger.log(
    `📦 Microservice: ${microserviceName || 'ALL'} started successfully`,
  );
  logger.log(
    ` Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`,
  );
  logger.log(`📊 Connected microservices: ${app.getMicroservices().length}`);
  if (observability.enabled) {
    logger.log('📈 Grafana Cloud OTLP observability enabled');
  } else {
    logger.log(
      '📈 Grafana Cloud OTLP observability disabled (OTEL_EXPORTER_OTLP_* env vars not set)',
    );
  }
}

bootstrap().catch((error) => {
  const logger = new Logger('Bootstrap');
  const details = normalizeError(error);
  logger.error(
    `Failed to start application: ${details.message}`,
    details.stack,
  );
  logger.error(`Error details: ${safeStringify(details)}`);
  process.exit(1);
});
