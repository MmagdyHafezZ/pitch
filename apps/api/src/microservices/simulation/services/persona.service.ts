import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Persona, Prisma } from '@prisma/simulation-client';
import { PersonaRepository } from '../repositories/persona.repository';

export interface PersonaResponseDto {
  id: string;
  orgId: string;
  name: string;
  traits?: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PersonaListResponseDto {
  personas: PersonaResponseDto[];
  total: number;
}

@Injectable()
export class PersonaService {
  private readonly logger = new Logger(PersonaService.name);

  constructor(private readonly personaRepository: PersonaRepository) {}

  async findAll(orgId?: string): Promise<PersonaListResponseDto> {
    this.logger.log(`Finding all personas${orgId ? ` for org: ${orgId}` : ''}`);

    const personas = await this.personaRepository.findMany(
      orgId ? { orgId } : undefined,
    );

    return {
      personas: personas.map(this.mapToResponseDto),
      total: personas.length,
    };
  }

  async findById(id: string): Promise<PersonaResponseDto> {
    this.logger.log(`Finding persona with ID: ${id}`);

    const persona = await this.personaRepository.findById(id);
    if (!persona) {
      throw new NotFoundException(`Persona with ID ${id} not found`);
    }

    return this.mapToResponseDto(persona);
  }

  async findByOrgId(orgId: string): Promise<PersonaListResponseDto> {
    this.logger.log(`Finding personas for org: ${orgId}`);

    const personas = await this.personaRepository.findByOrgId(orgId);

    return {
      personas: personas.map(this.mapToResponseDto),
      total: personas.length,
    };
  }

  private mapToResponseDto = (persona: Persona): PersonaResponseDto => {
    return {
      id: persona.id,
      orgId: persona.orgId,
      name: persona.name,
      traits: persona.traits,
      createdAt: persona.createdAt,
      updatedAt: persona.updatedAt,
    };
  };
}
