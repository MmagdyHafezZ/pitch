import { BadRequestException, NotFoundException } from '@nestjs/common';
import { InvitationService } from '../../services/invitation.service';
import type { InvitationRepository } from '../../repositories/invitation.repository';
import type { SessionRepository } from '../../repositories/session.repository';
import type { SessionMemberRepository } from '../../repositories/session-member.repository';
import type { ISessionInvitation } from '../../schemas/mongodb/session-invitation.schema';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeInvRepo = (): jest.Mocked<InvitationRepository> =>
  ({
    create: jest.fn(),
    findById: jest.fn(),
    findBySessionId: jest.fn(),
    findByInviteeId: jest.fn(),
    findByInviterId: jest.fn(),
    existsForSessionAndInvitee: jest.fn(),
    updateStatus: jest.fn(),
    delete: jest.fn(),
    countPendingForInvitee: jest.fn(),
  }) as unknown as jest.Mocked<InvitationRepository>;

const makeSessRepo = (): jest.Mocked<SessionRepository> =>
  ({
    findById: jest.fn(),
    findByIds: jest.fn(),
  }) as unknown as jest.Mocked<SessionRepository>;

const makeMemberRepo = (): jest.Mocked<SessionMemberRepository> =>
  ({
    findBySessionIdAndUserId: jest.fn(),
    create: jest.fn(),
  }) as unknown as jest.Mocked<SessionMemberRepository>;

const now = new Date('2026-03-24T00:00:00.000Z');

const stubInvitation = (
  overrides: Partial<ISessionInvitation> = {},
): ISessionInvitation =>
  ({
    _id: 'inv-1',
    sessionId: 'sess-1',
    inviterId: 'owner-1',
    inviterSnapshot: { name: 'Owner' },
    inviteeId: 'invitee-1',
    inviteeSnapshot: undefined,
    status: 'pending',
    message: 'Join me!',
    respondedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }) as unknown as ISessionInvitation;

const stubSession = (overrides: Record<string, unknown> = {}) => ({
  id: 'sess-1',
  type: 'text',
  status: 'active',
  createdAt: now,
  ...overrides,
});

const stubOwnerMember = (overrides: Record<string, unknown> = {}) => ({
  id: 'member-1',
  sessionId: 'sess-1',
  userId: 'owner-1',
  role: 'owner',
  ...overrides,
});

// ---------------------------------------------------------------------------
// createInvitations()
// ---------------------------------------------------------------------------

