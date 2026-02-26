import { Test, TestingModule } from '@nestjs/testing';
import * as crypto from 'crypto';
import axios from 'axios';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { LtiV1p1Service } from '../../v1.1/services/lti-v1.1.service';
import { LtiPrismaService } from '../../prisma/lti-prisma.service';
import { PlatformRepository } from '../../platform/platform.repository';
import {
  createMockLtiPrismaService,
  MockLtiPrismaService,
} from '../mocks/lti-prisma.service.mock';

jest.mock('axios');
const mockAxios = axios as jest.Mocked<typeof axios>;

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Compute a correct HMAC-SHA1 signature for the given params/url/method.
 * Mirrors the private computeHmacSha1Signature logic in the service.
 */
function computeSig(
  params: Record<string, string>,
  url: string,
  method: string,
  secret: string,
): string {
  const filtered: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) {
    if (k !== 'oauth_signature') filtered[k] = v;
  }
  const sorted = Object.keys(filtered)
    .sort()
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(filtered[k])}`)
    .join('&');
  const baseString = [
    method.toUpperCase(),
    encodeURIComponent(url),
    encodeURIComponent(sorted),
  ].join('&');
  const signingKey = `${encodeURIComponent(secret)}&`;
  return crypto
    .createHmac('sha1', signingKey)
    .update(baseString)
    .digest('base64');
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('LtiV1p1Service', () => {
  let service: LtiV1p1Service;
  let db: MockLtiPrismaService;

  const mockPlatformRepo = {
    findByConsumerKey: jest.fn(),
  };

  const consumerKey = 'test-consumer-key';
  const consumerSecret = 'super-secret';
  const requestUrl = 'https://tool.example.com/lti/v1.1/launch';

  const mockPlatform = {
    id: 'platform-1',
    consumerKey,
    consumerSecret: '$2b$10$hashed',
  };

  beforeEach(async () => {
    db = createMockLtiPrismaService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LtiV1p1Service,
        { provide: LtiPrismaService, useValue: db },
        { provide: PlatformRepository, useValue: mockPlatformRepo },
      ],
    }).compile();

    service = module.get<LtiV1p1Service>(LtiV1p1Service);

    // Default env secret
    process.env.LTI_DEFAULT_CONSUMER_SECRET = consumerSecret;
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.LTI_DEFAULT_CONSUMER_SECRET;
  });

  describe('validateLaunch', () => {
    it('validates a correctly signed launch and creates a session', async () => {
      const now = Math.floor(Date.now() / 1000).toString();
      const nonce = crypto.randomBytes(8).toString('hex');

      const params: Record<string, string> = {
        oauth_consumer_key: consumerKey,
        oauth_nonce: nonce,
        oauth_timestamp: now,
        oauth_signature_method: 'HMAC-SHA1',
        oauth_version: '1.0',
        lti_version: 'LTI-1p0',
        lti_message_type: 'basic-lti-launch-request',
        resource_link_id: 'rl-1',
        user_id: 'user-1',
      };
      const sig = computeSig(params, requestUrl, 'POST', consumerSecret);

      const dto = { ...params, oauth_signature: sig };

      mockPlatformRepo.findByConsumerKey.mockResolvedValue(mockPlatform);
      db.nonce.deleteMany.mockResolvedValue({ count: 0 });
      db.nonce.findUnique.mockResolvedValue(null);
      db.nonce.create.mockResolvedValue({});
      db.session.create.mockResolvedValue({
        id: 'session-1',
        platformId: 'platform-1',
      });

      const result = await service.validateLaunch(
        dto as any,
        requestUrl,
        'POST',
      );

      expect(result.sessionId).toBe('session-1');
      expect(result.platformId).toBe('platform-1');
    });

    it('throws BadRequestException for non-HMAC-SHA1 signature method', async () => {
      const dto = {
        oauth_consumer_key: consumerKey,
        oauth_nonce: 'n1',
        oauth_timestamp: '99999',
        oauth_signature_method: 'RSA-SHA256',
        oauth_signature: 'sig',
      };

      await expect(
        service.validateLaunch(dto as any, requestUrl, 'POST'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws UnauthorizedException for expired timestamp', async () => {
      const expiredTimestamp = (Math.floor(Date.now() / 1000) - 600).toString();

      const dto = {
        oauth_consumer_key: consumerKey,
        oauth_nonce: 'n1',
        oauth_timestamp: expiredTimestamp,
        oauth_signature_method: 'HMAC-SHA1',
        oauth_signature: 'sig',
      };

      await expect(
        service.validateLaunch(dto as any, requestUrl, 'POST'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException for replayed nonce', async () => {
      const now = Math.floor(Date.now() / 1000).toString();

      const dto = {
        oauth_consumer_key: consumerKey,
        oauth_nonce: 'replayed-nonce',
        oauth_timestamp: now,
        oauth_signature_method: 'HMAC-SHA1',
        oauth_signature: 'sig',
      };

      db.nonce.deleteMany.mockResolvedValue({ count: 0 });
      db.nonce.findUnique.mockResolvedValue({ nonce: 'replayed-nonce' });

      await expect(
        service.validateLaunch(dto as any, requestUrl, 'POST'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when platform has no consumerSecret', async () => {
      const now = Math.floor(Date.now() / 1000).toString();
      const nonce = 'unique-nonce-123';

      const dto = {
        oauth_consumer_key: consumerKey,
        oauth_nonce: nonce,
        oauth_timestamp: now,
        oauth_signature_method: 'HMAC-SHA1',
        oauth_signature: 'sig',
      };

      mockPlatformRepo.findByConsumerKey.mockResolvedValue({
        ...mockPlatform,
        consumerSecret: null,
      });
      db.nonce.deleteMany.mockResolvedValue({ count: 0 });
      db.nonce.findUnique.mockResolvedValue(null);
      db.nonce.create.mockResolvedValue({});

      await expect(
        service.validateLaunch(dto as any, requestUrl, 'POST'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException for invalid signature', async () => {
      const now = Math.floor(Date.now() / 1000).toString();
      const nonce = crypto.randomBytes(8).toString('hex');

      const dto = {
        oauth_consumer_key: consumerKey,
        oauth_nonce: nonce,
        oauth_timestamp: now,
        oauth_signature_method: 'HMAC-SHA1',
        oauth_signature: 'wrong-signature',
      };

      mockPlatformRepo.findByConsumerKey.mockResolvedValue(mockPlatform);
      db.nonce.deleteMany.mockResolvedValue({ count: 0 });
      db.nonce.findUnique.mockResolvedValue(null);
      db.nonce.create.mockResolvedValue({});

      await expect(
        service.validateLaunch(dto as any, requestUrl, 'POST'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when no secret is configured', async () => {
      delete process.env.LTI_DEFAULT_CONSUMER_SECRET;

      const now = Math.floor(Date.now() / 1000).toString();
      const nonce = crypto.randomBytes(8).toString('hex');

      const dto = {
        oauth_consumer_key: consumerKey,
        oauth_nonce: nonce,
        oauth_timestamp: now,
        oauth_signature_method: 'HMAC-SHA1',
        oauth_signature: 'sig',
      };

      mockPlatformRepo.findByConsumerKey.mockResolvedValue(mockPlatform);
      db.nonce.deleteMany.mockResolvedValue({ count: 0 });
      db.nonce.findUnique.mockResolvedValue(null);
      db.nonce.create.mockResolvedValue({});

      await expect(
        service.validateLaunch(dto as any, requestUrl, 'POST'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('submitGrade', () => {
    it('throws BadRequestException when score is out of range', async () => {
      const dto = {
        consumerKey,
        sourcedId: 'sourced-1',
        outcomeServiceUrl: 'https://lms.example.com/grade',
        score: 1.5,
      };

      await expect(service.submitGrade(dto as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('sends an XML POST to the outcome service URL', async () => {
      mockAxios.post = jest.fn().mockResolvedValue({ status: 200, data: '' });

      const dto = {
        consumerKey,
        sourcedId: 'sourced-1',
        outcomeServiceUrl: 'https://lms.example.com/grade',
        score: 0.85,
      };

      await service.submitGrade(dto as any);

      expect(mockAxios.post).toHaveBeenCalledWith(
        'https://lms.example.com/grade',
        expect.stringContaining('<textString>0.8500</textString>'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/xml',
          }),
        }),
      );
    });

    it('sends an Authorization header with OAuth signature', async () => {
      mockAxios.post = jest.fn().mockResolvedValue({ status: 200, data: '' });

      const dto = {
        consumerKey,
        sourcedId: 'sourced-1',
        outcomeServiceUrl: 'https://lms.example.com/grade',
        score: 0.5,
      };

      await service.submitGrade(dto as any);

      const call = mockAxios.post.mock.calls[0];
      const headers = call[2]?.headers as Record<string, string>;
      expect(headers['Authorization']).toMatch(/^OAuth /);
    });

    it('uses per-key secret when LTI_SECRET_<KEY> env var is set', async () => {
      process.env.LTI_SECRET_TEST_CONSUMER_KEY = 'key-specific-secret';
      mockAxios.post = jest.fn().mockResolvedValue({ status: 200, data: '' });

      const dto = {
        consumerKey: 'test-consumer-key',
        sourcedId: 'sourced-1',
        outcomeServiceUrl: 'https://lms.example.com/grade',
        score: 0.5,
      };

      await service.submitGrade(dto as any);

      expect(mockAxios.post).toHaveBeenCalled();

      delete process.env.LTI_SECRET_TEST_CONSUMER_KEY;
    });
  });
});
