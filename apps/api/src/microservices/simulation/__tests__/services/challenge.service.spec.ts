import {
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { ChallengeService } from '../../services/challenge.service';
import type { ChallengeRepository } from '../../repositories/challenge.repository';
import type { ChallengeGenerationService } from '../../services/challenge-generation.service';
import type { SessionRepository } from '../../repositories/session.repository';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeChallengeRepo = (): jest.Mocked<ChallengeRepository> =>
  ({
    findMany: jest.fn(),
    findById: jest.fn(),
    findParticipation: jest.fn(),
    createParticipation: jest.fn(),
    updateParticipationScore: jest.fn(),
    getLeaderboard: jest.fn(),
    getGlobalLeaderboard: jest.fn(),
    expireStale: jest.fn(),
    activateUpcoming: jest.fn(),
    create: jest.fn(),
  }) as unknown as jest.Mocked<ChallengeRepository>;

const makeGenerationService = (): jest.Mocked<ChallengeGenerationService> =>
  ({
    generate: jest.fn(),
  }) as unknown as jest.Mocked<ChallengeGenerationService>;

const makeSessionRepo = (): jest.Mocked<SessionRepository> =>
  ({
    findById: jest.fn(),
  }) as unknown as jest.Mocked<SessionRepository>;

const stubChallenge = (overrides: Record<string, unknown> = {}) => ({
  id: 'ch-1',
  period: 'DAILY',
  difficulty: 'BEGINNER',
  status: 'ACTIVE',
  title: 'Test Challenge',
  description: 'Desc',
  topic: 'Sales',
  scenarioPrompt: 'prompt',
  evaluatorPersonaPrompt: 'eva',
  startsAt: new Date('2026-03-24T00:00:00Z'),
  expiresAt: new Date('2026-03-25T00:00:00Z'),
  _count: { participations: 5 },
  ...overrides,
});

// ---------------------------------------------------------------------------
// list()
// ---------------------------------------------------------------------------

describe('ChallengeService.list', () => {
  it('returns mapped challenges and total', async () => {
    const repo = makeChallengeRepo();
    const service = new ChallengeService(
      repo,
      makeGenerationService(),
      makeSessionRepo(),
    );

    repo.findMany.mockResolvedValue({
      challenges: [stubChallenge()],
      total: 1,
    });

    const result = await service.list({ period: 'DAILY' as any });

    expect(repo.findMany).toHaveBeenCalledWith({
      period: 'DAILY',
      difficulty: undefined,
      status: 'ACTIVE',
      limit: undefined,
      offset: undefined,
    });
    expect(result.total).toBe(1);
    expect(result.challenges[0].participationCount).toBe(5);
    expect(result.challenges[0].id).toBe('ch-1');
  });

  it('passes limit and offset through', async () => {
    const repo = makeChallengeRepo();
    const service = new ChallengeService(
      repo,
      makeGenerationService(),
      makeSessionRepo(),
    );

    repo.findMany.mockResolvedValue({ challenges: [], total: 0 });

    await service.list({ limit: 10, offset: 20 } as any);

    expect(repo.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 10, offset: 20 }),
    );
  });

  it('returns empty list when repository returns none', async () => {
    const repo = makeChallengeRepo();
    const service = new ChallengeService(
      repo,
      makeGenerationService(),
      makeSessionRepo(),
    );

    repo.findMany.mockResolvedValue({ challenges: [], total: 0 });

    const result = await service.list({} as any);

    expect(result).toEqual({ challenges: [], total: 0 });
  });
});

// ---------------------------------------------------------------------------
// get()
// ---------------------------------------------------------------------------

