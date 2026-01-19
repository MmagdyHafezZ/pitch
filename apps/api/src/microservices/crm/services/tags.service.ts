import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { CreateTagDto, UpdateTagDto } from '../dto/tag.dto';

@Injectable()
export class TagsService {
  private readonly logger = new Logger(TagsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(orgId: string) {
    const tags = await this.prisma.client.tag.findMany({
      where: { orgId },
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { contacts: true } },
      },
    });

    return tags;
  }

  async findById(id: string, orgId: string) {
    const tag = await this.prisma.client.tag.findFirst({
      where: { id, orgId },
      include: {
        _count: { select: { contacts: true } },
      },
    });

    if (!tag) {
      throw new NotFoundException(`Tag with ID ${id} not found`);
    }

    return tag;
  }

  async create(orgId: string, dto: CreateTagDto) {
    // Check for duplicate name
    const existing = await this.prisma.client.tag.findFirst({
      where: { orgId, name: dto.name },
    });

    if (existing) {
      throw new ConflictException(`Tag with name "${dto.name}" already exists`);
    }

    const tag = await this.prisma.client.tag.create({
      data: { ...dto, orgId },
    });

    this.logger.log(`Created tag ${tag.id} for org ${orgId}`);
    return tag;
  }

  async update(id: string, orgId: string, dto: UpdateTagDto) {
    const existing = await this.prisma.client.tag.findFirst({
      where: { id, orgId },
    });

    if (!existing) {
      throw new NotFoundException(`Tag with ID ${id} not found`);
    }

    // Check for duplicate name if name is being updated
    if (dto.name && dto.name !== existing.name) {
      const duplicate = await this.prisma.client.tag.findFirst({
        where: { orgId, name: dto.name, NOT: { id } },
      });

      if (duplicate) {
        throw new ConflictException(
          `Tag with name "${dto.name}" already exists`,
        );
      }
    }

    const tag = await this.prisma.client.tag.update({
      where: { id },
      data: dto,
    });

    this.logger.log(`Updated tag ${id} for org ${orgId}`);
    return tag;
  }

  async delete(id: string, orgId: string) {
    const existing = await this.prisma.client.tag.findFirst({
      where: { id, orgId },
    });

    if (!existing) {
      throw new NotFoundException(`Tag with ID ${id} not found`);
    }

    await this.prisma.client.tag.delete({ where: { id } });
    this.logger.log(`Deleted tag ${id} for org ${orgId}`);

    return { success: true, message: 'Tag deleted successfully' };
  }
}
