import { Injectable } from '@nestjs/common';
import { Persona, Prisma } from '@prisma/simulation-client';
import { SimulationPrismaService } from '../prisma/simulation-prisma.service';

export interface FindPersonasFilters {
  orgId?: string;
}

@Injectable()
export class PersonaRepository {
  constructor(private readonly prisma: SimulationPrismaService) {}

  async findMany(filters?: FindPersonasFilters): Promise<Persona[]> {
    const where: Prisma.PersonaWhereInput = {};

    if (filters?.orgId) {
      where.orgId = filters.orgId;
    }

    return await this.prisma.client.persona.findMany({
      where,
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: string): Promise<Persona | null> {
    return await this.prisma.client.persona.findUnique({
      where: { id },
    });
  }

  async findByOrgId(orgId: string): Promise<Persona[]> {
    return await this.prisma.client.persona.findMany({
      where: { orgId },
      orderBy: { name: 'asc' },
    });
  }

  async create(data: {
    orgId: string;
    name: string;
    traits?: Prisma.InputJsonValue;
  }): Promise<Persona> {
    return await this.prisma.client.persona.create({
      data,
    });
  }

  async update(
    id: string,
    data: {
      name?: string;
      traits?: Prisma.InputJsonValue;
    },
  ): Promise<Persona> {
    return await this.prisma.client.persona.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<Persona> {
    return await this.prisma.client.persona.delete({
      where: { id },
    });
  }
}
