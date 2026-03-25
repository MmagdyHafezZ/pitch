import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { JwtModule, type JwtSignOptions } from '@nestjs/jwt';
import { UserGatewayController } from './controllers/userManagement/user-gateway.controller';
import { AuthGatewayController } from './controllers/userManagement/auth-gateway.controller';
import { TeamGatewayController } from './controllers/userManagement/team-gateway.controller';
import { PlanGatewayController } from './controllers/userManagement/plans.controller';
import { SubscriptionGatewayController } from './controllers/userManagement/subscription.controller';
import { StudioAccessGatewayController } from './controllers/userManagement/studio-access-gateway.controller';
import { SalesforceGatewayController } from './controllers/crm/salesforce-gateway.controller';
import { SessionGatewayController } from './controllers/simulation/session-gateway.controller';
import { ScenarioGatewayController } from './controllers/simulation/scenario-gateway.controller';
import { InvitationGatewayController } from './controllers/simulation/invitation-gateway.controller';
import { HintsGatewayController } from './controllers/simulation/hints-gateway.controller';
import { AssessmentGatewayController } from './controllers/simulation/assessment-gateway.controller';
import { PhoneCallGatewayController } from './controllers/simulation/phone-call-gateway.controller';
import { PhoneCallWebhookController } from './controllers/simulation/phone-call-webhook.controller';
import { GlobalJwtAuthGuard } from './guards/global-jwt-auth.guard';
import { UserClaimsInterceptor } from './interceptors/user-claims.interceptor';
import { TtsGatewayController } from './controllers/simulation/tts.controller';
import { LtiV1p3GatewayController } from './controllers/lti/lti-v1.3-gateway.controller';
import { LtiV1p1GatewayController } from './controllers/lti/lti-v1.1-gateway.controller';
import { LtiAdvantageGatewayController } from './controllers/lti/lti-advantage-gateway.controller';
import { LtiManagementGatewayController } from './controllers/lti/lti-management-gateway.controller';
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
import { SimulationWsGateway } from './controllers/simulation/simulation-ws.gateway';
import { SimulationModule } from '@microservices/simulation/simulation.module';
import { RagController } from '@microservices/simulation/rag/rag.controller';
import { ChallengesGatewayController } from './controllers/challenges/challenges-gateway.controller';
import { CalendarGatewayController } from './controllers/calendar/calendar-gateway.controller';
import { SupportChatGatewayController } from './controllers/support/support-chat-gateway.controller';
import { SupportAttachmentGatewayController } from './controllers/support/support-attachment-gateway.controller';
import { CoachStreamService } from './controllers/support/coach-stream.service';
import { SupportAttachmentStorageService } from './controllers/support/support-attachment-storage.service';
import { S3GatewayController } from './controllers/s3/s3-gateway.controller';
import { CoinsGatewayController } from './controllers/userManagement/coins-gateway.controller';

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
    SimulationModule,
  ],
  controllers: [
    UserGatewayController,
    AuthGatewayController,
    TeamGatewayController,
    PlanGatewayController,
    SubscriptionGatewayController,
    StudioAccessGatewayController,
    SalesforceGatewayController,
    TtsGatewayController,
    SessionGatewayController,
    ScenarioGatewayController,
    InvitationGatewayController,
    HintsGatewayController,
    AssessmentGatewayController,
    PhoneCallGatewayController,
    PhoneCallWebhookController,
    LtiV1p3GatewayController,
    LtiV1p1GatewayController,
    LtiAdvantageGatewayController,
    LtiManagementGatewayController,
    RagController,
    ChallengesGatewayController,
    CalendarGatewayController,
    S3GatewayController,
    SupportChatGatewayController,
    SupportAttachmentGatewayController,
    CoinsGatewayController,
  ],
  providers: [
    { provide: APP_GUARD, useClass: GlobalJwtAuthGuard },
    UserClaimsInterceptor,
    SimulationWsGateway,
    CoachStreamService,
    SupportAttachmentStorageService,
  ],
})
export class GatewayModule {}
