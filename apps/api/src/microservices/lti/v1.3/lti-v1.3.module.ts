import { Module } from '@nestjs/common';
import { LtiV1p3Controller } from './controllers/lti-v1.3.controller';
import { LtiV1p3Service } from './services/lti-v1.3.service';
import { OidcService } from './services/oidc.service';
import { JwksService } from './services/jwks.service';
import { TokenService } from './services/token.service';
import { PlatformModule } from '../platform/platform.module';
import { LtiPrismaModule } from '../prisma/lti-prisma.module';

@Module({
  imports: [LtiPrismaModule, PlatformModule],
  controllers: [LtiV1p3Controller],
  providers: [LtiV1p3Service, OidcService, JwksService, TokenService],
  exports: [LtiV1p3Service, OidcService, JwksService, TokenService],
})
export class LtiV1p3Module {}
