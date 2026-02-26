import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { LtiPrismaService } from '../../prisma/lti-prisma.service';
import { PlatformRepository } from '../../platform/platform.repository';
import { JwksService } from './jwks.service';
import { OidcService } from './oidc.service';
import {
  Lti1p3Claims,
  LtiLaunchContext,
} from '../../common/interfaces/lti-claims.interface';
import { parseRoles } from '../../common/utils/lti-roles.util';
import { LtiVersion } from '@prisma/lti-client';

const ALLOWED_MESSAGE_TYPES = [
  'LtiResourceLinkRequest',
  'LtiDeepLinkingRequest',
  'LtiSubmissionReviewRequest',
];

/**
 * Core LTI 1.3 launch verification service.
 *
 * Responsible for:
 * 1. Verifying the signed ID token from the LMS
 * 2. Validating all LTI-specific claims
 * 3. Creating/updating the LTI session record
 * 4. Returning a normalised LtiLaunchContext to downstream services
 */
@Injectable()
export class LtiV1p3Service {
  private readonly logger = new Logger(LtiV1p3Service.name);

  constructor(
    private readonly db: LtiPrismaService,
    private readonly platformRepo: PlatformRepository,
    private readonly jwksService: JwksService,
    private readonly oidcService: OidcService,
  ) {}

