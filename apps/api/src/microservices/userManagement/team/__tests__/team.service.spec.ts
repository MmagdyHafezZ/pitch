import { TeamService } from '../services/team.service';
import { NotFoundException, ConflictException } from '@nestjs/common';
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
    deleteTeam: jest.fn(),
    addMember: jest.fn(),
    updateMember: jest.fn(),
    deleteTeamMember: jest.fn(),
    findByName: jest.fn(),
    findMany: jest.fn(),
    findUserTeams: jest.fn(),
    findById: jest.fn(),
    ensureUniqueSlug: jest.fn(),
    confirmAuthorityOrThrow: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TeamService(repo as any);
  });

  const baseTeam: Team = {
    id: 'team-1',
    name: 'Engineering',
    slug: 'engineering',
    isActive: true,
    billingEmail: 'billing@example.com',
    billingAddress: null,
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
      {
        ...dto,
        slug: 'my-team',
        isActive: true,
        metadata: { temp: 'data' },
      },
      'user-1',
    );

    expect(result).toEqual(baseTeam);
  });

  // --------------------
  // updateTeam
  // --------------------

  it('throws Conflict if name already exists', async () => {
    // Existing team with some OLD name
    repo.confirmAuthorityOrThrow.mockResolvedValue(undefined);

    // Existing team is team-1 with a different current name
    repo.findById.mockResolvedValue({
      ...baseTeam,
      id: 'team-1',
      name: 'Old Name',
      slug: 'old-name',
    });

    // We try to rename to "Engineering"
    const dto: UpdateTeamDto = { name: 'Engineering' };

    // findByName returns another team already using that name
    repo.findByName.mockResolvedValue({
      ...baseTeam,
      id: 'team-2', // different id => conflict
      name: 'Engineering',
      slug: 'engineering',
    });
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
    repo.addMember.mockResolvedValue(membership);

    const result = await service.addMember(dto, 'admin-1');

    expect(repo.confirmAuthorityOrThrow).toHaveBeenCalledWith(
      'admin-1',
      'team-1',
    );
    expect(repo.addMember).toHaveBeenCalledWith(dto);
    expect(result).toEqual(membership);
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

  // --------------------
  // removeTeamMember
  // --------------------

  it('removes a team member with authority check', async () => {
    repo.confirmAuthorityOrThrow.mockResolvedValue(undefined);
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
