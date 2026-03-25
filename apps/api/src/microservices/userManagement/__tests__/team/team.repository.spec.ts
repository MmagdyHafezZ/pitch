import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/user-client';
import { Role } from '@prisma/user-client/client';
import { TeamRepository } from '../../team/repositories/team.repository';

const membershipInclude = {
  include: {
    user: {
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        isActive: true,
      },
    },
  },
  orderBy: [{ role: 'asc' }, { invitedAt: 'asc' }],
};

const baseMembership = {
  id: 'mem-1',
  userId: 'user-1',
  teamId: 'team-1',
  role: Role.OWNER,
  tokenLimit: 0,
  isActive: true,
  invitedByUserId: null,
  invitedAt: new Date('2024-01-01'),
  acceptedAt: new Date('2024-01-01'),
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

const baseTeam = {
  id: 'team-1',
  name: 'Engineering',
  slug: 'engineering',
  isActive: true,
  availableTokens: 0,
  usedTokens: 0,
  billingEmail: null,
  billingAddress: null,
  metadata: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  deletedAt: null,
  memberships: [baseMembership],
};

const mockTx = {
  teamMembership: {
    updateMany: jest.fn(),
    update: jest.fn(),
  },
};

const mockPrisma = {
  team: {
    create: jest.fn(),
    update: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
  },
  teamMembership: {
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
  client: {
    $transaction: jest.fn(),
  },
};

describe('TeamRepository', () => {
  let repo: TeamRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new TeamRepository(mockPrisma as never);
  });

  // ---------------------------------------------------------------------------
  // createTeam
  // ---------------------------------------------------------------------------

  describe('createTeam', () => {
    it('creates a team with owner membership and unique slug', async () => {
      mockPrisma.team.findUnique.mockResolvedValue(null);
      mockPrisma.team.create.mockResolvedValue(baseTeam);

      const result = await repo.createTeam(
        { name: 'Engineering', billingEmail: 'b@e.com' } as any,
        'user-1',
      );

      expect(result).toEqual(baseTeam);
      expect(mockPrisma.team.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'Engineering',
            slug: 'Engineering',
            isActive: true,
            billingEmail: 'b@e.com',
            memberships: {
              create: expect.objectContaining({
                userId: 'user-1',
                role: Role.OWNER,
              }),
            },
          }),
          include: { memberships: membershipInclude },
        }),
      );
    });

    it('uses provided slug when available', async () => {
      mockPrisma.team.findUnique.mockResolvedValue(null);
      mockPrisma.team.create.mockResolvedValue(baseTeam);

      await repo.createTeam({ name: 'Eng', slug: 'eng-team' } as any, 'user-1');

      expect(mockPrisma.team.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ slug: 'eng-team' }),
        }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // updateTeamMetadata
  // ---------------------------------------------------------------------------

  describe('updateTeamMetadata', () => {
    it('sets metadata to the provided value', async () => {
      mockPrisma.team.update.mockResolvedValue(baseTeam);

      await repo.updateTeamMetadata('team-1', { key: 'val' });

      expect(mockPrisma.team.update).toHaveBeenCalledWith({
        where: { id: 'team-1' },
        data: { metadata: { key: 'val' } },
      });
    });

    it('uses Prisma.JsonNull when metadata is null', async () => {
      mockPrisma.team.update.mockResolvedValue(baseTeam);

      await repo.updateTeamMetadata('team-1', null);

      expect(mockPrisma.team.update).toHaveBeenCalledWith({
        where: { id: 'team-1' },
        data: { metadata: Prisma.JsonNull },
      });
    });
  });

  // ---------------------------------------------------------------------------
  // updateTeam
  // ---------------------------------------------------------------------------

  describe('updateTeam', () => {
    it('updates team fields with membership include', async () => {
      const updated = { ...baseTeam, name: 'New Name' };
      mockPrisma.team.update.mockResolvedValue(updated);

      const result = await repo.updateTeam('team-1', {
        name: 'New Name',
      } as any);

      expect(result).toEqual(updated);
      expect(mockPrisma.team.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'team-1' },
          data: expect.objectContaining({ name: 'New Name' }),
          include: { memberships: membershipInclude },
        }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // deleteTeam
  // ---------------------------------------------------------------------------

  describe('deleteTeam', () => {
    it('soft-deletes the team', async () => {
      mockPrisma.team.update.mockResolvedValue(baseTeam);

      await repo.deleteTeam('team-1');

      expect(mockPrisma.team.update).toHaveBeenCalledWith({
        where: { id: 'team-1' },
        data: { deletedAt: expect.any(Date), isActive: false },
      });
    });
  });

  // ---------------------------------------------------------------------------
  // addMember
  // ---------------------------------------------------------------------------

  describe('addMember', () => {
    const addDto = {
      userId: 'user-2',
      teamId: 'team-1',
      role: Role.MEMBER,
      tokenLimit: 100,
      isActive: true,
      invitedByUserId: 'user-1',
    };

    it('creates a team membership', async () => {
      mockPrisma.teamMembership.create.mockResolvedValue(baseMembership);

      const result = await repo.addMember(addDto as any);

      expect(result).toEqual(baseMembership);
      expect(mockPrisma.teamMembership.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-2',
          teamId: 'team-1',
          role: Role.MEMBER,
        }),
      });
    });

    it('throws ConflictException on duplicate membership (P2002)', async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint violation',
        { code: 'P2002', clientVersion: '5.0.0' },
      );
      mockPrisma.teamMembership.create.mockRejectedValue(prismaError);

      await expect(repo.addMember(addDto as any)).rejects.toThrow(
        ConflictException,
      );
    });

    it('rethrows non-P2002 errors', async () => {
      const genericError = new Error('DB down');
      mockPrisma.teamMembership.create.mockRejectedValue(genericError);

      await expect(repo.addMember(addDto as any)).rejects.toThrow('DB down');
    });
  });

  // ---------------------------------------------------------------------------
  // createAcceptedMember
  // ---------------------------------------------------------------------------

  describe('createAcceptedMember', () => {
    const dto = {
      userId: 'user-2',
      teamId: 'team-1',
      role: Role.MEMBER,
      tokenLimit: 100,
      invitedByUserId: 'user-1',
    };

    it('creates an already-accepted membership', async () => {
      mockPrisma.teamMembership.create.mockResolvedValue(baseMembership);

      const result = await repo.createAcceptedMember(dto as any);

      expect(result).toEqual(baseMembership);
      expect(mockPrisma.teamMembership.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          isActive: true,
          acceptedAt: expect.any(Date),
        }),
      });
    });

    it('throws ConflictException on duplicate (P2002)', async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint',
        { code: 'P2002', clientVersion: '5.0.0' },
      );
      mockPrisma.teamMembership.create.mockRejectedValue(prismaError);

      await expect(repo.createAcceptedMember(dto as any)).rejects.toThrow(
        ConflictException,
      );
    });

    it('rethrows non-Prisma errors', async () => {
      mockPrisma.teamMembership.create.mockRejectedValue(new Error('fail'));

      await expect(repo.createAcceptedMember(dto as any)).rejects.toThrow(
        'fail',
      );
    });
  });

  // ---------------------------------------------------------------------------
  // inviteMember
  // ---------------------------------------------------------------------------

  describe('inviteMember', () => {
    it('creates an inactive membership as an invite', async () => {
      mockPrisma.teamMembership.create.mockResolvedValue(baseMembership);

      await repo.inviteMember({
        userId: 'user-2',
        teamId: 'team-1',
        role: Role.MEMBER,
        tokenLimit: 0,
        invitedByUserId: 'user-1',
      } as any);

      expect(mockPrisma.teamMembership.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          isActive: false,
          acceptedAt: null,
          invitedAt: expect.any(Date),
        }),
      });
    });
  });

  // ---------------------------------------------------------------------------
  // reinviteMember
  // ---------------------------------------------------------------------------

  describe('reinviteMember', () => {
    it('updates an existing membership back to pending invite', async () => {
      mockPrisma.teamMembership.update.mockResolvedValue(baseMembership);

      await repo.reinviteMember({
        userId: 'user-2',
        teamId: 'team-1',
        role: Role.MEMBER,
        tokenLimit: 0,
        invitedByUserId: 'user-1',
      } as any);

      expect(mockPrisma.teamMembership.update).toHaveBeenCalledWith({
        where: { userId_teamId: { userId: 'user-2', teamId: 'team-1' } },
        data: expect.objectContaining({
          isActive: false,
          acceptedAt: null,
          invitedAt: expect.any(Date),
        }),
      });
    });
  });

  // ---------------------------------------------------------------------------
  // acceptInvite
  // ---------------------------------------------------------------------------

  describe('acceptInvite', () => {
    it('activates the membership and stamps acceptedAt', async () => {
      mockPrisma.teamMembership.update.mockResolvedValue(baseMembership);

      await repo.acceptInvite('team-1', 'user-2');

      expect(mockPrisma.teamMembership.update).toHaveBeenCalledWith({
        where: { userId_teamId: { userId: 'user-2', teamId: 'team-1' } },
        data: { isActive: true, acceptedAt: expect.any(Date) },
      });
    });
  });

  // ---------------------------------------------------------------------------
  // reactivateMember
  // ---------------------------------------------------------------------------

  describe('reactivateMember', () => {
    it('reactivates an existing membership', async () => {
      mockPrisma.teamMembership.update.mockResolvedValue(baseMembership);

      await repo.reactivateMember({
        userId: 'user-2',
        teamId: 'team-1',
        role: Role.MEMBER,
        tokenLimit: 50,
        isActive: true,
        invitedByUserId: 'user-1',
      } as any);

      expect(mockPrisma.teamMembership.update).toHaveBeenCalledWith({
        where: { userId_teamId: { userId: 'user-2', teamId: 'team-1' } },
        data: expect.objectContaining({
          role: Role.MEMBER,
          tokenLimit: 50,
          isActive: true,
          acceptedAt: null,
          invitedAt: expect.any(Date),
        }),
      });
    });
  });

  // ---------------------------------------------------------------------------
  // updateMember
  // ---------------------------------------------------------------------------

  describe('updateMember', () => {
    it('updates membership fields', async () => {
      mockPrisma.teamMembership.update.mockResolvedValue(baseMembership);

      await repo.updateMember({
        userId: 'user-2',
        teamId: 'team-1',
        role: Role.ADMIN,
        tokenLimit: 200,
        isActive: true,
      } as any);

      expect(mockPrisma.teamMembership.update).toHaveBeenCalledWith({
        where: { userId_teamId: { userId: 'user-2', teamId: 'team-1' } },
        data: expect.objectContaining({ role: Role.ADMIN, tokenLimit: 200 }),
      });
    });
  });

  // ---------------------------------------------------------------------------
  // findMembership
  // ---------------------------------------------------------------------------

  describe('findMembership', () => {
    it('returns membership when found', async () => {
      mockPrisma.teamMembership.findUnique.mockResolvedValue(baseMembership);

      const result = await repo.findMembership('team-1', 'user-1');

      expect(result).toEqual(baseMembership);
      expect(mockPrisma.teamMembership.findUnique).toHaveBeenCalledWith({
        where: { userId_teamId: { userId: 'user-1', teamId: 'team-1' } },
      });
    });

    it('returns null when not found', async () => {
      mockPrisma.teamMembership.findUnique.mockResolvedValue(null);

      const result = await repo.findMembership('team-1', 'nobody');

      expect(result).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // findUserById
  // ---------------------------------------------------------------------------

  describe('findUserById', () => {
    it('returns user with id/email/name selection', async () => {
      const partial = { id: 'user-1', email: 'u@e.com', name: 'U' };
      mockPrisma.user.findUnique.mockResolvedValue(partial);

      const result = await repo.findUserById('user-1');

      expect(result).toEqual(partial);
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        select: { id: true, email: true, name: true },
      });
    });

    it('returns null when user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await repo.findUserById('missing');

      expect(result).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // findActiveOwners
  // ---------------------------------------------------------------------------

  describe('findActiveOwners', () => {
    it('returns active owners for a team', async () => {
      mockPrisma.teamMembership.findMany.mockResolvedValue([baseMembership]);

      const result = await repo.findActiveOwners('team-1');

      expect(result).toEqual([baseMembership]);
      expect(mockPrisma.teamMembership.findMany).toHaveBeenCalledWith({
        where: { teamId: 'team-1', isActive: true, role: Role.OWNER },
      });
    });
  });

  // ---------------------------------------------------------------------------
  // transferOwnership
  // ---------------------------------------------------------------------------

  describe('transferOwnership', () => {
    it('demotes existing owners and promotes the target user', async () => {
      const newOwnerMembership = { ...baseMembership, role: Role.OWNER };
      mockTx.teamMembership.updateMany.mockResolvedValue({ count: 1 });
      mockTx.teamMembership.update.mockResolvedValue(newOwnerMembership);
      mockPrisma.client.$transaction.mockImplementation(
        async (cb: (tx: typeof mockTx) => Promise<unknown>) => cb(mockTx),
      );

      const dto = {
        userId: 'user-2',
        teamId: 'team-1',
        tokenLimit: 0,
        isActive: true,
        acceptedAt: new Date(),
      };

      const result = await repo.transferOwnership(dto as any);

      expect(result).toEqual(newOwnerMembership);
      expect(mockTx.teamMembership.updateMany).toHaveBeenCalledWith({
        where: {
          teamId: 'team-1',
          isActive: true,
          role: Role.OWNER,
          NOT: { userId: 'user-2' },
        },
        data: { role: Role.ADMIN },
      });
      expect(mockTx.teamMembership.update).toHaveBeenCalledWith({
        where: { userId_teamId: { userId: 'user-2', teamId: 'team-1' } },
        data: expect.objectContaining({ role: Role.OWNER }),
      });
    });
  });

  // ---------------------------------------------------------------------------
  // deleteTeamMember
  // ---------------------------------------------------------------------------

  describe('deleteTeamMember', () => {
    it('soft-deletes the membership', async () => {
      mockPrisma.teamMembership.update.mockResolvedValue(baseMembership);

      await repo.deleteTeamMember('team-1', 'user-2');

      expect(mockPrisma.teamMembership.update).toHaveBeenCalledWith({
        where: { userId_teamId: { userId: 'user-2', teamId: 'team-1' } },
        data: { isActive: false, acceptedAt: null, invitedByUserId: null },
      });
    });
  });

  // ---------------------------------------------------------------------------
  // hardDeleteMembership
  // ---------------------------------------------------------------------------

  describe('hardDeleteMembership', () => {
    it('permanently deletes the membership record', async () => {
      mockPrisma.teamMembership.delete.mockResolvedValue(baseMembership);

      await repo.hardDeleteMembership('team-1', 'user-2');

      expect(mockPrisma.teamMembership.delete).toHaveBeenCalledWith({
        where: { userId_teamId: { userId: 'user-2', teamId: 'team-1' } },
      });
    });
  });

  // ---------------------------------------------------------------------------
  // deleteExpiredPendingInvites
  // ---------------------------------------------------------------------------

  describe('deleteExpiredPendingInvites', () => {
    it('deletes expired pending invites and returns count', async () => {
      mockPrisma.teamMembership.deleteMany.mockResolvedValue({ count: 3 });

      const cutoff = new Date('2024-06-01');
      const result = await repo.deleteExpiredPendingInvites(cutoff);

      expect(result).toBe(3);
      expect(mockPrisma.teamMembership.deleteMany).toHaveBeenCalledWith({
        where: {
          isActive: false,
          acceptedAt: null,
          invitedByUserId: { not: null },
          invitedAt: { lt: cutoff },
        },
      });
    });
  });

  // ---------------------------------------------------------------------------
  // listActiveTeamMetadata
  // ---------------------------------------------------------------------------

  describe('listActiveTeamMetadata', () => {
    it('returns id and metadata for non-deleted teams', async () => {
      const data = [{ id: 'team-1', metadata: { foo: 'bar' } }];
      mockPrisma.team.findMany.mockResolvedValue(data);

      const result = await repo.listActiveTeamMetadata();

      expect(result).toEqual(data);
      expect(mockPrisma.team.findMany).toHaveBeenCalledWith({
        where: { deletedAt: null },
        select: { id: true, metadata: true },
      });
    });
  });

  // ---------------------------------------------------------------------------
  // findMany
  // ---------------------------------------------------------------------------

  describe('findMany', () => {
    it('returns non-deleted teams with memberships', async () => {
      mockPrisma.team.findMany.mockResolvedValue([baseTeam]);

      const result = await repo.findMany();

      expect(result).toEqual([baseTeam]);
      expect(mockPrisma.team.findMany).toHaveBeenCalledWith({
        where: { deletedAt: null },
        include: { memberships: membershipInclude },
      });
    });
  });

  // ---------------------------------------------------------------------------
  // findById
  // ---------------------------------------------------------------------------

  describe('findById', () => {
    it('returns team with memberships', async () => {
      mockPrisma.team.findUnique.mockResolvedValue(baseTeam);

      const result = await repo.findById('team-1');

      expect(result).toEqual(baseTeam);
      expect(mockPrisma.team.findUnique).toHaveBeenCalledWith({
        where: { id: 'team-1' },
        include: { memberships: membershipInclude },
      });
    });

    it('returns null when not found', async () => {
      mockPrisma.team.findUnique.mockResolvedValue(null);

      const result = await repo.findById('missing');

      expect(result).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // findUserTeams
  // ---------------------------------------------------------------------------

  describe('findUserTeams', () => {
    it('returns active teams for a user', async () => {
      mockPrisma.team.findMany.mockResolvedValue([baseTeam]);

      const result = await repo.findUserTeams('user-1');

      expect(result).toEqual([baseTeam]);
      expect(mockPrisma.team.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            memberships: {
              some: expect.objectContaining({
                userId: 'user-1',
                isActive: true,
              }),
            },
            deletedAt: null,
          }),
          include: { memberships: membershipInclude },
        }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // findBySlug
  // ---------------------------------------------------------------------------

  describe('findBySlug', () => {
    it('returns team by slug', async () => {
      mockPrisma.team.findFirst.mockResolvedValue(baseTeam);

      const result = await repo.findBySlug('engineering');

      expect(result).toEqual(baseTeam);
      expect(mockPrisma.team.findFirst).toHaveBeenCalledWith({
        where: { slug: 'engineering', deletedAt: null },
      });
    });

    it('returns null when slug not found', async () => {
      mockPrisma.team.findFirst.mockResolvedValue(null);

      const result = await repo.findBySlug('nope');

      expect(result).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // findByName
  // ---------------------------------------------------------------------------

  describe('findByName', () => {
    it('returns team by name', async () => {
      mockPrisma.team.findFirst.mockResolvedValue(baseTeam);

      const result = await repo.findByName('Engineering');

      expect(result).toEqual(baseTeam);
      expect(mockPrisma.team.findFirst).toHaveBeenCalledWith({
        where: { name: 'Engineering', deletedAt: null },
      });
    });

    it('returns null when name not found', async () => {
      mockPrisma.team.findFirst.mockResolvedValue(null);

      const result = await repo.findByName('Ghost');

      expect(result).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // confirmAuthorityOrThrow
  // ---------------------------------------------------------------------------

  describe('confirmAuthorityOrThrow', () => {
    it('returns role for active admin', async () => {
      mockPrisma.teamMembership.findUnique.mockResolvedValue({
        role: Role.ADMIN,
        isActive: true,
        team: { id: 'team-1', isActive: true, deletedAt: null },
      });

      const role = await repo.confirmAuthorityOrThrow('user-1', 'team-1');

      expect(role).toBe(Role.ADMIN);
    });

    it('returns role for active owner', async () => {
      mockPrisma.teamMembership.findUnique.mockResolvedValue({
        role: Role.OWNER,
        isActive: true,
        team: { id: 'team-1', isActive: true, deletedAt: null },
      });

      const role = await repo.confirmAuthorityOrThrow('user-1', 'team-1');

      expect(role).toBe(Role.OWNER);
    });

    it('throws NotFoundException when membership not found', async () => {
      mockPrisma.teamMembership.findUnique.mockResolvedValue(null);

      await expect(
        repo.confirmAuthorityOrThrow('user-1', 'team-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when team is inactive', async () => {
      mockPrisma.teamMembership.findUnique.mockResolvedValue({
        role: Role.ADMIN,
        isActive: true,
        team: { id: 'team-1', isActive: false, deletedAt: null },
      });

      await expect(
        repo.confirmAuthorityOrThrow('user-1', 'team-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when team is deleted', async () => {
      mockPrisma.teamMembership.findUnique.mockResolvedValue({
        role: Role.ADMIN,
        isActive: true,
        team: { id: 'team-1', isActive: true, deletedAt: new Date() },
      });

      await expect(
        repo.confirmAuthorityOrThrow('user-1', 'team-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when membership is inactive', async () => {
      mockPrisma.teamMembership.findUnique.mockResolvedValue({
        role: Role.ADMIN,
        isActive: false,
        team: { id: 'team-1', isActive: true, deletedAt: null },
      });

      await expect(
        repo.confirmAuthorityOrThrow('user-1', 'team-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when role is MEMBER', async () => {
      mockPrisma.teamMembership.findUnique.mockResolvedValue({
        role: Role.MEMBER,
        isActive: true,
        team: { id: 'team-1', isActive: true, deletedAt: null },
      });

      await expect(
        repo.confirmAuthorityOrThrow('user-1', 'team-1'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ---------------------------------------------------------------------------
  // ensureUniqueSlug
  // ---------------------------------------------------------------------------

  describe('ensureUniqueSlug', () => {
    it('returns the base slug when it is unique', async () => {
      mockPrisma.team.findUnique.mockResolvedValue(null);

      const slug = await repo.ensureUniqueSlug('engineering');

      expect(slug).toBe('engineering');
      expect(mockPrisma.team.findUnique).toHaveBeenCalledTimes(1);
    });

    it('appends suffix when base slug is taken', async () => {
      mockPrisma.team.findUnique
        .mockResolvedValueOnce({ id: 'existing' })
        .mockResolvedValueOnce(null);

      const slug = await repo.ensureUniqueSlug('engineering');

      expect(slug).toBe('engineering-2');
      expect(mockPrisma.team.findUnique).toHaveBeenCalledTimes(2);
    });

    it('increments until a unique slug is found', async () => {
      mockPrisma.team.findUnique
        .mockResolvedValueOnce({ id: 'e1' })
        .mockResolvedValueOnce({ id: 'e2' })
        .mockResolvedValueOnce(null);

      const slug = await repo.ensureUniqueSlug('eng');

      expect(slug).toBe('eng-3');
      expect(mockPrisma.team.findUnique).toHaveBeenCalledTimes(3);
    });

    it('truncates to 50 chars when slug becomes too long', async () => {
      const longBase = 'a'.repeat(48);
      mockPrisma.team.findUnique
        .mockResolvedValueOnce({ id: 'e1' })
        .mockResolvedValueOnce(null);

      const slug = await repo.ensureUniqueSlug(longBase);

      expect(slug.length).toBeLessThanOrEqual(50);
    });
  });
});
