import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { SessionMemberService } from '../../services/session-member.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const now = new Date('2026-03-07T00:00:00.000Z');

const makeMember = (overrides: Record<string, unknown> = {}) => ({
  id: 'member-1',
  sessionId: 'session-1',
  userId: 'owner-1',
  role: 'owner',
  userSnapshot: null,
  joinedAt: now,
  updatedAt: now,
  ...overrides,
});

const makeSession = (overrides: Record<string, unknown> = {}) => ({
  id: 'session-1',
  status: 'active',
  ...overrides,
});

const makeMocks = () => {
  const sessionRepository = { findById: jest.fn() };

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
      $transaction: jest.fn((cb: (t: typeof tx) => unknown) => cb(tx)),
    },
  };

  const redis = { deleteSessionFull: jest.fn() };

  return { sessionRepository, sessionMemberRepository, tx, prisma, redis };
};

const buildService = (mocks: ReturnType<typeof makeMocks>) =>
  new SessionMemberService(
    mocks.sessionRepository as never,
    mocks.sessionMemberRepository as never,
    mocks.prisma as never,
    mocks.redis as never,
  );

// ---------------------------------------------------------------------------
// listMembers()
// ---------------------------------------------------------------------------

describe('SessionMemberService.listMembers', () => {
  it('throws ForbiddenException when requester is not a member', async () => {
    const mocks = makeMocks();
    const service = buildService(mocks);

    mocks.sessionMemberRepository.findBySessionIdAndUserId.mockResolvedValue(
      null,
    );

    await expect(service.listMembers('session-1', 'stranger')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('returns members list when requester is a member', async () => {
    const mocks = makeMocks();
    const service = buildService(mocks);

    const member = makeMember();
    mocks.sessionMemberRepository.findBySessionIdAndUserId.mockResolvedValue(
      member,
    );
    mocks.sessionMemberRepository.findBySessionId.mockResolvedValue([member]);

    const result = await service.listMembers('session-1', 'owner-1');

    expect(result.total).toBe(1);
    expect(result.members[0].userId).toBe('owner-1');
    expect(result.members[0].role).toBe('owner');
  });

  it('returns empty member list when session has no members (unreachable in practice but handled)', async () => {
    const mocks = makeMocks();
    const service = buildService(mocks);

    mocks.sessionMemberRepository.findBySessionIdAndUserId.mockResolvedValue(
      makeMember(),
    );
    mocks.sessionMemberRepository.findBySessionId.mockResolvedValue([]);

    const result = await service.listMembers('session-1', 'owner-1');

    expect(result).toEqual({ members: [], total: 0 });
  });
});

// ---------------------------------------------------------------------------
// addMembers()
// ---------------------------------------------------------------------------

describe('SessionMemberService.addMembers', () => {
  it('throws BadRequestException when userIds is empty', async () => {
    const mocks = makeMocks();
    const service = buildService(mocks);

    await expect(
      service.addMembers('session-1', 'owner-1', { userIds: [] } as never),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when userIds is missing', async () => {
    const mocks = makeMocks();
    const service = buildService(mocks);

    await expect(
      service.addMembers('session-1', 'owner-1', {
        userIds: undefined,
      } as never),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws NotFoundException when session does not exist', async () => {
    const mocks = makeMocks();
    const service = buildService(mocks);

    mocks.sessionRepository.findById.mockResolvedValue(null);

    await expect(
      service.addMembers('session-1', 'owner-1', {
        userIds: ['u-1'],
      } as never),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequestException when session has ended', async () => {
    const mocks = makeMocks();
    const service = buildService(mocks);

    mocks.sessionRepository.findById.mockResolvedValue(
      makeSession({ status: 'ended' }),
    );

    await expect(
      service.addMembers('session-1', 'owner-1', {
        userIds: ['u-1'],
      } as never),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws ForbiddenException when requester is not a member', async () => {
    const mocks = makeMocks();
    const service = buildService(mocks);

    mocks.sessionRepository.findById.mockResolvedValue(makeSession());
    mocks.sessionMemberRepository.findBySessionIdAndUserId.mockResolvedValue(
      null,
    );

    await expect(
      service.addMembers('session-1', 'stranger', {
        userIds: ['u-1'],
      } as never),
    ).rejects.toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when requester is a member but not owner', async () => {
    const mocks = makeMocks();
    const service = buildService(mocks);

    mocks.sessionRepository.findById.mockResolvedValue(makeSession());
    mocks.sessionMemberRepository.findBySessionIdAndUserId.mockResolvedValue(
      makeMember({ role: 'viewer' }),
    );

    await expect(
      service.addMembers('session-1', 'viewer-1', {
        userIds: ['u-1'],
      } as never),
    ).rejects.toThrow(ForbiddenException);
  });

  it('adds new members successfully', async () => {
    const mocks = makeMocks();
    const service = buildService(mocks);

    mocks.sessionRepository.findById.mockResolvedValue(makeSession());
    mocks.sessionMemberRepository.findBySessionIdAndUserId.mockResolvedValue(
      makeMember(),
    );
    mocks.sessionMemberRepository.findBySessionId
      .mockResolvedValueOnce([]) // existing members check
      .mockResolvedValueOnce([makeMember({ userId: 'u-new', role: 'viewer' })]);
    mocks.sessionMemberRepository.createMany.mockResolvedValue({ count: 1 });
    mocks.redis.deleteSessionFull.mockResolvedValue(undefined);

    const result = await service.addMembers('session-1', 'owner-1', {
      userIds: ['u-new'],
      role: 'viewer',
    } as never);

    expect(result.created).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.errors).toBeUndefined();
  });

  it('skips users already in the session and reports them as failures', async () => {
    const mocks = makeMocks();
    const service = buildService(mocks);

    mocks.sessionRepository.findById.mockResolvedValue(makeSession());
    mocks.sessionMemberRepository.findBySessionIdAndUserId.mockResolvedValue(
      makeMember(),
    );
    mocks.sessionMemberRepository.findBySessionId
      .mockResolvedValueOnce([makeMember({ userId: 'u-existing' })])
      .mockResolvedValueOnce([]);
    mocks.sessionMemberRepository.createMany.mockResolvedValue({ count: 0 });
    mocks.redis.deleteSessionFull.mockResolvedValue(undefined);

    const result = await service.addMembers('session-1', 'owner-1', {
      userIds: ['u-existing'],
      role: 'viewer',
    } as never);

    expect(result.errors).toContainEqual(expect.stringContaining('u-existing'));
    expect(result.created).toBe(0);
  });

  it('adds error when role is owner and downgrades to viewer', async () => {
    const mocks = makeMocks();
    const service = buildService(mocks);

    mocks.sessionRepository.findById.mockResolvedValue(makeSession());
    mocks.sessionMemberRepository.findBySessionIdAndUserId.mockResolvedValue(
      makeMember(),
    );
    mocks.sessionMemberRepository.findBySessionId
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([makeMember({ userId: 'u-new', role: 'viewer' })]);
    mocks.sessionMemberRepository.createMany.mockResolvedValue({ count: 1 });
    mocks.redis.deleteSessionFull.mockResolvedValue(undefined);

    const result = await service.addMembers('session-1', 'owner-1', {
      userIds: ['u-new'],
      role: 'owner',
    } as never);

    // Errors should include warning about owner role not allowed
    expect(result.errors).toBeDefined();
    expect(result.errors![0]).toContain('Cannot add a new owner');
  });

  it('invalidates full-session cache after adding members', async () => {
    const mocks = makeMocks();
    const service = buildService(mocks);

    mocks.sessionRepository.findById.mockResolvedValue(makeSession());
    mocks.sessionMemberRepository.findBySessionIdAndUserId.mockResolvedValue(
      makeMember(),
    );
    mocks.sessionMemberRepository.findBySessionId
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        makeMember({ userId: 'viewer-1', role: 'viewer' }),
      ]);
    mocks.sessionMemberRepository.createMany.mockResolvedValue({ count: 1 });
    mocks.redis.deleteSessionFull.mockResolvedValue(undefined);

    await service.addMembers('session-1', 'owner-1', {
      userIds: ['viewer-1'],
      role: 'viewer',
    } as never);

    expect(mocks.redis.deleteSessionFull).toHaveBeenCalledTimes(1);
    expect(mocks.redis.deleteSessionFull).toHaveBeenCalledWith('session-1');
  });

  it('continues even when cache invalidation throws', async () => {
    const mocks = makeMocks();
    const service = buildService(mocks);

    mocks.sessionRepository.findById.mockResolvedValue(makeSession());
    mocks.sessionMemberRepository.findBySessionIdAndUserId.mockResolvedValue(
      makeMember(),
    );
    mocks.sessionMemberRepository.findBySessionId
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([makeMember({ userId: 'u-new', role: 'viewer' })]);
    mocks.sessionMemberRepository.createMany.mockResolvedValue({ count: 1 });
    mocks.redis.deleteSessionFull.mockRejectedValue(new Error('Redis down'));

    await expect(
      service.addMembers('session-1', 'owner-1', {
        userIds: ['u-new'],
        role: 'viewer',
      } as never),
    ).resolves.not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// removeMember()
// ---------------------------------------------------------------------------

describe('SessionMemberService.removeMember', () => {
  it('throws BadRequestException when userId is falsy', async () => {
    const mocks = makeMocks();
    const service = buildService(mocks);

    await expect(
      service.removeMember('session-1', 'owner-1', ''),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws NotFoundException when session does not exist', async () => {
    const mocks = makeMocks();
    const service = buildService(mocks);

    mocks.sessionRepository.findById.mockResolvedValue(null);

    await expect(
      service.removeMember('session-1', 'owner-1', 'viewer-1'),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws ForbiddenException when requester is not a member', async () => {
    const mocks = makeMocks();
    const service = buildService(mocks);

    mocks.sessionRepository.findById.mockResolvedValue(makeSession());
    mocks.sessionMemberRepository.findBySessionIdAndUserId.mockResolvedValue(
      null,
    );

    await expect(
      service.removeMember('session-1', 'stranger', 'viewer-1'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when requester is a viewer trying to remove someone else', async () => {
    const mocks = makeMocks();
    const service = buildService(mocks);

    mocks.sessionRepository.findById.mockResolvedValue(makeSession());
    mocks.sessionMemberRepository.findBySessionIdAndUserId.mockResolvedValue(
      makeMember({ userId: 'viewer-1', role: 'viewer' }),
    );

    await expect(
      service.removeMember('session-1', 'viewer-1', 'other-viewer'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('throws NotFoundException when target user is not a member', async () => {
    const mocks = makeMocks();
    const service = buildService(mocks);

    mocks.sessionRepository.findById.mockResolvedValue(makeSession());
    mocks.sessionMemberRepository.findBySessionIdAndUserId
      .mockResolvedValueOnce(makeMember()) // actor = owner
      .mockResolvedValueOnce(null); // target not found

    await expect(
      service.removeMember('session-1', 'owner-1', 'ghost'),
    ).rejects.toThrow(NotFoundException);
  });

  it('allows a viewer to remove themselves', async () => {
    const mocks = makeMocks();
    const service = buildService(mocks);

    mocks.sessionRepository.findById.mockResolvedValue(makeSession());
    const viewerMember = makeMember({ userId: 'viewer-1', role: 'viewer' });
    mocks.sessionMemberRepository.findBySessionIdAndUserId
      .mockResolvedValueOnce(viewerMember) // actor
      .mockResolvedValueOnce(viewerMember); // target (same person)

    mocks.tx.sessionMember.delete.mockResolvedValue(undefined);
    mocks.tx.sessionMember.findMany.mockResolvedValue([makeMember()]);
    mocks.redis.deleteSessionFull.mockResolvedValue(undefined);

    const result = await service.removeMember(
      'session-1',
      'viewer-1',
      'viewer-1',
    );

    expect(result.removedUserId).toBe('viewer-1');
    expect(result.sessionDeleted).toBeUndefined();
  });

  it('removes the member and returns success message', async () => {
    const mocks = makeMocks();
    const service = buildService(mocks);

    mocks.sessionRepository.findById.mockResolvedValue(makeSession());
    mocks.sessionMemberRepository.findBySessionIdAndUserId
      .mockResolvedValueOnce(makeMember()) // actor = owner
      .mockResolvedValueOnce(
        makeMember({ userId: 'viewer-1', role: 'viewer' }),
      ); // target

    mocks.tx.sessionMember.delete.mockResolvedValue(undefined);
    mocks.tx.sessionMember.findMany.mockResolvedValue([makeMember()]);
    mocks.redis.deleteSessionFull.mockResolvedValue(undefined);

    const result = await service.removeMember(
      'session-1',
      'owner-1',
      'viewer-1',
    );

    expect(result.removedUserId).toBe('viewer-1');
    expect(result.sessionId).toBe('session-1');
    expect(result.message).toContain('viewer-1');
    expect(result.sessionDeleted).toBeUndefined();
  });

  it('deletes the session when last member is removed', async () => {
    const mocks = makeMocks();
    const service = buildService(mocks);

    mocks.sessionRepository.findById.mockResolvedValue(makeSession());
    const ownerMember = makeMember();
    mocks.sessionMemberRepository.findBySessionIdAndUserId
      .mockResolvedValueOnce(ownerMember) // actor
      .mockResolvedValueOnce(ownerMember); // target (same person)

    mocks.tx.sessionMember.delete.mockResolvedValue(undefined);
    mocks.tx.sessionMember.findMany.mockResolvedValue([]); // no remaining members
    mocks.tx.session.delete.mockResolvedValue(undefined);
    mocks.redis.deleteSessionFull.mockResolvedValue(undefined);

    const result = await service.removeMember(
      'session-1',
      'owner-1',
      'owner-1',
    );

    expect(mocks.tx.session.delete).toHaveBeenCalledWith({
      where: { id: 'session-1' },
    });
    expect(result.sessionDeleted).toBe(true);
    expect(result.message).toContain('deleted');
  });

  it('transfers ownership to next member when owner is removed', async () => {
    const mocks = makeMocks();
    const service = buildService(mocks);

    mocks.sessionRepository.findById.mockResolvedValue(makeSession());
    const ownerMember = makeMember();
    const viewerMember = makeMember({
      id: 'member-2',
      userId: 'viewer-1',
      role: 'viewer',
    });

    mocks.sessionMemberRepository.findBySessionIdAndUserId
      .mockResolvedValueOnce(ownerMember) // actor = owner
      .mockResolvedValueOnce(ownerMember); // target = also the owner

    mocks.tx.sessionMember.delete.mockResolvedValue(undefined);
    mocks.tx.sessionMember.findMany.mockResolvedValue([viewerMember]); // viewer remains
    mocks.tx.sessionMember.update.mockResolvedValue(undefined);
    mocks.redis.deleteSessionFull.mockResolvedValue(undefined);

    const result = await service.removeMember(
      'session-1',
      'owner-1',
      'owner-1',
    );

    expect(mocks.tx.sessionMember.update).toHaveBeenCalledWith({
      where: { id: viewerMember.id },
      data: { role: 'owner' },
    });
    expect(result.newOwnerId).toBe('viewer-1');
    expect(result.sessionDeleted).toBeUndefined();
  });

  it('does not transfer ownership when a non-owner member is removed', async () => {
    const mocks = makeMocks();
    const service = buildService(mocks);

    mocks.sessionRepository.findById.mockResolvedValue(makeSession());
    const ownerMember = makeMember();
    const viewerMember = makeMember({
      id: 'member-2',
      userId: 'viewer-1',
      role: 'viewer',
    });

    mocks.sessionMemberRepository.findBySessionIdAndUserId
      .mockResolvedValueOnce(ownerMember) // actor = owner
      .mockResolvedValueOnce(viewerMember); // target = viewer

    mocks.tx.sessionMember.delete.mockResolvedValue(undefined);
    mocks.tx.sessionMember.findMany.mockResolvedValue([ownerMember]);
    mocks.redis.deleteSessionFull.mockResolvedValue(undefined);

    const result = await service.removeMember(
      'session-1',
      'owner-1',
      'viewer-1',
    );

    expect(mocks.tx.sessionMember.update).not.toHaveBeenCalled();
    expect(result.newOwnerId).toBeUndefined();
  });

  it('invalidates full-session cache after removing a member', async () => {
    const mocks = makeMocks();
    const service = buildService(mocks);

    mocks.sessionRepository.findById.mockResolvedValue(makeSession());
    const ownerMember = makeMember();
    mocks.sessionMemberRepository.findBySessionIdAndUserId
      .mockResolvedValueOnce(ownerMember)
      .mockResolvedValueOnce(
        makeMember({ userId: 'viewer-1', role: 'viewer' }),
      );

    mocks.tx.sessionMember.delete.mockResolvedValue(undefined);
    mocks.tx.sessionMember.findMany.mockResolvedValue([ownerMember]);
    mocks.redis.deleteSessionFull.mockResolvedValue(undefined);

    await service.removeMember('session-1', 'owner-1', 'viewer-1');

    expect(mocks.redis.deleteSessionFull).toHaveBeenCalledTimes(1);
    expect(mocks.redis.deleteSessionFull).toHaveBeenCalledWith('session-1');
  });

  it('continues even when cache invalidation throws during removeMember', async () => {
    const mocks = makeMocks();
    const service = buildService(mocks);

    mocks.sessionRepository.findById.mockResolvedValue(makeSession());
    const ownerMember = makeMember();
    mocks.sessionMemberRepository.findBySessionIdAndUserId
      .mockResolvedValueOnce(ownerMember)
      .mockResolvedValueOnce(
        makeMember({ userId: 'viewer-1', role: 'viewer' }),
      );

    mocks.tx.sessionMember.delete.mockResolvedValue(undefined);
    mocks.tx.sessionMember.findMany.mockResolvedValue([ownerMember]);
    mocks.redis.deleteSessionFull.mockRejectedValue(new Error('Redis down'));

    await expect(
      service.removeMember('session-1', 'owner-1', 'viewer-1'),
    ).resolves.not.toThrow();
  });
});
