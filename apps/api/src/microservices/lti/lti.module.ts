import { Module } from '@nestjs/common';
import { LtiController } from './lti.controller';
import { LtiPrismaModule } from './prisma/lti-prisma.module';
import { PlatformModule } from './platform/platform.module';
import { LtiV1p1Module } from './v1.1/lti-v1.1.module';
import { LtiV1p3Module } from './v1.3/lti-v1.3.module';
import { AdvantageModule } from './advantage/advantage.module';

/**
 * LTI Microservice root module.
 *
 * Architecture overview:
 *  ┌──────────────────────────────────────────────────────────────┐
 *  │  LtiModule                                                   │
 *  │  ├── PlatformModule      LMS platform registration + CRUD    │
 *  │  ├── LtiV1p1Module       LTI 1.1 OAuth HMAC-SHA1 launch      │
 *  │  ├── LtiV1p3Module       LTI 1.3 OIDC + JWT verification     │
 *  │  └── AdvantageModule                                         │
 *  │      ├── DeepLinkingModule  Content selection → LMS          │
 *  │      ├── NrpsModule         Course roster fetch              │
 *  │      └── AgsModule          Gradebook line items + scores    │
 *  └──────────────────────────────────────────────────────────────┘
 *
 * All inter-service calls use RabbitMQ @MessagePattern.
 * HTTP endpoints for LMS callbacks live in the gateway layer.
 */
@Module({
  imports: [
    LtiPrismaModule,
    PlatformModule,
    LtiV1p1Module,
    LtiV1p3Module,
    AdvantageModule,
  ],
  controllers: [LtiController],
  providers: [],
  exports: [LtiPrismaModule, PlatformModule, LtiV1p3Module, AdvantageModule],
})
export class LtiModule {}
