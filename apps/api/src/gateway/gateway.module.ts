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
import {
  getJwtSecret,
  getJwtAccessExpiration,
} from '../common/config/jwt.config';
import { APP_GUARD } from '@nestjs/core';
import { TeamGatewayController } from './controllers/userManagement/team-gateway.controller';

@Module({
  imports: [
    JwtModule.register({
      secret: getJwtSecret(),
      signOptions: { expiresIn: getJwtAccessExpiration() },
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
  controllers: [
    UserGatewayController,
    AuthGatewayController,
    TeamGatewayController,
  ],
  providers: [
    { provide: APP_GUARD, useClass: GlobalJwtAuthGuard },
    UserClaimsInterceptor,
  ],
})
export class GatewayModule {}
