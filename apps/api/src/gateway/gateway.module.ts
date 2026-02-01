import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { JwtModule, type JwtSignOptions } from '@nestjs/jwt';
import { UserGatewayController } from './controllers/userManagement/user-gateway.controller';
import { AuthGatewayController } from './controllers/userManagement/auth-gateway.controller';
import { TeamGatewayController } from './controllers/userManagement/team-gateway.controller';
import { SalesforceGatewayController } from './controllers/crm/salesforce-gateway.controller';
import { SessionGatewayController } from './controllers/simulation/session-gateway.controller';
import { InvitationGatewayController } from './controllers/simulation/invitation-gateway.controller';
import { GlobalJwtAuthGuard } from './guards/global-jwt-auth.guard';
import { UserClaimsInterceptor } from './interceptors/user-claims.interceptor';
import { TtsGatewayController } from './controllers/simulation/tts.controller';
import {
  MICROSERVICES_CONFIG,
  getRabbitMQUrl,
  getQueueOptions,
} from '../config/microservices.config';
import {
  getJwtSecret,
  getJwtAccessExpiration,
} from '@pitch/shared-backend/config/jwt.config';
import { APP_GUARD } from '@nestjs/core';
import { TeamGatewayController } from './controllers/userManagement/team-gateway.controller';
import { S3GatewayController } from './controllers/s3/s3-gateway.controller';
import { SimulationWsGateway } from './controllers/simulation/simulation-ws.gateway';
import { SimulationWsGateway } from './controllers/simulation/simulation-ws.gateway';

@Module({
  imports: [
    JwtModule.register({
      secret: getJwtSecret(),
      signOptions: {
        expiresIn: getJwtAccessExpiration() as JwtSignOptions['expiresIn'],
      },
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
    S3GatewayController,
    SalesforceGatewayController,
    TtsGatewayController,
    SessionGatewayController,
    InvitationGatewayController,
  ],
  providers: [
    { provide: APP_GUARD, useClass: GlobalJwtAuthGuard },
    UserClaimsInterceptor,
    SimulationWsGateway,
  ],
})
export class GatewayModule {}
