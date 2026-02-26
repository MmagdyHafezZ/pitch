import { Test, TestingModule } from '@nestjs/testing';
import axios from 'axios';
import { BadRequestException } from '@nestjs/common';
import { NrpsService } from '../../advantage/nrps/nrps.service';
import { LtiPrismaService } from '../../prisma/lti-prisma.service';
import { PlatformRepository } from '../../platform/platform.repository';
import { TokenService } from '../../v1.3/services/token.service';
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
  getAccessToken: jest.fn().mockResolvedValue('bearer-token-abc'),
};

describe('NrpsService', () => {
  let service: NrpsService;
  let db: MockLtiPrismaService;

  const mockSession = {
    id: 'session-1',
    platformId: 'platform-1',
    namesRolesServiceUrl:
      'https://canvas.example.com/api/lti/courses/1/names_and_roles',
  };

  const mockPlatform = {
    id: 'platform-1',
    authTokenUrl: 'https://canvas.example.com/login/oauth2/token',
    clientId: 'client-abc',
  };

  const sampleMember = {
    user_id: 'user-1',
    name: 'Alice',
    email: 'alice@example.com',
    roles: ['http://purl.imsglobal.org/vocab/lis/v2/membership#Learner'],
  };

  beforeEach(async () => {
    db = createMockLtiPrismaService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NrpsService,
        { provide: LtiPrismaService, useValue: db },
        { provide: PlatformRepository, useValue: mockPlatformRepo },
        { provide: TokenService, useValue: mockTokenService },
      ],
    }).compile();

    service = module.get<NrpsService>(NrpsService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('getMembers', () => {
    it('fetches and returns a single page of members', async () => {
      db.session.findUnique.mockResolvedValue(mockSession);
      mockPlatformRepo.findById.mockResolvedValue(mockPlatform);
      mockAxios.get = jest.fn().mockResolvedValue({
        data: { members: [sampleMember] },
      });

      const result = await service.getMembers({
        sessionId: 'session-1',
      } as any);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(sampleMember);
    });

    it('follows @odata.nextLink pagination and aggregates all members', async () => {
      db.session.findUnique.mockResolvedValue(mockSession);
      mockPlatformRepo.findById.mockResolvedValue(mockPlatform);

      mockAxios.get = jest
        .fn()
        .mockResolvedValueOnce({
          data: {
            members: [sampleMember],
            '@odata.nextLink': 'https://canvas.example.com/page2',
          },
        })
        .mockResolvedValueOnce({
          data: { members: [{ ...sampleMember, user_id: 'user-2' }] },
        });

      const result = await service.getMembers({
        sessionId: 'session-1',
      } as any);

      expect(result).toHaveLength(2);
      expect(mockAxios.get).toHaveBeenCalledTimes(2);
    });

    it('respects the limit parameter and stops pagination early', async () => {
      db.session.findUnique.mockResolvedValue(mockSession);
      mockPlatformRepo.findById.mockResolvedValue(mockPlatform);

      const members = Array.from({ length: 5 }, (_, i) => ({
        ...sampleMember,
        user_id: `user-${i}`,
      }));

      mockAxios.get = jest.fn().mockResolvedValue({
        data: {
          members,
          '@odata.nextLink': 'https://canvas.example.com/page2',
        },
      });

      const result = await service.getMembers({
        sessionId: 'session-1',
        limit: 3,
      } as any);

      expect(result).toHaveLength(3);
    });

    it('throws BadRequestException when session not found', async () => {
      db.session.findUnique.mockResolvedValue(null);

      await expect(
        service.getMembers({ sessionId: 'missing' } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when session has no NRPS URL', async () => {
      db.session.findUnique.mockResolvedValue({
        ...mockSession,
        namesRolesServiceUrl: null,
      });

      await expect(
        service.getMembers({ sessionId: 'session-1' } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when platform is missing authTokenUrl', async () => {
      db.session.findUnique.mockResolvedValue(mockSession);
      mockPlatformRepo.findById.mockResolvedValue({
        ...mockPlatform,
        authTokenUrl: null,
      });

      await expect(
        service.getMembers({ sessionId: 'session-1' } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('passes Authorization Bearer token in the NRPS request', async () => {
      db.session.findUnique.mockResolvedValue(mockSession);
      mockPlatformRepo.findById.mockResolvedValue(mockPlatform);
      mockAxios.get = jest.fn().mockResolvedValue({ data: { members: [] } });

      await service.getMembers({ sessionId: 'session-1' } as any);

      expect(mockAxios.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer bearer-token-abc',
          }),
        }),
      );
    });
  });
});
