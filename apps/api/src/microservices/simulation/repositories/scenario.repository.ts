import { Injectable } from '@nestjs/common';
import {
  Prisma,
  Scenario,
  ScenarioVisibility,
} from '@prisma/simulation-client';
import { SimulationPrismaService } from '../prisma/simulation-prisma.service';

export interface FindScenarioFilters {
  where?: Prisma.ScenarioWhereInput;
}

@Injectable()
export class ScenarioRepository {
  constructor(private readonly prisma: SimulationPrismaService) {}

  async findMany(filters?: FindScenarioFilters): Promise<Scenario[]> {
    return await this.prisma.client.scenario.findMany({
      where: filters?.where,
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async findById(id: string): Promise<Scenario | null> {
    return await this.prisma.client.scenario.findUnique({
      where: { id },
    });
  }

  async create(data: {
    orgId: string;
    createdByUserId?: string | null;
    visibility: ScenarioVisibility;
    name: string;
    description?: string | null;
    config?: Prisma.InputJsonValue | null;
  }): Promise<Scenario> {
    return await this.prisma.client.scenario.create({
      data: {
        orgId: data.orgId,
        createdByUserId: data.createdByUserId ?? undefined,
        visibility: data.visibility,
        name: data.name,
        description: data.description ?? undefined,
        config: data.config ?? undefined,
      },
    });
  }

  async update(
    id: string,
    data: {
      visibility?: ScenarioVisibility;
      name?: string;
      description?: string | null;
      config?: Prisma.InputJsonValue | null;
    },
  ): Promise<Scenario> {
    return await this.prisma.client.scenario.update({
      where: { id },
      data: {
        visibility: data.visibility,
        name: data.name,
        description: data.description,
        config:
          data.config === null
            ? Prisma.JsonNull
            : data.config === undefined
              ? undefined
              : data.config,
      },
    });
  }

  async delete(id: string): Promise<Scenario> {
    return await this.prisma.client.scenario.delete({
      where: { id },
    });
  }
}