describe('InvitationService.createInvitations', () => {
  it('throws NotFoundException when session does not exist', async () => {
    const inv = makeInvRepo();
    const sess = makeSessRepo();
    const member = makeMemberRepo();
    const service = new InvitationService(inv, sess, member);

    sess.findById.mockResolvedValue(null);

    await expect(
      service.createInvitations('sess-1', 'owner-1', { inviteeIds: ['u-1'] }),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequestException when session has ended', async () => {
    const inv = makeInvRepo();
    const sess = makeSessRepo();
    const member = makeMemberRepo();
    const service = new InvitationService(inv, sess, member);

    sess.findById.mockResolvedValue(stubSession({ status: 'ended' }) as any);

    await expect(
      service.createInvitations('sess-1', 'owner-1', { inviteeIds: ['u-1'] }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when requester is not an owner', async () => {
    const inv = makeInvRepo();
    const sess = makeSessRepo();
    const member = makeMemberRepo();
    const service = new InvitationService(inv, sess, member);

    sess.findById.mockResolvedValue(stubSession() as any);
    member.findBySessionIdAndUserId.mockResolvedValue({
      role: 'viewer',
    } as any);

    await expect(
      service.createInvitations('sess-1', 'viewer-1', {
        inviteeIds: ['u-1'],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when requester is not a member at all', async () => {
    const inv = makeInvRepo();
    const sess = makeSessRepo();
    const member = makeMemberRepo();
    const service = new InvitationService(inv, sess, member);

    sess.findById.mockResolvedValue(stubSession() as any);
    member.findBySessionIdAndUserId.mockResolvedValue(null);

    await expect(
      service.createInvitations('sess-1', 'stranger', { inviteeIds: ['u-1'] }),
    ).rejects.toThrow(BadRequestException);
  });

  it('skips invitees who already have an invitation and reports failure', async () => {
    const inv = makeInvRepo();
    const sess = makeSessRepo();
    const member = makeMemberRepo();
    const service = new InvitationService(inv, sess, member);

    sess.findById.mockResolvedValue(stubSession() as any);
    member.findBySessionIdAndUserId.mockResolvedValue(stubOwnerMember() as any);
    inv.existsForSessionAndInvitee.mockResolvedValue({
      status: 'pending',
    } as any);

    const result = await service.createInvitations('sess-1', 'owner-1', {
      inviteeIds: ['u-already'],
    });

    expect(result.created).toBe(0);
    expect(result.failed).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(inv.create).not.toHaveBeenCalled();
  });

  it('skips invitees who are already session members', async () => {
    const inv = makeInvRepo();
    const sess = makeSessRepo();
    const member = makeMemberRepo();
    const service = new InvitationService(inv, sess, member);

    sess.findById.mockResolvedValue(stubSession() as any);
    // first call: owner check; second call: invitee already a member
    member.findBySessionIdAndUserId
      .mockResolvedValueOnce(stubOwnerMember() as any)
      .mockResolvedValueOnce({ role: 'viewer' } as any);
    inv.existsForSessionAndInvitee.mockResolvedValue(null);

    const result = await service.createInvitations('sess-1', 'owner-1', {
      inviteeIds: ['u-member'],
    });

    expect(result.created).toBe(0);
    expect(result.failed).toBe(1);
    expect(inv.create).not.toHaveBeenCalled();
  });

  it('creates invitation for valid new invitees', async () => {
    const inv = makeInvRepo();
    const sess = makeSessRepo();
    const member = makeMemberRepo();
    const service = new InvitationService(inv, sess, member);

    sess.findById.mockResolvedValue(stubSession() as any);
    member.findBySessionIdAndUserId
      .mockResolvedValueOnce(stubOwnerMember() as any)
      .mockResolvedValueOnce(null); // invitee is not a member
    inv.existsForSessionAndInvitee.mockResolvedValue(null);
    inv.create.mockResolvedValue(stubInvitation() as any);

    const result = await service.createInvitations('sess-1', 'owner-1', {
      inviteeIds: ['u-new'],
      message: 'Join!',
      inviterSnapshot: { name: 'Owner' },
    });

    expect(result.created).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.errors).toBeUndefined();
    expect(inv.create).toHaveBeenCalledWith({
      sessionId: 'sess-1',
      inviterId: 'owner-1',
      inviterSnapshot: { name: 'Owner' },
      inviteeId: 'u-new',
      message: 'Join!',
    });
  });

  it('handles errors during individual invite creation gracefully', async () => {
    const inv = makeInvRepo();
    const sess = makeSessRepo();
    const member = makeMemberRepo();
    const service = new InvitationService(inv, sess, member);

    sess.findById.mockResolvedValue(stubSession() as any);
    member.findBySessionIdAndUserId
      .mockResolvedValueOnce(stubOwnerMember() as any)
      .mockResolvedValueOnce(null);
    inv.existsForSessionAndInvitee.mockResolvedValue(null);
    inv.create.mockRejectedValue(new Error('DB write failed'));

    const result = await service.createInvitations('sess-1', 'owner-1', {
      inviteeIds: ['u-err'],
    });

    expect(result.created).toBe(0);
    expect(result.failed).toBe(1);
    expect(result.errors![0]).toContain('DB write failed');
  });

  it('returns no errors field when all invites succeed', async () => {
    const inv = makeInvRepo();
    const sess = makeSessRepo();
    const member = makeMemberRepo();
    const service = new InvitationService(inv, sess, member);

    sess.findById.mockResolvedValue(stubSession() as any);
    member.findBySessionIdAndUserId
      .mockResolvedValueOnce(stubOwnerMember() as any)
      .mockResolvedValueOnce(null);
    inv.existsForSessionAndInvitee.mockResolvedValue(null);
    inv.create.mockResolvedValue(stubInvitation() as any);

    const result = await service.createInvitations('sess-1', 'owner-1', {
      inviteeIds: ['u-ok'],
    });

    expect(result.errors).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// findBySessionId()
// ---------------------------------------------------------------------------

describe('InvitationService.findBySessionId', () => {
  it('returns mapped invitations with session data', async () => {
    const inv = makeInvRepo();
    const sess = makeSessRepo();
    const member = makeMemberRepo();
    const service = new InvitationService(inv, sess, member);

    inv.findBySessionId.mockResolvedValue([stubInvitation()]);
    sess.findByIds.mockResolvedValue([stubSession() as any]);

    const result = await service.findBySessionId('sess-1');

    expect(result.total).toBe(1);
    expect(result.invitations[0].id).toBe('inv-1');
    expect(result.invitations[0].session?.id).toBe('sess-1');
  });

  it('returns empty list when no invitations exist', async () => {
    const inv = makeInvRepo();
    const sess = makeSessRepo();
    const member = makeMemberRepo();
    const service = new InvitationService(inv, sess, member);

    inv.findBySessionId.mockResolvedValue([]);
    sess.findByIds.mockResolvedValue([]);

    const result = await service.findBySessionId('sess-1');

    expect(result).toEqual({ invitations: [], total: 0 });
  });

  it('handles invitation whose session is not found in session map', async () => {
    const inv = makeInvRepo();
    const sess = makeSessRepo();
    const member = makeMemberRepo();
    const service = new InvitationService(inv, sess, member);

    inv.findBySessionId.mockResolvedValue([stubInvitation()]);
    sess.findByIds.mockResolvedValue([]); // session not found

    const result = await service.findBySessionId('sess-1');

    expect(result.invitations[0].session).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// findInvitationsForUser()
// ---------------------------------------------------------------------------

describe('InvitationService.findInvitationsForUser', () => {
  it('returns invitations received by user', async () => {
    const inv = makeInvRepo();
    const sess = makeSessRepo();
    const member = makeMemberRepo();
    const service = new InvitationService(inv, sess, member);

    inv.findByInviteeId.mockResolvedValue([stubInvitation()]);
    sess.findByIds.mockResolvedValue([stubSession() as any]);

    const result = await service.findInvitationsForUser('invitee-1');

    expect(inv.findByInviteeId).toHaveBeenCalledWith('invitee-1', undefined);
    expect(result.total).toBe(1);
  });

  it('passes status filter to repository', async () => {
    const inv = makeInvRepo();
    const sess = makeSessRepo();
    const member = makeMemberRepo();
    const service = new InvitationService(inv, sess, member);

    inv.findByInviteeId.mockResolvedValue([]);
    sess.findByIds.mockResolvedValue([]);

    await service.findInvitationsForUser('user-1', 'pending' as any);

    expect(inv.findByInviteeId).toHaveBeenCalledWith('user-1', 'pending');
  });
});

// ---------------------------------------------------------------------------
// findInvitationsSentByUser()
// ---------------------------------------------------------------------------

describe('InvitationService.findInvitationsSentByUser', () => {
  it('returns invitations sent by user', async () => {
    const inv = makeInvRepo();
    const sess = makeSessRepo();
    const member = makeMemberRepo();
    const service = new InvitationService(inv, sess, member);

    inv.findByInviterId.mockResolvedValue([stubInvitation()]);
    sess.findByIds.mockResolvedValue([stubSession() as any]);

    const result = await service.findInvitationsSentByUser('owner-1');

    expect(inv.findByInviterId).toHaveBeenCalledWith('owner-1', undefined);
    expect(result.total).toBe(1);
  });

  it('passes status filter to repository', async () => {
    const inv = makeInvRepo();
    const sess = makeSessRepo();
    const member = makeMemberRepo();
    const service = new InvitationService(inv, sess, member);

    inv.findByInviterId.mockResolvedValue([]);
    sess.findByIds.mockResolvedValue([]);

    await service.findInvitationsSentByUser('owner-1', 'accepted' as any);

    expect(inv.findByInviterId).toHaveBeenCalledWith('owner-1', 'accepted');
  });
});

// ---------------------------------------------------------------------------
// findOne()
// ---------------------------------------------------------------------------

describe('InvitationService.findOne', () => {
  it('throws NotFoundException when invitation does not exist', async () => {
    const inv = makeInvRepo();
    const sess = makeSessRepo();
    const member = makeMemberRepo();
    const service = new InvitationService(inv, sess, member);

    inv.findById.mockResolvedValue(null);

    await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
  });

  it('returns invitation mapped with session', async () => {
    const inv = makeInvRepo();
    const sess = makeSessRepo();
    const member = makeMemberRepo();
    const service = new InvitationService(inv, sess, member);

    inv.findById.mockResolvedValue(stubInvitation());
    sess.findById.mockResolvedValue(stubSession() as any);

    const result = await service.findOne('inv-1');

    expect(result.id).toBe('inv-1');
    expect(result.session?.id).toBe('sess-1');
  });

  it('returns invitation without session when session not found', async () => {
    const inv = makeInvRepo();
    const sess = makeSessRepo();
    const member = makeMemberRepo();
    const service = new InvitationService(inv, sess, member);

    inv.findById.mockResolvedValue(stubInvitation());
    sess.findById.mockResolvedValue(null);

    const result = await service.findOne('inv-1');

    expect(result.session).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// acceptInvitation()
// ---------------------------------------------------------------------------

describe('InvitationService.acceptInvitation', () => {
  it('throws NotFoundException when invitation does not exist', async () => {
    const inv = makeInvRepo();
    const sess = makeSessRepo();
    const member = makeMemberRepo();
    const service = new InvitationService(inv, sess, member);

    inv.findById.mockResolvedValue(null);

    await expect(service.acceptInvitation('inv-1', 'user-1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('throws BadRequestException when user is not the invitee', async () => {
    const inv = makeInvRepo();
    const sess = makeSessRepo();
    const member = makeMemberRepo();
    const service = new InvitationService(inv, sess, member);

    inv.findById.mockResolvedValue(stubInvitation({ inviteeId: 'other-user' }));

    await expect(service.acceptInvitation('inv-1', 'user-1')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('throws BadRequestException when invitation is not pending', async () => {
    const inv = makeInvRepo();
    const sess = makeSessRepo();
    const member = makeMemberRepo();
    const service = new InvitationService(inv, sess, member);

    inv.findById.mockResolvedValue(
      stubInvitation({ inviteeId: 'invitee-1', status: 'accepted' }),
    );

    await expect(
      service.acceptInvitation('inv-1', 'invitee-1'),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when session has ended', async () => {
    const inv = makeInvRepo();
    const sess = makeSessRepo();
    const member = makeMemberRepo();
    const service = new InvitationService(inv, sess, member);

    inv.findById.mockResolvedValue(stubInvitation());
    sess.findById.mockResolvedValue(stubSession({ status: 'ended' }) as any);

    await expect(
      service.acceptInvitation('inv-1', 'invitee-1'),
    ).rejects.toThrow(BadRequestException);
  });

  it('accepts invitation, creates member, and returns updated invitation', async () => {
    const inv = makeInvRepo();
    const sess = makeSessRepo();
    const member = makeMemberRepo();
    const service = new InvitationService(inv, sess, member);

    const updated = stubInvitation({ status: 'accepted' });
    inv.findById.mockResolvedValue(stubInvitation());
    sess.findById.mockResolvedValue(stubSession() as any);
    inv.updateStatus.mockResolvedValue(updated);
    member.findBySessionIdAndUserId.mockResolvedValue(null); // not yet a member

    const result = await service.acceptInvitation('inv-1', 'invitee-1');

    expect(inv.updateStatus).toHaveBeenCalledWith('inv-1', 'accepted');
    expect(member.create).toHaveBeenCalledWith({
      sessionId: 'sess-1',
      userId: 'invitee-1',
      role: 'viewer',
      userSnapshot: undefined,
    });
    expect(result.status).toBe('accepted');
  });

  it('does not create a duplicate member when user is already a member', async () => {
    const inv = makeInvRepo();
    const sess = makeSessRepo();
    const member = makeMemberRepo();
    const service = new InvitationService(inv, sess, member);

    inv.findById.mockResolvedValue(stubInvitation());
    sess.findById.mockResolvedValue(stubSession() as any);
    inv.updateStatus.mockResolvedValue(stubInvitation({ status: 'accepted' }));
    member.findBySessionIdAndUserId.mockResolvedValue({
      role: 'viewer',
    } as any);

    await service.acceptInvitation('inv-1', 'invitee-1');

    expect(member.create).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// declineInvitation()
// ---------------------------------------------------------------------------

describe('InvitationService.declineInvitation', () => {
  it('throws NotFoundException when invitation does not exist', async () => {
    const inv = makeInvRepo();
    const sess = makeSessRepo();
    const member = makeMemberRepo();
    const service = new InvitationService(inv, sess, member);

    inv.findById.mockResolvedValue(null);

    await expect(service.declineInvitation('inv-1', 'user-1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('throws BadRequestException when user is not the invitee', async () => {
    const inv = makeInvRepo();
    const sess = makeSessRepo();
    const member = makeMemberRepo();
    const service = new InvitationService(inv, sess, member);

    inv.findById.mockResolvedValue(stubInvitation({ inviteeId: 'other' }));

    await expect(service.declineInvitation('inv-1', 'user-1')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('throws BadRequestException when invitation is not pending', async () => {
    const inv = makeInvRepo();
    const sess = makeSessRepo();
    const member = makeMemberRepo();
    const service = new InvitationService(inv, sess, member);

    inv.findById.mockResolvedValue(
      stubInvitation({ inviteeId: 'invitee-1', status: 'declined' }),
    );

    await expect(
      service.declineInvitation('inv-1', 'invitee-1'),
    ).rejects.toThrow(BadRequestException);
  });

  it('declines invitation and returns updated invitation', async () => {
    const inv = makeInvRepo();
    const sess = makeSessRepo();
    const member = makeMemberRepo();
    const service = new InvitationService(inv, sess, member);

    const updated = stubInvitation({ status: 'declined' });
    inv.findById.mockResolvedValue(stubInvitation());
    inv.updateStatus.mockResolvedValue(updated);
    sess.findById.mockResolvedValue(stubSession() as any);

    const result = await service.declineInvitation('inv-1', 'invitee-1');

    expect(inv.updateStatus).toHaveBeenCalledWith('inv-1', 'declined');
    expect(result.status).toBe('declined');
  });
});

// ---------------------------------------------------------------------------
// revokeInvitation()
// ---------------------------------------------------------------------------

describe('InvitationService.revokeInvitation', () => {
  it('throws NotFoundException when invitation does not exist', async () => {
    const inv = makeInvRepo();
    const sess = makeSessRepo();
    const member = makeMemberRepo();
    const service = new InvitationService(inv, sess, member);

    inv.findById.mockResolvedValue(null);

    await expect(service.revokeInvitation('inv-1', 'user-1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('throws BadRequestException when user is not the inviter', async () => {
    const inv = makeInvRepo();
    const sess = makeSessRepo();
    const member = makeMemberRepo();
    const service = new InvitationService(inv, sess, member);

    inv.findById.mockResolvedValue(stubInvitation({ inviterId: 'real-owner' }));

    await expect(
      service.revokeInvitation('inv-1', 'other-user'),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when invitation is not pending', async () => {
    const inv = makeInvRepo();
    const sess = makeSessRepo();
    const member = makeMemberRepo();
    const service = new InvitationService(inv, sess, member);

    inv.findById.mockResolvedValue(
      stubInvitation({ inviterId: 'owner-1', status: 'accepted' }),
    );

    await expect(service.revokeInvitation('inv-1', 'owner-1')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('deletes invitation and returns success message', async () => {
    const inv = makeInvRepo();
    const sess = makeSessRepo();
    const member = makeMemberRepo();
    const service = new InvitationService(inv, sess, member);

    inv.findById.mockResolvedValue(stubInvitation());
    inv.delete.mockResolvedValue(undefined);

    const result = await service.revokeInvitation('inv-1', 'owner-1');

    expect(inv.delete).toHaveBeenCalledWith('inv-1');
    expect(result).toEqual({
      message: 'Invitation inv-1 has been revoked successfully',
      id: 'inv-1',
    });
  });
});

// ---------------------------------------------------------------------------
// deleteInvitation()
// ---------------------------------------------------------------------------

describe('InvitationService.deleteInvitation', () => {
  it('throws NotFoundException when invitation does not exist', async () => {
    const inv = makeInvRepo();
    const sess = makeSessRepo();
    const member = makeMemberRepo();
    const service = new InvitationService(inv, sess, member);

    inv.findById.mockResolvedValue(null);

    await expect(service.deleteInvitation('inv-1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('deletes invitation and returns success message', async () => {
    const inv = makeInvRepo();
    const sess = makeSessRepo();
    const member = makeMemberRepo();
    const service = new InvitationService(inv, sess, member);

    inv.findById.mockResolvedValue(stubInvitation());
    inv.delete.mockResolvedValue(undefined);

    const result = await service.deleteInvitation('inv-1');

    expect(inv.delete).toHaveBeenCalledWith('inv-1');
    expect(result).toEqual({
      message: 'Invitation inv-1 has been deleted successfully',
      id: 'inv-1',
    });
  });

  it('throws NotFoundException on Prisma P2025 error during delete', async () => {
    const inv = makeInvRepo();
    const sess = makeSessRepo();
    const member = makeMemberRepo();
    const service = new InvitationService(inv, sess, member);

    inv.findById.mockResolvedValue(stubInvitation());
    inv.delete.mockRejectedValue({ code: 'P2025' });

    await expect(service.deleteInvitation('inv-1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('rethrows unexpected errors during delete', async () => {
    const inv = makeInvRepo();
    const sess = makeSessRepo();
    const member = makeMemberRepo();
    const service = new InvitationService(inv, sess, member);

    inv.findById.mockResolvedValue(stubInvitation());
    inv.delete.mockRejectedValue(new Error('Unexpected DB error'));

    await expect(service.deleteInvitation('inv-1')).rejects.toThrow(
      'Unexpected DB error',
    );
  });
});

// ---------------------------------------------------------------------------
// getPendingCount()
// ---------------------------------------------------------------------------

describe('InvitationService.getPendingCount', () => {
  it('returns count of pending invitations for user', async () => {
    const inv = makeInvRepo();
    const sess = makeSessRepo();
    const member = makeMemberRepo();
    const service = new InvitationService(inv, sess, member);

    inv.countPendingForInvitee.mockResolvedValue(3);

    const result = await service.getPendingCount('user-1');

    expect(inv.countPendingForInvitee).toHaveBeenCalledWith('user-1');
    expect(result).toEqual({ count: 3 });
  });

  it('returns 0 when user has no pending invitations', async () => {
    const inv = makeInvRepo();
    const sess = makeSessRepo();
    const member = makeMemberRepo();
    const service = new InvitationService(inv, sess, member);

    inv.countPendingForInvitee.mockResolvedValue(0);

    const result = await service.getPendingCount('user-1');

    expect(result).toEqual({ count: 0 });
  });
});
