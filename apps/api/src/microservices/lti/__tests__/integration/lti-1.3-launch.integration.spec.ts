/**
 * Integration tests for the LTI 1.3 launch pipeline.
 *
 * These tests exercise the full chain within the LTI microservice boundary:
 *
 *   OIDC state storage
 *     → LTI 1.3 JWT verification  (real crypto, mocked JWKS fetch + platform repo)
 *     → deployment auto-registration
 *     → LTI session creation
 *     → returned LtiLaunchContext (sessionId, user claims, etc.)
 *
 * The user microservice (auth) is tested separately; only the LTI side is in scope here.
 *
 * External boundaries mocked:
 *   - LtiPrismaService (database)
 *   - PlatformRepository (platform DB lookups)
 *   - JwksService.getPublicKey (remote JWKS fetch)
 */

import * as crypto from 'crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';

import { LtiV1p3Service } from '../../v1.3/services/lti-v1.3.service';
import { OidcService } from '../../v1.3/services/oidc.service';
import { JwksService } from '../../v1.3/services/jwks.service';
import { LtiPrismaService } from '../../prisma/lti-prisma.service';
import { PlatformRepository } from '../../platform/platform.repository';
import {
  createMockLtiPrismaService,
  MockLtiPrismaService,
} from '../mocks/lti-prisma.service.mock';

// ── Crypto helpers ────────────────────────────────────────────────────────────

function buildJwt(payload: object, key: crypto.KeyObject): string {
  const header = Buffer.from(
    JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: 'test-kid' }),
  ).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto
    .createSign('RSA-SHA256')
    .update(`${header}.${body}`)
    .sign(key, 'base64url');
  return `${header}.${body}.${sig}`;
}

function nowSec() {
  return Math.floor(Date.now() / 1000);
}

