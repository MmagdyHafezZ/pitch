import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { JwtModule, type JwtSignOptions } from '@nestjs/jwt';
import { UserGatewayController } from './controllers/userManagement/user-gateway.controller';
import { AuthGatewayController } from './controllers/userManagement/auth-gateway.controller';
import { TeamGatewayController } from './controllers/userManagement/team-gateway.controller';
import { PlanGatewayController } from './controllers/userManagement/plans.controller';
import { SubscriptionGatewayController } from './controllers/userManagement/subscription.controller';
import { SimulationWsGateway } from './controllers/simulation/simulation-ws.gateway';
import { SalesforceGatewayController } from './controllers/crm/salesforce-gateway.controller';
import { SessionGatewayController } from './controllers/simulation/session-gateway.controller';
import { InvitationGatewayController } from './controllers/simulation/invitation-gateway.controller';
import { HintsGatewayController } from './controllers/simulation/hints-gateway.controller';
import { AssessmentGatewayController } from './controllers/simulation/assessment-gateway.controller';
import { PhoneCallGatewayController } from './controllers/simulation/phone-call-gateway.controller';
import { PhoneCallWebhookController } from './controllers/simulation/phone-call-webhook.controller';
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
    PlanGatewayController,
    SubscriptionGatewayController,
    TtsGatewayController,
    SessionGatewayController,
    InvitationGatewayController,
    HintsGatewayController,
    AssessmentGatewayController,
    PhoneCallGatewayController,
    PhoneCallWebhookController,
  ],
  providers: [
    { provide: APP_GUARD, useClass: GlobalJwtAuthGuard },
    UserClaimsInterceptor,
    SimulationWsGateway,
  ],
})
export class GatewayModule {}