  /**
   * Full LTI 1.3 launch verification.
   *
   * @param idToken   The raw JWT id_token from the LMS form POST
   * @param state     The OIDC state returned from the LMS
   * @returns         Normalised LtiLaunchContext + raw claims
   */
  async verifyLaunch(
    idToken: string,
    state: string,
  ): Promise<{ context: LtiLaunchContext; claims: Lti1p3Claims }> {
    // 1. Consume state — validates it exists, isn't expired, and marks as used
    const { platformId, nonce: expectedNonce } =
      await this.oidcService.consumeState(state);

    // 2. Decode JWT header to get kid + alg (without verifying yet)
    const { header } = this.decodeJwtUnsafe(idToken);

    // 3. Fetch platform config
    const platform = await this.platformRepo.findById(platformId);
    if (!platform.keysetUrl) {
      throw new BadRequestException(
        `Platform ${platformId} has no JWKS URL configured`,
      );
    }

    // 4. Get platform's public key and verify signature
    const publicKey = await this.jwksService.getPublicKey(
      platform.keysetUrl,
      header.kid,
    );
    const claims = this.verifyJwtSignature(idToken, publicKey) as Lti1p3Claims;

    // 5. Validate standard OIDC claims
    this.validateOidcClaims(
      claims,
      platform.clientId!,
      platform.issuer!,
      expectedNonce,
    );

    // 6. Validate LTI-specific claims
    this.validateLtiClaims(claims);

    // 7. Ensure deployment is registered
    const deploymentId =
      claims['https://purl.imsglobal.org/spec/lti/claim/deployment_id'];
    await this.ensureDeployment(platformId, deploymentId);

    // 8. Persist session
    const session = await this.createOrUpdateSession(platformId, claims);

    // 9. Build normalised context
    const context = this.buildLaunchContext(platform.id, session.id, claims);

    this.logger.log(
      `LTI 1.3 launch verified: session=${session.id} type=${claims['https://purl.imsglobal.org/spec/lti/claim/message_type']}`,
    );

    return { context, claims };
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private decodeJwtUnsafe(token: string): {
    header: { kid?: string; alg?: string };
    payload: unknown;
  } {
    const parts = token.split('.');
    if (parts.length !== 3) throw new BadRequestException('Malformed JWT');
    try {
      const header = JSON.parse(
        Buffer.from(parts[0], 'base64url').toString(),
      ) as {
        kid?: string;
        alg?: string;
      };
      const payload = JSON.parse(
        Buffer.from(parts[1], 'base64url').toString(),
      ) as unknown;
      return { header, payload };
    } catch {
      throw new BadRequestException('Unable to decode JWT');
    }
  }

  private verifyJwtSignature(
    token: string,
    publicKey: crypto.KeyObject,
  ): unknown {
    const [headerB64, payloadB64, signatureB64] = token.split('.');
    const data = `${headerB64}.${payloadB64}`;

    const isValid = crypto
      .createVerify('RSA-SHA256')
      .update(data)
      .verify(publicKey, Buffer.from(signatureB64, 'base64url'));

    if (!isValid) {
      throw new UnauthorizedException('JWT signature verification failed');
    }

    return JSON.parse(Buffer.from(payloadB64, 'base64url').toString());
  }

  private validateOidcClaims(
    claims: Lti1p3Claims,
    clientId: string,
    issuer: string,
    expectedNonce: string,
  ): void {
    const now = Math.floor(Date.now() / 1000);

    if (claims.iss !== issuer) {
      throw new UnauthorizedException(
        `Issuer mismatch: got ${claims.iss}, expected ${issuer}`,
      );
    }

    const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (!aud.includes(clientId)) {
      throw new UnauthorizedException(`Client ID not in audience: ${clientId}`);
    }

    if (claims.exp < now) {
      throw new UnauthorizedException('JWT has expired');
    }

    if (claims.iat > now + 60) {
      throw new UnauthorizedException('JWT issued in the future');
    }

    if (claims.nonce !== expectedNonce) {
      throw new UnauthorizedException('Nonce mismatch');
    }
  }

  private validateLtiClaims(claims: Lti1p3Claims): void {
    const version = claims['https://purl.imsglobal.org/spec/lti/claim/version'];
    if (version !== '1.3.0') {
      throw new BadRequestException(`Unsupported LTI version: ${version}`);
    }

    const messageType =
      claims['https://purl.imsglobal.org/spec/lti/claim/message_type'];
    if (!ALLOWED_MESSAGE_TYPES.includes(messageType)) {
      throw new BadRequestException(`Unsupported message type: ${messageType}`);
    }

    if (!claims['https://purl.imsglobal.org/spec/lti/claim/deployment_id']) {
      throw new BadRequestException('Missing deployment_id claim');
    }

    if (
      !claims['https://purl.imsglobal.org/spec/lti/claim/resource_link']?.id
    ) {
      throw new BadRequestException('Missing resource_link.id claim');
    }
  }

  private async ensureDeployment(
    platformId: string,
    deploymentId: string,
  ): Promise<void> {
    const existing = await this.db.deployment
      .findUnique({
        where: { platformId_deploymentId: { platformId, deploymentId } },
      })
      .catch(() => null);

    if (!existing) {
      await this.db.deployment.create({ data: { platformId, deploymentId } });
      this.logger.log(
        `Auto-registered deployment: ${deploymentId} for platform ${platformId}`,
      );
    }
  }

  private async createOrUpdateSession(
    platformId: string,
    claims: Lti1p3Claims,
  ) {
    const deploymentId =
      claims['https://purl.imsglobal.org/spec/lti/claim/deployment_id'];
    const resourceLink =
      claims['https://purl.imsglobal.org/spec/lti/claim/resource_link'];
    const context = claims['https://purl.imsglobal.org/spec/lti/claim/context'];
    const rawRoles = claims['https://purl.imsglobal.org/spec/lti/claim/roles'];
    const roles = parseRoles(rawRoles);

    const dlClaim =
      claims[
        'https://purl.imsglobal.org/spec/lti-dl/claim/deep_linking_settings'
      ];
    const nrpsClaim =
      claims['https://purl.imsglobal.org/spec/lti-nrps/claim/namesroleservice'];
    const agsClaim =
      claims['https://purl.imsglobal.org/spec/lti-ags/claim/endpoint'];

    return this.db.session.create({
      data: {
        platformId,
        deploymentId,
        version: LtiVersion.V1P3,
        sub: claims.sub,
        userId: claims.sub,
        email: claims.email,
        name: claims.name,
        roles,
        contextId: context?.id,
        contextLabel: context?.label,
        contextTitle: context?.title,
        resourceLinkId: resourceLink.id,
        resourceLinkTitle: resourceLink.title,
        nonce: claims.nonce,
        issuedAt: new Date(claims.iat * 1000),
        deepLinkReturnUrl: dlClaim?.deep_link_return_url,
        namesRolesServiceUrl: nrpsClaim?.context_memberships_url,
        lineItemsServiceUrl: agsClaim?.lineitems ?? agsClaim?.lineitem,
      },
    });
  }

  private buildLaunchContext(
    platformId: string,
    sessionId: string,
    claims: Lti1p3Claims,
  ): LtiLaunchContext {
    const agsClaim =
      claims['https://purl.imsglobal.org/spec/lti-ags/claim/endpoint'];
    const nrpsClaim =
      claims['https://purl.imsglobal.org/spec/lti-nrps/claim/namesroleservice'];
    const dlClaim =
      claims[
        'https://purl.imsglobal.org/spec/lti-dl/claim/deep_linking_settings'
      ];
    const context = claims['https://purl.imsglobal.org/spec/lti/claim/context'];
    const resourceLink =
      claims['https://purl.imsglobal.org/spec/lti/claim/resource_link'];

    return {
      version: '1.3',
      platformId,
      sessionId,
      user: {
        id: claims.sub,
        email: claims.email,
        name: claims.name,
        roles: claims['https://purl.imsglobal.org/spec/lti/claim/roles'],
      },
      course: context
        ? { id: context.id, label: context.label, title: context.title }
        : undefined,
      resourceLink: { id: resourceLink.id, title: resourceLink.title },
      services: {
        deepLinkReturnUrl: dlClaim?.deep_link_return_url,
        namesRolesUrl: nrpsClaim?.context_memberships_url,
        lineItemsUrl: agsClaim?.lineitems,
        lineItemUrl: agsClaim?.lineitem,
        agsScopes: agsClaim?.scope,
      },
    };
  }
}
