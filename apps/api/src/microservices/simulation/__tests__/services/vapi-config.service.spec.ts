import { InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { VapiConfigService } from '../../phone/vapi-config.service';

function makeConfigService(values: Record<string, string | undefined> = {}) {
  return {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}

const validConfig: Record<string, string> = {
  VAPI_API_KEY: 'test-api-key',
  VAPI_PHONE_NUMBER_ID: 'pn-123',
  PUBLIC_API_BASE_URL: 'https://api.example.com',
  VAPI_CONTEXT_SECRET: 'secret-123',
};

describe('VapiConfigService', () => {
  describe('onModuleInit', () => {
    it('succeeds when all required config is present', () => {
      const service = new VapiConfigService(makeConfigService(validConfig));

      expect(() => service.onModuleInit()).not.toThrow();
    });

    it('throws when VAPI_API_KEY is missing', () => {
      const config = { ...validConfig, VAPI_API_KEY: undefined };
      const service = new VapiConfigService(makeConfigService(config));

      expect(() => service.onModuleInit()).toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('getApiKey', () => {
    it('returns the configured API key', () => {
      const service = new VapiConfigService(makeConfigService(validConfig));

      expect(service.getApiKey()).toBe('test-api-key');
    });

    it('throws when API key is empty', () => {
      const service = new VapiConfigService(
        makeConfigService({ ...validConfig, VAPI_API_KEY: '' }),
      );

      expect(() => service.getApiKey()).toThrow();
    });
  });

  describe('getPhoneNumberId', () => {
    it('returns the configured phone number ID', () => {
      const service = new VapiConfigService(makeConfigService(validConfig));

      expect(service.getPhoneNumberId()).toBe('pn-123');
    });
  });

  describe('getCallUrl', () => {
    it('returns explicit VAPI_CALL_URL when configured', () => {
      const service = new VapiConfigService(
        makeConfigService({
          ...validConfig,
          VAPI_CALL_URL: 'https://custom.vapi.ai/call/phone',
        }),
      );

      expect(service.getCallUrl()).toBe('https://custom.vapi.ai/call/phone');
    });

    it('falls back to default base URL with /call/phone', () => {
      const service = new VapiConfigService(makeConfigService(validConfig));

      expect(service.getCallUrl()).toBe('https://api.vapi.ai/call/phone');
    });

    it('uses custom base URL when configured', () => {
      const service = new VapiConfigService(
        makeConfigService({
          ...validConfig,
          VAPI_BASE_URL: 'https://staging.vapi.ai',
        }),
      );

      expect(service.getCallUrl()).toBe('https://staging.vapi.ai/call/phone');
    });
  });

  describe('getPublicApiBaseUrl', () => {
    it('returns PUBLIC_API_BASE_URL', () => {
      const service = new VapiConfigService(makeConfigService(validConfig));

      expect(service.getPublicApiBaseUrl()).toBe('https://api.example.com');
    });

    it('falls back to API_BASE_URL', () => {
      const config = {
        ...validConfig,
        PUBLIC_API_BASE_URL: undefined,
        API_BASE_URL: 'https://fallback.com',
      };
      const service = new VapiConfigService(makeConfigService(config));

      expect(service.getPublicApiBaseUrl()).toBe('https://fallback.com');
    });

    it('throws when neither is configured', () => {
      const config = { ...validConfig, PUBLIC_API_BASE_URL: undefined };
      const service = new VapiConfigService(makeConfigService(config));

      expect(() => service.getPublicApiBaseUrl()).toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('getReachablePublicApiBaseUrl', () => {
    it('returns URL when it is publicly reachable', () => {
      const service = new VapiConfigService(makeConfigService(validConfig));

      expect(service.getReachablePublicApiBaseUrl()).toContain(
        'https://api.example.com',
      );
    });

    it('throws for localhost', () => {
      const config = {
        ...validConfig,
        PUBLIC_API_BASE_URL: 'http://localhost:3000',
      };
      const service = new VapiConfigService(makeConfigService(config));

      expect(() => service.getReachablePublicApiBaseUrl()).toThrow(
        'not reachable from Vapi',
      );
    });

    it('throws for 127.0.0.1', () => {
      const config = {
        ...validConfig,
        PUBLIC_API_BASE_URL: 'http://127.0.0.1:3000',
      };
      const service = new VapiConfigService(makeConfigService(config));

      expect(() => service.getReachablePublicApiBaseUrl()).toThrow(
        'not reachable from Vapi',
      );
    });

    it('throws for private 10.x.x.x addresses', () => {
      const config = {
        ...validConfig,
        PUBLIC_API_BASE_URL: 'http://10.0.0.5:3000',
      };
      const service = new VapiConfigService(makeConfigService(config));

      expect(() => service.getReachablePublicApiBaseUrl()).toThrow(
        'not reachable from Vapi',
      );
    });

    it('throws for private 192.168.x.x addresses', () => {
      const config = {
        ...validConfig,
        PUBLIC_API_BASE_URL: 'http://192.168.1.1:3000',
      };
      const service = new VapiConfigService(makeConfigService(config));

      expect(() => service.getReachablePublicApiBaseUrl()).toThrow(
        'not reachable from Vapi',
      );
    });

    it('throws for private 172.16-31.x.x addresses', () => {
      const config = {
        ...validConfig,
        PUBLIC_API_BASE_URL: 'http://172.16.0.1:3000',
      };
      const service = new VapiConfigService(makeConfigService(config));

      expect(() => service.getReachablePublicApiBaseUrl()).toThrow(
        'not reachable from Vapi',
      );
    });

    it('allows 172.x outside 16-31 range', () => {
      const config = {
        ...validConfig,
        PUBLIC_API_BASE_URL: 'http://172.32.0.1:3000',
      };
      const service = new VapiConfigService(makeConfigService(config));

      expect(() => service.getReachablePublicApiBaseUrl()).not.toThrow();
    });

    it('throws for .local domains', () => {
      const config = {
        ...validConfig,
        PUBLIC_API_BASE_URL: 'http://myhost.local:3000',
      };
      const service = new VapiConfigService(makeConfigService(config));

      expect(() => service.getReachablePublicApiBaseUrl()).toThrow(
        'not reachable from Vapi',
      );
    });

    it('throws for invalid URL format', () => {
      const config = { ...validConfig, PUBLIC_API_BASE_URL: 'not-a-url' };
      const service = new VapiConfigService(makeConfigService(config));

      expect(() => service.getReachablePublicApiBaseUrl()).toThrow(
        'valid absolute URL',
      );
    });
  });

  describe('getContextSecret', () => {
    it('returns VAPI_CONTEXT_SECRET', () => {
      const service = new VapiConfigService(makeConfigService(validConfig));

      expect(service.getContextSecret()).toBe('secret-123');
    });

    it('falls back to JWT_SECRET', () => {
      const config = {
        ...validConfig,
        VAPI_CONTEXT_SECRET: undefined,
        JWT_SECRET: 'jwt-secret',
      };
      const service = new VapiConfigService(makeConfigService(config));

      expect(service.getContextSecret()).toBe('jwt-secret');
    });

    it('throws when neither is configured', () => {
      const config = { ...validConfig, VAPI_CONTEXT_SECRET: undefined };
      const service = new VapiConfigService(makeConfigService(config));

      expect(() => service.getContextSecret()).toThrow(
        InternalServerErrorException,
      );
    });
  });
});
