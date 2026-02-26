import { Test, TestingModule } from '@nestjs/testing';
import { OidcService } from '../../v1.3/services/oidc.service';
import { LtiPrismaService } from '../../prisma/lti-prisma.service';
import { PlatformRepository } from '../../platform/platform.repository';
import {
  createMockLtiPrismaService,
  MockLtiPrismaService,
} from '../mocks/lti-prisma.service.mock';

const mockPlatformRepo = {
  findByIssuerAndClientId: jest.fn(),
};

describe('OidcService', () => {
  let service: OidcService;
  let db: MockLtiPrismaService;

  const mockPlatform = {
    id: 'platform-1',
    issuer: 'https://canvas.example.com',
    clientId: 'client-abc',
    authLoginUrl: 'https://canvas.example.com/api/lti/authorize_redirect',
  };

  beforeEach(async () => {
    db = createMockLtiPrismaService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OidcService,
        { provide: LtiPrismaService, useValue: db },
        { provide: PlatformRepository, useValue: mockPlatformRepo },
      ],
    }).compile();

    service = module.get<OidcService>(OidcService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('initiateLogin', () => {
    it('creates a nonce and returns redirect params', async () => {
      mockPlatformRepo.findByIssuerAndClientId.mockResolvedValue(mockPlatform);
      db.nonce.create.mockResolvedValue({});

      const dto = {
        iss: 'https://canvas.example.com',
        client_id: 'client-abc',
        login_hint: 'hint-123',
        target_link_uri: 'https://tool.example.com/launch',
      };

      const result = await service.initiateLogin(
        dto as any,
        'https://tool.example.com/launch',
      );

      expect(db.nonce.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            platformId: 'platform-1',
          }),
        }),
      );
      expect(result.redirectUrl).toBe(mockPlatform.authLoginUrl);
      expect(result.params.client_id).toBe('client-abc');
      expect(result.params.scope).toBe('openid');
      expect(result.params.response_type).toBe('id_token');
      expect(result.params.nonce).toBeDefined();
      expect(result.params.state).toBeDefined();
    });

    it('includes lti_message_hint when provided', async () => {
      mockPlatformRepo.findByIssuerAndClientId.mockResolvedValue(mockPlatform);
      db.nonce.create.mockResolvedValue({});

      const dto = {
        iss: 'https://canvas.example.com',
        client_id: 'client-abc',
        login_hint: 'hint-123',
        lti_message_hint: 'lms-hint-xyz',
      };

      const result = await service.initiateLogin(
        dto as any,
        'https://tool.example.com/launch',
      );

      expect(result.params.lti_message_hint).toBe('lms-hint-xyz');
    });

    it('throws when platform has no authLoginUrl', async () => {
      mockPlatformRepo.findByIssuerAndClientId.mockResolvedValue({
        ...mockPlatform,
        authLoginUrl: null,
      });

      await expect(
        service.initiateLogin(
          { iss: 'https://canvas.example.com', client_id: 'client-abc' } as any,
          'https://tool.example.com/launch',
        ),
      ).rejects.toThrow('has no authLoginUrl configured');
    });
  });

  describe('consumeState', () => {
    it('returns platformId and nonce on valid state', async () => {
      const mockNonce = {
        nonce: 'abc123',
        state: 'state-xyz',
        platformId: 'platform-1',
        usedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
      };
      db.nonce.findUnique.mockResolvedValue(mockNonce);
      db.nonce.update.mockResolvedValue({ ...mockNonce, usedAt: new Date() });

      const result = await service.consumeState('state-xyz');

      expect(result.platformId).toBe('platform-1');
      expect(result.nonce).toBe('abc123');
      expect(db.nonce.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { state: 'state-xyz' } }),
      );
    });

    it('throws when state is not found', async () => {
      db.nonce.findUnique.mockResolvedValue(null);

      await expect(service.consumeState('unknown-state')).rejects.toThrow(
        'Invalid or unknown OIDC state',
      );
    });

    it('throws when state is already consumed', async () => {
      db.nonce.findUnique.mockResolvedValue({
        nonce: 'abc',
        state: 'state-xyz',
        platformId: 'p1',
        usedAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000),
      });

      await expect(service.consumeState('state-xyz')).rejects.toThrow(
        'OIDC state already consumed',
      );
    });

    it('throws when state is expired', async () => {
      db.nonce.findUnique.mockResolvedValue({
        nonce: 'abc',
        state: 'state-xyz',
        platformId: 'p1',
        usedAt: null,
        expiresAt: new Date(Date.now() - 1000),
      });

      await expect(service.consumeState('state-xyz')).rejects.toThrow(
        'OIDC state expired',
      );
    });
  });
});
