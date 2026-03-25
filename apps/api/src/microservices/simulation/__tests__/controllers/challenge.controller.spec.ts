import { Test, TestingModule } from '@nestjs/testing';
import { ChallengeController } from '../../controllers/challenge.controller';
import { ChallengeService } from '../../services/challenge.service';
import {
  ChallengePeriodDto,
  ChallengeDifficultyDto,
  ListChallengesDto,
  TriggerGenerateDto,
} from '../../dto/challenge.dto';

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

jest.mock('@pitch/shared-backend/helpers/exceptions', () => ({
  toRpcException: (err: unknown) => err,
}));

const mockChallenge = {
  id: 'challenge-1',
  period: ChallengePeriodDto.WEEKLY,
  difficulty: ChallengeDifficultyDto.INTERMEDIATE,
  title: 'Weekly sales challenge',
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-01-07'),
};

const mockLeaderboard = [
  { userId: 'user-1', score: 95, rank: 1 },
  { userId: 'user-2', score: 88, rank: 2 },
];

const mockChallengeService = {
  list: jest.fn(),
  get: jest.fn(),
  participate: jest.fn(),
  submitScore: jest.fn(),
  leaderboard: jest.fn(),
  triggerGenerate: jest.fn(),
};

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('ChallengeController', () => {
  let controller: ChallengeController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChallengeController],
      providers: [
        { provide: ChallengeService, useValue: mockChallengeService },
      ],
    }).compile();

    controller = module.get<ChallengeController>(ChallengeController);
  });

  // -------------------------------------------------------------------------
  // listChallenges
  // -------------------------------------------------------------------------
  describe('listChallenges', () => {
    it('lists challenges for the authenticated user', async () => {
      const challenges = [mockChallenge];
      mockChallengeService.list.mockResolvedValue(challenges);

      const query: ListChallengesDto = {
        period: ChallengePeriodDto.WEEKLY,
        difficulty: ChallengeDifficultyDto.INTERMEDIATE,
        limit: 10,
        offset: 0,
      };

      const data = { ...query, userClaims: { id: 'user-1' } } as any;

      const result = await controller.listChallenges(data);

      expect(mockChallengeService.list).toHaveBeenCalledWith(query, 'user-1');
      expect(result).toEqual(challenges);
    });

    it('passes undefined userId when userClaims is absent', async () => {
      mockChallengeService.list.mockResolvedValue([]);

      const data = {
        period: ChallengePeriodDto.DAILY,
        userClaims: undefined,
      } as any;

      await controller.listChallenges(data);

      expect(mockChallengeService.list).toHaveBeenCalledWith(
        { period: ChallengePeriodDto.DAILY },
        undefined,
      );
    });

    it('wraps and rethrows errors as RPC exceptions', async () => {
      const error = new Error('Service failure');
      mockChallengeService.list.mockRejectedValue(error);

      await expect(
        controller.listChallenges({ userClaims: { id: 'user-1' } } as any),
      ).rejects.toThrow(error);
    });
  });

  // -------------------------------------------------------------------------
  // getChallenge
  // -------------------------------------------------------------------------
  describe('getChallenge', () => {
    it('returns a challenge by id', async () => {
      mockChallengeService.get.mockResolvedValue(mockChallenge);

      const data = { id: 'challenge-1', userClaims: { id: 'user-1' } } as any;
      const result = await controller.getChallenge(data);

      expect(mockChallengeService.get).toHaveBeenCalledWith(
        'challenge-1',
        'user-1',
      );
      expect(result).toEqual(mockChallenge);
    });

    it('passes undefined userId when userClaims absent', async () => {
      mockChallengeService.get.mockResolvedValue(mockChallenge);

      await controller.getChallenge({ id: 'challenge-1' } as any);

      expect(mockChallengeService.get).toHaveBeenCalledWith(
        'challenge-1',
        undefined,
      );
    });

    it('rethrows errors from the service', async () => {
      mockChallengeService.get.mockRejectedValue(new Error('Not found'));

      await expect(
        controller.getChallenge({
          id: 'bad-id',
          userClaims: { id: 'user-1' },
        } as any),
      ).rejects.toThrow('Not found');
    });
  });

  // -------------------------------------------------------------------------
  // participate
  // -------------------------------------------------------------------------
  describe('participate', () => {
    it('registers user participation in a challenge', async () => {
      const participation = {
        id: 'part-1',
        challengeId: 'challenge-1',
        userId: 'user-1',
      };
      mockChallengeService.participate.mockResolvedValue(participation);

      const data = {
        challengeId: 'challenge-1',
        userClaims: { id: 'user-1' },
      } as any;

      const result = await controller.participate(data);

      expect(mockChallengeService.participate).toHaveBeenCalledWith(
        'challenge-1',
        'user-1',
      );
      expect(result).toEqual(participation);
    });

    it('throws when userClaims.id is missing', async () => {
      const data = { challengeId: 'challenge-1', userClaims: {} } as any;

      await expect(controller.participate(data)).rejects.toThrow(
        'User claims required',
      );
      expect(mockChallengeService.participate).not.toHaveBeenCalled();
    });

    it('throws when userClaims is absent', async () => {
      const data = { challengeId: 'challenge-1' } as any;

      await expect(controller.participate(data)).rejects.toThrow(
        'User claims required',
      );
    });

    it('propagates service errors', async () => {
      mockChallengeService.participate.mockRejectedValue(
        new Error('Already participating'),
      );

      await expect(
        controller.participate({
          challengeId: 'challenge-1',
          userClaims: { id: 'user-1' },
        } as any),
      ).rejects.toThrow('Already participating');
    });
  });

  // -------------------------------------------------------------------------
  // submitScore
  // -------------------------------------------------------------------------
  describe('submitScore', () => {
    it('submits a score for a challenge session', async () => {
      const submission = { id: 'sub-1', score: 90 };
      mockChallengeService.submitScore.mockResolvedValue(submission);

      const data = {
        challengeId: 'challenge-1',
        sessionId: 'session-1',
        score: 90,
        userClaims: { id: 'user-1' },
      } as any;

      const result = await controller.submitScore(data);

      expect(mockChallengeService.submitScore).toHaveBeenCalledWith(
        'challenge-1',
        'user-1',
        'session-1',
        90,
      );
      expect(result).toEqual(submission);
    });

    it('throws when userClaims.id is missing', async () => {
      const data = {
        challengeId: 'challenge-1',
        sessionId: 'session-1',
        score: 90,
        userClaims: {},
      } as any;

      await expect(controller.submitScore(data)).rejects.toThrow(
        'User claims required',
      );
      expect(mockChallengeService.submitScore).not.toHaveBeenCalled();
    });

    it('propagates service errors', async () => {
      mockChallengeService.submitScore.mockRejectedValue(
        new Error('Score submission failed'),
      );

      await expect(
        controller.submitScore({
          challengeId: 'challenge-1',
          sessionId: 'session-1',
          score: 80,
          userClaims: { id: 'user-1' },
        } as any),
      ).rejects.toThrow('Score submission failed');
    });
  });

  // -------------------------------------------------------------------------
  // leaderboard
  // -------------------------------------------------------------------------
  describe('leaderboard', () => {
    it('returns the leaderboard for a specific challenge', async () => {
      mockChallengeService.leaderboard.mockResolvedValue(mockLeaderboard);

      const data = {
        challengeId: 'challenge-1',
        limit: 10,
        userClaims: { id: 'user-1' },
      } as any;

      const result = await controller.leaderboard(data);

      expect(mockChallengeService.leaderboard).toHaveBeenCalledWith(
        'challenge-1',
        10,
      );
      expect(result).toEqual(mockLeaderboard);
    });

    it('returns global leaderboard when challengeId is not provided', async () => {
      mockChallengeService.leaderboard.mockResolvedValue(mockLeaderboard);

      const data = { userClaims: { id: 'user-1' } } as any;

      await controller.leaderboard(data);

      expect(mockChallengeService.leaderboard).toHaveBeenCalledWith(
        undefined,
        undefined,
      );
    });

    it('propagates service errors', async () => {
      mockChallengeService.leaderboard.mockRejectedValue(
        new Error('Leaderboard error'),
      );

      await expect(
        controller.leaderboard({ userClaims: { id: 'user-1' } } as any),
      ).rejects.toThrow('Leaderboard error');
    });
  });

  // -------------------------------------------------------------------------
  // triggerGenerate
  // -------------------------------------------------------------------------
  describe('triggerGenerate', () => {
    it('triggers generation and returns triggered=true immediately', () => {
      mockChallengeService.triggerGenerate.mockResolvedValue(undefined);

      const data: TriggerGenerateDto = { period: ChallengePeriodDto.WEEKLY };

      const result = controller.triggerGenerate(data);

      expect(result).toEqual({
        triggered: true,
        period: ChallengePeriodDto.WEEKLY,
      });
      // Service called fire-and-forget (void), so we only verify it was invoked
      expect(mockChallengeService.triggerGenerate).toHaveBeenCalledWith(data);
    });

    it('returns the correct period in the response', () => {
      mockChallengeService.triggerGenerate.mockResolvedValue(undefined);

      const data: TriggerGenerateDto = { period: ChallengePeriodDto.DAILY };
      const result = controller.triggerGenerate(data);

      expect(result.period).toBe(ChallengePeriodDto.DAILY);
    });

    it('does not throw when service fails asynchronously (fire-and-forget)', () => {
      mockChallengeService.triggerGenerate.mockRejectedValue(
        new Error('Async generation error'),
      );

      const data: TriggerGenerateDto = { period: ChallengePeriodDto.MONTHLY };

      // Should NOT throw — the rejection is handled internally with .catch()
      expect(() => controller.triggerGenerate(data)).not.toThrow();
    });

    it('rethrows synchronous errors', () => {
      // Simulate a synchronous throw inside service
      mockChallengeService.triggerGenerate.mockImplementation(() => {
        throw new Error('Sync error');
      });

      const data: TriggerGenerateDto = { period: ChallengePeriodDto.WEEKLY };

      expect(() => controller.triggerGenerate(data)).toThrow('Sync error');
    });
  });
});
