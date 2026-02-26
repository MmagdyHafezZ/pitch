import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { DeepLinkingService } from '../../advantage/deep-linking/deep-linking.service';
import { LtiPrismaService } from '../../prisma/lti-prisma.service';
import { PlatformRepository } from '../../platform/platform.repository';
import { JwksService } from '../../v1.3/services/jwks.service';
import {
  createMockLtiPrismaService,
  MockLtiPrismaService,
} from '../mocks/lti-prisma.service.mock';

const mockPlatformRepo = {
  findById: jest.fn(),
};

const mockJwksService = {
  signWithToolKey: jest.fn().mockReturnValue('signed.deep.link.jwt'),
};

describe('DeepLinkingService', () => {
  let service: DeepLinkingService;
  let db: MockLtiPrismaService;

  const mockSession = {
    id: 'session-1',
    platformId: 'platform-1',
    sub: 'user-sub-1',
    deploymentId: 'deployment-1',
    deepLinkReturnUrl: 'https://canvas.example.com/deep_link_return',
  };

  const mockPlatform = {
    id: 'platform-1',
    issuer: 'https://canvas.example.com',
    clientId: 'client-abc',
  };

  beforeEach(async () => {
    db = createMockLtiPrismaService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeepLinkingService,
        { provide: LtiPrismaService, useValue: db },
        { provide: PlatformRepository, useValue: mockPlatformRepo },
        { provide: JwksService, useValue: mockJwksService },
      ],
    }).compile();

    service = module.get<DeepLinkingService>(DeepLinkingService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('buildResponse', () => {
    it('returns a signed JWT and the return URL', async () => {
      db.session.findUnique.mockResolvedValue(mockSession);
      mockPlatformRepo.findById.mockResolvedValue(mockPlatform);

      const dto = {
        sessionId: 'session-1',
        items: [
          {
            type: 'ltiResourceLink',
            title: 'Intro Simulation',
            url: 'https://tool.example.com/sim/1',
          },
        ],
      };

      const result = await service.buildResponse(dto as any);

      expect(result.jwt).toBe('signed.deep.link.jwt');
      expect(result.returnUrl).toBe(mockSession.deepLinkReturnUrl);
    });

    it('passes the LtiDeepLinkingResponse message_type claim', async () => {
      db.session.findUnique.mockResolvedValue(mockSession);
      mockPlatformRepo.findById.mockResolvedValue(mockPlatform);

      const dto = {
        sessionId: 'session-1',
        items: [
          { type: 'link', title: 'Resource', url: 'https://example.com' },
        ],
      };

      await service.buildResponse(dto as any);

      expect(mockJwksService.signWithToolKey).toHaveBeenCalledWith(
        expect.objectContaining({
          'https://purl.imsglobal.org/spec/lti/claim/message_type':
            'LtiDeepLinkingResponse',
        }),
        600,
      );
    });

    it('includes optional data and message fields when provided', async () => {
      db.session.findUnique.mockResolvedValue(mockSession);
      mockPlatformRepo.findById.mockResolvedValue(mockPlatform);

      const dto = {
        sessionId: 'session-1',
        items: [],
        data: 'opaque-data',
        message: 'Content successfully selected',
      };

      await service.buildResponse(dto as any);

      expect(mockJwksService.signWithToolKey).toHaveBeenCalledWith(
        expect.objectContaining({
          'https://purl.imsglobal.org/spec/lti-dl/claim/data': 'opaque-data',
          'https://purl.imsglobal.org/spec/lti-dl/claim/msg':
            'Content successfully selected',
        }),
        600,
      );
    });

    it('throws BadRequestException when session not found', async () => {
      db.session.findUnique.mockResolvedValue(null);

      await expect(
        service.buildResponse({ sessionId: 'missing', items: [] } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when session has no deepLinkReturnUrl', async () => {
      db.session.findUnique.mockResolvedValue({
        ...mockSession,
        deepLinkReturnUrl: null,
      });

      await expect(
        service.buildResponse({ sessionId: 'session-1', items: [] } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('serializes html content items correctly', async () => {
      db.session.findUnique.mockResolvedValue(mockSession);
      mockPlatformRepo.findById.mockResolvedValue(mockPlatform);

      const dto = {
        sessionId: 'session-1',
        items: [
          { type: 'html', html: '<p>Hello</p>', title: 'Inline Content' },
        ],
      };

      await service.buildResponse(dto as any);

      expect(mockJwksService.signWithToolKey).toHaveBeenCalledWith(
        expect.objectContaining({
          'https://purl.imsglobal.org/spec/lti-dl/claim/content_items':
            expect.arrayContaining([
              expect.objectContaining({ type: 'html', html: '<p>Hello</p>' }),
            ]),
        }),
        600,
      );
    });
  });
});
