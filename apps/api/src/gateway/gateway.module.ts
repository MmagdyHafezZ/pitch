import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { JwtModule } from '@nestjs/jwt';
import { UserGatewayController } from './controllers/userManagement/user-gateway.controller';
import { AuthGatewayController } from './controllers/userManagement/auth-gateway.controller';
import { GlobalJwtAuthGuard } from './guards/global-jwt-auth.guard';
import { UserClaimsInterceptor } from './interceptors/user-claims.interceptor';
import {
  MICROSERVICES_CONFIG,
  getRabbitMQUrl,
  getQueueOptions,
} from '../config/microservices.config';
import { APP_GUARD } from '@nestjs/core';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'secret',
      signOptions: { expiresIn: process.env.JWT_EXPIRES_IN || '15m' },
    }),
    ClientsModule.register(
      MICROSERVICES_CONFIG.map(({ name, queue }) => ({
        name,
        transport: Transport.RMQ,
        options: {
          urls: [getRabbitMQUrl()],
          queue,
          queueOptions: getQueueOptions(),
        },
      })),
    ),
  ],
  controllers: [UserGatewayController, AuthGatewayController],
  providers: [
    { provide: APP_GUARD, useClass: GlobalJwtAuthGuard },
    UserClaimsInterceptor,
  ],
})
export class GatewayModule {}
