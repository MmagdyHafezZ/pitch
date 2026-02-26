import { Test, TestingModule } from '@nestjs/testing';
import * as crypto from 'crypto';
import axios from 'axios';
import { JwksService } from '../../v1.3/services/jwks.service';

jest.mock('axios');
const mockAxios = axios as jest.Mocked<typeof axios>;

describe('JwksService', () => {
  let service: JwksService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [JwksService],
    }).compile();

    service = module.get<JwksService>(JwksService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('getToolJwks', () => {
    it('returns parsed JSON from LTI_TOOL_PUBLIC_JWK env var', () => {
      const jwks = { keys: [{ kty: 'RSA', kid: 'key-1', alg: 'RS256' }] };
      process.env.LTI_TOOL_PUBLIC_JWK = JSON.stringify(jwks);

      const result = service.getToolJwks();

      expect(result).toEqual(jwks);
    });

    it('returns empty keys when env var is not set', () => {
      delete process.env.LTI_TOOL_PUBLIC_JWK;

      const result = service.getToolJwks();

      expect(result).toEqual({ keys: [] });
    });

    it('returns empty keys when env var contains invalid JSON', () => {
      process.env.LTI_TOOL_PUBLIC_JWK = 'not-valid-json';

      const result = service.getToolJwks();

      expect(result).toEqual({ keys: [] });

      delete process.env.LTI_TOOL_PUBLIC_JWK;
    });
  });

  describe('signWithToolKey', () => {
    it('throws when LTI_TOOL_PRIVATE_KEY is not set', () => {
      delete process.env.LTI_TOOL_PRIVATE_KEY;

      expect(() => service.signWithToolKey({ sub: 'user1' })).toThrow(
        'LTI_TOOL_PRIVATE_KEY environment variable not set',
      );
    });

    it('produces a three-part JWT when a raw PEM key is provided', () => {
      const { privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      });

      process.env.LTI_TOOL_PRIVATE_KEY = privateKey;

      const jwt = service.signWithToolKey({ sub: 'user1' });

      expect(jwt.split('.')).toHaveLength(3);

      delete process.env.LTI_TOOL_PRIVATE_KEY;
    });

    it('produces a valid JWT from a base64-encoded PEM key', () => {
      const { privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      });

      process.env.LTI_TOOL_PRIVATE_KEY =
        Buffer.from(privateKey).toString('base64');

      const jwt = service.signWithToolKey({ sub: 'test' });

      expect(jwt.split('.')).toHaveLength(3);

      delete process.env.LTI_TOOL_PRIVATE_KEY;
    });
  });

  describe('getPublicKey', () => {
    it('fetches JWKS and returns a KeyObject for a matching kid', async () => {
      const { publicKey: pubPem } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      });
      const pubKeyObj = crypto.createPublicKey(pubPem);
      const jwkKey = pubKeyObj.export({ format: 'jwk' }) as any;
      jwkKey.kid = 'test-kid';
      jwkKey.alg = 'RS256';

      mockAxios.get = jest.fn().mockResolvedValue({ data: { keys: [jwkKey] } });

      const keyObj = await service.getPublicKey(
        'https://platform.example.com/jwks',
        'test-kid',
      );

      expect(keyObj).toBeDefined();
      expect(keyObj.type).toBe('public');
    });

    it('uses cached keys on second call', async () => {
      const { publicKey: pubPem } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      });
      const pubKeyObj = crypto.createPublicKey(pubPem);
      const jwkKey = pubKeyObj.export({ format: 'jwk' }) as any;
      jwkKey.kid = 'cached-kid';

      mockAxios.get = jest.fn().mockResolvedValue({ data: { keys: [jwkKey] } });

      await service.getPublicKey(
        'https://platform.example.com/jwks',
        'cached-kid',
      );
      await service.getPublicKey(
        'https://platform.example.com/jwks',
        'cached-kid',
      );

      expect(mockAxios.get).toHaveBeenCalledTimes(1);
    });

    it('forces a refresh when kid is not found in cache', async () => {
      const { publicKey: pubPem } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      });
      const pubKeyObj = crypto.createPublicKey(pubPem);
      const jwkKey = pubKeyObj.export({ format: 'jwk' }) as any;
      jwkKey.kid = 'new-kid';

      // First call returns no matching kid, second (forced refresh) returns it
      mockAxios.get = jest
        .fn()
        .mockResolvedValueOnce({
          data: { keys: [{ ...jwkKey, kid: 'old-kid' }] },
        })
        .mockResolvedValueOnce({ data: { keys: [jwkKey] } });

      const keyObj = await service.getPublicKey(
        'https://platform.example.com/jwks2',
        'new-kid',
      );

      expect(mockAxios.get).toHaveBeenCalledTimes(2);
      expect(keyObj.type).toBe('public');
    });

    it('throws when kid not found even after refresh', async () => {
      mockAxios.get = jest.fn().mockResolvedValue({ data: { keys: [] } });

      await expect(
        service.getPublicKey(
          'https://platform.example.com/jwks3',
          'missing-kid',
        ),
      ).rejects.toThrow('No suitable JWK found');
    });
  });
});
