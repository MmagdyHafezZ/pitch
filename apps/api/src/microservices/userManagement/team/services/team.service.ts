import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { Role } from '@prisma/user-client';
import {
  Team,
  TeamMembership,
  CreateTeamDto,
  UpdateTeamDto,
  AddMemberDto,
  UpdateMemberDto,
  TeamMetadata,
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
    const metadata = this.buildMetadataOnCreate(
      createTeamDto.metadata ?? null,
      requesterId,
    );

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
    if (dto.name !== undefined && existingTeam.name !== dto.name) {
      const teamWithName = await this.teamRepository.findByName(dto.name);
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

    await this.teamRepository.confirmAuthorityOrThrow(requesterId, teamId);

    const metadata = this.buildMetadataOnUpdate(
      existingTeam.metadata ?? null,
      dto.metadata,
      requesterId,
    );

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
    if (addMemberDto.role === Role.OWNER) {
      const activeOwners = await this.teamRepository.findActiveOwners(
        addMemberDto.teamId,
      );
      if (activeOwners.length > 0) {
        throw new ConflictException(
          'This team already has an owner. Transfer ownership from an existing member instead.',
        );
      }
    }

    const existingMembership = await this.teamRepository.findMembership(
      addMemberDto.teamId,
      addMemberDto.userId,
    );
    if (existingMembership) {
      if (existingMembership.isActive !== false) {
        throw new ConflictException('User is already a member of this team');
      }
      return this.teamRepository.reactivateMember({
        ...addMemberDto,
        isActive: true,
      });
    }

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

    const existingMembership = await this.teamRepository.findMembership(
      updateMemberDto.teamId,
      updateMemberDto.userId,
    );
    if (!existingMembership) {
      throw new NotFoundException(
        `Membership for user ${updateMemberDto.userId} in team ${updateMemberDto.teamId} not found`,
      );
    }

    if (
      updateMemberDto.role &&
      updateMemberDto.role !== Role.OWNER &&
      existingMembership.role === Role.OWNER
    ) {
      throw new ConflictException(
        'Transfer ownership to another member before changing the current owner role.',
      );
    }

    if (
      updateMemberDto.role === Role.OWNER &&
      existingMembership.role !== Role.OWNER
    ) {
      return this.teamRepository.transferOwnership({
        ...updateMemberDto,
        acceptedAt: updateMemberDto.acceptedAt ?? new Date(),
      });
    }

    return this.teamRepository.updateMember({
      ...updateMemberDto,
      acceptedAt: updateMemberDto.acceptedAt ?? new Date(),
    });
  }

  async removeTeamMember(
    teamId: string,
    userId: string,
    requesterId: string,
  ): Promise<{ message: string }> {
    const isSelfLeave = requesterId === userId;
    if (!isSelfLeave) {
      await this.teamRepository.confirmAuthorityOrThrow(requesterId, teamId);
    }
    const membership = await this.teamRepository.findMembership(teamId, userId);
    if (!membership) {
      throw new NotFoundException(
        `Membership for user ${userId} in team ${teamId} not found`,
      );
    }
    if (membership.isActive !== false && membership.role === Role.OWNER) {
      throw new ConflictException(
        'Transfer ownership to another member before removing the current owner.',
      );
    }
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

  private toMetadataObject(value: unknown): TeamMetadata {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }
    return value as TeamMetadata;
  }

  private buildMetadataOnCreate(
    input: TeamMetadata | null | undefined,
    requesterId: string,
  ): TeamMetadata {
    const now = new Date().toISOString();
    const metadata = this.toMetadataObject(input);
    const audit = metadata.audit ?? {};

    return {
      ...metadata,
      audit: {
        ownerUserId: requesterId,
        createdByUserId: requesterId,
        createdAt: now,
        updatedByUserId: requesterId,
        updatedAt: now,
        version: typeof audit.version === 'number' ? audit.version : 1,
      },
    } satisfies TeamMetadata;
  }

  private buildMetadataOnUpdate(
    existing: TeamMetadata | null | undefined,
    patch: TeamMetadata | null | undefined,
    requesterId: string,
  ): TeamMetadata {
    const now = new Date().toISOString();
    const existingMetadata = this.toMetadataObject(existing);
    const patchMetadata = this.toMetadataObject(patch);
    const previousAudit = existingMetadata.audit ?? {};
    const patchAudit = patchMetadata.audit ?? {};
    const nextVersion =
      typeof previousAudit.version === 'number' ? previousAudit.version + 1 : 1;

    return {
      ...existingMetadata,
      ...patchMetadata,
      profile: {
        ...(existingMetadata.profile ?? {}),
        ...(patchMetadata.profile ?? {}),
      },
      preferences: {
        ...(existingMetadata.preferences ?? {}),
        ...(patchMetadata.preferences ?? {}),
      },
      audit: {
        ownerUserId:
          patchAudit.ownerUserId ?? previousAudit.ownerUserId ?? requesterId,
        createdByUserId: previousAudit.createdByUserId ?? requesterId,
        createdAt: previousAudit.createdAt ?? now,
        updatedByUserId: requesterId,
        updatedAt: now,
        version: nextVersion,
      },
    } satisfies TeamMetadata;
  }

  async confirmAuthorityOrThrow(userId: string, teamId: string): Promise<Role> {
    return this.teamRepository.confirmAuthorityOrThrow(userId, teamId);
  }
}
