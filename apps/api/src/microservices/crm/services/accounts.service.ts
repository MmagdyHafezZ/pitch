import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import {
  CreateAccountDto,
  UpdateAccountDto,
  AccountListQueryDto,
} from '../dto/account.dto';
import { createPaginatedResponse } from '../dto/pagination.dto';

@Injectable()
export class AccountsService {
  private readonly logger = new Logger(AccountsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(orgId: string, query: AccountListQueryDto) {
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
    if (query.industry) where.industry = query.industry;
    if (query.ownerId) where.ownerId = query.ownerId;

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { domain: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [accounts, total] = await Promise.all([
      this.prisma.client.account.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          _count: { select: { contacts: true, opportunities: true } },
        },
      }),
      this.prisma.client.account.count({ where }),
    ]);

    return createPaginatedResponse(accounts, total, page, limit);
  }

  async findById(id: string, orgId: string) {
    const account = await this.prisma.client.account.findFirst({
      where: { id, orgId },
      include: {
        contacts: { take: 10, orderBy: { createdAt: 'desc' } },
        opportunities: { take: 10, orderBy: { createdAt: 'desc' } },
        activities: { take: 10, orderBy: { createdAt: 'desc' } },
        notes: { take: 10, orderBy: { createdAt: 'desc' } },
        parentAccount: { select: { id: true, name: true } },
        childAccounts: { select: { id: true, name: true } },
        _count: { select: { contacts: true, opportunities: true } },
      },
    });

    if (!account) {
      throw new NotFoundException(`Account with ID ${id} not found`);
    }

    return account;
  }

  async create(orgId: string, dto: CreateAccountDto) {
    try {
      // Clean up empty/invalid optional fields
      const data: any = { ...dto, orgId };
      if (!data.parentAccountId || data.parentAccountId === 'string')
        delete data.parentAccountId;
      if (!data.ownerId || data.ownerId === 'string') delete data.ownerId;

      const account = await this.prisma.client.account.create({
        data,
        include: {
          _count: { select: { contacts: true, opportunities: true } },
        },
      });

      this.logger.log(`Created account ${account.id} for org ${orgId}`);
      return account;
    } catch (error) {
      this.logger.error(
        `Failed to create account: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async update(id: string, orgId: string, dto: UpdateAccountDto) {
    const existing = await this.prisma.client.account.findFirst({
      where: { id, orgId },
    });

    if (!existing) {
      throw new NotFoundException(`Account with ID ${id} not found`);
    }

    const account = await this.prisma.client.account.update({
      where: { id },
      data: dto,
      include: {
        _count: { select: { contacts: true, opportunities: true } },
      },
    });

    this.logger.log(`Updated account ${id} for org ${orgId}`);
    return account;
  }

  async delete(id: string, orgId: string) {
    const existing = await this.prisma.client.account.findFirst({
      where: { id, orgId },
    });

    if (!existing) {
      throw new NotFoundException(`Account with ID ${id} not found`);
    }

    await this.prisma.client.account.delete({ where: { id } });
    this.logger.log(`Deleted account ${id} for org ${orgId}`);

    return { success: true, message: 'Account deleted successfully' };
  }

  async getContacts(id: string, orgId: string) {
    const account = await this.prisma.client.account.findFirst({
      where: { id, orgId },
    });

    if (!account) {
      throw new NotFoundException(`Account with ID ${id} not found`);
    }

    return this.prisma.client.contact.findMany({
      where: { accountId: id, orgId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getOpportunities(id: string, orgId: string) {
    const account = await this.prisma.client.account.findFirst({
      where: { id, orgId },
    });

    if (!account) {
      throw new NotFoundException(`Account with ID ${id} not found`);
    }

    return this.prisma.client.opportunity.findMany({
      where: { accountId: id, orgId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
