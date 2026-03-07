import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { Model, Types } from 'mongoose';
import { MongoConnectionService } from '../../mongo/mongo-connection.service';
import {
  Notification,
  NotificationSchema,
  NotificationSeverity,
  NotificationSourceType,
} from '../../mongo/schemas/notification.schema';
import {
  CreateNotificationDto,
  CreateNotificationBatchDto,
  ListNotificationsQueryDto,
  MarkReadDto,
  NotificationDto,
  ListNotificationsResponseDto,
  BatchCreateResponseDto,
  MarkReadResponseDto,
} from '../dto/notification.dto';

const NOTIFICATION_MODEL = Notification.name;

type NotificationRecord = {
  _id: unknown;
  recipientUserId: string;
  title: string;
  message: string;
  type: string;
  severity?: NotificationSeverity;
  sourceType?: NotificationSourceType;
  sourceUserId?: string | null;
  metadata?: Record<string, unknown>;
  readAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
};

@Injectable()
export class NotificationService {
  constructor(private readonly mongo: MongoConnectionService) {}

  private async getModel(): Promise<Model<Notification>> {
    const connected = await this.mongo.waitUntilConnected(10000);
    if (!connected) {
      throw new ServiceUnavailableException(
        'Notifications storage is not available',
      );
    }
    return this.mongo.getModel<Notification>(
      NOTIFICATION_MODEL,
      NotificationSchema,
    );
  }

  private toDto(doc: NotificationRecord): NotificationDto {
    const idValue = doc._id;
    let id = '';

    if (typeof idValue === 'string') {
      id = idValue;
    } else if (typeof idValue === 'number' || typeof idValue === 'bigint') {
      id = idValue.toString();
    } else if (
      typeof idValue === 'object' &&
      idValue !== null &&
      idValue instanceof Types.ObjectId
    ) {
      id = idValue.toString();
    }
    return {
      id,
      recipientUserId: doc.recipientUserId,
      title: doc.title,
      message: doc.message,
      type: doc.type,
      severity: doc.severity ?? NotificationSeverity.INFO,
      sourceType: doc.sourceType ?? NotificationSourceType.SYSTEM,
      sourceUserId: doc.sourceUserId ?? undefined,
      metadata: doc.metadata ?? undefined,
      readAt: doc.readAt ?? null,
      createdAt: doc.createdAt ?? new Date(),
      updatedAt: doc.updatedAt ?? new Date(),
    };
  }

  async createOne(dto: CreateNotificationDto): Promise<NotificationDto> {
    const model = await this.getModel();
    const created = await model.create({
      ...dto,
      readAt: null,
    });
    return this.toDto(created.toObject() as NotificationRecord);
  }

  async createBatch(
    dto: CreateNotificationBatchDto,
  ): Promise<BatchCreateResponseDto> {
    const model = await this.getModel();
    const payload = dto.recipientUserIds.map((recipientUserId) => ({
      recipientUserId,
      title: dto.title,
      message: dto.message,
      type: dto.type,
      severity: dto.severity ?? NotificationSeverity.INFO,
      sourceType: dto.sourceType,
      sourceUserId: dto.sourceUserId,
      metadata: dto.metadata ?? {},
      readAt: null,
    }));
    const inserted = await model.insertMany(payload);
    return {
      insertedCount: inserted.length,
      notifications: inserted.map((doc) =>
        this.toDto(doc.toObject() as NotificationRecord),
      ),
    };
  }

  async list(
    query: ListNotificationsQueryDto,
  ): Promise<ListNotificationsResponseDto> {
    const model = await this.getModel();
    const filter: Record<string, unknown> = {};

    if (query.recipientUserId) {
      filter.recipientUserId = query.recipientUserId;
    }

    if (query.unreadOnly) {
      filter.readAt = null;
    }

    if (query.type) {
      filter.type = query.type;
    }

    const skip = query.skip ?? 0;
    const limit = query.limit ?? 20;

    const [data, total] = await Promise.all([
      model
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      model.countDocuments(filter),
    ]);

    return {
      data: data.map((doc) => this.toDto(doc as NotificationRecord)),
      total,
      skip,
      limit,
    };
  }

  async unreadCount(recipientUserId: string): Promise<number> {
    const model = await this.getModel();
    return model.countDocuments({ recipientUserId, readAt: null });
  }

  async markRead(dto: MarkReadDto): Promise<MarkReadResponseDto> {
    const model = await this.getModel();
    const ids = dto.notificationIds.map((id) => new Types.ObjectId(id));
    const filter: Record<string, unknown> = { _id: { $in: ids } };

    if (dto.recipientUserId) {
      filter.recipientUserId = dto.recipientUserId;
    }

    const result = await model.updateMany(filter, {
      $set: { readAt: new Date() },
    });

    return {
      matched: result.matchedCount ?? 0,
      modified: result.modifiedCount ?? 0,
    };
  }

  async markAllRead(recipientUserId: string): Promise<MarkReadResponseDto> {
    const model = await this.getModel();
    const result = await model.updateMany(
      { recipientUserId, readAt: null },
      { $set: { readAt: new Date() } },
    );
    return {
      matched: result.matchedCount ?? 0,
      modified: result.modifiedCount ?? 0,
    };
  }
}
