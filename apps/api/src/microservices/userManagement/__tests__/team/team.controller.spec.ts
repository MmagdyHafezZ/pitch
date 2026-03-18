import { TeamController } from '../../team/controllers/team.controller';
import type { TeamService } from '../../team/services/team.service';
import { toRpcException } from '@pitch/shared-backend/helpers/exceptions';
import { RpcException } from '@nestjs/microservices';
import type {
  Team,
  TeamMembership,
} from '@pitch/shared-backend/interfaces/user.interface';
import type { MessageWithUserClaims } from '@pitch/shared-backend/interfaces/user-claims.interface';

jest.mock('@pitch/shared-backend/helpers/exceptions', () => ({
  toRpcException: jest.fn((error: unknown) => error),
}));

describe('TeamController', () => {
  const createServiceMock = (): jest.Mocked<TeamService> =>
    ({
      createTeam: jest.fn(),
      updateTeam: jest.fn(),
      removeTeam: jest.fn(),
      addMember: jest.fn(),
      updateMember: jest.fn(),
      removeTeamMember: jest.fn(),
      inviteMember: jest.fn(),
      acceptInvite: jest.fn(),
      sendSignupInvite: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
      findUserTeams: jest.fn(),
      findByName: jest.fn(),
      createSlug: jest.fn(),
      slugify: jest.fn(),
    }) as unknown as jest.Mocked<TeamService>;

  const basePayload: MessageWithUserClaims = {
    userClaims: {
      id: 'admin-1',
      email: 'admin@example.com',
      name: 'Admin User',
    },
  };

  const team: Team = {
    id: 'team-1',
    name: 'Engineering',
    slug: 'engineering',
    isActive: true,
    billingEmail: 'billing@example.com',
    billingAddress: {
      street: '123 Main St',
      city: 'Anytown',
      state: 'CA',
      zip: '12345',
    },
    metadata: null,
    createdAt: new Date('2023-01-01T00:00:00.000Z'),
    updatedAt: new Date('2023-01-01T00:00:00.000Z'),
    deletedAt: null,
    memberships: [],
  };

  const membership: TeamMembership = {
    id: 'membership-1',
    userId: 'user-1',
    teamId: 'team-1',
    role: 'MEMBER',
    tokenLimit: 1000,
    isActive: true,
    acceptedAt: null,
    invitedByUserId: 'admin-1',
    user: {
      id: 'user-1',
      email: 'user@example.com',
      name: 'Test User',
      avatar: null,
      isActive: true,
      invitedAt: undefined,
    },
  };

  const toRpcExceptionMock = jest.mocked(toRpcException);

  beforeEach(() => {
    jest.clearAllMocks();
    toRpcExceptionMock.mockReset();
  });

  // ---------- happy paths ----------

  it('creates a team and passes correct DTO and userId', async () => {
    const service = createServiceMock();
    service.createTeam.mockResolvedValue(team);
    const controller = new TeamController(service);

    const payload = {
      name: 'My Team',
      slug: 'my-team',
      billingEmail: 'billing@example.com',
      billingAddress: {
        street: '123 Main St',
        city: 'Anytown',
        state: 'CA',
        zip: '12345',
      },
      metadata: {
        profile: { industry: 'Software' },
      },
      ...basePayload,
    };

    await expect(controller.createTeam(payload as any)).resolves.toEqual(team);

    expect(service.createTeam).toHaveBeenCalledTimes(1);
    expect(service.createTeam).toHaveBeenCalledWith(
      {
        name: 'My Team',
        slug: 'my-team',
        isActive: true,
        billingEmail: 'billing@example.com',
        billingAddress: {
          street: '123 Main St',
          city: 'Anytown',
          state: 'CA',
          zip: '12345',
        },
        metadata: {
          profile: { industry: 'Software' },
        },
      },
      basePayload.userClaims.id,
    );
  });

  it('updates a team and passes correct DTO and userId', async () => {
    const service = createServiceMock();
    service.updateTeam.mockResolvedValue(team);
    const controller = new TeamController(service);

    const payload = {
      teamId: 'team-1',
      name: 'Updated Name',
      slug: 'updated-slug',
      isActive: false,
      billingEmail: 'new-billing@example.com',
      billingAddress: {
        street: '456 Other St',
        city: 'Othertown',
        state: 'NY',
        zip: '67890',
      },
      metadata: {
        notes: 'updated',
      },
      ...basePayload,
    };

    await expect(controller.updateTeam(payload as any)).resolves.toEqual(team);

    expect(service.updateTeam).toHaveBeenCalledTimes(1);
    expect(service.updateTeam).toHaveBeenCalledWith(
      'team-1',
      {
        name: 'Updated Name',
        slug: 'updated-slug',
        isActive: false,
        billingEmail: 'new-billing@example.com',
        billingAddress: {
          street: '456 Other St',
          city: 'Othertown',
          state: 'NY',
          zip: '67890',
        },
        metadata: {
          notes: 'updated',
        },
      },
      basePayload.userClaims.id,
    );
  });

  it('deletes a team with correct teamId and userId', async () => {
    const service = createServiceMock();
    service.removeTeam.mockResolvedValue({ message: 'deleted' } as any);
    const controller = new TeamController(service);

    const payload = { teamId: 'team-1', ...basePayload };

    await expect(controller.deleteTeam(payload as any)).resolves.toEqual({
      message: 'deleted',
    });

    expect(service.removeTeam).toHaveBeenCalledWith(
      'team-1',
      basePayload.userClaims.id,
    );
  });

  it('returns a single team', async () => {
    const service = createServiceMock();
    service.findById.mockResolvedValue(team);
    const controller = new TeamController(service);

    const payload = { teamId: 'team-1', ...basePayload };

    await expect(controller.getTeam(payload as any)).resolves.toEqual(team);
    expect(service.findById).toHaveBeenCalledWith('team-1');
  });

  it('returns all teams', async () => {
    const service = createServiceMock();
    service.findAll.mockResolvedValue([team]);
    const controller = new TeamController(service);

    await expect(controller.getTeams(basePayload)).resolves.toEqual([team]);
    expect(service.findAll).toHaveBeenCalledTimes(1);
  });

  it('returns user teams', async () => {
    const service = createServiceMock();
    service.findUserTeams.mockResolvedValue([team]);
    const controller = new TeamController(service);

    await expect(controller.getUserTeams(basePayload)).resolves.toEqual([team]);

    expect(service.findUserTeams).toHaveBeenCalledWith(
      basePayload.userClaims.id,
    );
  });

  it('adds a team member and passes correct DTO and userId', async () => {
    const service = createServiceMock();
    service.addMember.mockResolvedValue(membership);
    const controller = new TeamController(service);

    const payload = {
      teamId: 'team-1',
      userId: 'user-1',
      role: 'MEMBER',
      tokenLimit: 500,
      isActive: true,
      ...basePayload,
    };

    await expect(controller.addTeamMember(payload as any)).resolves.toEqual(
      membership,
    );

    expect(service.addMember).toHaveBeenCalledTimes(1);
    expect(service.addMember).toHaveBeenCalledWith(
      {
        teamId: 'team-1',
        userId: 'user-1',
        role: 'MEMBER',
        tokenLimit: 500,
        isActive: true,
        invitedByUserId: basePayload.userClaims.id,
      },
      basePayload.userClaims.id,
    );
  });

  it('updates a team member and passes correct DTO and userId', async () => {
    const service = createServiceMock();
    service.updateMember.mockResolvedValue(membership);
    const controller = new TeamController(service);

    const payload = {
      teamId: 'team-1',
      userId: 'user-1',
      role: 'ADMIN',
      tokenLimit: 800,
      isActive: false,
      acceptedAt: new Date('2023-02-01T00:00:00.000Z'),
      ...basePayload,
    };

    await expect(controller.updateTeamMember(payload as any)).resolves.toEqual(
      membership,
    );

    expect(service.updateMember).toHaveBeenCalledTimes(1);
    expect(service.updateMember).toHaveBeenCalledWith(
      {
        teamId: 'team-1',
        userId: 'user-1',
        role: 'ADMIN',
        tokenLimit: 800,
        isActive: false,
      },
      basePayload.userClaims.id,
    );
  });

  it('removes a team member and passes correct ids', async () => {
    const service = createServiceMock();
    service.removeTeamMember.mockResolvedValue({ message: 'removed' } as any);
    const controller = new TeamController(service);

    const payload = {
      teamId: 'team-1',
      userId: 'user-1',
      ...basePayload,
    };

    await expect(controller.removeTeamMember(payload as any)).resolves.toEqual({
      message: 'removed',
    });

    expect(service.removeTeamMember).toHaveBeenCalledWith(
      'team-1',
      'user-1',
      basePayload.userClaims.id,
    );
  });

  it('sends a team signup invite with expected payload', async () => {
    const service = createServiceMock();
    service.sendSignupInvite.mockResolvedValue({
      message: 'Signup invite sent to new-user@example.com',
    });
    const controller = new TeamController(service);

    const payload = {
      teamId: 'team-1',
      email: 'new-user@example.com',
      signupUrl: 'https://app.pitch.ai/signup?invite=abc123',
      ...basePayload,
    };

    await expect(
      controller.sendTeamSignupInvite(payload as any),
    ).resolves.toEqual({
      message: 'Signup invite sent to new-user@example.com',
    });

    expect(service.sendSignupInvite).toHaveBeenCalledWith({
      teamId: 'team-1',
      email: 'new-user@example.com',
      requesterId: basePayload.userClaims.id,
      inviterName: basePayload.userClaims.name,
      signupUrl: 'https://app.pitch.ai/signup?invite=abc123',
    });
  });

  it('invites a user and passes correct DTO and requester', async () => {
    const service = createServiceMock();
    service.inviteMember.mockResolvedValue(membership);
    const controller = new TeamController(service);

    const payload = {
      teamId: 'team-1',
      userId: 'user-2',
      role: 'MEMBER',
      tokenLimit: 0,
      ...basePayload,
    };

    await expect(controller.inviteTeamMember(payload as any)).resolves.toEqual(
      membership,
    );

    expect(service.inviteMember).toHaveBeenCalledWith(
      {
        teamId: 'team-1',
        userId: 'user-2',
        role: 'MEMBER',
        tokenLimit: 0,
        invitedByUserId: basePayload.userClaims.id,
      },
      {
        id: basePayload.userClaims.id,
        name: basePayload.userClaims.name,
      },
    );
  });

  it('accepts a team invite for current user claims', async () => {
    const service = createServiceMock();
    service.acceptInvite.mockResolvedValue({
      message: 'Invitation accepted',
      membership,
    } as any);
    const controller = new TeamController(service);

    await expect(
      controller.acceptTeamInvite({ teamId: 'team-1', ...basePayload } as any),
    ).resolves.toEqual({
      message: 'Invitation accepted',
      membership,
    });

    expect(service.acceptInvite).toHaveBeenCalledWith(
      'team-1',
      basePayload.userClaims.id,
    );
  });

  // ---------- error wrapping ----------

  it('wraps errors in createTeam with toRpcException', async () => {
    const service = createServiceMock();
    const error = new Error('failure');
    const rpcError = new RpcException('rpc');

    service.createTeam.mockRejectedValue(error);
    toRpcExceptionMock.mockReturnValueOnce(rpcError as any);

    const controller = new TeamController(service);

    await expect(
      controller.createTeam({
        name: 'My Team',
        ...basePayload,
      } as any),
    ).rejects.toThrow(rpcError);

    expect(toRpcExceptionMock).toHaveBeenCalledWith(error);
  });

  it('wraps errors in updateTeam with toRpcException', async () => {
    const service = createServiceMock();
    const error = new Error('failure');
    const rpcError = new RpcException('rpc');

    service.updateTeam.mockRejectedValue(error);
    toRpcExceptionMock.mockReturnValueOnce(rpcError as any);

    const controller = new TeamController(service);

    await expect(
      controller.updateTeam({
        teamId: 'team-1',
        name: 'Updated',
        ...basePayload,
      } as any),
    ).rejects.toThrow(rpcError);
  });

  it('wraps errors in deleteTeam with toRpcException', async () => {
    const service = createServiceMock();
    const error = new Error('failure');
    const rpcError = new RpcException('rpc');

    service.removeTeam.mockRejectedValue(error);
    toRpcExceptionMock.mockReturnValueOnce(rpcError as any);

    const controller = new TeamController(service);

    await expect(
      controller.deleteTeam({ teamId: 'team-1', ...basePayload } as any),
    ).rejects.toThrow(rpcError);
  });

  it('wraps errors in getTeam with toRpcException', async () => {
    const service = createServiceMock();
    const error = new Error('failure');
    const rpcError = new RpcException('rpc');

    service.findById.mockRejectedValue(error);
    toRpcExceptionMock.mockReturnValueOnce(rpcError as any);

    const controller = new TeamController(service);

    await expect(
      controller.getTeam({ teamId: 'team-1', ...basePayload } as any),
    ).rejects.toThrow(rpcError);
  });

  it('wraps errors in getTeams with toRpcException', async () => {
    const service = createServiceMock();
    const error = new Error('failure');
    const rpcError = new RpcException('rpc');

    service.findAll.mockRejectedValue(error);
    toRpcExceptionMock.mockReturnValueOnce(rpcError as any);

    const controller = new TeamController(service);

    await expect(controller.getTeams(basePayload)).rejects.toThrow(rpcError);
  });

  it('wraps errors in getUserTeams with toRpcException', async () => {
    const service = createServiceMock();
    const error = new Error('failure');
    const rpcError = new RpcException('rpc');

    service.findUserTeams.mockRejectedValue(error);
    toRpcExceptionMock.mockReturnValueOnce(rpcError as any);

    const controller = new TeamController(service);

    await expect(controller.getUserTeams(basePayload)).rejects.toThrow(
      rpcError,
    );
  });

  it('wraps errors in addTeamMember with toRpcException', async () => {
    const service = createServiceMock();
    const error = new Error('failure');
    const rpcError = new RpcException('rpc');

    service.addMember.mockRejectedValue(error);
    toRpcExceptionMock.mockReturnValueOnce(rpcError as any);

    const controller = new TeamController(service);

    await expect(
      controller.addTeamMember({
        teamId: 'team-1',
        userId: 'user-1',
        role: 'MEMBER',
        ...basePayload,
      } as any),
    ).rejects.toThrow(rpcError);
  });

  it('wraps errors in updateTeamMember with toRpcException', async () => {
    const service = createServiceMock();
    const error = new Error('failure');
    const rpcError = new RpcException('rpc');

    service.updateMember.mockRejectedValue(error);
    toRpcExceptionMock.mockReturnValueOnce(rpcError as any);

    const controller = new TeamController(service);

    await expect(
      controller.updateTeamMember({
        teamId: 'team-1',
        userId: 'user-1',
        role: 'ADMIN',
        ...basePayload,
      } as any),
    ).rejects.toThrow(rpcError);
  });

  it('wraps errors in removeTeamMember with toRpcException', async () => {
    const service = createServiceMock();
    const error = new Error('failure');
    const rpcError = new RpcException('rpc');

    service.removeTeamMember.mockRejectedValue(error);
    toRpcExceptionMock.mockReturnValueOnce(rpcError as any);

    const controller = new TeamController(service);

    await expect(
      controller.removeTeamMember({
        teamId: 'team-1',
        userId: 'user-1',
        ...basePayload,
      } as any),
    ).rejects.toThrow(rpcError);
  });

  it('wraps errors in sendTeamSignupInvite with toRpcException', async () => {
    const service = createServiceMock();
    const error = new Error('failure');
    const rpcError = new RpcException('rpc');

    service.sendSignupInvite.mockRejectedValue(error);
    toRpcExceptionMock.mockReturnValueOnce(rpcError as any);

    const controller = new TeamController(service);

    await expect(
      controller.sendTeamSignupInvite({
        teamId: 'team-1',
        email: 'new-user@example.com',
        ...basePayload,
      } as any),
    ).rejects.toThrow(rpcError);
  });

  it('wraps errors in inviteTeamMember with toRpcException', async () => {
    const service = createServiceMock();
    const error = new Error('failure');
    const rpcError = new RpcException('rpc');

    service.inviteMember.mockRejectedValue(error);
    toRpcExceptionMock.mockReturnValueOnce(rpcError as any);

    const controller = new TeamController(service);

    await expect(
      controller.inviteTeamMember({
        teamId: 'team-1',
        userId: 'user-2',
        role: 'MEMBER',
        ...basePayload,
      } as any),
    ).rejects.toThrow(rpcError);
  });

  it('wraps errors in acceptTeamInvite with toRpcException', async () => {
    const service = createServiceMock();
    const error = new Error('failure');
    const rpcError = new RpcException('rpc');

    service.acceptInvite.mockRejectedValue(error);
    toRpcExceptionMock.mockReturnValueOnce(rpcError as any);

    const controller = new TeamController(service);

    await expect(
      controller.acceptTeamInvite({ teamId: 'team-1', ...basePayload } as any),
    ).rejects.toThrow(rpcError);
  });
});