function validClaims(overrides: object = {}) {
  const now = nowSec();
  return {
    iss: 'https://lms.university.edu',
    aud: 'pitch-client-id',
    sub: 'learner-sub-42',
    nonce: 'nonce-integration',
    iat: now,
    exp: now + 3600,
    email: 'learner@university.edu',
    name: 'Alice Learner',
    'https://purl.imsglobal.org/spec/lti/claim/version': '1.3.0',
    'https://purl.imsglobal.org/spec/lti/claim/message_type':
      'LtiResourceLinkRequest',
    'https://purl.imsglobal.org/spec/lti/claim/deployment_id': 'deploy-99',
    'https://purl.imsglobal.org/spec/lti/claim/resource_link': {
      id: 'rl-42',
      title: 'Sales Pitch Practice',
    },
    'https://purl.imsglobal.org/spec/lti/claim/roles': [
      'http://purl.imsglobal.org/vocab/lis/v2/membership#Learner',
    ],
    ...overrides,
  };
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('LTI 1.3 Launch — integration', () => {
  let service: LtiV1p3Service;
  let db: MockLtiPrismaService;

  let privateKey: crypto.KeyObject;
  let publicKey: crypto.KeyObject;

  const mockOidcService = { consumeState: jest.fn() };
  const mockJwksService = { getPublicKey: jest.fn() };
  const mockPlatformRepo = { findById: jest.fn() };

  const PLATFORM = {
    id: 'platform-integration',
    issuer: 'https://lms.university.edu',
    clientId: 'pitch-client-id',
    keysetUrl: 'https://lms.university.edu/.well-known/jwks.json',
    authTokenUrl: 'https://lms.university.edu/auth/token',
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

  // ── Happy path ──────────────────────────────────────────────────────────────

  describe('successful launch', () => {
    function arrangeMocks(overrides: object = {}) {
      mockOidcService.consumeState.mockResolvedValue({
        platformId: PLATFORM.id,
        nonce: 'nonce-integration',
      });
      mockPlatformRepo.findById.mockResolvedValue(PLATFORM);
      mockJwksService.getPublicKey.mockResolvedValue(publicKey);
      db.deployment.findUnique.mockResolvedValue({ id: 'dep-99' });
      db.session.create.mockResolvedValue({
        id: 'lti-sess-integration',
        platformId: PLATFORM.id,
        ...overrides,
      });
    }

    it('returns a normalised LtiLaunchContext', async () => {
      arrangeMocks();
      const idToken = buildJwt(validClaims(), privateKey);

      const { context, claims } = await service.verifyLaunch(
        idToken,
        'state-ok',
      );

      expect(context.version).toBe('1.3');
      expect(context.sessionId).toBe('lti-sess-integration');
      expect(context.platformId).toBe(PLATFORM.id);
      expect(context.user.id).toBe('learner-sub-42');
      expect(context.user.email).toBe('learner@university.edu');
      expect(context.user.name).toBe('Alice Learner');
      expect(claims.iss).toBe('https://lms.university.edu');
    });

    it('persists the LTI session in the database', async () => {
      arrangeMocks();
      const idToken = buildJwt(validClaims(), privateKey);

      await service.verifyLaunch(idToken, 'state-ok');

      expect(db.session.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            sub: 'learner-sub-42',
            email: 'learner@university.edu',
            name: 'Alice Learner',
            resourceLinkId: 'rl-42',
          }),
        }),
      );
    });

    it('exposes AGS and NRPS service URLs when present in claims', async () => {
      arrangeMocks();
      const claims = validClaims({
        'https://purl.imsglobal.org/spec/lti-ags/claim/endpoint': {
          lineitems: 'https://lms.university.edu/lineitems',
          scope: ['https://purl.imsglobal.org/spec/lti-ags/scope/lineitem'],
        },
        'https://purl.imsglobal.org/spec/lti-nrps/claim/namesroleservice': {
          context_memberships_url: 'https://lms.university.edu/memberships',
          service_versions: ['2.0'],
        },
      });
      const idToken = buildJwt(claims, privateKey);

      const { context } = await service.verifyLaunch(idToken, 'state-ok');

      expect(context.services?.lineItemsUrl).toBe(
        'https://lms.university.edu/lineitems',
      );
      expect(context.services?.namesRolesUrl).toBe(
        'https://lms.university.edu/memberships',
      );
    });

    it('includes Deep Linking return URL when messageType is LtiDeepLinkingRequest', async () => {
      arrangeMocks();
      const claims = validClaims({
        'https://purl.imsglobal.org/spec/lti/claim/message_type':
          'LtiDeepLinkingRequest',
        'https://purl.imsglobal.org/spec/lti-dl/claim/deep_linking_settings': {
          deep_link_return_url: 'https://lms.university.edu/deep-link-return',
          accept_types: ['ltiResourceLink'],
          accept_presentation_document_targets: ['iframe'],
        },
      });
      const idToken = buildJwt(claims, privateKey);

      const { context } = await service.verifyLaunch(idToken, 'state-ok');

      expect(context.services?.deepLinkReturnUrl).toBe(
        'https://lms.university.edu/deep-link-return',
      );
    });
  });

  // ── Deployment auto-registration ────────────────────────────────────────────

  describe('deployment handling', () => {
    it('auto-registers a deployment when first seen', async () => {
      mockOidcService.consumeState.mockResolvedValue({
        platformId: PLATFORM.id,
        nonce: 'nonce-integration',
      });
      mockPlatformRepo.findById.mockResolvedValue(PLATFORM);
      mockJwksService.getPublicKey.mockResolvedValue(publicKey);
      db.deployment.findUnique.mockResolvedValue(null); // Not found → auto-register
      db.deployment.create.mockResolvedValue({ id: 'new-dep-auto' });
      db.session.create.mockResolvedValue({
        id: 'lti-sess-new',
        platformId: PLATFORM.id,
      });

      const idToken = buildJwt(validClaims(), privateKey);
      await service.verifyLaunch(idToken, 'state-ok');

      expect(db.deployment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            deploymentId: 'deploy-99',
            platformId: PLATFORM.id,
          }),
        }),
      );
    });

    it('reuses an existing deployment without creating a new one', async () => {
      mockOidcService.consumeState.mockResolvedValue({
        platformId: PLATFORM.id,
        nonce: 'nonce-integration',
      });
      mockPlatformRepo.findById.mockResolvedValue(PLATFORM);
      mockJwksService.getPublicKey.mockResolvedValue(publicKey);
      db.deployment.findUnique.mockResolvedValue({ id: 'existing-dep' });
      db.session.create.mockResolvedValue({
        id: 'lti-sess-reuse',
        platformId: PLATFORM.id,
      });

      const idToken = buildJwt(validClaims(), privateKey);
      await service.verifyLaunch(idToken, 'state-ok');

      expect(db.deployment.create).not.toHaveBeenCalled();
    });
  });

  // ── Security error paths ─────────────────────────────────────────────────────

  describe('security rejections', () => {
    function arrangeForClaims() {
      mockOidcService.consumeState.mockResolvedValue({
        platformId: PLATFORM.id,
        nonce: 'nonce-integration',
      });
      mockPlatformRepo.findById.mockResolvedValue(PLATFORM);
      mockJwksService.getPublicKey.mockResolvedValue(publicKey);
    }

    it('rejects a JWT signed with a different private key (signature mismatch)', async () => {
      arrangeForClaims();
      const wrongPair = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      });
      const idToken = buildJwt(
        validClaims(),
        crypto.createPrivateKey(wrongPair.privateKey),
      );

      await expect(service.verifyLaunch(idToken, 'state-ok')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects an expired JWT', async () => {
      arrangeForClaims();
      const claims = validClaims({
        exp: nowSec() - 3600,
        iat: nowSec() - 7200,
      });
      const idToken = buildJwt(claims, privateKey);

      await expect(service.verifyLaunch(idToken, 'state-ok')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects when issuer does not match the registered platform', async () => {
      arrangeForClaims();
      const claims = validClaims({ iss: 'https://attacker.example.com' });
      const idToken = buildJwt(claims, privateKey);

      await expect(service.verifyLaunch(idToken, 'state-ok')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects on nonce mismatch (replay protection)', async () => {
      mockOidcService.consumeState.mockResolvedValue({
        platformId: PLATFORM.id,
        nonce: 'different-nonce', // ← expected nonce differs
      });
      mockPlatformRepo.findById.mockResolvedValue(PLATFORM);
      mockJwksService.getPublicKey.mockResolvedValue(publicKey);

      const idToken = buildJwt(
        validClaims({ nonce: 'nonce-integration' }),
        privateKey,
      );

      await expect(service.verifyLaunch(idToken, 'state-ok')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects an unsupported LTI version claim', async () => {
      arrangeForClaims();
      const claims = validClaims({
        'https://purl.imsglobal.org/spec/lti/claim/version': '1.1.0',
      });
      const idToken = buildJwt(claims, privateKey);

      await expect(service.verifyLaunch(idToken, 'state-ok')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects a platform with no keysetUrl configured', async () => {
      mockOidcService.consumeState.mockResolvedValue({
        platformId: PLATFORM.id,
        nonce: 'nonce-integration',
      });
      mockPlatformRepo.findById.mockResolvedValue({
        ...PLATFORM,
        keysetUrl: null,
      });

      const idToken = buildJwt(validClaims(), privateKey);

      await expect(service.verifyLaunch(idToken, 'state-ok')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
