import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import {
  CreateNoteDto,
  UpdateNoteDto,
  NoteListQueryDto,
} from '../dto/note.dto';
import { createPaginatedResponse } from '../dto/pagination.dto';

@Injectable()
export class NotesService {
  private readonly logger = new Logger(NotesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(orgId: string, query: NoteListQueryDto) {
    const {
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;
    const skip = (page - 1) * limit;

    const where: any = { orgId };

    if (query.contactId) where.contactId = query.contactId;
    if (query.accountId) where.accountId = query.accountId;
    if (query.opportunityId) where.opportunityId = query.opportunityId;
    if (query.isPinned !== undefined) where.isPinned = query.isPinned;

    const [notes, total] = await Promise.all([
      this.prisma.client.note.findMany({
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
      this.prisma.client.note.count({ where }),
    ]);

    return createPaginatedResponse(notes, total, page, limit);
  }

  async findById(id: string, orgId: string) {
    const note = await this.prisma.client.note.findFirst({
      where: { id, orgId },
      include: {
        contact: { select: { id: true, firstName: true, lastName: true } },
        account: { select: { id: true, name: true } },
        opportunity: { select: { id: true, name: true } },
      },
    });

    if (!note) {
      throw new NotFoundException(`Note with ID ${id} not found`);
    }

    return note;
  }

  async create(orgId: string, userId: string, dto: CreateNoteDto) {
    try {
      // Clean up empty/invalid optional fields
      const data: any = { ...dto, orgId, createdById: userId };
      if (!data.contactId || data.contactId === 'string') delete data.contactId;
      if (!data.accountId || data.accountId === 'string') delete data.accountId;
      if (!data.opportunityId || data.opportunityId === 'string')
        delete data.opportunityId;

      const note = await this.prisma.client.note.create({
        data,
      });

      this.logger.log(`Created note ${note.id} for org ${orgId}`);
      return note;
    } catch (error) {
      this.logger.error(`Failed to create note: ${error.message}`, error.stack);
      throw error;
    }
  }

  async update(id: string, orgId: string, dto: UpdateNoteDto) {
    const existing = await this.prisma.client.note.findFirst({
      where: { id, orgId },
    });

    if (!existing) {
      throw new NotFoundException(`Note with ID ${id} not found`);
    }

    const note = await this.prisma.client.note.update({
      where: { id },
      data: dto,
    });

    this.logger.log(`Updated note ${id} for org ${orgId}`);
    return note;
  }

  async delete(id: string, orgId: string) {
    const existing = await this.prisma.client.note.findFirst({
      where: { id, orgId },
    });

    if (!existing) {
      throw new NotFoundException(`Note with ID ${id} not found`);
    }

    await this.prisma.client.note.delete({ where: { id } });
    this.logger.log(`Deleted note ${id} for org ${orgId}`);

    return { success: true, message: 'Note deleted successfully' };
  }

  async togglePin(id: string, orgId: string) {
    const existing = await this.prisma.client.note.findFirst({
      where: { id, orgId },
    });

    if (!existing) {
      throw new NotFoundException(`Note with ID ${id} not found`);
    }

    const note = await this.prisma.client.note.update({
      where: { id },
      data: { isPinned: !existing.isPinned },
    });

    return note;
  }
}
