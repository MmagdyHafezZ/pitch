import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/user-client';
import { UserPrismaService } from '../../prisma/user-prisma.service';
import {
  CreateTeamDto,
  UpdateTeamDto,
  Team,
  AddMemberDto,
  UpdateMemberDto,
} from '@pitch/shared-backend/interfaces/user.interface';
import { Role, TeamMembership } from '@prisma/user-client/client';

export interface TeamInviteTargetUser {
  id: string;
  email: string;
  name: string;
}

@Injectable()
export class TeamRepository {
  constructor(private readonly prisma: UserPrismaService) {}

  async createTeam(data: CreateTeamDto, ownerId: string): Promise<Team> {
    const slug = await this.ensureUniqueSlug(data.slug ?? data.name);

    return this.prisma.team.create({
      data: {
        name: data.name,
        slug,
        isActive: data.isActive ?? true,
        approvalStatus: data.approvalStatus ?? 'APPROVED',
        availableTokens: 0,
        usedTokens: 0,
        billingEmail: data.billingEmail ?? null,
        billingAddress: (data.billingAddress ?? null) as Prisma.InputJsonValue,
        metadata: (data.metadata ?? {}) as Prisma.InputJsonValue,
        memberships: {
          create: {
            userId: ownerId,
            role: Role.OWNER,
            tokenLimit: 0,
            isActive: true,
            acceptedAt: new Date(),
          },
        },
      },
      include: {
        memberships: {
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
        },
      },
    }) as unknown as Promise<Team>;
  }

  async updateTeamMetadata(
    teamId: string,
    metadata: Prisma.InputJsonValue | null,
  ): Promise<void> {
    await this.prisma.team.update({
      where: { id: teamId },
      data: { metadata: metadata === null ? Prisma.JsonNull : metadata },
    });
  }

  updateTeam(id: string, data: Partial<UpdateTeamDto>): Promise<Team> {
    return this.prisma.team.update({
      where: { id },
      data: {
        name: data.name,
        slug: data.slug,
        isActive: data.isActive,
        billingEmail: data.billingEmail ?? null,
        billingAddress: (data.billingAddress ?? undefined) as
          | Prisma.InputJsonValue
          | undefined,
        metadata: (data.metadata ?? undefined) as
          | Prisma.InputJsonValue
          | undefined,
      },
      include: {
        memberships: {
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
        },
      },
    }) as unknown as Promise<Team>;
  }

  async deleteTeam(id: string): Promise<void> {
    await this.prisma.team.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }

