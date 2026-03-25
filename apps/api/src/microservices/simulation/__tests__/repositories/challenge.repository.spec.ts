import { ChallengeRepository } from '../../repositories/challenge.repository';

const mockChallenge = {
  id: 'challenge-1',
  period: 'WEEKLY' as const,
  difficulty: 'MEDIUM' as const,
  status: 'ACTIVE' as const,
  title: 'Weekly Challenge',
  description: 'A weekly sales challenge',
  topic: 'Cold Outreach',
  scenarioPrompt: 'You are a sales rep...',
  evaluatorPersonaPrompt: 'You are an evaluator...',
  startsAt: new Date('2024-01-01'),
  expiresAt: new Date('2024-01-07'),
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  _count: { participations: 10 },
};

const mockParticipation = {
  id: 'participation-1',
  challengeId: 'challenge-1',
  userId: 'user-1',
  sessionId: 'session-1',
  score: 85,
  completedAt: new Date('2024-01-03'),
  createdAt: new Date('2024-01-02'),
  updatedAt: new Date('2024-01-03'),
};

const mockPrisma = {
  client: {
    challenge: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
    },
    challengeParticipation: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      groupBy: jest.fn(),
    },
  },
};

describe('ChallengeRepository', () => {
  let repo: ChallengeRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new ChallengeRepository(mockPrisma as never);
  });

  // ---------------------------------------------------------------------------
  // findMany
  // ---------------------------------------------------------------------------

  describe('findMany', () => {
    it('returns challenges and total with no filters', async () => {
      mockPrisma.client.challenge.findMany.mockResolvedValue([mockChallenge]);
      mockPrisma.client.challenge.count.mockResolvedValue(1);

      const result = await repo.findMany();

      expect(result).toEqual({ challenges: [mockChallenge], total: 1 });
      expect(mockPrisma.client.challenge.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {},
          skip: 0,
          take: 20,
          orderBy: [{ difficulty: 'asc' }, { createdAt: 'desc' }],
          include: { _count: { select: { participations: true } } },
        }),
      );
    });

    it('applies period filter', async () => {
      mockPrisma.client.challenge.findMany.mockResolvedValue([]);
      mockPrisma.client.challenge.count.mockResolvedValue(0);

      await repo.findMany({ period: 'WEEKLY' as any });

      expect(mockPrisma.client.challenge.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { period: 'WEEKLY' } }),
      );
    });

    it('applies difficulty filter', async () => {
      mockPrisma.client.challenge.findMany.mockResolvedValue([]);
      mockPrisma.client.challenge.count.mockResolvedValue(0);

      await repo.findMany({ difficulty: 'HARD' as any });

      expect(mockPrisma.client.challenge.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { difficulty: 'HARD' } }),
      );
    });

    it('applies status filter', async () => {
      mockPrisma.client.challenge.findMany.mockResolvedValue([]);
      mockPrisma.client.challenge.count.mockResolvedValue(0);

      await repo.findMany({ status: 'UPCOMING' as any });

      expect(mockPrisma.client.challenge.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: 'UPCOMING' } }),
      );
    });

    it('respects custom limit and offset', async () => {
      mockPrisma.client.challenge.findMany.mockResolvedValue([]);
      mockPrisma.client.challenge.count.mockResolvedValue(0);

      await repo.findMany({ limit: 5, offset: 10 });

      expect(mockPrisma.client.challenge.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 5, skip: 10 }),
      );
    });

    it('returns empty challenges and zero total when none found', async () => {
      mockPrisma.client.challenge.findMany.mockResolvedValue([]);
      mockPrisma.client.challenge.count.mockResolvedValue(0);

      const result = await repo.findMany();

      expect(result).toEqual({ challenges: [], total: 0 });
    });
  });

  // ---------------------------------------------------------------------------
  // findById
  // ---------------------------------------------------------------------------

  describe('findById', () => {
    it('returns challenge when found', async () => {
      mockPrisma.client.challenge.findUnique.mockResolvedValue(mockChallenge);

      const result = await repo.findById('challenge-1');

      expect(result).toEqual(mockChallenge);
      expect(mockPrisma.client.challenge.findUnique).toHaveBeenCalledWith({
        where: { id: 'challenge-1' },
        include: { _count: { select: { participations: true } } },
      });
    });

    it('returns null when challenge not found', async () => {
      mockPrisma.client.challenge.findUnique.mockResolvedValue(null);

      const result = await repo.findById('nonexistent');

      expect(result).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // create
  // ---------------------------------------------------------------------------

  describe('create', () => {
    it('creates a challenge with all required fields', async () => {
      mockPrisma.client.challenge.create.mockResolvedValue(mockChallenge);

      const createData = {
        period: 'WEEKLY' as any,
        difficulty: 'MEDIUM' as any,
        title: 'Weekly Challenge',
        description: 'A weekly sales challenge',
        topic: 'Cold Outreach',
        scenarioPrompt: 'You are a sales rep...',
        evaluatorPersonaPrompt: 'You are an evaluator...',
        startsAt: new Date('2024-01-01'),
        expiresAt: new Date('2024-01-07'),
      };

      const result = await repo.create(createData);

      expect(result).toEqual(mockChallenge);
      expect(mockPrisma.client.challenge.create).toHaveBeenCalledWith({
        data: createData,
      });
    });
  });

  // ---------------------------------------------------------------------------
  // updateStatus
  // ---------------------------------------------------------------------------

  describe('updateStatus', () => {
    it('updates challenge status', async () => {
      const updated = { ...mockChallenge, status: 'EXPIRED' as const };
      mockPrisma.client.challenge.update.mockResolvedValue(updated);

      const result = await repo.updateStatus('challenge-1', 'EXPIRED' as any);

      expect(result).toEqual(updated);
      expect(mockPrisma.client.challenge.update).toHaveBeenCalledWith({
        where: { id: 'challenge-1' },
        data: { status: 'EXPIRED' },
      });
    });
  });

  // ---------------------------------------------------------------------------
  // expireStale
  // ---------------------------------------------------------------------------

  describe('expireStale', () => {
    it('bulk-updates active challenges past their expiry', async () => {
      const now = new Date('2024-01-08');
      mockPrisma.client.challenge.updateMany.mockResolvedValue({ count: 3 });

      const result = await repo.expireStale(now);

      expect(result).toEqual({ count: 3 });
      expect(mockPrisma.client.challenge.updateMany).toHaveBeenCalledWith({
        where: { status: 'ACTIVE', expiresAt: { lt: now } },
        data: { status: 'EXPIRED' },
      });
    });

    it('returns count of 0 when no challenges to expire', async () => {
      mockPrisma.client.challenge.updateMany.mockResolvedValue({ count: 0 });

      const result = await repo.expireStale(new Date());

      expect(result).toEqual({ count: 0 });
    });
  });

  // ---------------------------------------------------------------------------
  // activateUpcoming
  // ---------------------------------------------------------------------------

  describe('activateUpcoming', () => {
    it('bulk-updates upcoming challenges that have started', async () => {
      const now = new Date('2024-01-01');
      mockPrisma.client.challenge.updateMany.mockResolvedValue({ count: 2 });

      const result = await repo.activateUpcoming(now);

      expect(result).toEqual({ count: 2 });
      expect(mockPrisma.client.challenge.updateMany).toHaveBeenCalledWith({
        where: { status: 'UPCOMING', startsAt: { lte: now } },
        data: { status: 'ACTIVE' },
      });
    });

    it('returns count of 0 when no challenges to activate', async () => {
      mockPrisma.client.challenge.updateMany.mockResolvedValue({ count: 0 });

      const result = await repo.activateUpcoming(new Date());

      expect(result).toEqual({ count: 0 });
    });
  });

  // ---------------------------------------------------------------------------
  // findParticipation
  // ---------------------------------------------------------------------------

  describe('findParticipation', () => {
    it('returns participation when found', async () => {
      mockPrisma.client.challengeParticipation.findUnique.mockResolvedValue(
        mockParticipation,
      );

      const result = await repo.findParticipation('challenge-1', 'user-1');

      expect(result).toEqual(mockParticipation);
      expect(
        mockPrisma.client.challengeParticipation.findUnique,
      ).toHaveBeenCalledWith({
        where: {
          challengeId_userId: { challengeId: 'challenge-1', userId: 'user-1' },
        },
      });
    });

    it('returns null when participation not found', async () => {
      mockPrisma.client.challengeParticipation.findUnique.mockResolvedValue(
        null,
      );

      const result = await repo.findParticipation('challenge-1', 'user-nobody');

      expect(result).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // createParticipation
  // ---------------------------------------------------------------------------

  describe('createParticipation', () => {
    it('creates a participation record', async () => {
      mockPrisma.client.challengeParticipation.create.mockResolvedValue(
        mockParticipation,
      );

      const result = await repo.createParticipation('challenge-1', 'user-1');

      expect(result).toEqual(mockParticipation);
      expect(
        mockPrisma.client.challengeParticipation.create,
      ).toHaveBeenCalledWith({
        data: { challengeId: 'challenge-1', userId: 'user-1' },
      });
    });
  });

  // ---------------------------------------------------------------------------
  // updateParticipationScore
  // ---------------------------------------------------------------------------

  describe('updateParticipationScore', () => {
    it('updates score, sessionId and completedAt', async () => {
      const updated = { ...mockParticipation, score: 95 };
      mockPrisma.client.challengeParticipation.update.mockResolvedValue(
        updated,
      );

      const result = await repo.updateParticipationScore(
        'challenge-1',
        'user-1',
        'session-1',
        95,
      );

      expect(result).toEqual(updated);
      expect(
        mockPrisma.client.challengeParticipation.update,
      ).toHaveBeenCalledWith({
        where: {
          challengeId_userId: { challengeId: 'challenge-1', userId: 'user-1' },
        },
        data: {
          score: 95,
          sessionId: 'session-1',
          completedAt: expect.any(Date),
        },
      });
    });
  });

  // ---------------------------------------------------------------------------
  // getLeaderboard
  // ---------------------------------------------------------------------------

  describe('getLeaderboard', () => {
    it('returns leaderboard entries ordered by score desc', async () => {
      mockPrisma.client.challengeParticipation.findMany.mockResolvedValue([
        mockParticipation,
      ]);

      const result = await repo.getLeaderboard('challenge-1');

      expect(result).toEqual([mockParticipation]);
      expect(
        mockPrisma.client.challengeParticipation.findMany,
      ).toHaveBeenCalledWith({
        where: { challengeId: 'challenge-1', score: { not: null } },
        orderBy: [{ score: 'desc' }, { completedAt: 'asc' }],
        take: 10,
      });
    });

    it('respects custom limit', async () => {
      mockPrisma.client.challengeParticipation.findMany.mockResolvedValue([]);

      await repo.getLeaderboard('challenge-1', 5);

      expect(
        mockPrisma.client.challengeParticipation.findMany,
      ).toHaveBeenCalledWith(expect.objectContaining({ take: 5 }));
    });

    it('returns empty array when no scored entries exist', async () => {
      mockPrisma.client.challengeParticipation.findMany.mockResolvedValue([]);

      const result = await repo.getLeaderboard('challenge-1');

      expect(result).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // getGlobalLeaderboard
  // ---------------------------------------------------------------------------

  describe('getGlobalLeaderboard', () => {
    it('returns aggregated global leaderboard rows', async () => {
      const mockRows = [
        {
          userId: 'user-1',
          _sum: { score: 250 },
          _max: { completedAt: new Date() },
        },
        {
          userId: 'user-2',
          _sum: { score: 180 },
          _max: { completedAt: new Date() },
        },
      ];
      mockPrisma.client.challengeParticipation.groupBy.mockResolvedValue(
        mockRows,
      );

      const result = await repo.getGlobalLeaderboard();

      expect(result).toEqual(mockRows);
      expect(
        mockPrisma.client.challengeParticipation.groupBy,
      ).toHaveBeenCalledWith({
        by: ['userId'],
        _sum: { score: true },
        _max: { completedAt: true },
        where: { score: { not: null } },
        orderBy: { _sum: { score: 'desc' } },
        take: 20,
      });
    });

    it('respects custom limit', async () => {
      mockPrisma.client.challengeParticipation.groupBy.mockResolvedValue([]);

      await repo.getGlobalLeaderboard(5);

      expect(
        mockPrisma.client.challengeParticipation.groupBy,
      ).toHaveBeenCalledWith(expect.objectContaining({ take: 5 }));
    });

    it('returns empty array when no scored participations exist', async () => {
      mockPrisma.client.challengeParticipation.groupBy.mockResolvedValue([]);

      const result = await repo.getGlobalLeaderboard();

      expect(result).toEqual([]);
    });
  });
});
