import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import {
  CreateActivityDto,
  UpdateActivityDto,
  ActivityListQueryDto,
} from '../dto/activity.dto';
import { createPaginatedResponse } from '../dto/pagination.dto';

@Injectable()
export class ActivitiesService {
  private readonly logger = new Logger(ActivitiesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(orgId: string, query: ActivityListQueryDto) {
    const {
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;
    const skip = (page - 1) * limit;

    const where: any = { orgId };

    if (query.type) where.type = query.type;
    if (query.status) where.status = query.status;
    if (query.priority) where.priority = query.priority;
    if (query.contactId) where.contactId = query.contactId;
    if (query.accountId) where.accountId = query.accountId;
    if (query.opportunityId) where.opportunityId = query.opportunityId;
    if (query.assignedToId) where.assignedToId = query.assignedToId;

    const [activities, total] = await Promise.all([
      this.prisma.client.activity.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          contact: { select: { id: true, firstName: true, lastName: true } },
          account: { select: { id: true, name: true } },
          opportunity: { select: { id: true, name: true } },
        },
      }),
      this.prisma.client.activity.count({ where }),
    ]);

    return createPaginatedResponse(activities, total, page, limit);
  }

  async findById(id: string, orgId: string) {
    const activity = await this.prisma.client.activity.findFirst({
      where: { id, orgId },
      include: {
        contact: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        account: { select: { id: true, name: true } },
        opportunity: { select: { id: true, name: true } },
      },
    });

    if (!activity) {
      throw new NotFoundException(`Activity with ID ${id} not found`);
    }

    return activity;
  }

  async create(orgId: string, userId: string, dto: CreateActivityDto) {
    try {
      // Clean up empty/invalid optional fields
      const data: any = { ...dto, orgId, createdById: userId };
      if (!data.contactId || data.contactId === 'string') delete data.contactId;
      if (!data.accountId || data.accountId === 'string') delete data.accountId;
      if (!data.opportunityId || data.opportunityId === 'string')
        delete data.opportunityId;
      if (!data.assignedToId || data.assignedToId === 'string')
        delete data.assignedToId;

      const activity = await this.prisma.client.activity.create({
        data,
        include: {
          contact: { select: { id: true, firstName: true, lastName: true } },
          account: { select: { id: true, name: true } },
          opportunity: { select: { id: true, name: true } },
        },
      });

      this.logger.log(`Created activity ${activity.id} for org ${orgId}`);
      return activity;
    } catch (error) {
      this.logger.error(
        `Failed to create activity: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async update(id: string, orgId: string, dto: UpdateActivityDto) {
    const existing = await this.prisma.client.activity.findFirst({
      where: { id, orgId },
    });

    if (!existing) {
      throw new NotFoundException(`Activity with ID ${id} not found`);
    }

    const activity = await this.prisma.client.activity.update({
      where: { id },
      data: dto,
      include: {
        contact: { select: { id: true, firstName: true, lastName: true } },
        account: { select: { id: true, name: true } },
        opportunity: { select: { id: true, name: true } },
      },
    });

    this.logger.log(`Updated activity ${id} for org ${orgId}`);
    return activity;
  }

  async delete(id: string, orgId: string) {
    const existing = await this.prisma.client.activity.findFirst({
      where: { id, orgId },
    });

    if (!existing) {
      throw new NotFoundException(`Activity with ID ${id} not found`);
    }

    await this.prisma.client.activity.delete({ where: { id } });
    this.logger.log(`Deleted activity ${id} for org ${orgId}`);

    return { success: true, message: 'Activity deleted successfully' };
  }

  async complete(id: string, orgId: string, outcome?: string) {
    const existing = await this.prisma.client.activity.findFirst({
      where: { id, orgId },
    });

    if (!existing) {
      throw new NotFoundException(`Activity with ID ${id} not found`);
    }

    const activity = await this.prisma.client.activity.update({
      where: { id },
      data: {
        status: 'completed',
        completedAt: new Date(),
        outcome,
      },
    });

    this.logger.log(`Completed activity ${id} for org ${orgId}`);
    return activity;
  }
}
