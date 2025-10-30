// team.service.ts
import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { Prisma } from '@prisma/user-client';
import {
  Team,
  CreateTeamDto,
  UpdateTeamDto,
} from '../../../common/interfaces/user.interface';
import { TeamRepository } from '../repositories/team.repository';

function toJson(v: unknown): Prisma.JsonValue | undefined {
  if (v === undefined) return undefined;
  return JSON.parse(JSON.stringify(v)) as Prisma.JsonValue;
}

@Injectable()
export class TeamService {
  constructor(private readonly teamRepository: TeamRepository) {}

  async create(createTeamDto: CreateTeamDto): Promise<Team> {
    const slug = await this.createSlug({
      name: createTeamDto.name,
      slug: createTeamDto.slug,
    });
    const metadata = { temp: 'data' }; // this is temporary, will replace with actual logic

    return this.teamRepository.create({
      ...createTeamDto,
      slug,
      isActive: createTeamDto.isActive ?? true,
      metadata,
    });
  }

  async update(id: string, dto: UpdateTeamDto): Promise<Team> {
    const existingTeam = await this.teamRepository.findById(id);
    if (!existingTeam) {
      throw new NotFoundException(`Team with ID ${id} not found`);
    }
    if (existingTeam.name !== dto.name) {
      const teamWithName = await this.teamRepository.findByName(dto.name!);
      if (teamWithName && teamWithName.id !== id) {
        throw new ConflictException(
          `Team name '${dto.name}' is already in use`,
        );
      }
    }
    let slug = existingTeam.slug;
    if (dto.slug && dto.slug !== existingTeam.slug) {
      slug = await this.createSlug({
        name: dto.name ?? existingTeam.name,
        slug: dto.slug,
      });
    } else if (dto.name && dto.name !== existingTeam.name) {
      slug = await this.createSlug({ name: dto.name, slug: undefined });
    }

    const metadata = { temp: 'data' }; // this is temporary, will replace with actual logic

    return this.teamRepository.update(id, {
      ...dto,
      slug,
      metadata,
    });
  }

  async remove(id: string): Promise<{ message: string }> {
    await this.teamRepository.delete(id);
    return { message: `Team with ID ${id} has been deleted` };
  }

  async findAll(): Promise<Team[]> {
    return this.teamRepository.findMany();
  }

  async findOne(id: string): Promise<Team> {
    const team = await this.teamRepository.findById(id);
    if (!team) throw new NotFoundException(`Team with ID ${id} not found`);
    return team;
  }

  async findByName(name: string): Promise<Team | null> {
    return this.teamRepository.findByName(name);
  }

  private async createSlug(input: {
    name: string;
    slug?: string;
  }): Promise<string> {
    const base = this.slugify((input.slug ?? input.name).trim());
    return this.teamRepository.ensureUniqueSlug(base);
  }

  private slugify(s: string): string {
    const MAX = 50;
    const normalized = s
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
    return normalized.slice(0, MAX);
  }

  private buildMetadata(ownerId: string, createdBy: string): Prisma.JsonValue {
    return {
      ownerId: ownerId,
      createdBy: createdBy,
      createdAt: new Date().toISOString(),
    };
  }

  private updateMetadata(existingMetadata: Prisma.JsonValue | undefined) {
    return {
      ...((existingMetadata as Record<string, unknown>) || {}),
      updatedBy: 'system',
      updatedAt: new Date().toISOString(),
    };
  }
}
