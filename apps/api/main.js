'use strict';
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, '__esModule', { value: true });
require('dotenv/config');
const core_1 = require('@nestjs/core');
const app_module_1 = require('./app.module');
const common_1 = require('@nestjs/common');
const swagger_1 = require('@nestjs/swagger');
const microservices_1 = require('@nestjs/microservices');
const helmet_1 = __importDefault(require('helmet'));
const compression_1 = __importDefault(require('compression'));
const morgan_1 = __importDefault(require('morgan'));
const microservice_exception_filter_1 = require('./common/filters/microservice-exception.filter');
const microservices_config_1 = require('./config/microservices.config');
const prisma_exception_filter_1 = require('./common/filters/prisma-exception.filter');
async function bootstrap() {
  const app = await core_1.NestFactory.create(app_module_1.AppModule, {
    bufferLogs: true,
  });
  const logger = new common_1.Logger('Bootstrap');
  app.useLogger(logger);
  app.use((0, helmet_1.default)());
  app.use((0, compression_1.default)());
  app.use((0, morgan_1.default)(process.env.MORGAN_FORMAT ?? 'combined'));
  app.enableCors({
    origin: true,
    credentials: true,
  });
  app.setGlobalPrefix('api');
  app.enableVersioning({
    type: common_1.VersioningType.URI,
    defaultVersion: '1',
  });
  app.useGlobalPipes(
    new common_1.ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      validationError: { target: false },
    }),
  );
  app.useGlobalFilters(
    new microservice_exception_filter_1.MicroserviceExceptionFilter(),
    new prisma_exception_filter_1.PrismaClientExceptionFilter(),
  );
  const config = new swagger_1.DocumentBuilder()
    .setTitle(process.env.SWAGGER_TITLE ?? 'My API')
    .setDescription(process.env.SWAGGER_DESCRIPTION ?? 'REST API documentation')
    .setVersion(process.env.SWAGGER_VERSION ?? '1.0.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'bearer',
    )
    .build();
  const document = swagger_1.SwaggerModule.createDocument(app, config);
  swagger_1.SwaggerModule.setup(
    process.env.SWAGGER_PATH ?? 'docs',
    app,
    document,
    {
      swaggerOptions: { persistAuthorization: true },
      customSiteTitle: process.env.SWAGGER_SITE_TITLE ?? 'API Docs',
    },
  );
  microservices_config_1.MICROSERVICES_CONFIG.forEach(({ queue }) => {
    const microserviceOptions = {
      transport: microservices_1.Transport.RMQ,
      options: {
        urls: [(0, microservices_config_1.getRabbitMQUrl)()],
        queue,
        queueOptions: (0, microservices_config_1.getQueueOptions)(),
      },
    };
    app.connectMicroservice(microserviceOptions);
    logger.log(`🔗 Connected microservice queue: ${queue}`);
  });
  await app.startAllMicroservices();
  logger.log('🚀 All microservices started');
  app.enableShutdownHooks();
  const port = parseInt(process.env.PORT ?? '8000', 10);
  await app.listen(port);
  const baseUrl = await app.getUrl();
  logger.log(`🚀 Server running at ${baseUrl}`);
  logger.log(
    `📘 Swagger UI at ${baseUrl}/${process.env.SWAGGER_PATH ?? 'docs'}`,
  );
}
void bootstrap();
//# sourceMappingURL=main.js.map
