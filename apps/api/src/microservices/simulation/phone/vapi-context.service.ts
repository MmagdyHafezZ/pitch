import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { VapiConfigService } from './vapi-config.service';

export interface VapiRequestContext {
  sessionId: string;
  userId: string;
  purpose: 'phone-call';
  iat: number;
  exp: number;
}

@Injectable()
export class VapiContextService {
  private readonly logger = new Logger(VapiContextService.name);

  constructor(private readonly vapiConfig: VapiConfigService) {}

  createToken(
    input: Pick<VapiRequestContext, 'sessionId' | 'userId' | 'purpose'>,
    ttlSeconds = 60 * 60,
  ): string {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const payload: VapiRequestContext = {
      ...input,
      iat: nowSeconds,
      exp: nowSeconds + ttlSeconds,
    };

    const encodedPayload = this.toBase64Url(JSON.stringify(payload));
    const signature = this.sign(encodedPayload);
    return `${encodedPayload}.${signature}`;
  }

  verifyToken(token: string): VapiRequestContext {
    const normalizedToken = this.normalizeToken(token);
    const [encodedPayload, signature] = normalizedToken.split('.');

    if (!encodedPayload || !signature) {
      throw new UnauthorizedException('Invalid Vapi request token.');
    }

    const expectedSignature = this.sign(encodedPayload);
    const provided = Buffer.from(signature, 'utf8');
    const expected = Buffer.from(expectedSignature, 'utf8');

    if (
      provided.length !== expected.length ||
      !timingSafeEqual(provided, expected)
    ) {
      throw new UnauthorizedException('Invalid Vapi request signature.');
    }

    const payload = JSON.parse(
      Buffer.from(this.fromBase64Url(encodedPayload), 'base64').toString(
        'utf8',
      ),
    ) as VapiRequestContext;

    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
      throw new UnauthorizedException('Vapi request token expired.');
    }

    if (
      !payload.sessionId ||
      !payload.userId ||
      payload.purpose !== 'phone-call'
    ) {
      throw new UnauthorizedException('Vapi request context is incomplete.');
    }

    return payload;
  }

  buildGatewayUrl(path: string, token: string): string {
    const url = new URL(
      `/api/v1/${path.replace(/^\/+/, '')}`,
      this.vapiConfig.getReachablePublicApiBaseUrl(),
    );
    url.searchParams.set('token', token);
    return url.toString();
  }

  buildGatewayPathTokenUrl(path: string, token: string): string {
    return new URL(
      `/api/v1/${path.replace(/^\/+/, '')}/${encodeURIComponent(token)}`,
      this.vapiConfig.getReachablePublicApiBaseUrl(),
    ).toString();
  }

  private sign(encodedPayload: string): string {
    return createHmac('sha256', this.vapiConfig.getContextSecret())
      .update(encodedPayload)
      .digest('base64url');
  }

  private normalizeToken(token: string): string {
    const trimmed = token.trim();
    const slashIndex = trimmed.indexOf('/');
    if (slashIndex === -1) {
      return trimmed;
    }

    const normalized = trimmed.slice(0, slashIndex);
    this.logger.warn(
      `Normalizing malformed Vapi token by trimming unexpected suffix after position ${slashIndex}.`,
    );
    return normalized;
  }

  private toBase64Url(value: string): string {
    return Buffer.from(value, 'utf8').toString('base64url');
  }

  private fromBase64Url(value: string): string {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const remainder = normalized.length % 4;
    return remainder === 0
      ? normalized
      : `${normalized}${'='.repeat(4 - remainder)}`;
  }
}
