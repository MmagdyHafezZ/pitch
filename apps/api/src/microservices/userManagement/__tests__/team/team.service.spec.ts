import { TeamService } from '../../team/services/team.service';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/user-client';
import type {
  Team,
  TeamMembership,
  CreateTeamDto,
  UpdateTeamDto,
  AddMemberDto,
  UpdateMemberDto,
} from '@pitch/shared-backend/interfaces/user.interface';

describe('TeamService', () => {
  let service: TeamService;

  const repo = {
    createTeam: jest.fn(),
    updateTeam: jest.fn(),
    updateTeamMetadata: jest.fn(),
    deleteTeam: jest.fn(),
    addMember: jest.fn(),
    inviteMember: jest.fn(),
    reinviteMember: jest.fn(),
    acceptInvite: jest.fn(),
    reactivateMember: jest.fn(),
    updateMember: jest.fn(),
    transferOwnership: jest.fn(),
    deleteTeamMember: jest.fn(),
    hardDeleteMembership: jest.fn(),
    deleteExpiredPendingInvites: jest.fn(),
    listActiveTeamMetadata: jest.fn(),
    findMembership: jest.fn(),
    findActiveOwners: jest.fn(),
    findByName: jest.fn(),
    findMany: jest.fn(),
    findUserTeams: jest.fn(),
    findById: jest.fn(),
    findUserById: jest.fn(),
    ensureUniqueSlug: jest.fn(),
    confirmAuthorityOrThrow: jest.fn(),
  };

  const teamInviteEmailService = {
    sendSignupInvite: jest.fn(),
  };

  const notificationService = {
    createOne: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TeamService(
      repo as any,
      teamInviteEmailService as any,
      notificationService as any,
    );
  });

  const baseTeam: Team = {
    id: 'team-1',
    name: 'Engineering',
    slug: 'engineering',
    isActive: true,
    billingEmail: 'billing@example.com',
    billingAddress: null,
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    memberships: [],
  };

  // --------------------
  // createTeam
  // --------------------

  it('creates a team with generated unique slug', async () => {
    const dto: CreateTeamDto = {
      name: 'My Team',
      billingEmail: 'billing@example.com',
    };

    repo.ensureUniqueSlug.mockResolvedValue('my-team');
    repo.createTeam.mockResolvedValue(baseTeam);

    const result = await service.createTeam(dto, 'user-1');

    expect(repo.ensureUniqueSlug).toHaveBeenCalledWith('my-team');
    expect(repo.createTeam).toHaveBeenCalledWith(
      expect.objectContaining({
        ...dto,
        slug: 'my-team',
        isActive: true,
        metadata: expect.objectContaining({
          audit: expect.objectContaining({
            ownerUserId: 'user-1',
            createdByUserId: 'user-1',
            updatedByUserId: 'user-1',
            version: 1,
          }),
        }),
      }),
      'user-1',
    );

    expect(result).toEqual(baseTeam);
  });

  // --------------------
  // updateTeam
  // --------------------

  it('throws Conflict if name already exists', async () => {
    repo.confirmAuthorityOrThrow.mockResolvedValue(undefined);

    repo.findById.mockResolvedValue({
      ...baseTeam,
      id: 'team-1',
      name: 'Old Name',
      slug: 'old-name',
    });

    const dto: UpdateTeamDto = { name: 'Engineering' };

    repo.findByName.mockResolvedValue({
      ...baseTeam,
      id: 'team-2',
      name: 'Engineering',
      slug: 'engineering',
    });
    await expect(service.updateTeam('team-1', dto, 'user-1')).rejects.toThrow();
  });

  it('merges metadata on update and increments audit version', async () => {
    repo.confirmAuthorityOrThrow.mockResolvedValue(undefined);
    repo.findById.mockResolvedValue({
      ...baseTeam,
      metadata: {
        profile: { industry: 'Software' },
        audit: {
          ownerUserId: 'owner-1',
          createdByUserId: 'owner-1',
          createdAt: '2024-01-01T00:00:00.000Z',
          version: 2,
        },
      },
    });
    repo.updateTeam.mockResolvedValue(baseTeam);

    await service.updateTeam(
      'team-1',
      { metadata: { preferences: { allowMemberInvites: true } } },
      'admin-1',
    );

    expect(repo.updateTeam).toHaveBeenCalledWith(
      'team-1',
      expect.objectContaining({
        metadata: expect.objectContaining({
          profile: { industry: 'Software' },
          preferences: { allowMemberInvites: true },
          audit: expect.objectContaining({
            ownerUserId: 'owner-1',
            updatedByUserId: 'admin-1',
            version: 3,
          }),
        }),
      }),
    );
  });

  // --------------------
  // removeTeam
  // --------------------

  it('removes team with authority check', async () => {
    repo.confirmAuthorityOrThrow.mockResolvedValue(undefined);
    repo.deleteTeam.mockResolvedValue(undefined);

    const result = await service.removeTeam('team-1', 'user-1');

    expect(repo.confirmAuthorityOrThrow).toHaveBeenCalledWith(
      'user-1',
      'team-1',
    );
    expect(repo.deleteTeam).toHaveBeenCalledWith('team-1');
    expect(result.message).toContain('team-1');
  });

  it('sends signup invite email after authority and team checks', async () => {
    repo.confirmAuthorityOrThrow.mockResolvedValue(Role.ADMIN);
    repo.findById.mockResolvedValue(baseTeam);
    repo.updateTeamMetadata.mockResolvedValue(undefined);
    teamInviteEmailService.sendSignupInvite.mockResolvedValue(undefined);

    const result = await service.sendSignupInvite({
      teamId: 'team-1',
      email: 'new-user@example.com',
      requesterId: 'admin-1',
      inviterName: 'Admin User',
      signupUrl: 'https://app.pitch.ai/signup?invite=abc123',
    });

    expect(repo.confirmAuthorityOrThrow).toHaveBeenCalledWith(
      'admin-1',
      'team-1',
    );
    expect(repo.findById).toHaveBeenCalledWith('team-1');
    expect(teamInviteEmailService.sendSignupInvite).toHaveBeenCalledWith({
      email: 'new-user@example.com',
      signupUrl: 'https://app.pitch.ai/signup?invite=abc123',
      invitedByName: 'Admin User',
      teamName: 'Engineering',
      expiresMinutes: 15,
    });
    expect(result).toEqual({
      message: 'Signup invite sent to new-user@example.com',
    });
  });

  it('invites a user as pending and sends notification/email', async () => {
    repo.confirmAuthorityOrThrow.mockResolvedValue(Role.ADMIN);
    repo.findById.mockResolvedValue(baseTeam);
    repo.findUserById.mockResolvedValue({
      id: 'user-2',
      email: 'user2@example.com',
      name: 'User Two',
    });
    repo.findMembership.mockResolvedValue(null);
    repo.inviteMember.mockResolvedValue({
      id: 'm2',
      userId: 'user-2',
      teamId: 'team-1',
      role: 'MEMBER',
      tokenLimit: 0,
      isActive: false,
      invitedByUserId: 'admin-1',
      acceptedAt: null,
    });

    const result = await service.inviteMember(
      { teamId: 'team-1', userId: 'user-2', role: 'MEMBER' },
      { id: 'admin-1', name: 'Admin User' },
    );

    expect(repo.inviteMember).toHaveBeenCalledWith(
      expect.objectContaining({
        teamId: 'team-1',
        userId: 'user-2',
        invitedByUserId: 'admin-1',
      }),
    );
    expect(notificationService.createOne).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientUserId: 'user-2',
        type: 'TEAM_INVITE',
        message:
          'Admin User invited you to join Engineering. This invitation expires in 15 minutes.',
      }),
    );
    expect(teamInviteEmailService.sendSignupInvite).toHaveBeenCalledWith({
      email: 'user2@example.com',
      invitedByName: 'Admin User',
      teamName: 'Engineering',
      expiresMinutes: 15,
    });
    expect(result).toEqual(
      expect.objectContaining({
        userId: 'user-2',
        isActive: false,
      }),
    );
  });

  it('accepts a pending invite and activates membership', async () => {
    repo.findMembership.mockResolvedValue({
      id: 'm2',
      userId: 'user-2',
      teamId: 'team-1',
      role: 'MEMBER',
      tokenLimit: 0,
      isActive: false,
      invitedByUserId: 'admin-1',
      acceptedAt: null,
      invitedAt: new Date(),
    });
    repo.acceptInvite.mockResolvedValue({
      id: 'm2',
      userId: 'user-2',
      teamId: 'team-1',
      role: 'MEMBER',
      tokenLimit: 0,
      isActive: true,
      invitedByUserId: 'admin-1',
      acceptedAt: new Date(),
    });

    const result = await service.acceptInvite('team-1', 'user-2');

    expect(repo.acceptInvite).toHaveBeenCalledWith('team-1', 'user-2');
    expect(result.message).toBe('Invitation accepted');
    expect(result.membership.isActive).toBe(true);
  });

  it('rejects accepting an invitation that was already accepted', async () => {
    repo.findMembership.mockResolvedValue({
      id: 'm2',
      userId: 'user-2',
      teamId: 'team-1',
      role: 'MEMBER',
      tokenLimit: 0,
      isActive: true,
      invitedByUserId: 'admin-1',
      acceptedAt: new Date(),
      invitedAt: new Date(),
    });

    await expect(service.acceptInvite('team-1', 'user-2')).rejects.toThrow(
      ConflictException,
    );
    expect(repo.acceptInvite).not.toHaveBeenCalled();
  });

  it('rejects expired invitation acceptance and deletes stale membership invite', async () => {
    repo.findMembership.mockResolvedValue({
      id: 'm2',
      userId: 'user-2',
      teamId: 'team-1',
      role: 'MEMBER',
      tokenLimit: 0,
      isActive: false,
      invitedByUserId: 'admin-1',
      acceptedAt: null,
      invitedAt: new Date('2024-01-01T00:00:00.000Z'),
    });

    await expect(service.acceptInvite('team-1', 'user-2')).rejects.toThrow(
      BadRequestException,
    );
    expect(repo.hardDeleteMembership).toHaveBeenCalledWith('team-1', 'user-2');
    expect(repo.acceptInvite).not.toHaveBeenCalled();
  });

  it('claimSignupInvite rejects expired signup invite and removes it from team metadata', async () => {
    repo.findById.mockResolvedValue({
      ...baseTeam,
      metadata: {
        pendingSignupInvites: [
          {
            email: 'expired@example.com',
            role: 'MEMBER',
            invitedAt: '2024-01-01T00:00:00.000Z',
            invitedByUserId: 'admin-1',
          },
        ],
      },
    });
    repo.findUserById.mockResolvedValue({
      id: 'user-3',
      email: 'expired@example.com',
      name: 'Expired User',
    });
    repo.updateTeamMetadata.mockResolvedValue(undefined);

    await expect(service.claimSignupInvite('team-1', 'user-3')).rejects.toThrow(
      BadRequestException,
    );
    expect(repo.updateTeamMetadata).toHaveBeenCalled();
  });

  it('cleanupExpiredInvitations removes stale memberships and signup invites', async () => {
    repo.deleteExpiredPendingInvites.mockResolvedValue(2);
    repo.listActiveTeamMetadata.mockResolvedValue([
      {
        id: 'team-1',
        metadata: {
          pendingSignupInvites: [
            {
              email: 'expired@example.com',
              role: 'MEMBER',
              invitedAt: '2024-01-01T00:00:00.000Z',
            },
            {
              email: 'fresh@example.com',
              role: 'MEMBER',
              invitedAt: new Date().toISOString(),
            },
          ],
        },
      },
    ]);
    repo.updateTeamMetadata.mockResolvedValue(undefined);

    const result = await service.cleanupExpiredInvitations();

    expect(repo.deleteExpiredPendingInvites).toHaveBeenCalledWith(
      expect.any(Date),
    );
    expect(repo.updateTeamMetadata).toHaveBeenCalledWith(
      'team-1',
      expect.objectContaining({
        pendingSignupInvites: [
          expect.objectContaining({ email: 'fresh@example.com' }),
        ],
      }),
    );
    expect(result).toEqual({
      deletedMembershipInvites: 2,
      deletedSignupInvites: 1,
    });
  });

  // --------------------
  // addMember
  // --------------------

  it('adds a member after authority check', async () => {
    const dto: AddMemberDto = {
      teamId: 'team-1',
      userId: 'user-2',
    };

    const membership = { id: 'm1' } as TeamMembership;

    repo.confirmAuthorityOrThrow.mockResolvedValue(undefined);
    repo.findMembership.mockResolvedValue(null);
    repo.addMember.mockResolvedValue(membership);

    const result = await service.addMember(dto, 'admin-1');

    expect(repo.confirmAuthorityOrThrow).toHaveBeenCalledWith(
      'admin-1',
      'team-1',
    );
    expect(repo.addMember).toHaveBeenCalledWith(dto);
    expect(result).toEqual(membership);
  });

  it('rejects adding a second owner to a team', async () => {
    const dto: AddMemberDto = {
      teamId: 'team-1',
      userId: 'user-2',
      role: 'OWNER',
    };

    repo.confirmAuthorityOrThrow.mockResolvedValue(Role.ADMIN);
    repo.findActiveOwners.mockResolvedValue([{ id: 'owner-membership' }]);

    await expect(service.addMember(dto, 'admin-1')).rejects.toThrow(
      ConflictException,
    );
    expect(repo.addMember).not.toHaveBeenCalled();
  });

  it('reactivates an existing inactive membership instead of creating a duplicate', async () => {
    const dto: AddMemberDto = {
      teamId: 'team-1',
      userId: 'user-2',
      role: 'MEMBER',
    };
    const reactivated = { id: 'm1', isActive: true } as TeamMembership;

    repo.confirmAuthorityOrThrow.mockResolvedValue(Role.ADMIN);
    repo.findMembership.mockResolvedValue({
      id: 'm1',
      teamId: 'team-1',
      userId: 'user-2',
      role: 'MEMBER',
      tokenLimit: 0,
      isActive: false,
      invitedByUserId: null,
    });
    repo.reactivateMember.mockResolvedValue(reactivated);

    const result = await service.addMember(dto, 'admin-1');

    expect(repo.reactivateMember).toHaveBeenCalledWith(
      expect.objectContaining({
        teamId: 'team-1',
        userId: 'user-2',
        isActive: true,
      }),
    );
    expect(repo.addMember).not.toHaveBeenCalled();
    expect(result).toEqual(reactivated);
  });

  it('returns conflict when adding a user who is already an active member', async () => {
    const dto: AddMemberDto = {
      teamId: 'team-1',
      userId: 'user-2',
      role: 'MEMBER',
    };

    repo.confirmAuthorityOrThrow.mockResolvedValue(Role.ADMIN);
    repo.findMembership.mockResolvedValue({
      id: 'm1',
      teamId: 'team-1',
      userId: 'user-2',
      role: 'MEMBER',
      tokenLimit: 0,
      isActive: true,
      invitedByUserId: null,
    });

    await expect(service.addMember(dto, 'admin-1')).rejects.toThrow(
      ConflictException,
    );
    expect(repo.addMember).not.toHaveBeenCalled();
    expect(repo.reactivateMember).not.toHaveBeenCalled();
  });

  // --------------------
  // updateMember
  // --------------------

  it('updates a member', async () => {
    const dto: UpdateMemberDto = {
      teamId: 'team-1',
      userId: 'user-2',
    };

    const membership = { id: 'm1' } as TeamMembership;

    repo.confirmAuthorityOrThrow.mockResolvedValue(undefined);
    repo.findMembership.mockResolvedValue({
      id: 'm1',
      teamId: 'team-1',
      userId: 'user-2',
      role: 'MEMBER',
      tokenLimit: 0,
      invitedByUserId: null,
    });
    repo.updateMember.mockResolvedValue(membership);

    const result = await service.updateMember(dto, 'admin-1');

    expect(repo.confirmAuthorityOrThrow).toHaveBeenCalledWith(
      'admin-1',
      'team-1',
    );
    expect(repo.updateMember).toHaveBeenCalledWith(
      expect.objectContaining({
        teamId: 'team-1',
        userId: 'user-2',
      }),
    );
    expect(result).toEqual(membership);
  });

  it('transfers ownership when a different member is promoted to OWNER', async () => {
    const dto: UpdateMemberDto = {
      teamId: 'team-1',
      userId: 'user-2',
      role: 'OWNER',
    };
    const membership = { id: 'm2', role: 'OWNER' } as TeamMembership;

    repo.confirmAuthorityOrThrow.mockResolvedValue(Role.OWNER);
    repo.findMembership.mockResolvedValue({
      id: 'm2',
      teamId: 'team-1',
      userId: 'user-2',
      role: 'ADMIN',
      tokenLimit: 0,
      invitedByUserId: null,
      isActive: true,
    });
    repo.transferOwnership.mockResolvedValue(membership);

    const result = await service.updateMember(dto, 'owner-1');

    expect(repo.transferOwnership).toHaveBeenCalledWith(
      expect.objectContaining({
        teamId: 'team-1',
        userId: 'user-2',
        role: 'OWNER',
        acceptedAt: expect.any(Date),
      }),
    );
    expect(repo.updateMember).not.toHaveBeenCalled();
    expect(result).toEqual(membership);
  });

  it('blocks demoting the current owner without transferring ownership', async () => {
    const dto: UpdateMemberDto = {
      teamId: 'team-1',
      userId: 'owner-1',
      role: 'ADMIN',
    };

    repo.confirmAuthorityOrThrow.mockResolvedValue(Role.OWNER);
    repo.findMembership.mockResolvedValue({
      id: 'm-owner',
      teamId: 'team-1',
      userId: 'owner-1',
      role: 'OWNER',
      tokenLimit: 0,
      invitedByUserId: null,
      isActive: true,
    });

    await expect(service.updateMember(dto, 'owner-1')).rejects.toThrow(
      ConflictException,
    );
    expect(repo.updateMember).not.toHaveBeenCalled();
  });

  // --------------------
  // removeTeamMember
  // --------------------

  it('removes a team member with authority check', async () => {
    repo.confirmAuthorityOrThrow.mockResolvedValue(undefined);
    repo.findMembership.mockResolvedValue({
      id: 'm2',
      teamId: 'team-1',
      userId: 'user-2',
      role: 'MEMBER',
      tokenLimit: 0,
      invitedByUserId: null,
      isActive: true,
    });
    repo.deleteTeamMember.mockResolvedValue(undefined);

    const result = await service.removeTeamMember(
      'team-1',
      'user-2',
      'admin-1',
    );

    expect(repo.confirmAuthorityOrThrow).toHaveBeenCalledWith(
      'admin-1',
      'team-1',
    );
    expect(repo.deleteTeamMember).toHaveBeenCalledWith('team-1', 'user-2');
    expect(result.message).toContain('user-2');
  });

  it('blocks removing the current owner before ownership transfer', async () => {
    repo.confirmAuthorityOrThrow.mockResolvedValue(undefined);
    repo.findMembership.mockResolvedValue({
      id: 'm-owner',
      teamId: 'team-1',
      userId: 'owner-1',
      role: 'OWNER',
      tokenLimit: 0,
      invitedByUserId: null,
      isActive: true,
    });

    await expect(
      service.removeTeamMember('team-1', 'owner-1', 'admin-1'),
    ).rejects.toThrow(ConflictException);
    expect(repo.deleteTeamMember).not.toHaveBeenCalled();
  });

  it('allows a member to leave their own team without authority check', async () => {
    repo.findMembership.mockResolvedValue({
      id: 'm-member',
      teamId: 'team-1',
      userId: 'member-1',
      role: 'MEMBER',
      tokenLimit: 0,
      invitedByUserId: null,
      isActive: true,
    });
    repo.deleteTeamMember.mockResolvedValue(undefined);

    const result = await service.removeTeamMember(
      'team-1',
      'member-1',
      'member-1',
    );

    expect(repo.confirmAuthorityOrThrow).not.toHaveBeenCalled();
    expect(repo.deleteTeamMember).toHaveBeenCalledWith('team-1', 'member-1');
    expect(result.message).toContain('member-1');
  });

  it('blocks an owner from leaving their own team before transferring ownership', async () => {
    repo.findMembership.mockResolvedValue({
      id: 'm-owner',
      teamId: 'team-1',
      userId: 'owner-1',
      role: 'OWNER',
      tokenLimit: 0,
      invitedByUserId: null,
      isActive: true,
    });

    await expect(
      service.removeTeamMember('team-1', 'owner-1', 'owner-1'),
    ).rejects.toThrow(ConflictException);

    expect(repo.confirmAuthorityOrThrow).not.toHaveBeenCalled();
    expect(repo.deleteTeamMember).not.toHaveBeenCalled();
  });

  // --------------------
  // findAll / findById / findUserTeams
  // --------------------

  it('findAll returns teams', async () => {
    repo.findMany.mockResolvedValue([baseTeam]);

    const result = await service.findAll();

    expect(repo.findMany).toHaveBeenCalled();
    expect(result).toEqual([baseTeam]);
  });

  it('findById returns team', async () => {
    repo.findById.mockResolvedValue(baseTeam);

    const result = await service.findById('team-1');

    expect(result).toEqual(baseTeam);
  });

  it('findById throws if not found', async () => {
    repo.findById.mockResolvedValue(null);

    await expect(service.findById('team-x')).rejects.toThrow(NotFoundException);
  });

  it('findUserTeams returns user teams', async () => {
    repo.findUserTeams.mockResolvedValue([baseTeam]);

    const result = await service.findUserTeams('user-1');

    expect(repo.findUserTeams).toHaveBeenCalledWith('user-1');
    expect(result).toEqual([baseTeam]);
  });
});
