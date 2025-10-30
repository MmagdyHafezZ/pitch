// team.repository.ts
import { Injectable } from '@nestjs/common';
import { UserPrismaService } from '../prisma/user-prisma.service';
import {
  CreateTeamDto,
  UpdateTeamDto,
  Team,
} from 'src/common/interfaces/user.interface';

@Injectable()
export class TeamRepository {
  constructor(private readonly prisma: UserPrismaService) {}

  async create(data: CreateTeamDto): Promise<Team> {
    return this.prisma.team.create({
      data: {
        name: data.name,
        slug: data.slug ?? '',
        isActive: data.isActive ?? true,
        availableTokens: 0,
        usedTokens: 0,
        billingEmail: data.billingEmail ?? null,
        billingAddress: data.billingAddress ?? undefined,
        metadata: data.metadata ?? undefined,
      },
    });
  }

  async update(id: string, data: Partial<UpdateTeamDto>): Promise<Team> {
    return this.prisma.team.update({
      where: { id },
      data: {
        name: data.name,
        slug: data.slug,
        isActive: data.isActive,
        billingEmail: data.billingEmail ?? null,
        billingAddress: data.billingAddress ?? undefined,
        metadata: data.metadata ?? undefined,
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.team.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }

  async findMany(): Promise<Team[]> {
    return this.prisma.team.findMany({ where: { deletedAt: null } });
  }

  async findById(id: string): Promise<Team | null> {
    return this.prisma.team.findFirst({ where: { id, deletedAt: null } });
  }

  async findBySlug(slug: string): Promise<Team | null> {
    return this.prisma.team.findFirst({ where: { slug, deletedAt: null } });
  }

  async findByName(name: string): Promise<Team | null> {
    return this.prisma.team.findFirst({ where: { name, deletedAt: null } });
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
