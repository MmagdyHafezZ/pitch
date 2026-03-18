import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Inject,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { ClientProxy } from '@nestjs/microservices';
import { ApiTags, ApiOperation, ApiSecurity } from '@nestjs/swagger';
import { firstValueFrom } from 'rxjs';
import { LTI_PATTERNS } from '@microservices/lti/common/constants/lti-patterns.constants';
import { CreatePlatformDto } from '@microservices/lti/platform/dto/create-platform.dto';

/**
 * LTI Platform management endpoints (admin use).
 * Used to register LMS platforms (Canvas, Moodle, etc.) and manage their configs.
 * All routes require JWT authentication.
 */
@ApiTags('LTI Management')
@ApiSecurity('bearer')
@Controller('lti/platforms')
export class LtiManagementGatewayController {
  constructor(@Inject('LTI_SERVICE') private readonly ltiClient: ClientProxy) {}

  @Post()
  @ApiOperation({ summary: 'Register a new LMS platform' })
  create(@Body() dto: CreatePlatformDto) {
    return firstValueFrom(
      this.ltiClient.send(LTI_PATTERNS.PLATFORM_CREATE, dto),
    );
  }

  @Get()
  @ApiOperation({ summary: 'List all registered LMS platforms' })
  findAll() {
    return firstValueFrom(
      this.ltiClient.send(LTI_PATTERNS.PLATFORM_FIND_ALL, {}),
    );
  }

  /**
   * GET /api/v1/lti/platforms/credentials
   * Must be declared before @Get(':id') so NestJS matches the literal
   * segment "credentials" before the wildcard param route.
   */
  @Get('credentials')
  @ApiOperation({ summary: 'Get LTI tool credentials for LMS configuration' })
  getCredentials() {
    const apiBase = process.env.API_BASE_URL ?? 'http://localhost:4000';
    const ltiBase = `${apiBase}/api/v1/lti`;

    let publicKeyPem: string | null = null;
    try {
      const jwkJson = process.env.LTI_TOOL_PUBLIC_JWK;
      if (jwkJson) {
        const { keys } = JSON.parse(jwkJson) as {
          keys: Array<{
            kty?: string;
            n?: string;
            e?: string;
            [k: string]: unknown;
          }>;
        };
        const rsaKey = keys.find((k) => k.kty === 'RSA' && k.n && k.e);
        if (rsaKey) {
          const keyObj = crypto.createPublicKey({
            key: rsaKey as crypto.JsonWebKey,
            format: 'jwk',
          });
          publicKeyPem = keyObj.export({
            type: 'spki',
            format: 'pem',
          }) as string;
        }
      }
    } catch {
      // Public key unavailable — admins can use the JWKS URL instead
    }

    return {
      v13: {
        launchUrl: `${ltiBase}/v1.3/launch`,
        oidcLoginUrl: `${ltiBase}/v1.3/oidc/login`,
        jwksUrl: `${ltiBase}/v1.3/jwks`,
        redirectUri: `${ltiBase}/v1.3/launch`,
        publicKeyPem,
      },
      v11: {
        launchUrl: `${ltiBase}/v1.1/launch`,
      },
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific platform by ID' })
  findOne(@Param('id') id: string) {
    return firstValueFrom(
      this.ltiClient.send(LTI_PATTERNS.PLATFORM_FIND_ONE, { id }),
    );
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a platform configuration' })
  update(@Param('id') id: string, @Body() dto: Partial<CreatePlatformDto>) {
    return firstValueFrom(
      this.ltiClient.send(LTI_PATTERNS.PLATFORM_UPDATE, { id, dto }),
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Deactivate a platform' })
  remove(@Param('id') id: string) {
    return firstValueFrom(
      this.ltiClient.send(LTI_PATTERNS.PLATFORM_DELETE, { id }),
    );
  }

  @Get(':sessionId/session')
  @ApiOperation({ summary: 'Get LTI session details' })
  getSession(@Param('sessionId') sessionId: string) {
    return firstValueFrom(
      this.ltiClient.send(LTI_PATTERNS.SESSION_FIND, { sessionId }),
    );
  }

  @Patch(':sessionId/session/link')
  @ApiOperation({ summary: 'Link an LTI session to a PITCH session' })
  linkSession(
    @Param('sessionId') sessionId: string,
    @Body() body: { pitchSessionId?: string; pitchUserId?: string },
  ) {
    return firstValueFrom(
      this.ltiClient.send(LTI_PATTERNS.SESSION_LINK_PITCH, {
        sessionId,
        ...body,
      }),
    );
  }
}
