import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import {
  CreateOpportunityDto,
  UpdateOpportunityDto,
  OpportunityListQueryDto,
} from '../dto/opportunity.dto';
import { createPaginatedResponse } from '../dto/pagination.dto';

@Injectable()
export class OpportunitiesService {
  private readonly logger = new Logger(OpportunitiesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(orgId: string, query: OpportunityListQueryDto) {
    const {
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;
    const skip = (page - 1) * limit;

    const where: any = { orgId };

    if (query.stage) where.stage = query.stage;
    if (query.accountId) where.accountId = query.accountId;
    if (query.contactId) where.contactId = query.contactId;
    if (query.ownerId) where.ownerId = query.ownerId;
    if (query.type) where.type = query.type;

    if (query.search) {
      where.name = { contains: query.search, mode: 'insensitive' };
    }

    const [opportunities, total] = await Promise.all([
      this.prisma.client.opportunity.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          account: { select: { id: true, name: true } },
          contact: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      }),
      this.prisma.client.opportunity.count({ where }),
    ]);

    return createPaginatedResponse(opportunities, total, page, limit);
  }

  async findById(id: string, orgId: string) {
    const opportunity = await this.prisma.client.opportunity.findFirst({
      where: { id, orgId },
      include: {
        account: { select: { id: true, name: true } },
        contact: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        activities: { take: 10, orderBy: { createdAt: 'desc' } },
        notes: { take: 10, orderBy: { createdAt: 'desc' } },
      },
    });

    if (!opportunity) {
      throw new NotFoundException(`Opportunity with ID ${id} not found`);
    }

    return opportunity;
  }

  async create(orgId: string, dto: CreateOpportunityDto) {
    try {
      // Clean up empty/invalid optional fields
      const data: any = { ...dto, orgId };
      if (!data.accountId || data.accountId === 'string') delete data.accountId;
      if (!data.contactId || data.contactId === 'string') delete data.contactId;
      if (!data.ownerId || data.ownerId === 'string') delete data.ownerId;

      const opportunity = await this.prisma.client.opportunity.create({
        data,
        include: {
          account: { select: { id: true, name: true } },
          contact: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      });

      this.logger.log(`Created opportunity ${opportunity.id} for org ${orgId}`);
      return opportunity;
    } catch (error) {
      this.logger.error(
        `Failed to create opportunity: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async update(id: string, orgId: string, dto: UpdateOpportunityDto) {
    const existing = await this.prisma.client.opportunity.findFirst({
      where: { id, orgId },
    });

    if (!existing) {
      throw new NotFoundException(`Opportunity with ID ${id} not found`);
    }

    const opportunity = await this.prisma.client.opportunity.update({
      where: { id },
      data: dto,
      include: {
        account: { select: { id: true, name: true } },
        contact: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    this.logger.log(`Updated opportunity ${id} for org ${orgId}`);
    return opportunity;
  }

  async delete(id: string, orgId: string) {
    const existing = await this.prisma.client.opportunity.findFirst({
      where: { id, orgId },
    });

    if (!existing) {
      throw new NotFoundException(`Opportunity with ID ${id} not found`);
    }

    await this.prisma.client.opportunity.delete({ where: { id } });
    this.logger.log(`Deleted opportunity ${id} for org ${orgId}`);

    return { success: true, message: 'Opportunity deleted successfully' };
  }

  async getPipelineSummary(orgId: string) {
    const stages = [
      'prospecting',
      'qualification',
      'proposal',
      'negotiation',
      'closed_won',
      'closed_lost',
    ];

    const pipeline = await Promise.all(
      stages.map(async (stage) => {
        const result = await this.prisma.client.opportunity.aggregate({
          where: { orgId, stage },
          _count: true,
          _sum: { amount: true },
        });
        return {
          stage,
          count: result._count,
          totalValue: result._sum.amount || 0,
        };
      }),
    );

    return pipeline;
  }
}
