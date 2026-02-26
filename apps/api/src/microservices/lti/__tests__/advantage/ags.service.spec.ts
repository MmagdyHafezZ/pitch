import { Test, TestingModule } from '@nestjs/testing';
import axios from 'axios';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AgsService } from '../../advantage/ags/ags.service';
import { LtiPrismaService } from '../../prisma/lti-prisma.service';
import { PlatformRepository } from '../../platform/platform.repository';
import { TokenService } from '../../v1.3/services/token.service';
import { ActivityProgress, GradingProgress } from '@prisma/lti-client';
import {
  createMockLtiPrismaService,
  MockLtiPrismaService,
} from '../mocks/lti-prisma.service.mock';

jest.mock('axios');
const mockAxios = axios as jest.Mocked<typeof axios>;

const mockPlatformRepo = {
  findById: jest.fn(),
};

const mockTokenService = {
  getAccessToken: jest.fn().mockResolvedValue('ags-bearer-token'),
};

describe('AgsService', () => {
  let service: AgsService;
  let db: MockLtiPrismaService;

  const mockSession = {
    id: 'session-1',
    platformId: 'platform-1',
    lineItemsServiceUrl:
      'https://canvas.example.com/api/lti/courses/1/line_items',
  };

  const mockPlatform = {
    id: 'platform-1',
    authTokenUrl: 'https://canvas.example.com/login/oauth2/token',
    clientId: 'client-abc',
  };

  const mockLineItem = {
    id: 'li-1',
    sessionId: 'session-1',
    label: 'Final Score',
    scoreMaximum: 100,
    lineItemUrl: 'https://canvas.example.com/api/lti/courses/1/line_items/42',
  };

  beforeEach(async () => {
    db = createMockLtiPrismaService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgsService,
        { provide: LtiPrismaService, useValue: db },
        { provide: PlatformRepository, useValue: mockPlatformRepo },
        { provide: TokenService, useValue: mockTokenService },
      ],
    }).compile();

    service = module.get<AgsService>(AgsService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── createLineItem ─────────────────────────────────────────────────────────

  describe('createLineItem', () => {
    it('creates a local line item when lineItemUrl is provided directly', async () => {
      db.session.findUnique.mockResolvedValue(mockSession);
      db.lineItem.create.mockResolvedValue(mockLineItem);

      const dto = {
        sessionId: 'session-1',
        label: 'Final Score',
        scoreMaximum: 100,
        lineItemUrl: 'https://canvas.example.com/api/lti/line_items/42',
      };

      await service.createLineItem(dto as any);

      expect(db.lineItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            label: 'Final Score',
            scoreMaximum: 100,
          }),
        }),
      );
      // Should NOT call the LMS API when URL is pre-provided
      expect(mockAxios.post).not.toHaveBeenCalled();
    });

    it('creates line item on LMS when no URL is provided', async () => {
      db.session.findUnique.mockResolvedValue(mockSession);
      mockPlatformRepo.findById.mockResolvedValue(mockPlatform);
      mockAxios.post = jest.fn().mockResolvedValue({
        data: { id: 'https://canvas.example.com/api/lti/line_items/99' },
      });
      db.lineItem.create.mockResolvedValue(mockLineItem);

      const dto = {
        sessionId: 'session-1',
        label: 'Final Score',
        scoreMaximum: 100,
      };

      await service.createLineItem(dto as any);

      expect(mockAxios.post).toHaveBeenCalledWith(
        mockSession.lineItemsServiceUrl,
        expect.objectContaining({ scoreMaximum: 100 }),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer ags-bearer-token',
          }),
        }),
      );
    });

    it('throws BadRequestException when session not found', async () => {
      db.session.findUnique.mockResolvedValue(null);

      await expect(
        service.createLineItem({
          sessionId: 'missing',
          label: 'L',
          scoreMaximum: 10,
        } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── submitScore ────────────────────────────────────────────────────────────

  describe('submitScore', () => {
    it('upserts local score and pushes to LMS when lineItemUrl exists', async () => {
      db.lineItem.findUnique.mockResolvedValue(mockLineItem);
      db.score.upsert.mockResolvedValue({});
      db.session.findUnique.mockResolvedValue(mockSession);
      mockPlatformRepo.findById.mockResolvedValue(mockPlatform);
      mockAxios.post = jest.fn().mockResolvedValue({ status: 200 });

      const dto = {
        lineItemId: 'li-1',
        userId: 'user-1',
        scoreGiven: 85,
        scoreMaximum: 100,
        activityProgress: ActivityProgress.COMPLETED,
        gradingProgress: GradingProgress.FULLY_GRADED,
      };

      await service.submitScore(dto as any);

      expect(db.score.upsert).toHaveBeenCalled();
      expect(mockAxios.post).toHaveBeenCalledWith(
        `${mockLineItem.lineItemUrl}/scores`,
        expect.objectContaining({ userId: 'user-1', scoreGiven: 85 }),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer ags-bearer-token',
          }),
        }),
      );
    });

    it('only saves locally when lineItemUrl is null', async () => {
      db.lineItem.findUnique.mockResolvedValue({
        ...mockLineItem,
        lineItemUrl: null,
      });
      db.score.upsert.mockResolvedValue({});

      const dto = {
        lineItemId: 'li-1',
        userId: 'user-1',
        scoreGiven: 50,
        scoreMaximum: 100,
        activityProgress: ActivityProgress.SUBMITTED,
        gradingProgress: GradingProgress.PENDING,
      };

      await service.submitScore(dto as any);

      expect(db.score.upsert).toHaveBeenCalled();
      expect(mockAxios.post).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when line item not found', async () => {
      db.lineItem.findUnique.mockResolvedValue(null);

      await expect(
        service.submitScore({
          lineItemId: 'missing',
          userId: 'u1',
          scoreGiven: 0,
          scoreMaximum: 10,
        } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when scoreGiven exceeds scoreMaximum', async () => {
      db.lineItem.findUnique.mockResolvedValue(mockLineItem);

      const dto = {
        lineItemId: 'li-1',
        userId: 'user-1',
        scoreGiven: 150,
        scoreMaximum: 100,
        activityProgress: ActivityProgress.COMPLETED,
        gradingProgress: GradingProgress.FULLY_GRADED,
      };

      await expect(service.submitScore(dto as any)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ── getResults ─────────────────────────────────────────────────────────────

  describe('getResults', () => {
    it('returns local scores when lineItemUrl is null', async () => {
      db.lineItem.findUnique.mockResolvedValue({
        ...mockLineItem,
        lineItemUrl: null,
      });
      db.score.findMany.mockResolvedValue([
        { id: 's1', userId: 'user-1', scoreGiven: 85 },
      ]);

      const result = await service.getResults({ lineItemId: 'li-1' } as any);

      expect(result).toHaveLength(1);
      expect(mockAxios.get).not.toHaveBeenCalled();
    });

    it('fetches results from LMS when lineItemUrl exists', async () => {
      db.lineItem.findUnique.mockResolvedValue(mockLineItem);
      db.session.findUnique.mockResolvedValue(mockSession);
      mockPlatformRepo.findById.mockResolvedValue(mockPlatform);
      mockAxios.get = jest.fn().mockResolvedValue({
        data: [{ userId: 'user-1', resultScore: 85 }],
      });

      const result = await service.getResults({ lineItemId: 'li-1' } as any);

      expect(mockAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('/results'),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer ags-bearer-token',
          }),
        }),
      );
      expect(result).toHaveLength(1);
    });

    it('appends user_id query param when provided', async () => {
      db.lineItem.findUnique.mockResolvedValue(mockLineItem);
      db.session.findUnique.mockResolvedValue(mockSession);
      mockPlatformRepo.findById.mockResolvedValue(mockPlatform);
      mockAxios.get = jest.fn().mockResolvedValue({ data: [] });

      await service.getResults({
        lineItemId: 'li-1',
        userId: 'user-99',
      } as any);

      const calledUrl = mockAxios.get.mock.calls[0][0];
      expect(calledUrl).toContain('user_id=user-99');
    });

    it('throws NotFoundException when line item not found', async () => {
      db.lineItem.findUnique.mockResolvedValue(null);

      await expect(
        service.getResults({ lineItemId: 'missing' } as any),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
