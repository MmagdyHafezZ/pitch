import { Test, TestingModule } from '@nestjs/testing';
import * as crypto from 'crypto';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { LtiV1p3Service } from '../../v1.3/services/lti-v1.3.service';
import { LtiPrismaService } from '../../prisma/lti-prisma.service';
import { PlatformRepository } from '../../platform/platform.repository';
import { JwksService } from '../../v1.3/services/jwks.service';
import { OidcService } from '../../v1.3/services/oidc.service';
import {
  createMockLtiPrismaService,
  MockLtiPrismaService,
} from '../mocks/lti-prisma.service.mock';

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildJwt(payload: object, privateKey: crypto.KeyObject): string {
  const header = Buffer.from(
    JSON.stringify({ alg: 'RS256', typ: 'JWT' }),
  ).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto
    .createSign('RSA-SHA256')
    .update(`${header}.${body}`)
    .sign(privateKey, 'base64url');
  return `${header}.${body}.${sig}`;
}

function buildValidClaims(overrides: object = {}) {
  const now = Math.floor(Date.now() / 1000);
  return {
    iss: 'https://canvas.example.com',
    aud: 'client-abc',
    sub: 'user-sub-1',
    nonce: 'nonce-abc',
    iat: now,
    exp: now + 3600,
    email: 'user@example.com',
    name: 'Test User',
    'https://purl.imsglobal.org/spec/lti/claim/version': '1.3.0',
    'https://purl.imsglobal.org/spec/lti/claim/message_type':
      'LtiResourceLinkRequest',
    'https://purl.imsglobal.org/spec/lti/claim/deployment_id': 'deployment-1',
    'https://purl.imsglobal.org/spec/lti/claim/resource_link': { id: 'rl-1' },
    'https://purl.imsglobal.org/spec/lti/claim/roles': [
      'http://purl.imsglobal.org/vocab/lis/v2/membership#Learner',
    ],
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('LtiV1p3Service', () => {
  let service: LtiV1p3Service;
  let db: MockLtiPrismaService;

  let privateKey: crypto.KeyObject;
  let publicKey: crypto.KeyObject;

  const mockPlatform = {
    id: 'platform-1',
    issuer: 'https://canvas.example.com',
    clientId: 'client-abc',
    keysetUrl: 'https://canvas.example.com/jwks',
    authTokenUrl: 'https://canvas.example.com/token',
  };

  const mockOidcService = {
    consumeState: jest.fn(),
  };

  const mockJwksService = {
    getPublicKey: jest.fn(),
  };

  const mockPlatformRepo = {
    findById: jest.fn(),
  };

  beforeAll(() => {
    const pair = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    privateKey = crypto.createPrivateKey(pair.privateKey);
    publicKey = crypto.createPublicKey(pair.publicKey);
  });

  beforeEach(async () => {
    db = createMockLtiPrismaService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LtiV1p3Service,
        { provide: LtiPrismaService, useValue: db },
        { provide: PlatformRepository, useValue: mockPlatformRepo },
        { provide: JwksService, useValue: mockJwksService },
        { provide: OidcService, useValue: mockOidcService },
      ],
    }).compile();

    service = module.get<LtiV1p3Service>(LtiV1p3Service);
  });

  afterEach(() => jest.clearAllMocks());

  describe('verifyLaunch – happy path', () => {
    it('returns context and claims for a valid LTI 1.3 launch', async () => {
      const claims = buildValidClaims();
      const idToken = buildJwt(claims, privateKey);

      mockOidcService.consumeState.mockResolvedValue({
        platformId: 'platform-1',
        nonce: 'nonce-abc',
      });
      mockPlatformRepo.findById.mockResolvedValue(mockPlatform);
      mockJwksService.getPublicKey.mockResolvedValue(publicKey);
      db.deployment.findUnique.mockResolvedValue({ id: 'dep-1' });
      db.session.create.mockResolvedValue({
        id: 'session-1',
        platformId: 'platform-1',
      });

      const result = await service.verifyLaunch(idToken, 'state-xyz');

      expect(result.context.sessionId).toBe('session-1');
      expect(result.context.version).toBe('1.3');
      expect(result.context.user.id).toBe('user-sub-1');
      expect(result.claims.iss).toBe('https://canvas.example.com');
    });
  });

  describe('verifyLaunch – error paths', () => {
    it('throws BadRequestException for malformed JWT (not 3 parts)', async () => {
      mockOidcService.consumeState.mockResolvedValue({
        platformId: 'platform-1',
        nonce: 'nonce-abc',
      });

      await expect(
        service.verifyLaunch('not.a.valid.jwt.at.all', 'state-xyz'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when platform has no keysetUrl', async () => {
      const claims = buildValidClaims();
      const idToken = buildJwt(claims, privateKey);

      mockOidcService.consumeState.mockResolvedValue({
        platformId: 'platform-1',
        nonce: 'nonce-abc',
      });
      mockPlatformRepo.findById.mockResolvedValue({
        ...mockPlatform,
        keysetUrl: null,
      });

      await expect(service.verifyLaunch(idToken, 'state-xyz')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws UnauthorizedException for invalid JWT signature', async () => {
      // Build JWT with a different (wrong) private key
      const { privateKey: wrongKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      });
      const claims = buildValidClaims();
      const idToken = buildJwt(claims, crypto.createPrivateKey(wrongKey));

      mockOidcService.consumeState.mockResolvedValue({
        platformId: 'platform-1',
        nonce: 'nonce-abc',
      });
      mockPlatformRepo.findById.mockResolvedValue(mockPlatform);
      // Return the correct public key — signature won't match the wrong private key
      mockJwksService.getPublicKey.mockResolvedValue(publicKey);

      await expect(service.verifyLaunch(idToken, 'state-xyz')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException on issuer mismatch', async () => {
      const claims = buildValidClaims({
        iss: 'https://wrong-issuer.example.com',
      });
      const idToken = buildJwt(claims, privateKey);

      mockOidcService.consumeState.mockResolvedValue({
        platformId: 'platform-1',
        nonce: 'nonce-abc',
      });
      mockPlatformRepo.findById.mockResolvedValue(mockPlatform);
      mockJwksService.getPublicKey.mockResolvedValue(publicKey);

      await expect(service.verifyLaunch(idToken, 'state-xyz')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException on expired JWT', async () => {
      const now = Math.floor(Date.now() / 1000);
      const claims = buildValidClaims({ exp: now - 3600, iat: now - 7200 });
      const idToken = buildJwt(claims, privateKey);

      mockOidcService.consumeState.mockResolvedValue({
        platformId: 'platform-1',
        nonce: 'nonce-abc',
      });
      mockPlatformRepo.findById.mockResolvedValue(mockPlatform);
      mockJwksService.getPublicKey.mockResolvedValue(publicKey);

      await expect(service.verifyLaunch(idToken, 'state-xyz')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException on nonce mismatch', async () => {
      const claims = buildValidClaims({ nonce: 'wrong-nonce' });
      const idToken = buildJwt(claims, privateKey);

      mockOidcService.consumeState.mockResolvedValue({
        platformId: 'platform-1',
        nonce: 'expected-nonce',
      });
      mockPlatformRepo.findById.mockResolvedValue(mockPlatform);
      mockJwksService.getPublicKey.mockResolvedValue(publicKey);

      await expect(service.verifyLaunch(idToken, 'state-xyz')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws BadRequestException for unsupported LTI version', async () => {
      const claims = buildValidClaims({
        'https://purl.imsglobal.org/spec/lti/claim/version': '1.1.0',
      });
      const idToken = buildJwt(claims, privateKey);

      mockOidcService.consumeState.mockResolvedValue({
        platformId: 'platform-1',
        nonce: 'nonce-abc',
      });
      mockPlatformRepo.findById.mockResolvedValue(mockPlatform);
      mockJwksService.getPublicKey.mockResolvedValue(publicKey);

      await expect(service.verifyLaunch(idToken, 'state-xyz')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException for unsupported message_type', async () => {
      const claims = buildValidClaims({
        'https://purl.imsglobal.org/spec/lti/claim/message_type': 'UnknownType',
      });
      const idToken = buildJwt(claims, privateKey);

      mockOidcService.consumeState.mockResolvedValue({
        platformId: 'platform-1',
        nonce: 'nonce-abc',
      });
      mockPlatformRepo.findById.mockResolvedValue(mockPlatform);
      mockJwksService.getPublicKey.mockResolvedValue(publicKey);

      await expect(service.verifyLaunch(idToken, 'state-xyz')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('auto-registers a new deployment when not found', async () => {
      const claims = buildValidClaims();
      const idToken = buildJwt(claims, privateKey);

      mockOidcService.consumeState.mockResolvedValue({
        platformId: 'platform-1',
        nonce: 'nonce-abc',
      });
      mockPlatformRepo.findById.mockResolvedValue(mockPlatform);
      mockJwksService.getPublicKey.mockResolvedValue(publicKey);
      // Deployment not found → auto-register
      db.deployment.findUnique.mockResolvedValue(null);
      db.deployment.create.mockResolvedValue({ id: 'new-dep' });
      db.session.create.mockResolvedValue({
        id: 'session-1',
        platformId: 'platform-1',
      });

      await service.verifyLaunch(idToken, 'state-xyz');

      expect(db.deployment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ deploymentId: 'deployment-1' }),
        }),
      );
    });
  });
});
