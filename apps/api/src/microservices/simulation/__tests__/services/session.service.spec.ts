import { SessionService } from '../../services/session.service';

describe('SessionService cache invalidation', () => {
  const now = new Date('2026-03-07T00:00:00.000Z');

  const baseSession = {
    id: 'session-1',
    orgId: 'org-1',
    orgSnapshot: null,
    name: 'Session',
    type: 'text',
    tags: [],
    sessionConfig: {},
    scenarioId: null,
    personaId: null,
    scenario: null,
    persona: null,
    language: 'English',
    crmContextId: null,
    status: 'active',
    endedReason: null,
    createdAt: now,
    updatedAt: now,
    endedAt: null,
    members: [
      {
        id: 'member-owner',
        sessionId: 'session-1',
        userId: 'owner-1',
        role: 'owner',
        userSnapshot: null,
        joinedAt: now,
        updatedAt: now,
      },
    ],
  };

  const sessionRepository = {
    create: jest.fn(),
    findById: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  const sessionMemberRepository = {
    findBySessionIdAndUserId: jest.fn(),
    findOwner: jest.fn(),
  };

  const assessmentService = {
    requestRun: jest.fn(),
  };

  const prisma = {
    client: {
      iteration: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    },
  };

  const personaMediaService = {
    enrichTraits: jest.fn(),
  };

  const redis = {
    deleteSessionFull: jest.fn(),
  };

  const service = new SessionService(
    sessionRepository as never,
    sessionMemberRepository as never,
    assessmentService as never,
    prisma as never,
    personaMediaService as never,
    redis as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('invalidates full-session cache on create', async () => {
    sessionRepository.create.mockResolvedValue(baseSession);
    redis.deleteSessionFull.mockResolvedValue(undefined);

    await service.create(
      {
        orgId: 'org-1',
        type: 'text',
        name: 'Session',
      } as never,
      'owner-1',
    );

    expect(redis.deleteSessionFull).toHaveBeenCalledTimes(1);
    expect(redis.deleteSessionFull).toHaveBeenCalledWith('session-1');
  });

  it('invalidates full-session cache on update', async () => {
    sessionRepository.findById.mockResolvedValue(baseSession);
    sessionRepository.update.mockResolvedValue({
      ...baseSession,
      name: 'Updated Session',
    });
    redis.deleteSessionFull.mockResolvedValue(undefined);

    await service.update(
      'session-1',
      {
        name: 'Updated Session',
      } as never,
      'owner-1',
    );

    expect(redis.deleteSessionFull).toHaveBeenCalledTimes(1);
    expect(redis.deleteSessionFull).toHaveBeenCalledWith('session-1');
  });

  it('invalidates full-session cache on end', async () => {
    sessionRepository.findById.mockResolvedValue(baseSession);
    prisma.client.iteration.findFirst.mockResolvedValue(null);
    assessmentService.requestRun.mockResolvedValue(undefined);
    redis.deleteSessionFull.mockResolvedValue(undefined);

    await service.end(
      'session-1',
      {
        reason: 'user_ended',
      } as never,
      'owner-1',
    );

    expect(redis.deleteSessionFull).toHaveBeenCalledTimes(1);
    expect(redis.deleteSessionFull).toHaveBeenCalledWith('session-1');
  });

  it('invalidates full-session cache on delete', async () => {
    sessionRepository.findById.mockResolvedValue(baseSession);
    sessionRepository.delete.mockResolvedValue(undefined);
    redis.deleteSessionFull.mockResolvedValue(undefined);

    await service.remove('session-1', 'owner-1');

    expect(redis.deleteSessionFull).toHaveBeenCalledTimes(1);
    expect(redis.deleteSessionFull).toHaveBeenCalledWith('session-1');
  });
});
