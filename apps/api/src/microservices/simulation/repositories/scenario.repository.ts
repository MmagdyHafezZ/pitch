import { Injectable } from '@nestjs/common';
import { Scenario, Prisma } from '@prisma/simulation-client';
import { SimulationPrismaService } from '../prisma/simulation-prisma.service';

export interface FindScenarioFilters {
  orgId?: string;
}

@Injectable()
export class ScenarioRepository {
  constructor(private readonly prisma: SimulationPrismaService) {}

  async findMany(filters?: FindScenarioFilters): Promise<Scenario[]> {
    const where: Prisma.ScenarioWhereInput = {};

    if (filters?.orgId) {
      where.orgId = filters.orgId;
    }

    return await this.prisma.client.scenario.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string): Promise<Scenario | null> {
    return await this.prisma.client.scenario.findUnique({
      where: { id },
    });
  }

  async create(data: {
    orgId: string;
    name: string;
    description?: string | null;
    config?: Prisma.InputJsonValue | null;
  }): Promise<Scenario> {
    return await this.prisma.client.scenario.create({
      data: {
        orgId: data.orgId,
        name: data.name,
        description: data.description ?? undefined,
        config: data.config ?? undefined,
      },
    });
  }
}
