import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import * as crypto from 'crypto';
import axios from 'axios';
import { LtiPrismaService } from '../../prisma/lti-prisma.service';
import { PlatformRepository } from '../../platform/platform.repository';
import { LtiV1p1LaunchDto, LtiV1p1GradeDto } from '../dto/lti-v1.1-launch.dto';
import { parseRoles } from '../../common/utils/lti-roles.util';
import { LtiVersion } from '@prisma/lti-client';

const NONCE_WINDOW_SECONDS = 300; // 5-minute replay window

@Injectable()
export class LtiV1p1Service {
  private readonly logger = new Logger(LtiV1p1Service.name);

  constructor(
    private readonly db: LtiPrismaService,
    private readonly platformRepo: PlatformRepository,
  ) {}

  // ── Signature Validation ────────────────────────────────────────────────────

  /**
   * Validates an incoming LTI 1.1 launch request using OAuth 1.0a HMAC-SHA1.
   * Throws UnauthorizedException on any validation failure.
   */
  async validateLaunch(
    dto: LtiV1p1LaunchDto,
    requestUrl: string,
    method: string,
  ): Promise<{ platformId: string; sessionId: string }> {
    const {
      oauth_consumer_key,
      oauth_signature,
      oauth_timestamp,
      oauth_nonce,
      oauth_signature_method,
    } = dto;

    if (oauth_signature_method !== 'HMAC-SHA1') {
      throw new BadRequestException('Only HMAC-SHA1 signatures are supported');
    }

    // 1. Timestamp freshness check
    const now = Math.floor(Date.now() / 1000);
    const ts = parseInt(oauth_timestamp, 10);
    if (Math.abs(now - ts) > NONCE_WINDOW_SECONDS) {
      throw new UnauthorizedException('OAuth timestamp expired');
    }

    // 2. Nonce replay check
    await this.checkAndConsumeNonce(oauth_nonce, oauth_timestamp);

    // 3. Fetch platform and raw secret
    const platform =
      await this.platformRepo.findByConsumerKey(oauth_consumer_key);
    if (!platform.consumerSecret) {
      throw new UnauthorizedException(
        'Platform has no consumer secret configured',
      );
    }

    // Retrieve raw secret — NOTE: we stored it hashed. For signature verification we
    // need the raw secret, so platforms must also store it separately or we skip hashing.
    // In production, use a secrets manager (Vault, AWS Secrets Manager) to store raw.
    // For now we fetch the raw from env as a fallback pattern.
    const rawSecret = this.getRawConsumerSecret(oauth_consumer_key);

    // 4. Recompute signature
    const expectedSig = this.computeHmacSha1Signature(
      dto,
      requestUrl,
      method,
      rawSecret,
    );
    if (!this.safeCompare(expectedSig, oauth_signature)) {
      this.logger.warn(
        `Invalid OAuth signature for consumer key: ${oauth_consumer_key}`,
      );
      throw new UnauthorizedException('Invalid OAuth signature');
    }

    // 5. Persist session
    const roles = parseRoles(dto.roles?.split(',').map((r) => r.trim()) ?? []);
    const session = await this.db.session.create({
      data: {
        platformId: platform.id,
        version: LtiVersion.V1P1,
        userId: dto.user_id,
        email: dto.lis_person_contact_email_primary,
        name: dto.lis_person_name_full,
        roles,
        contextId: dto.context_id,
        contextLabel: dto.context_label,
        contextTitle: dto.context_title,
        resourceLinkId: dto.resource_link_id,
        resourceLinkTitle: dto.resource_link_title,
      },
    });

    return { platformId: platform.id, sessionId: session.id };
  }

  // ── Grade Passback (Basic Outcomes) ────────────────────────────────────────