describe('ChallengeService.get', () => {
  it('throws NotFoundException when challenge does not exist', async () => {
    const repo = makeChallengeRepo();
    const service = new ChallengeService(
      repo,
      makeGenerationService(),
      makeSessionRepo(),
    );

    repo.findById.mockResolvedValue(null);

    await expect(service.get('missing')).rejects.toThrow(NotFoundException);
  });

  it('returns challenge without participation when no userId provided', async () => {
    const repo = makeChallengeRepo();
    const service = new ChallengeService(
      repo,
      makeGenerationService(),
      makeSessionRepo(),
    );

    repo.findById.mockResolvedValue(stubChallenge());

    const result = await service.get('ch-1');

    expect(repo.findParticipation).not.toHaveBeenCalled();
    expect(result.myParticipation).toBeNull();
    expect(result.id).toBe('ch-1');
  });

  it('returns participation details when userId supplied and participation exists', async () => {
    const repo = makeChallengeRepo();
    const service = new ChallengeService(
      repo,
      makeGenerationService(),
      makeSessionRepo(),
    );

    const completedAt = new Date('2026-03-24T12:00:00Z');
    repo.findById.mockResolvedValue(stubChallenge());
    repo.findParticipation.mockResolvedValue({
      sessionId: 'sess-1',
      score: 88,
      completedAt,
    });

    const result = await service.get('ch-1', 'user-1');

    expect(result.myParticipation).toEqual({
      sessionId: 'sess-1',
      score: 88,
      completedAt,
    });
  });

  it('returns null participation when userId supplied but no participation', async () => {
    const repo = makeChallengeRepo();
    const service = new ChallengeService(
      repo,
      makeGenerationService(),
      makeSessionRepo(),
    );

    repo.findById.mockResolvedValue(stubChallenge());
    repo.findParticipation.mockResolvedValue(null);

    const result = await service.get('ch-1', 'user-1');

    expect(result.myParticipation).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// participate()
// ---------------------------------------------------------------------------

describe('ChallengeService.participate', () => {
  it('throws NotFoundException when challenge does not exist', async () => {
    const repo = makeChallengeRepo();
    const service = new ChallengeService(
      repo,
      makeGenerationService(),
      makeSessionRepo(),
    );

    repo.findById.mockResolvedValue(null);

    await expect(service.participate('ch-1', 'user-1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('throws ConflictException when challenge is not ACTIVE', async () => {
    const repo = makeChallengeRepo();
    const service = new ChallengeService(
      repo,
      makeGenerationService(),
      makeSessionRepo(),
    );

    repo.findById.mockResolvedValue(stubChallenge({ status: 'EXPIRED' }));

    await expect(service.participate('ch-1', 'user-1')).rejects.toThrow(
      ConflictException,
    );
  });

  it('returns alreadyParticipating=true when participation already exists', async () => {
    const repo = makeChallengeRepo();
    const service = new ChallengeService(
      repo,
      makeGenerationService(),
      makeSessionRepo(),
    );

    repo.findById.mockResolvedValue(stubChallenge());
    repo.findParticipation.mockResolvedValue({
      sessionId: 'sess-existing',
      score: null,
      completedAt: null,
    });

    const result = await service.participate('ch-1', 'user-1');

    expect(result).toEqual({
      challengeId: 'ch-1',
      sessionId: 'sess-existing',
      alreadyParticipating: true,
    });
    expect(repo.createParticipation).not.toHaveBeenCalled();
  });

  it('creates participation and returns alreadyParticipating=false when new', async () => {
    const repo = makeChallengeRepo();
    const service = new ChallengeService(
      repo,
      makeGenerationService(),
      makeSessionRepo(),
    );

    repo.findById.mockResolvedValue(stubChallenge());
    repo.findParticipation.mockResolvedValue(null);
    repo.createParticipation.mockResolvedValue(undefined);

    const result = await service.participate('ch-1', 'user-1');

    expect(repo.createParticipation).toHaveBeenCalledWith('ch-1', 'user-1');
    expect(result).toEqual({
      challengeId: 'ch-1',
      sessionId: null,
      alreadyParticipating: false,
    });
  });
});

// ---------------------------------------------------------------------------
// submitScore()
// ---------------------------------------------------------------------------

describe('ChallengeService.submitScore', () => {
  const stubSession = (overrides: Record<string, unknown> = {}) => ({
    id: 'sess-1',
    members: [{ userId: 'user-1' }],
    sessionConfig: { challengeId: 'ch-1' },
    ...overrides,
  });

  it('throws NotFoundException when participation does not exist', async () => {
    const repo = makeChallengeRepo();
    const sessRepo = makeSessionRepo();
    const service = new ChallengeService(
      repo,
      makeGenerationService(),
      sessRepo,
    );

    repo.findParticipation.mockResolvedValue(null);

    await expect(
      service.submitScore('ch-1', 'user-1', 'sess-1', 80),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws NotFoundException when session does not exist', async () => {
    const repo = makeChallengeRepo();
    const sessRepo = makeSessionRepo();
    const service = new ChallengeService(
      repo,
      makeGenerationService(),
      sessRepo,
    );

    repo.findParticipation.mockResolvedValue({ sessionId: null });
    sessRepo.findById.mockResolvedValue(null);

    await expect(
      service.submitScore('ch-1', 'user-1', 'sess-1', 80),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws ForbiddenException when user is not the session owner', async () => {
    const repo = makeChallengeRepo();
    const sessRepo = makeSessionRepo();
    const service = new ChallengeService(
      repo,
      makeGenerationService(),
      sessRepo,
    );

    repo.findParticipation.mockResolvedValue({ sessionId: 'sess-1' });
    sessRepo.findById.mockResolvedValue(
      stubSession({ members: [{ userId: 'other-user' }] }),
    );

    await expect(
      service.submitScore('ch-1', 'user-1', 'sess-1', 80),
    ).rejects.toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when members array is empty', async () => {
    const repo = makeChallengeRepo();
    const sessRepo = makeSessionRepo();
    const service = new ChallengeService(
      repo,
      makeGenerationService(),
      sessRepo,
    );

    repo.findParticipation.mockResolvedValue({ sessionId: 'sess-1' });
    sessRepo.findById.mockResolvedValue(stubSession({ members: [] }));

    await expect(
      service.submitScore('ch-1', 'user-1', 'sess-1', 80),
    ).rejects.toThrow(ForbiddenException);
  });

  it('throws BadRequestException when session is not linked to the challenge', async () => {
    const repo = makeChallengeRepo();
    const sessRepo = makeSessionRepo();
    const service = new ChallengeService(
      repo,
      makeGenerationService(),
      sessRepo,
    );

    repo.findParticipation.mockResolvedValue({ sessionId: 'sess-1' });
    sessRepo.findById.mockResolvedValue(
      stubSession({ sessionConfig: { challengeId: 'other-ch' } }),
    );

    await expect(
      service.submitScore('ch-1', 'user-1', 'sess-1', 80),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when sessionConfig is not an object', async () => {
    const repo = makeChallengeRepo();
    const sessRepo = makeSessionRepo();
    const service = new ChallengeService(
      repo,
      makeGenerationService(),
      sessRepo,
    );

    repo.findParticipation.mockResolvedValue({ sessionId: 'sess-1' });
    sessRepo.findById.mockResolvedValue(stubSession({ sessionConfig: null }));

    await expect(
      service.submitScore('ch-1', 'user-1', 'sess-1', 80),
    ).rejects.toThrow(BadRequestException);
  });

  it('updates score and returns success on valid submission', async () => {
    const repo = makeChallengeRepo();
    const sessRepo = makeSessionRepo();
    const service = new ChallengeService(
      repo,
      makeGenerationService(),
      sessRepo,
    );

    repo.findParticipation.mockResolvedValue({ sessionId: 'sess-1' });
    sessRepo.findById.mockResolvedValue(stubSession());
    repo.updateParticipationScore.mockResolvedValue(undefined);

    const result = await service.submitScore('ch-1', 'user-1', 'sess-1', 80);

    expect(repo.updateParticipationScore).toHaveBeenCalledWith(
      'ch-1',
      'user-1',
      'sess-1',
      80,
    );
    expect(result).toEqual({ success: true });
  });
});

// ---------------------------------------------------------------------------
// leaderboard()
// ---------------------------------------------------------------------------

describe('ChallengeService.leaderboard', () => {
  it('returns challenge-specific leaderboard with ranks when challengeId given', async () => {
    const repo = makeChallengeRepo();
    const service = new ChallengeService(
      repo,
      makeGenerationService(),
      makeSessionRepo(),
    );

    const completedAt = new Date('2026-03-24T10:00:00Z');
    repo.getLeaderboard.mockResolvedValue([
      { userId: 'user-A', score: 95, completedAt },
      { userId: 'user-B', score: 80, completedAt },
    ]);

    const result = await service.leaderboard('ch-1', 5);

    expect(repo.getLeaderboard).toHaveBeenCalledWith('ch-1', 5);
    expect(result).toEqual([
      { rank: 1, userId: 'user-A', score: 95, completedAt },
      { rank: 2, userId: 'user-B', score: 80, completedAt },
    ]);
  });

  it('returns global leaderboard when no challengeId given', async () => {
    const repo = makeChallengeRepo();
    const service = new ChallengeService(
      repo,
      makeGenerationService(),
      makeSessionRepo(),
    );

    repo.getGlobalLeaderboard.mockResolvedValue([
      { userId: 'user-A', _sum: { score: 200 } },
    ]);

    const result = await service.leaderboard(undefined, 10);

    expect(repo.getGlobalLeaderboard).toHaveBeenCalledWith(10);
    expect(result).toEqual([{ rank: 1, userId: 'user-A', totalScore: 200 }]);
  });

  it('uses default limit of 10 when not specified', async () => {
    const repo = makeChallengeRepo();
    const service = new ChallengeService(
      repo,
      makeGenerationService(),
      makeSessionRepo(),
    );

    repo.getGlobalLeaderboard.mockResolvedValue([]);

    await service.leaderboard();

    expect(repo.getGlobalLeaderboard).toHaveBeenCalledWith(10);
  });
});

// ---------------------------------------------------------------------------
// triggerGenerate()
// ---------------------------------------------------------------------------

describe('ChallengeService.triggerGenerate', () => {
  it('expires stale challenges, generates 4 difficulties, and activates upcoming', async () => {
    const repo = makeChallengeRepo();
    const gen = makeGenerationService();
    const service = new ChallengeService(repo, gen, makeSessionRepo());

    repo.expireStale.mockResolvedValue(undefined);
    repo.activateUpcoming.mockResolvedValue(undefined);
    repo.create.mockResolvedValue({} as any);
    gen.generate.mockResolvedValue({
      title: 'T',
      description: 'D',
      topic: 'Sales',
      scenarioPrompt: 'sp',
      evaluatorPersonaPrompt: 'ep',
    });

    await service.triggerGenerate({ period: 'DAILY' } as any);

    expect(repo.expireStale).toHaveBeenCalledTimes(1);
    expect(gen.generate).toHaveBeenCalledTimes(4);
    expect(repo.create).toHaveBeenCalledTimes(4);
    expect(repo.activateUpcoming).toHaveBeenCalledTimes(1);
  });

  it('continues generating other difficulties when one fails', async () => {
    const repo = makeChallengeRepo();
    const gen = makeGenerationService();
    const service = new ChallengeService(repo, gen, makeSessionRepo());

    repo.expireStale.mockResolvedValue(undefined);
    repo.activateUpcoming.mockResolvedValue(undefined);
    repo.create.mockResolvedValue({} as any);

    gen.generate
      .mockRejectedValueOnce(new Error('LLM failure'))
      .mockResolvedValue({
        title: 'T',
        description: 'D',
        topic: 'Sales',
        scenarioPrompt: 'sp',
        evaluatorPersonaPrompt: 'ep',
      });

    await service.triggerGenerate({ period: 'WEEKLY' } as any);

    expect(gen.generate).toHaveBeenCalledTimes(4);
    // first call failed, so only 3 should be created
    expect(repo.create).toHaveBeenCalledTimes(3);
    expect(repo.activateUpcoming).toHaveBeenCalledTimes(1);
  });

  it('computes DAILY period window correctly (expires next day UTC)', async () => {
    const repo = makeChallengeRepo();
    const gen = makeGenerationService();
    const service = new ChallengeService(repo, gen, makeSessionRepo());

    repo.expireStale.mockResolvedValue(undefined);
    repo.activateUpcoming.mockResolvedValue(undefined);
    repo.create.mockResolvedValue({} as any);
    gen.generate.mockResolvedValue({
      title: 'T',
      description: 'D',
      topic: 'Sales',
      scenarioPrompt: 'sp',
      evaluatorPersonaPrompt: 'ep',
    });

    await service.triggerGenerate({ period: 'DAILY' } as any);

    const createArg = repo.create.mock.calls[0][0] as any;
    const diff = createArg.expiresAt.getTime() - createArg.startsAt.getTime();
    // DAILY → exactly 1 day apart
    expect(diff).toBe(24 * 60 * 60 * 1000);
  });

  it('computes WEEKLY period window correctly (expires 7 days later)', async () => {
    const repo = makeChallengeRepo();
    const gen = makeGenerationService();
    const service = new ChallengeService(repo, gen, makeSessionRepo());

    repo.expireStale.mockResolvedValue(undefined);
    repo.activateUpcoming.mockResolvedValue(undefined);
    repo.create.mockResolvedValue({} as any);
    gen.generate.mockResolvedValue({
      title: 'T',
      description: 'D',
      topic: 'Sales',
      scenarioPrompt: 'sp',
      evaluatorPersonaPrompt: 'ep',
    });

    await service.triggerGenerate({ period: 'WEEKLY' } as any);

    const createArg = repo.create.mock.calls[0][0] as any;
    const diff = createArg.expiresAt.getTime() - createArg.startsAt.getTime();
    expect(diff).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it('computes MONTHLY period window correctly (expires next month)', async () => {
    const repo = makeChallengeRepo();
    const gen = makeGenerationService();
    const service = new ChallengeService(repo, gen, makeSessionRepo());

    repo.expireStale.mockResolvedValue(undefined);
    repo.activateUpcoming.mockResolvedValue(undefined);
    repo.create.mockResolvedValue({} as any);
    gen.generate.mockResolvedValue({
      title: 'T',
      description: 'D',
      topic: 'Sales',
      scenarioPrompt: 'sp',
      evaluatorPersonaPrompt: 'ep',
    });

    await service.triggerGenerate({ period: 'MONTHLY' } as any);

    const createArg = repo.create.mock.calls[0][0] as any;
    // expiresAt month should be one month ahead of startsAt month
    expect(
      createArg.expiresAt.getUTCMonth() - createArg.startsAt.getUTCMonth(),
    ).toBe(1);
  });
});
