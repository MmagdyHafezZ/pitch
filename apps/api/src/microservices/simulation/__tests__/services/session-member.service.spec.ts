import { SessionMemberService } from '../../services/session-member.service';

describe('SessionMemberService cache invalidation', () => {
  const now = new Date('2026-03-07T00:00:00.000Z');

  const sessionRepository = {
    findById: jest.fn(),
  };

  const sessionMemberRepository = {
    findBySessionIdAndUserId: jest.fn(),
    findBySessionId: jest.fn(),
    createMany: jest.fn(),
  };

  const tx = {
    sessionMember: {
      delete: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    session: {
      delete: jest.fn(),
    },
  };

  const prisma = {
    client: {
      $transaction: jest.fn(),
    },
  };

  const redis = {
    deleteSessionFull: jest.fn(),
  };

  const service = new SessionMemberService(
    sessionRepository as never,
    sessionMemberRepository as never,
    prisma as never,
    redis as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('invalidates full-session cache after adding members', async () => {
    sessionRepository.findById.mockResolvedValue({
      id: 'session-1',
      status: 'active',
    });

    sessionMemberRepository.findBySessionIdAndUserId.mockResolvedValue({
      id: 'member-owner',
      sessionId: 'session-1',
      userId: 'owner-1',
      role: 'owner',
      userSnapshot: null,
      joinedAt: now,
      updatedAt: now,
    });

    sessionMemberRepository.findBySessionId
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 'member-viewer',
          sessionId: 'session-1',
          userId: 'viewer-1',
          role: 'viewer',
          userSnapshot: null,
          joinedAt: now,
          updatedAt: now,
        },
      ]);

    sessionMemberRepository.createMany.mockResolvedValue({ count: 1 });
    redis.deleteSessionFull.mockResolvedValue(undefined);

    await service.addMembers('session-1', 'owner-1', {
      userIds: ['viewer-1'],
      role: 'viewer',
    } as never);

    expect(redis.deleteSessionFull).toHaveBeenCalledTimes(1);
    expect(redis.deleteSessionFull).toHaveBeenCalledWith('session-1');
  });

  it('invalidates full-session cache after removing a member', async () => {
    sessionRepository.findById.mockResolvedValue({
      id: 'session-1',
      status: 'active',
    });

    sessionMemberRepository.findBySessionIdAndUserId
      .mockResolvedValueOnce({
        id: 'member-owner',
        sessionId: 'session-1',
        userId: 'owner-1',
        role: 'owner',
        userSnapshot: null,
        joinedAt: now,
        updatedAt: now,
      })
      .mockResolvedValueOnce({
        id: 'member-viewer',
        sessionId: 'session-1',
        userId: 'viewer-1',
        role: 'viewer',
        userSnapshot: null,
        joinedAt: now,
        updatedAt: now,
      });

    tx.sessionMember.delete.mockResolvedValue(undefined);
    tx.sessionMember.findMany.mockResolvedValue([
      {
        id: 'member-owner',
        sessionId: 'session-1',
        userId: 'owner-1',
        role: 'owner',
        userSnapshot: null,
        joinedAt: now,
        updatedAt: now,
      },
    ]);
    tx.sessionMember.update.mockResolvedValue(undefined);
    tx.session.delete.mockResolvedValue(undefined);

    prisma.client.$transaction.mockImplementation(
      (callback: (value: typeof tx) => unknown) => callback(tx),
    );

    redis.deleteSessionFull.mockResolvedValue(undefined);

    await service.removeMember('session-1', 'owner-1', 'viewer-1');

    expect(redis.deleteSessionFull).toHaveBeenCalledTimes(1);
    expect(redis.deleteSessionFull).toHaveBeenCalledWith('session-1');
  });
});
