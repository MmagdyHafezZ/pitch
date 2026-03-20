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
    end: jest.fn(),
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
        create: jest.fn(),
      },
      turn: {
        count: jest.fn(),
      },
      session: {
        update: jest.fn(),
      },
    },
  };

  const personaMediaService = {
    enrichTraits: jest.fn(),
  };

  const redis = {
    deleteSessionFull: jest.fn(),
    setSessionMemberIteration: jest.fn(),
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

  it('allows updating an ended session without forcing a restart', async () => {
    sessionRepository.findById.mockResolvedValue({
      ...baseSession,
      status: 'ended',
      endedReason: 'completed',
      endedAt: now,
    });
    sessionRepository.update.mockResolvedValue({
      ...baseSession,
      status: 'ended',
      endedReason: 'completed',
      endedAt: now,
      name: 'Updated Ended Session',
    });
    redis.deleteSessionFull.mockResolvedValue(undefined);

    await service.update(
      'session-1',
      {
        name: 'Updated Ended Session',
      } as never,
      'owner-1',
    );

    expect(sessionRepository.update).toHaveBeenCalledWith(
      'session-1',
      expect.objectContaining({
        name: 'Updated Ended Session',
        status: undefined,
        endedReason: undefined,
        endedAt: undefined,
      }),
    );
    expect(redis.deleteSessionFull).toHaveBeenCalledWith('session-1');
  });

  it('reopens an ended session cleanly when status is set back to active', async () => {
    sessionRepository.findById.mockResolvedValue({
      ...baseSession,
      status: 'ended',
      endedReason: 'completed',
      endedAt: now,
    });
    sessionRepository.update.mockResolvedValue({
      ...baseSession,
      status: 'active',
      endedReason: null,
      endedAt: null,
    });
    redis.deleteSessionFull.mockResolvedValue(undefined);

    await service.update(
      'session-1',
      {
        status: 'active',
      } as never,
      'owner-1',
    );

    expect(sessionRepository.update).toHaveBeenCalledWith(
      'session-1',
      expect.objectContaining({
        status: 'active',
        endedReason: null,
        endedAt: null,
      }),
    );
    expect(redis.deleteSessionFull).toHaveBeenCalledWith('session-1');
  });

  it('invalidates full-session cache on end', async () => {
    sessionRepository.findById.mockResolvedValue(baseSession);
    sessionRepository.end.mockResolvedValue({
      ...baseSession,
      status: 'ended',
      endedReason: 'user_ended',
      endedAt: now,
    });
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
    expect(sessionRepository.end).toHaveBeenCalledWith(
      'session-1',
      'user_ended',
    );
  });

  it('invalidates full-session cache on delete', async () => {
    sessionRepository.findById.mockResolvedValue(baseSession);
    sessionRepository.delete.mockResolvedValue(undefined);
    redis.deleteSessionFull.mockResolvedValue(undefined);

    await service.remove('session-1', 'owner-1');

    expect(redis.deleteSessionFull).toHaveBeenCalledTimes(1);
    expect(redis.deleteSessionFull).toHaveBeenCalledWith('session-1');
  });

  it('restarts the current session by creating a new iteration instead of a new session', async () => {
    const phoneSession = {
      ...baseSession,
      type: 'phone',
      sessionConfig: {
        phone: {
          provider: 'vapi',
          runtime: {
            callId: 'call-1',
            status: 'queued',
          },
        },
      },
    };

    sessionRepository.findById
      .mockResolvedValueOnce(phoneSession)
      .mockResolvedValueOnce(phoneSession);
    prisma.client.iteration.findFirst.mockResolvedValue({
      id: 'iteration-1',
      iterationNumber: 1,
      status: 'active',
    });
    prisma.client.iteration.update.mockResolvedValue(undefined);
    prisma.client.turn.count.mockResolvedValue(3);
    assessmentService.requestRun.mockResolvedValue(undefined);
    prisma.client.iteration.create.mockResolvedValue({ id: 'iteration-2' });
    prisma.client.session.update.mockResolvedValue(undefined);
    redis.setSessionMemberIteration.mockResolvedValue(undefined);
    redis.deleteSessionFull.mockResolvedValue(undefined);

    await service.restart(
      'session-1',
      {
        reason: 'restart_from_scratch',
      } as never,
      'owner-1',
    );

    expect(prisma.client.iteration.update).toHaveBeenCalledWith({
      where: { id: 'iteration-1' },
      data: expect.objectContaining({
        status: 'completed',
        endedReason: 'restart_from_scratch',
      }),
    });
    expect(prisma.client.iteration.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        sessionId: 'session-1',
        sessionMemberId: 'member-owner',
        iterationNumber: 2,
        status: 'active',
      }),
      select: { id: true },
    });
    expect(prisma.client.session.update).toHaveBeenCalledWith({
      where: { id: 'session-1' },
      data: {
        status: 'active',
        endedReason: null,
        endedAt: null,
        sessionConfig: {
          phone: {
            provider: 'vapi',
          },
        },
      },
    });
    expect(assessmentService.requestRun).toHaveBeenCalledWith({
      iterationId: 'iteration-1',
      sessionId: 'session-1',
      mode: 'final',
      requestedBy: 'owner-1',
    });
    expect(redis.setSessionMemberIteration).toHaveBeenCalledWith(
      'session-1',
      'owner-1',
      {
        sessionMemberId: 'member-owner',
        iterationId: 'iteration-2',
        lastTurnOrder: 0,
      },
    );
    expect(redis.deleteSessionFull).toHaveBeenCalledWith('session-1');
    expect(sessionRepository.create).not.toHaveBeenCalled();
  });
});
