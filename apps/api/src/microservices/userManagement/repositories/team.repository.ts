// team.repository.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { UserPrismaService } from '../prisma/user-prisma.service';
import type { Prisma, Team as PrismaTeam } from '@prisma/user-client';

export interface CreateTeamData {
  name: string;
  slug?: string;
  isActive?: boolean;
  availableTokens?: number;
  usedTokens?: number;
  billingEmail?: string;
  billingAddress?: Prisma.InputJsonValue;
  metadata?: Prisma.InputJsonValue;
}

@Injectable()
export class TeamRepository {
  constructor(private readonly prisma: UserPrismaService) {}

  private slugify(input: string): string {
    return (
      input
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 50) || 'team'
    );
  }

  private async ensureUniqueSlug(base: string): Promise<string> {
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

  async findMany(): Promise<PrismaTeam[]> {
    return this.prisma.team.findMany({ where: { deletedAt: null } });
  }

  async findById(id: string): Promise<PrismaTeam | null> {
    return this.prisma.team.findFirst({ where: { id, deletedAt: null } });
  }

  async findBySlug(slug: string): Promise<PrismaTeam | null> {
    return this.prisma.team.findFirst({ where: { slug, deletedAt: null } });
  }

  async findByName(name: string): Promise<PrismaTeam | null> {
    return this.prisma.team.findFirst({ where: { name, deletedAt: null } });
  }

  async create(data: CreateTeamData): Promise<PrismaTeam> {
    const baseSlug = this.slugify(data.slug ?? data.name);
    data.slug = await this.ensureUniqueSlug(baseSlug);

    return this.prisma.team.create({
      data: {
        name: data.name,
        slug: data.slug,
        isActive: data.isActive ?? true,
        availableTokens: data.availableTokens ?? 0,
        usedTokens: data.usedTokens ?? 0,
        billingEmail: data.billingEmail,
        billingAddress: data.billingAddress,
        metadata: data.metadata,
      },
    });
  }

  async update(id: string, data: Partial<CreateTeamData>): Promise<PrismaTeam> {
    const current = await this.prisma.team.findUnique({ where: { id } });
    if (!current || current.deletedAt)
      throw new NotFoundException('Team not found');

    const nameChanged =
      typeof data.name === 'string' &&
      data.name.trim().length > 0 &&
      data.name.trim() !== current.name;

    if (nameChanged) {
      const baseSlug = this.slugify(data.slug ?? data.name!);
      data.slug = await this.ensureUniqueSlug(baseSlug);
    }

    return this.prisma.team.update({
      where: { id },
      data: {
        name: data.name,
        slug: data.slug,
        isActive: data.isActive,
        availableTokens: data.availableTokens,
        usedTokens: data.usedTokens,
        billingEmail: data.billingEmail,
        billingAddress: data.billingAddress,
        metadata: data.metadata,
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.team.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }
}
