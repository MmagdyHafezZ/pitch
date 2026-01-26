import {
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
          },
        },
      },
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
    });
  }

  async deleteTeam(id: string): Promise<void> {
    await this.prisma.team.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }

  async addMember(data: AddMemberDto): Promise<TeamMembership> {
    return this.prisma.teamMembership.create({
      data: {
        userId: data.userId,
        teamId: data.teamId,
        role: data.role,
        tokenLimit: data.tokenLimit,
        isActive: data.isActive ?? true,
        invitedByUserId: data.invitedByUserId,
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

  async deleteTeamMember(teamId: string, userId: string): Promise<void> {
    await this.prisma.teamMembership.update({
      where: {
        userId_teamId: { userId: userId, teamId: teamId },
      },
      data: { isActive: false },
    });
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
    });
  }

  async findBySlug(slug: string): Promise<Team | null> {
    return this.prisma.team.findFirst({ where: { slug, deletedAt: null } });
  }

  async findByName(name: string): Promise<Team | null> {
    return this.prisma.team.findFirst({ where: { name, deletedAt: null } });
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
