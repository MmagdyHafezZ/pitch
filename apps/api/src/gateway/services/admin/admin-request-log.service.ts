import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  IAdminRequestLog,
  AdminRequestLogModel,
} from '../../schemas/admin-request-log.schema';

@Injectable()
export class AdminRequestLogService {
  constructor(
    @InjectModel(AdminRequestLogModel, 'gateway')
    private readonly model: Model<IAdminRequestLog>,
  ) {}

  async log(entry: {
    adminEmail: string;
    method: string;
    path: string;
    statusCode: number;
    durationMs: number;
  }): Promise<void> {
    await this.model.create({ ...entry, timestamp: new Date() });
  }

  async findAll(
    limit = 50,
    offset = 0,
  ): Promise<{ logs: IAdminRequestLog[]; total: number }> {
    const [logs, total] = await Promise.all([
      this.model
        .find()
        .sort({ timestamp: -1 })
        .skip(offset)
        .limit(limit)
        .lean()
        .exec(),
      this.model.countDocuments().exec(),
    ]);
    return { logs: logs as unknown as IAdminRequestLog[], total };
  }
}
