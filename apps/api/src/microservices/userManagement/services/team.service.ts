// team.service.ts
import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import type { Prisma, Team as PrismaTeam } from '@prisma/user-client';
import {
  CreateTeamDto,
  UpdateTeamDto,
} from '../../../common/interfaces/user.interface';
import {
  TeamRepository,
  CreateTeamData,
} from '../repositories/team.repository';

function toJson(v: unknown): Prisma.InputJsonValue | undefined {
  if (v === undefined) return undefined;
  return JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
}

@Injectable()
export class TeamService {
  constructor(private readonly teamRepository: TeamRepository) {}

  async findAll(): Promise<PrismaTeam[]> {
    return this.teamRepository.findMany();
  }

  async findOne(id: string): Promise<PrismaTeam> {
    const team = await this.teamRepository.findById(id);
    if (!team) throw new NotFoundException(`Team with ID ${id} not found`);
    return team;
  }

  async findByName(name: string): Promise<PrismaTeam | null> {
    return this.teamRepository.findByName(name);
  }

  async create(dto: CreateTeamDto): Promise<PrismaTeam> {
    const payload: CreateTeamData = {
      name: dto.name,
      availableTokens: dto.availableTokens,
      billingEmail: dto.billingEmail,
      billingAddress: toJson(dto.billingAddress),
      metadata: toJson(dto.metadata),
    };

    try {
      return await this.teamRepository.create(payload);
    } catch (e: unknown) {
      const err = e as Prisma.PrismaClientKnownRequestError;
      if (err?.code === 'P2002')
        throw new ConflictException('Team slug already exists');
      throw e;
    }
  }

  async update(id: string, dto: UpdateTeamDto): Promise<PrismaTeam> {
    const payload: Partial<CreateTeamData> = {
      name: dto.name,
      isActive: dto.isActive,
      availableTokens: dto.availableTokens,
      usedTokens: dto.usedTokens,
      billingEmail: dto.billingEmail,
      billingAddress: toJson(dto.billingAddress),
      metadata: toJson(dto.metadata),
    };

    try {
      return await this.teamRepository.update(id, payload);
    } catch (e: unknown) {
      const err = e as Prisma.PrismaClientKnownRequestError;
      if (err?.code === 'P2025')
        throw new NotFoundException(`Team with ID ${id} not found`);
      if (err?.code === 'P2002')
        throw new ConflictException('Team slug already exists');
      throw e;
    }
  }

  async remove(id: string): Promise<{ message: string }> {
    try {
      await this.teamRepository.delete(id);
      return { message: `Team with ID ${id} has been deleted` };
    } catch (e: unknown) {
      const err = e as Prisma.PrismaClientKnownRequestError;
      if (err?.code === 'P2025')
        throw new NotFoundException(`Team with ID ${id} not found`);
      throw e;
    }
  }
}
