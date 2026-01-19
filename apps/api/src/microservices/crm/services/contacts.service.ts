import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import {
  CreateContactDto,
  UpdateContactDto,
  ContactListQueryDto,
} from '../dto/contact.dto';
import { createPaginatedResponse } from '../dto/pagination.dto';

@Injectable()
export class ContactsService {
  private readonly logger = new Logger(ContactsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(orgId: string, query: ContactListQueryDto) {
    const {
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;
    const skip = (page - 1) * limit;

    const where: any = { orgId };

    // Apply filters
    if (query.status) where.status = query.status;
    if (query.leadStatus) where.leadStatus = query.leadStatus;
    if (query.customerType) where.customerType = query.customerType;
    if (query.accountId) where.accountId = query.accountId;
    if (query.ownerId) where.ownerId = query.ownerId;

    // Search by name or email
    if (query.search) {
      where.OR = [
        { firstName: { contains: query.search, mode: 'insensitive' } },
        { lastName: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [contacts, total] = await Promise.all([
      this.prisma.client.contact.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          account: { select: { id: true, name: true } },
          tags: { include: { tag: true } },
        },
      }),
      this.prisma.client.contact.count({ where }),
    ]);

    // Transform tags
    const transformedContacts = contacts.map((c) => ({
      ...c,
      tags: c.tags.map((t) => t.tag),
    }));

    return createPaginatedResponse(transformedContacts, total, page, limit);
  }

  async findById(id: string, orgId: string) {
    const contact = await this.prisma.client.contact.findFirst({
      where: { id, orgId },
      include: {
        account: { select: { id: true, name: true } },
        tags: { include: { tag: true } },
        opportunities: {
          select: { id: true, name: true, stage: true, amount: true },
        },
        activities: { orderBy: { createdAt: 'desc' }, take: 10 },
        notes: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    });

    if (!contact) {
      throw new NotFoundException(`Contact with ID ${id} not found`);
    }

    return {
      ...contact,
      tags: contact.tags.map((t) => t.tag),
    };
  }

  async create(orgId: string, dto: CreateContactDto) {
    try {
      const { tagIds, ...inputData } = dto;

      // Clean up empty/invalid optional fields
      const data: any = { ...inputData, orgId };
      if (!data.accountId || data.accountId === 'string') delete data.accountId;
      if (!data.ownerId || data.ownerId === 'string') delete data.ownerId;
      if (data.nextFollowUpAt === 'string') delete data.nextFollowUpAt;

      // Filter out invalid tag IDs
      const validTagIds = tagIds?.filter((id) => id && id !== 'string') || [];

      const contact = await this.prisma.client.contact.create({
        data: {
          ...data,
          ...(validTagIds.length && {
            tags: {
              create: validTagIds.map((tagId) => ({ tagId })),
            },
          }),
        },
        include: {
          account: { select: { id: true, name: true } },
          tags: { include: { tag: true } },
        },
      });

      this.logger.log(`Created contact ${contact.id} for org ${orgId}`);

      return {
        ...contact,
        tags: contact.tags.map((t) => t.tag),
      };
    } catch (error) {
      this.logger.error(
        `Failed to create contact: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async update(id: string, orgId: string, dto: UpdateContactDto) {
    // First check if contact exists
    const existing = await this.prisma.client.contact.findFirst({
      where: { id, orgId },
    });

    if (!existing) {
      throw new NotFoundException(`Contact with ID ${id} not found`);
    }

    const { tagIds, ...data } = dto;

    // Update contact and optionally tags
    const contact = await this.prisma.client.contact.update({
      where: { id },
      data: {
        ...data,
        ...(tagIds !== undefined && {
          tags: {
            deleteMany: {},
            create: tagIds.map((tagId) => ({ tagId })),
          },
        }),
      },
      include: {
        account: { select: { id: true, name: true } },
        tags: { include: { tag: true } },
      },
    });

    this.logger.log(`Updated contact ${id} for org ${orgId}`);

    return {
      ...contact,
      tags: contact.tags.map((t) => t.tag),
    };
  }

  async delete(id: string, orgId: string) {
    const existing = await this.prisma.client.contact.findFirst({
      where: { id, orgId },
    });

    if (!existing) {
      throw new NotFoundException(`Contact with ID ${id} not found`);
    }

    await this.prisma.client.contact.delete({ where: { id } });

    this.logger.log(`Deleted contact ${id} for org ${orgId}`);

    return { success: true, message: 'Contact deleted successfully' };
  }

  async assignTags(id: string, orgId: string, tagIds: string[]) {
    const existing = await this.prisma.client.contact.findFirst({
      where: { id, orgId },
    });

    if (!existing) {
      throw new NotFoundException(`Contact with ID ${id} not found`);
    }

    // Replace all tags
    await this.prisma.client.contactTag.deleteMany({
      where: { contactId: id },
    });

    if (tagIds.length > 0) {
      await this.prisma.client.contactTag.createMany({
        data: tagIds.map((tagId) => ({ contactId: id, tagId })),
      });
    }

    return this.findById(id, orgId);
  }

  async addTag(id: string, orgId: string, tagId: string) {
    const existing = await this.prisma.client.contact.findFirst({
      where: { id, orgId },
    });

    if (!existing) {
      throw new NotFoundException(`Contact with ID ${id} not found`);
    }

    await this.prisma.client.contactTag.upsert({
      where: { contactId_tagId: { contactId: id, tagId } },
      create: { contactId: id, tagId },
      update: {},
    });

    return this.findById(id, orgId);
  }

  async removeTag(id: string, orgId: string, tagId: string) {
    const existing = await this.prisma.client.contact.findFirst({
      where: { id, orgId },
    });

    if (!existing) {
      throw new NotFoundException(`Contact with ID ${id} not found`);
    }

    await this.prisma.client.contactTag.deleteMany({
      where: { contactId: id, tagId },
    });

    return { success: true, message: 'Tag removed successfully' };
  }
}
