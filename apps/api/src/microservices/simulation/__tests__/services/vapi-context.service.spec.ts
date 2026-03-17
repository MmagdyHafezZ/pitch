import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { VapiConfigService } from '../../phone/vapi-config.service';
import { VapiContextService } from '../../phone/vapi-context.service';

describe('VapiContextService', () => {
  let service: VapiContextService;

  beforeEach(() => {
    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'VAPI_API_KEY') return 'vapi-key';
        if (key === 'VAPI_PHONE_NUMBER_ID') return 'phone-number-id';
        if (key === 'PUBLIC_API_BASE_URL') return 'https://api.example.com';
        if (key === 'VAPI_CONTEXT_SECRET') return 'context-secret';
        return undefined;
      }),
    } as unknown as ConfigService;

    const vapiConfig = new VapiConfigService(configService);
    service = new VapiContextService(vapiConfig);
  });

  it('creates and verifies a signed phone-call token', () => {
    const token = service.createToken({
      sessionId: 'session-1',
      userId: 'user-1',
      purpose: 'phone-call',
    });

    expect(service.verifyToken(token)).toEqual(
      expect.objectContaining({
        sessionId: 'session-1',
        userId: 'user-1',
        purpose: 'phone-call',
      }),
    );
  });

  it('rejects tampered tokens', () => {
    const token = service.createToken({
      sessionId: 'session-1',
      userId: 'user-1',
      purpose: 'phone-call',
    });
    const [payload] = token.split('.');
    const tampered = `${payload}.invalid-signature`;

    expect(() => service.verifyToken(tampered)).toThrow(UnauthorizedException);
  });

  it('rejects expired tokens', () => {
    const token = service.createToken(
      {
        sessionId: 'session-1',
        userId: 'user-1',
        purpose: 'phone-call',
      },
      -10,
    );

    expect(() => service.verifyToken(token)).toThrow(
      'Vapi request token expired.',
    );
  });

  it('builds gateway callback URLs with the signed token', () => {
    const url = service.buildGatewayUrl(
      'simulation/phone-calls/vapi/server',
      'signed-token',
    );

    expect(url).toBe(
      'https://api.example.com/api/v1/simulation/phone-calls/vapi/server?token=signed-token',
    );
  });
});
