import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as crypto from 'crypto';

export interface JwkKey {
  kty: string;
  kid?: string;
  use?: string;
  n?: string;
  e?: string;
  x5c?: string[];
  alg?: string;
}

interface JwksCache {
  keys: JwkKey[];
  fetchedAt: number;
}

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Fetches and caches JWKS (JSON Web Key Sets) from LMS platforms.
 * Used to verify the signature on LTI 1.3 ID tokens.
 *
 * Implements in-memory caching with configurable TTL to avoid hammering the
 * platform's JWKS endpoint on every launch. Keys are matched by `kid` header.
 */
@Injectable()
export class JwksService {
  private readonly logger = new Logger(JwksService.name);
  private readonly cache = new Map<string, JwksCache>();

  /**
   * Retrieves the public key for a given JWKS URL and key ID.
   * Falls back to fetching fresh keys if the cached entry is missing or stale.
   */
  async getPublicKey(jwksUrl: string, kid?: string): Promise<crypto.KeyObject> {
    const keys = await this.getKeys(jwksUrl);

    // Match by kid if provided, otherwise use first RS256 key
    const jwk = kid
      ? keys.find((k) => k.kid === kid)
      : keys.find((k) => k.alg === 'RS256' || k.kty === 'RSA');

    if (!jwk) {
      // Try a forced refresh — kid might be a newly rotated key
      const freshKeys = await this.fetchAndCache(jwksUrl);
      const freshJwk = kid
        ? freshKeys.find((k) => k.kid === kid)
        : freshKeys.find((k) => k.alg === 'RS256' || k.kty === 'RSA');

      if (!freshJwk) {
        throw new Error(`No suitable JWK found at ${jwksUrl} for kid=${kid}`);
      }
      return this.jwkToPublicKey(freshJwk);
    }

    return this.jwkToPublicKey(jwk);
  }

  /**
   * Returns the tool's own JWKS (used by LMS platforms to verify our signed JWTs).
   * In production, generate an RSA key pair and persist it securely.
   */
  getToolJwks(): { keys: JwkKey[] } {
    // In production: read from env/secrets and return the public JWK
    // For now, we return a placeholder that must be replaced
    const toolPublicJwk = process.env.LTI_TOOL_PUBLIC_JWK;
    if (toolPublicJwk) {
      try {
        return JSON.parse(toolPublicJwk) as { keys: JwkKey[] };
      } catch {
        this.logger.error('LTI_TOOL_PUBLIC_JWK is not valid JSON');
      }
    }
    return { keys: [] };
  }

  /** Signs a JWT using the tool's private key (for Deep Linking responses, AGS) */
  signWithToolKey(payload: object, expiresInSeconds = 3600): string {
    const rawKey = process.env.LTI_TOOL_PRIVATE_KEY;
    if (!rawKey) {
      throw new Error('LTI_TOOL_PRIVATE_KEY environment variable not set');
    }
    // Support both base64-encoded PEM (single-line .env storage) and raw PEM
    const privateKey = rawKey.startsWith('-----')
      ? rawKey
      : Buffer.from(rawKey, 'base64').toString('utf8');

    const header = Buffer.from(
      JSON.stringify({ alg: 'RS256', typ: 'JWT' }),
    ).toString('base64url');
    const body = Buffer.from(
      JSON.stringify({
        ...payload,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
      }),
    ).toString('base64url');

    const signature = crypto
      .createSign('RSA-SHA256')
      .update(`${header}.${body}`)
      .sign(privateKey, 'base64url');

    return `${header}.${body}.${signature}`;
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private async getKeys(jwksUrl: string): Promise<JwkKey[]> {
    const cached = this.cache.get(jwksUrl);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      return cached.keys;
    }
    return this.fetchAndCache(jwksUrl);
  }

  private async fetchAndCache(jwksUrl: string): Promise<JwkKey[]> {
    this.logger.debug(`Fetching JWKS from ${jwksUrl}`);
    const { data } = await axios.get<{ keys: JwkKey[] }>(jwksUrl, {
      timeout: 5000,
    });
    this.cache.set(jwksUrl, { keys: data.keys, fetchedAt: Date.now() });
    return data.keys;
  }

  private jwkToPublicKey(jwk: JwkKey): crypto.KeyObject {
    if (jwk.x5c && jwk.x5c.length > 0) {
      const cert = `-----BEGIN CERTIFICATE-----\n${jwk.x5c[0]}\n-----END CERTIFICATE-----`;
      return crypto.createPublicKey(cert);
    }

    if (jwk.kty === 'RSA' && jwk.n && jwk.e) {
      return crypto.createPublicKey({
        key: jwk as crypto.JsonWebKey,
        format: 'jwk',
      });
    }

    throw new Error(`Unsupported JWK format: ${JSON.stringify(jwk)}`);
  }
}
