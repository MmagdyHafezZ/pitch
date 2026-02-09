import { Injectable, Logger } from '@nestjs/common';
import { UserPrismaService } from '../../prisma/user-prisma.service';
import { Prisma, Plan } from '@prisma/user-client';

@Injectable()
export class PlanRepository {
  private readonly logger = new Logger(PlanRepository.name);

  constructor(private readonly prisma: UserPrismaService) {}

  async create(data: Prisma.PlanCreateInput): Promise<Plan> {
    this.logger.debug(`Creating plan "${data.name}"`);
    return this.prisma.plan.create({ data });
  }

  async update(id: string, data: Prisma.PlanUpdateInput): Promise<Plan> {
    this.logger.debug(`Updating plan "${id}"`);
    return this.prisma.plan.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<Plan> {
    this.logger.debug(`Deleting plan "${id}"`);
    return this.prisma.plan.delete({
      where: { id },
    });
  }

  async findById(id: string): Promise<Plan | null> {
    this.logger.debug(`Finding plan by id "${id}"`);
    return this.prisma.plan.findUnique({
      where: { id },
    });
  }

  async findAll(): Promise<Plan[]> {
    this.logger.debug('Finding all plans');
    return this.prisma.plan.findMany({
      orderBy: { createdAt: 'asc' },
    });
  }

  async findActive(): Promise<Plan[]> {
    this.logger.debug('Finding all active plans');
    return this.prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findByName(name: string): Promise<Plan | null> {
    return this.prisma.plan.findUnique({ where: { name } });
  }
}
