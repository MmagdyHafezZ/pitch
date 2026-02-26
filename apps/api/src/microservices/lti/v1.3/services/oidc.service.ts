import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { LtiPrismaService } from '../../prisma/lti-prisma.service';
import { PlatformRepository } from '../../platform/platform.repository';
import { OidcLoginDto, OidcAuthRequest } from '../dto/oidc-login.dto';

const STATE_TTL_SECONDS = 300; // 5 minutes for the OIDC state to be consumed

/**
 * Handles the LTI 1.3 OIDC Third-Party Initiated Login flow.
 *
 * Flow:
 *   1. LMS → POST /lti/v1.3/oidc/login  (OidcLoginDto)
 *   2. We validate issuer + client_id, generate state + nonce, store in DB
 *   3. We redirect to platform's authLoginUrl with auth request params
 *   4. LMS POST → /lti/v1.3/launch with id_token + state
 *   5. We validate state, then hand off to LtiV1p3Service for JWT verification
 */
@Injectable()
export class OidcService {
  private readonly logger = new Logger(OidcService.name);

  constructor(
    private readonly db: LtiPrismaService,
    private readonly platformRepo: PlatformRepository,
  ) {}

  /**
   * Processes the OIDC login initiation request and returns the redirect
   * URL + params to send the browser to the platform's auth endpoint.
   */
  async initiateLogin(
    dto: OidcLoginDto,
    toolLaunchUrl: string,
  ): Promise<OidcAuthRequest> {
    // Resolve platform by issuer (+ optional client_id)
    const clientId = dto.client_id;
    const platform = clientId
      ? await this.platformRepo.findByIssuerAndClientId(dto.iss, clientId)
      : await this.platformRepo.findByIssuerAndClientId(dto.iss, '');

    if (!platform.authLoginUrl) {
      throw new Error(`Platform ${platform.id} has no authLoginUrl configured`);
    }

    // Generate cryptographically random state and nonce
    const state = crypto.randomBytes(32).toString('hex');
    const nonce = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + STATE_TTL_SECONDS * 1000);

    await this.db.nonce.create({
      data: {
        nonce,
        state,
        platformId: platform.id,
        expiresAt,
      },
    });

    this.logger.debug(
      `OIDC login initiated for platform=${platform.id} state=${state.slice(0, 8)}...`,
    );

    return {
      redirectUrl: platform.authLoginUrl,
      params: {
        scope: 'openid',
        response_type: 'id_token',
        client_id: platform.clientId!,
        redirect_uri: toolLaunchUrl,
        login_hint: dto.login_hint,
        state,
        response_mode: 'form_post',
        nonce,
        prompt: 'none',
        ...(dto.lti_message_hint && { lti_message_hint: dto.lti_message_hint }),
      },
    };
  }

  /**
   * Validates that the state returned in the launch matches a stored nonce record.
   * Returns the platform ID associated with this state.
   * Marks the nonce as used (one-time use).
   */
  async consumeState(
    state: string,
  ): Promise<{ platformId: string; nonce: string }> {
    const record = await this.db.nonce.findUnique({ where: { state } });

    if (!record) {
      throw new Error('Invalid or unknown OIDC state');
    }

    if (record.usedAt) {
      throw new Error('OIDC state already consumed (replay attack)');
    }

    if (new Date() > record.expiresAt) {
      throw new Error('OIDC state expired');
    }

    // Mark as used
    await this.db.nonce.update({
      where: { state },
      data: { usedAt: new Date() },
    });

    return { platformId: record.platformId, nonce: record.nonce };
  }
}
