import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global prefix for all routes
  app.setGlobalPrefix('api/v1');

  // Enable CORS
  const corsOrigins = process.env.CORS_ORIGIN?.split(',') || [
    'http://localhost:3000',
  ];
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Swagger documentation
  const swaggerConfig = new DocumentBuilder()
    .setTitle(process.env.SWAGGER_TITLE || 'PITCH Microservices API')
    .setDescription(
      process.env.SWAGGER_DESCRIPTION ||
        'Microservices REST API for PITCH application',
    )
    .setVersion(process.env.SWAGGER_VERSION || '1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth',
    )
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup(process.env.SWAGGER_PATH || 'docs', app, document, {
    customSiteTitle: process.env.SWAGGER_SITE_TITLE || 'PITCH API Docs',
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  // Start the application
  const port = process.env.PORT || 8000;
  await app.listen(port);

  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🚀  PITCH API Gateway is running!                      ║
║                                                           ║
║   📍  URL: http://localhost:${port}                         ║
║   📚  API Docs: http://localhost:${port}/${process.env.SWAGGER_PATH || 'docs'}              ║
║   🌍  Environment: ${process.env.NODE_ENV || 'development'}                       ║
║                                                           ║
╔═══════════════════════════════════════════════════════════╗
  `);
}

bootstrap();
