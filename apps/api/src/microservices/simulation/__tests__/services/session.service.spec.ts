import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
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

describe('SessionService — query & error paths', () => {
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
    findMany: jest.fn(),
    findByUserId: jest.fn(),
    findByOrgId: jest.fn(),
    findActiveByUserId: jest.fn(),
    findActiveByOrgId: jest.fn(),
    update: jest.fn(),
    end: jest.fn(),
    delete: jest.fn(),
  };

  const sessionMemberRepository = {
    findBySessionIdAndUserId: jest.fn(),
    findOwner: jest.fn(),
  };

  const assessmentService = { requestRun: jest.fn() };

  const prisma = {
    client: {
      iteration: {
        findFirst: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
      },
      turn: { count: jest.fn() },
      session: { update: jest.fn() },
    },
  };

  const personaMediaService = { enrichTraits: jest.fn((x) => x.traits) };

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

  beforeEach(() => jest.clearAllMocks());

  describe('findAll()', () => {
    it('returns sessions and total from repository', async () => {
      sessionRepository.findMany.mockResolvedValue({
        sessions: [baseSession],
        total: 1,
      });

      const result = await service.findAll({ limit: 5, offset: 0 } as never);

      expect(result.sessions).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.limit).toBe(5);
    });

    it('defaults limit=10 and offset=0 when not provided', async () => {
      sessionRepository.findMany.mockResolvedValue({ sessions: [], total: 0 });

      const result = await service.findAll({} as never);

      expect(result.limit).toBe(10);
      expect(result.offset).toBe(0);
    });

    it('uses provided userId filter', async () => {
      sessionRepository.findMany.mockResolvedValue({ sessions: [], total: 0 });

      await service.findAll({ userId: 'u-1' } as never, 'u-2');

      expect(sessionRepository.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'u-1' }),
        10,
        0,
      );
    });

    it('falls back to requesterUserId when query.userId not provided', async () => {
      sessionRepository.findMany.mockResolvedValue({ sessions: [], total: 0 });

      await service.findAll({} as never, 'requester-1');

      expect(sessionRepository.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'requester-1' }),
        10,
        0,
      );
    });
  });

  describe('findOne()', () => {
    it('returns session when found', async () => {
      sessionRepository.findById.mockResolvedValue(baseSession);

      const result = await service.findOne('session-1');

      expect(result.id).toBe('session-1');
    });

    it('throws NotFoundException when session not found', async () => {
      sessionRepository.findById.mockResolvedValue(null);

      await expect(service.findOne('missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException when id is null', async () => {
      await expect(service.findOne(null as never)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws ForbiddenException when requester is not a session member', async () => {
      sessionMemberRepository.findBySessionIdAndUserId.mockResolvedValue(null);

      await expect(
        service.findOne('session-1', 'unauthorized-user'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('returns session when requester is a valid member', async () => {
      sessionMemberRepository.findBySessionIdAndUserId.mockResolvedValue({
        id: 'member-owner',
      });
      sessionRepository.findById.mockResolvedValue(baseSession);

      const result = await service.findOne('session-1', 'owner-1');

      expect(result.id).toBe('session-1');
    });
  });

  describe('findByUserId()', () => {
    it('returns sessions list for user', async () => {
      sessionRepository.findByUserId.mockResolvedValue({
        sessions: [baseSession],
        total: 1,
      });

      const result = await service.findByUserId('u-1', 5, 0);

      expect(result.sessions).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe('findByOrgId()', () => {
    it('returns sessions list for org', async () => {
      sessionRepository.findByOrgId.mockResolvedValue({
        sessions: [baseSession],
        total: 1,
      });

      const result = await service.findByOrgId('org-1');

      expect(result.sessions).toHaveLength(1);
    });
  });

  describe('findActiveByUserId()', () => {
    it('returns active sessions for user', async () => {
      sessionRepository.findActiveByUserId.mockResolvedValue([baseSession]);

      const result = await service.findActiveByUserId('u-1');

      expect(result).toHaveLength(1);
    });
  });

  describe('findActiveByOrgId()', () => {
    it('returns active sessions for org', async () => {
      sessionRepository.findActiveByOrgId.mockResolvedValue([baseSession]);

      const result = await service.findActiveByOrgId('org-1');

      expect(result).toHaveLength(1);
    });
  });

  describe('create() — error paths', () => {
    it('throws BadRequestException when userId is missing', async () => {
      await expect(
        service.create({ orgId: 'org-1', type: 'text' } as never),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException for P2003 on scenarioId FK violation', async () => {
      const err = {
        code: 'P2003',
        meta: { constraint: 'Session_scenarioId_fkey' },
      };
      sessionRepository.create.mockRejectedValue(err);

      await expect(
        service.create(
          { orgId: 'org-1', type: 'text', scenarioId: 'bad-id' } as never,
          'user-1',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException for P2003 on personaId FK violation', async () => {
      const err = {
        code: 'P2003',
        meta: { constraint: 'Session_personaId_fkey' },
      };
      sessionRepository.create.mockRejectedValue(err);

      await expect(
        service.create(
          { orgId: 'org-1', type: 'text', personaId: 'bad-id' } as never,
          'user-1',
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('update() — error paths', () => {
    it('throws NotFoundException when session not found', async () => {
      sessionRepository.findById.mockResolvedValue(null);

      await expect(
        service.update('missing', {} as never, 'owner-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when requester is not owner', async () => {
      sessionRepository.findById.mockResolvedValue(baseSession);

      await expect(
        service.update('session-1', {} as never, 'not-owner'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when no requesterUserId', async () => {
      sessionRepository.findById.mockResolvedValue(baseSession);

      await expect(service.update('session-1', {} as never)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('converts P2025 Prisma error to NotFoundException', async () => {
      sessionRepository.findById.mockResolvedValue(baseSession);
      sessionRepository.update.mockRejectedValue({ code: 'P2025' });

      await expect(
        service.update('session-1', {} as never, 'owner-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('end() — error paths', () => {
    it('throws NotFoundException when session not found', async () => {
      sessionRepository.findById.mockResolvedValue(null);

      await expect(
        service.end('missing', { reason: 'done' } as never, 'owner-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when requester is not owner', async () => {
      sessionRepository.findById.mockResolvedValue(baseSession);

      await expect(
        service.end('session-1', { reason: 'done' } as never, 'not-owner'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when no owner member found', async () => {
      const sessionWithoutOwner = { ...baseSession, members: [] };
      sessionRepository.findById.mockResolvedValue(sessionWithoutOwner);
      sessionMemberRepository.findOwner.mockResolvedValue(null);

      await expect(
        service.end('session-1', { reason: 'done' } as never, 'owner-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('completes iteration and enqueues assessment on end', async () => {
      sessionRepository.findById.mockResolvedValue(baseSession);
      prisma.client.iteration.findFirst.mockResolvedValue({
        id: 'iter-1',
        status: 'active',
      });
      prisma.client.iteration.update.mockResolvedValue({});
      assessmentService.requestRun.mockResolvedValue({});
      sessionRepository.end.mockResolvedValue({
        ...baseSession,
        status: 'ended',
      });
      redis.deleteSessionFull.mockResolvedValue({});

      await service.end('session-1', { reason: 'done' } as never, 'owner-1');

      expect(prisma.client.iteration.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'iter-1' } }),
      );
      expect(assessmentService.requestRun).toHaveBeenCalled();
    });
  });

  describe('remove() — error paths', () => {
    it('throws NotFoundException when session not found', async () => {
      sessionRepository.findById.mockResolvedValue(null);

      await expect(service.remove('missing', 'owner-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException when not owner and not admin', async () => {
      sessionRepository.findById.mockResolvedValue(baseSession);

      await expect(
        service.remove('session-1', 'not-owner', false),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows admin to delete any session', async () => {
      sessionRepository.findById.mockResolvedValue(baseSession);
      sessionRepository.delete.mockResolvedValue({});
      redis.deleteSessionFull.mockResolvedValue({});

      const result = await service.remove('session-1', 'any-user', true);

      expect(result.id).toBe('session-1');
    });

    it('converts P2025 Prisma error to NotFoundException', async () => {
      sessionRepository.findById.mockResolvedValue(baseSession);
      sessionRepository.delete.mockRejectedValue({ code: 'P2025' });

      await expect(service.remove('session-1', 'owner-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('mapToResponseDto (via findAll)', () => {
    it('maps session with persona and scenario', async () => {
      const sessionWithRelations = {
        ...baseSession,
        persona: {
          id: 'p-1',
          orgId: 'org-1',
          name: 'Alice',
          traits: [],
          createdAt: now,
          updatedAt: now,
        },
        scenario: {
          id: 's-1',
          orgId: 'org-1',
          name: 'Cold Call',
          description: 'A cold call scenario',
          config: { difficulty: 'hard' },
          createdAt: now,
          updatedAt: now,
        },
      };
      sessionRepository.findMany.mockResolvedValue({
        sessions: [sessionWithRelations],
        total: 1,
      });

      const result = await service.findAll({} as never);

      expect(result.sessions[0].persona).toBeDefined();
      expect(result.sessions[0].scenario).toBeDefined();
      expect(result.sessions[0].scenario!.name).toBe('Cold Call');
    });
  });
});