  async addMember(data: AddMemberDto): Promise<TeamMembership> {
    try {
      return await this.prisma.teamMembership.create({
        data: {
          userId: data.userId,
          teamId: data.teamId,
          role: data.role,
          tokenLimit: data.tokenLimit,
          isActive: data.isActive ?? true,
          invitedByUserId: data.invitedByUserId,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('User is already a member of this team');
      }
      throw error;
    }
  }

  async createAcceptedMember(data: AddMemberDto): Promise<TeamMembership> {
    try {
      return await this.prisma.teamMembership.create({
        data: {
          userId: data.userId,
          teamId: data.teamId,
          role: data.role,
          tokenLimit: data.tokenLimit,
          isActive: true,
          invitedByUserId: data.invitedByUserId,
          acceptedAt: new Date(),
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('User is already a member of this team');
      }
      throw error;
    }
  }

  async inviteMember(data: AddMemberDto): Promise<TeamMembership> {
    return this.prisma.teamMembership.create({
      data: {
        userId: data.userId,
        teamId: data.teamId,
        role: data.role,
        tokenLimit: data.tokenLimit,
        isActive: false,
        invitedByUserId: data.invitedByUserId,
        invitedAt: new Date(),
        acceptedAt: null,
      },
    });
  }

  async reinviteMember(data: AddMemberDto): Promise<TeamMembership> {
    return this.prisma.teamMembership.update({
      where: {
        userId_teamId: { userId: data.userId, teamId: data.teamId },
      },
      data: {
        role: data.role,
        tokenLimit: data.tokenLimit,
        isActive: false,
        invitedByUserId: data.invitedByUserId,
        acceptedAt: null,
        invitedAt: new Date(),
      },
    });
  }

  async acceptInvite(teamId: string, userId: string): Promise<TeamMembership> {
    return this.prisma.teamMembership.update({
      where: {
        userId_teamId: { userId, teamId },
      },
      data: {
        isActive: true,
        acceptedAt: new Date(),
      },
    });
  }

  async reactivateMember(data: AddMemberDto): Promise<TeamMembership> {
    return this.prisma.teamMembership.update({
      where: {
        userId_teamId: { userId: data.userId, teamId: data.teamId },
      },
      data: {
        role: data.role,
        tokenLimit: data.tokenLimit,
        isActive: data.isActive ?? true,
        invitedByUserId: data.invitedByUserId,
        acceptedAt: null,
        invitedAt: new Date(),
      },
    });
  }

  async updateMember(data: UpdateMemberDto): Promise<TeamMembership> {
    return this.prisma.teamMembership.update({
      where: {
        userId_teamId: { userId: data.userId, teamId: data.teamId },
      },
      data: {
        role: data.role,
        tokenLimit: data.tokenLimit,
        isActive: data.isActive,
        acceptedAt: data.acceptedAt,
      },
    });
  }

  async findMembership(
    teamId: string,
    userId: string,
  ): Promise<TeamMembership | null> {
    return this.prisma.teamMembership.findUnique({
      where: {
        userId_teamId: { userId, teamId },
      },
    });
  }

  async findUserById(userId: string): Promise<TeamInviteTargetUser | null> {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
      },
    }) as Promise<TeamInviteTargetUser | null>;
  }

  async findActiveOwners(teamId: string): Promise<TeamMembership[]> {
    return this.prisma.teamMembership.findMany({
      where: {
        teamId,
        isActive: true,
        role: Role.OWNER,
      },
    });
  }

  async transferOwnership(data: UpdateMemberDto): Promise<TeamMembership> {
    const membership = await this.prisma.client.$transaction(
      async (tx: Prisma.TransactionClient) => {
        await tx.teamMembership.updateMany({
          where: {
            teamId: data.teamId,
            isActive: true,
            role: Role.OWNER,
            NOT: { userId: data.userId },
          },
          data: {
            role: Role.ADMIN,
          },
        });

        return tx.teamMembership.update({
          where: {
            userId_teamId: { userId: data.userId, teamId: data.teamId },
          },
          data: {
            role: Role.OWNER,
            tokenLimit: data.tokenLimit,
            isActive: data.isActive,
            acceptedAt: data.acceptedAt,
          },
        });
      },
    );

    return membership;
  }

  async deleteTeamMember(teamId: string, userId: string): Promise<void> {
    await this.prisma.teamMembership.update({
      where: {
        userId_teamId: { userId: userId, teamId: teamId },
      },
      data: {
        isActive: false,
        acceptedAt: null,
        invitedByUserId: null,
      },
    });
  }

  async hardDeleteMembership(teamId: string, userId: string): Promise<void> {
    await this.prisma.teamMembership.delete({
      where: {
        userId_teamId: { userId, teamId },
      },
    });
  }

  async deleteExpiredPendingInvites(cutoff: Date): Promise<number> {
    const result = await this.prisma.teamMembership.deleteMany({
      where: {
        isActive: false,
        acceptedAt: null,
        invitedByUserId: { not: null },
        invitedAt: { lt: cutoff },
      },
    });

    return result.count;
  }

  listActiveTeamMetadata(): Promise<
    Array<{ id: string; metadata: Prisma.JsonValue | null }>
  > {
    return this.prisma.team.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        metadata: true,
      },
    }) as Promise<Array<{ id: string; metadata: Prisma.JsonValue | null }>>;
  }

  findMany(): Promise<Team[]> {
    return this.prisma.team.findMany({
      where: { deletedAt: null },
      include: {
        memberships: {
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
        },
      },
    }) as unknown as Promise<Team[]>;
  }

  findById(id: string): Promise<Team | null> {
    return this.prisma.team.findUnique({
      where: { id },
      include: {
        memberships: {
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
        },
      },
    }) as unknown as Promise<Team | null>;
  }

  async findUserTeams(userId: string): Promise<Team[]> {
    return this.prisma.team.findMany({
      where: {
        memberships: {
          some: {
            userId: userId,
            isActive: true,
            team: { isActive: true, deletedAt: null },
          },
        },
        deletedAt: null,
      },
      include: {
        memberships: {
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
        },
      },
    }) as unknown as Promise<Team[]>;
  }

  async findBySlug(slug: string): Promise<Team | null> {
    return this.prisma.team.findFirst({
      where: { slug, deletedAt: null },
    }) as unknown as Promise<Team | null>;
  }

  async findByName(name: string): Promise<Team | null> {
    return this.prisma.team.findFirst({
      where: { name, deletedAt: null },
    }) as unknown as Promise<Team | null>;
  }

  async confirmAuthorityOrThrow(userId: string, teamId: string): Promise<Role> {
    const m = await this.prisma.teamMembership.findUnique({
      where: { userId_teamId: { userId, teamId } },
      select: {
        role: true,
        isActive: true,
        team: { select: { id: true, isActive: true, deletedAt: true } },
      },
    });

    if (!m) throw new NotFoundException('Membership not found');
    if (!m.team.isActive || m.team.deletedAt !== null)
      throw new NotFoundException('Team not found');
    if (!m.isActive) throw new ForbiddenException('Membership inactive');
    if (m.role === Role.MEMBER)
      throw new ForbiddenException('Insufficient role');

    return m.role;
  }

  async confirmSubscriptionAuthorityOrThrow(
    userId: string,
    teamId: string,
  ): Promise<Role> {
    const membership = await this.prisma.teamMembership.findUnique({
      where: { userId_teamId: { userId, teamId } },
      select: {
        role: true,
        isActive: true,
        team: { select: { id: true, isActive: true, deletedAt: true } },
      },
    });

    if (!membership) throw new NotFoundException('Membership not found');
    if (!membership.team.isActive || membership.team.deletedAt !== null)
      throw new NotFoundException('Team not found');
    if (!membership.isActive)
      throw new ForbiddenException('Membership inactive');
    if (membership.role !== Role.MEMBER) {
      return membership.role;
    }

    const activeMemberCount = await this.prisma.teamMembership.count({
      where: { teamId, isActive: true },
    });

    if (activeMemberCount === 1) {
      return membership.role;
    }

    throw new ForbiddenException('Insufficient role');
  }

  async findPendingTeams(): Promise<Team[]> {
    return this.prisma.team.findMany({
      where: { approvalStatus: 'PENDING', deletedAt: null },
      include: {
        memberships: {
          where: { role: Role.OWNER },
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
        },
      },
      orderBy: { createdAt: 'asc' },
    }) as unknown as Promise<Team[]>;
  }

  async approveTeam(teamId: string): Promise<Team> {
    return this.prisma.team.update({
      where: { id: teamId },
      data: { approvalStatus: 'APPROVED', isActive: true },
    }) as unknown as Promise<Team>;
  }

  async rejectTeam(teamId: string, note?: string): Promise<Team> {
    const existing = await this.prisma.team.findUnique({
      where: { id: teamId },
    });
    const currentMeta = (existing?.metadata as Record<string, unknown>) ?? {};
    return this.prisma.team.update({
      where: { id: teamId },
      data: {
        approvalStatus: 'REJECTED',
        isActive: false,
        metadata: {
          ...currentMeta,
          rejectionNote: note ?? null,
          rejectedAt: new Date().toISOString(),
        },
      },
    }) as unknown as Promise<Team>;
  }

  async ensureUniqueSlug(base: string): Promise<string> {
    let candidate = base;
    let i = 1;
    while (true) {
      const existing = await this.prisma.team.findUnique({
        where: { slug: candidate },
      });
      if (!existing) return candidate;
      i += 1;
      candidate = `${base}-${i}`;
      if (candidate.length > 50) candidate = candidate.slice(0, 50);
    }
  }
}
