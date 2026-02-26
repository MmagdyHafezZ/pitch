import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { JwksService } from './jwks.service';

interface TokenCache {
  accessToken: string;
  expiresAt: number;
}

/**
 * Manages OAuth2 client_credentials tokens for calling LTI Advantage services
 * (NRPS, AGS). Tokens are cached until 60 seconds before expiry.
 *
 * Scopes required per service:
 *  - NRPS:  https://purl.imsglobal.org/spec/lti-nrps/scope/contextmembership.readonly
 *  - AGS lineitems: https://purl.imsglobal.org/spec/lti-ags/scope/lineitem
 *                   https://purl.imsglobal.org/spec/lti-ags/scope/lineitem.readonly
 *  - AGS scores:    https://purl.imsglobal.org/spec/lti-ags/scope/score
 *  - AGS results:   https://purl.imsglobal.org/spec/lti-ags/scope/result.readonly
 */
@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);
  private readonly tokenCache = new Map<string, TokenCache>();

  constructor(private readonly jwksService: JwksService) {}

  /**
   * Returns a valid Bearer token for the given platform's token endpoint and scope.
   * Uses cached token if it hasn't expired.
   */
  async getAccessToken(
    tokenUrl: string,
    clientId: string,
    scope: string,
  ): Promise<string> {
    const cacheKey = `${tokenUrl}:${clientId}:${scope}`;
    const cached = this.tokenCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.accessToken;
    }

    const token = await this.fetchToken(tokenUrl, clientId, scope);
    return token;
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  private async fetchToken(
    tokenUrl: string,
    clientId: string,
    scope: string,
  ): Promise<string> {
    this.logger.debug(
      `Fetching OAuth2 token from ${tokenUrl} for scope=${scope}`,
    );

    // Build a signed JWT as client assertion (client_credentials with jwt_bearer)
    const clientAssertion = this.jwksService.signWithToolKey(
      {
        iss: clientId,
        sub: clientId,
        aud: tokenUrl,
        jti: Math.random().toString(36).slice(2),
      },
      60,
    );

    const params = new URLSearchParams({
      grant_type: 'client_credentials',
      client_assertion_type:
        'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
      client_assertion: clientAssertion,
      scope,
    });

    const { data } = await axios.post<{
      access_token: string;
      expires_in: number;
      token_type: string;
    }>(tokenUrl, params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 10000,
    });

    const expiresAt = Date.now() + (data.expires_in - 60) * 1000;
    const cacheKey = `${tokenUrl}:${clientId}:${scope}`;
    this.tokenCache.set(cacheKey, {
      accessToken: data.access_token,
      expiresAt,
    });

    return data.access_token;
  }
}
