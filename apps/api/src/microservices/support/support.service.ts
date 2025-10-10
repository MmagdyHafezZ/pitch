import { Injectable, NotFoundException } from '@nestjs/common';
import {
  CreateSupportDto,
  UpdateSupportDto,
  Support,
} from '../../common/interfaces/support.interface';
import { SupportPrismaService } from './support-prisma.service';
import type { PrismaError } from '../../common/interfaces/error.interface';

@Injectable()
export class SupportService {
}
