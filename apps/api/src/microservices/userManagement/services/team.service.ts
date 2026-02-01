import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { Prisma } from '@prisma/user-client';
import {
  Team,
  TeamMembership,
  CreateTeamDto,
  UpdateTeamDto,
  AddMemberDto,
  UpdateMemberDto,
} from '@pitch/shared-backend/interfaces/user.interface';
import { TeamRepository } from '../repositories/team.repository';

@Injectable()
export class TeamService {
  constructor(private readonly teamRepository: TeamRepository) {}

  async createTeam(
    createTeamDto: CreateTeamDto,
    requesterId: string,
  ): Promise<Team> {
    const slug = await this.createSlug({
      name: createTeamDto.name,
      slug: createTeamDto.slug,
    });
    const metadata = { temp: 'data' };

    return this.teamRepository.createTeam(
      {
        ...createTeamDto,
        slug,
        isActive: createTeamDto.isActive ?? true,
        metadata,
      },
      requesterId,
    );
  }

  async updateTeam(
    teamId: string,
    dto: UpdateTeamDto,
    requesterId: string,
  ): Promise<Team> {
    const existingTeam = await this.teamRepository.findById(teamId);
    if (!existingTeam) {
      throw new NotFoundException(`Team with ID ${teamId} not found`);
    }
    if (existingTeam.name !== dto.name) {
      const teamWithName = await this.teamRepository.findByName(dto.name!);
      if (teamWithName && teamWithName.id !== teamId) {
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

    const metadata = { temp: 'data' };

    await this.teamRepository.confirmAuthorityOrThrow(requesterId, teamId);

    return this.teamRepository.updateTeam(teamId, {
      ...dto,
      slug,
      metadata,
    });
  }

  async removeTeam(
    teamId: string,
    requesterId: string,
  ): Promise<{ message: string }> {
    await this.teamRepository.confirmAuthorityOrThrow(requesterId, teamId);
    await this.teamRepository.deleteTeam(teamId);
    return { message: `Team with ID ${teamId} has been deleted` };
  }

  async addMember(
    addMemberDto: AddMemberDto,
    requesterId: string,
  ): Promise<TeamMembership> {
    await this.teamRepository.confirmAuthorityOrThrow(
      requesterId,
      addMemberDto.teamId,
    );
    return this.teamRepository.addMember({
      ...addMemberDto,
    });
  }

  async updateMember(
    updateMemberDto: UpdateMemberDto,
    requesterId: string,
  ): Promise<TeamMembership> {
    await this.teamRepository.confirmAuthorityOrThrow(
      requesterId,
      updateMemberDto.teamId,
    );
    return this.teamRepository.updateMember({
      ...updateMemberDto,
    });
  }

  async removeTeamMember(
    teamId: string,
    userId: string,
    requesterId: string,
  ): Promise<{ message: string }> {
    await this.teamRepository.confirmAuthorityOrThrow(requesterId, teamId);
    await this.teamRepository.deleteTeamMember(teamId, userId);
    return {
      message: `User with ID ${userId} has been removed from team with ID: ${teamId}`,
    };
  }

  async findAll(): Promise<Team[]> {
    return this.teamRepository.findMany();
  }

  async findById(id: string): Promise<Team> {
    const team = await this.teamRepository.findById(id);
    if (!team) throw new NotFoundException(`Team with ID ${id} not found`);
    return team;
  }

  async findUserTeams(userId: string): Promise<Team[]> {
    return this.teamRepository.findUserTeams(userId);
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