  /**
   * Sends a grade back to the LMS using LTI 1.1 Basic Outcomes XML.
   * Score must be normalised between 0.0 and 1.0.
   */
  async submitGrade(dto: LtiV1p1GradeDto): Promise<void> {
    if (dto.score < 0 || dto.score > 1) {
      throw new BadRequestException(
        'Score must be between 0.0 and 1.0 for LTI 1.1',
      );
    }

    const rawSecret = this.getRawConsumerSecret(dto.consumerKey);
    const xmlBody = this.buildOutcomeXml(dto.sourcedId, dto.score);
    const authHeader = this.buildOAuthHeader(
      dto.outcomeServiceUrl,
      'POST',
      dto.consumerKey,
      rawSecret,
    );

    await axios.post(dto.outcomeServiceUrl, xmlBody, {
      headers: {
        'Content-Type': 'application/xml',
        Authorization: authHeader,
      },
    });

    // Record the score internally
    this.logger.log(
      `Grade submitted for sourcedId=${dto.sourcedId} score=${dto.score}`,
    );
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private async checkAndConsumeNonce(
    nonce: string,
    timestamp: string,
  ): Promise<void> {
    const expiresAt = new Date(
      (parseInt(timestamp, 10) + NONCE_WINDOW_SECONDS) * 1000,
    );

    // Clean expired nonces periodically (fire-and-forget)
    void this.db.nonce
      .deleteMany({ where: { expiresAt: { lt: new Date() } } })
      .catch(() => {});

    const existing = await this.db.nonce
      .findUnique({ where: { nonce } })
      .catch(() => null);
    if (existing) {
      throw new UnauthorizedException(
        'OAuth nonce already used (replay attack)',
      );
    }

    // Store nonce with state re-used as nonce for LTI 1.1
    await this.db.nonce.create({
      data: {
        nonce,
        state: nonce, // state and nonce share value for v1.1
        platformId: 'v1p1-placeholder', // filled in after platform lookup
        expiresAt,
        usedAt: new Date(),
      },
    });
  }

  /**
   * Constructs the OAuth 1.0a HMAC-SHA1 signature base string and signs it.
   * Follows https://oauth.net/core/1.0a/#signing_process
   */
  private computeHmacSha1Signature(
    params: Record<string, string | undefined>,
    requestUrl: string,
    method: string,
    consumerSecret: string,
  ): string {
    // Collect all params except oauth_signature
    const filtered: Record<string, string> = {};
    for (const [k, v] of Object.entries(params)) {
      if (k !== 'oauth_signature' && v !== undefined) {
        filtered[k] = v;
      }
    }

    const sorted = Object.keys(filtered)
      .sort()
      .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(filtered[k])}`)
      .join('&');

    const baseString = [
      method.toUpperCase(),
      encodeURIComponent(requestUrl),
      encodeURIComponent(sorted),
    ].join('&');

    const signingKey = `${encodeURIComponent(consumerSecret)}&`;
    return crypto
      .createHmac('sha1', signingKey)
      .update(baseString)
      .digest('base64');
  }

  private buildOAuthHeader(
    url: string,
    method: string,
    consumerKey: string,
    consumerSecret: string,
  ): string {
    const nonce = crypto.randomBytes(16).toString('hex');
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const params = {
      oauth_consumer_key: consumerKey,
      oauth_nonce: nonce,
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: timestamp,
      oauth_version: '1.0',
    };

    const sig = this.computeHmacSha1Signature(
      params,
      url,
      method,
      consumerSecret,
    );
    const allParams = { ...params, oauth_signature: sig };

    const headerParts = Object.entries(allParams)
      .map(([k, v]) => `${encodeURIComponent(k)}="${encodeURIComponent(v)}"`)
      .join(', ');

    return `OAuth ${headerParts}`;
  }

  /**
   * Builds the XML body for LTI 1.1 Basic Outcomes replaceResult call.
   */
  private buildOutcomeXml(sourcedId: string, score: number): string {
    const msgId = crypto.randomUUID();
    return `<?xml version="1.0" encoding="UTF-8"?>
<imsx_POXEnvelopeRequest xmlns="http://www.imsglobal.org/services/ltiv1p1/xsd/imsoms_v1p0">
  <imsx_POXHeader>
    <imsx_POXRequestHeaderInfo>
      <imsx_version>V1.0</imsx_version>
      <imsx_messageIdentifier>${msgId}</imsx_messageIdentifier>
    </imsx_POXRequestHeaderInfo>
  </imsx_POXHeader>
  <imsx_POXBody>
    <replaceResultRequest>
      <resultRecord>
        <sourcedGUID>
          <sourcedId>${sourcedId}</sourcedId>
        </sourcedGUID>
        <result>
          <resultScore>
            <language>en</language>
            <textString>${score.toFixed(4)}</textString>
          </resultScore>
        </result>
      </resultRecord>
    </replaceResultRequest>
  </imsx_POXBody>
</imsx_POXEnvelopeRequest>`;
  }

  /** Constant-time string comparison to prevent timing attacks */
  private safeCompare(a: string, b: string): boolean {
    try {
      return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
    } catch {
      return false;
    }
  }

  /**
   * Retrieves the raw consumer secret for HMAC signing.
   * In production this should delegate to a secrets manager.
   * Here we support ENV-based secrets keyed by consumer key.
   */
  private getRawConsumerSecret(consumerKey: string): string {
    // Pattern: LTI_SECRET_<CONSUMER_KEY_UPPER_UNDERSCORED>=rawsecret
    const envKey = `LTI_SECRET_${consumerKey.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;
    const secret = process.env[envKey];
    if (secret) return secret;
    // Fallback: LTI_DEFAULT_CONSUMER_SECRET (dev only)
    if (process.env.LTI_DEFAULT_CONSUMER_SECRET) {
      return process.env.LTI_DEFAULT_CONSUMER_SECRET;
    }
    throw new UnauthorizedException(
      `No secret configured for consumer key: ${consumerKey}`,
    );
  }
}
