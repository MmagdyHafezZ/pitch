import { ServiceUnavailableException } from '@nestjs/common';
import { Types } from 'mongoose';
import { MongoConnectionService } from '../../../services/mongo/mongo-connection.service';
import { NotificationService } from '../../../notifications/service/notification.service';
import {
  NotificationSeverity,
  NotificationSourceType,
} from '../../../notifications/schema/notification.schema';

describe('NotificationService', () => {
  let service: NotificationService;
  let mongo: jest.Mocked<MongoConnectionService>;
  let model: any;

  beforeEach(() => {
    model = {
      create: jest.fn(),
      insertMany: jest.fn(),
      find: jest.fn(),
      countDocuments: jest.fn(),
      updateMany: jest.fn(),
    };

    mongo = {
      isConnected: jest.fn().mockReturnValue(true),
      getModel: jest.fn().mockReturnValue(model),
    } as unknown as jest.Mocked<MongoConnectionService>;

    service = new NotificationService(mongo);
  });

  it('throws service unavailable when mongo is disconnected', async () => {
    mongo.isConnected.mockReturnValue(false);

    await expect(
      service.createOne({
        recipientUserId: 'u1',
        title: 'T',
        message: 'M',
        type: 'SYSTEM',
        sourceType: NotificationSourceType.SYSTEM,
      } as any),
    ).rejects.toThrow(ServiceUnavailableException);
  });

  it('creates a notification and maps defaults/objectId to dto', async () => {
    const id = new Types.ObjectId();
    model.create.mockResolvedValue({
      _id: id,
      recipientUserId: 'u1',
      title: 'Title',
      message: 'Message',
      type: 'SESSION',
      sourceType: NotificationSourceType.SYSTEM,
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
      updatedAt: new Date('2024-01-01T00:00:00.000Z'),
      readAt: null,
    });

    const result = await service.createOne({
      recipientUserId: 'u1',
      title: 'Title',
      message: 'Message',
      type: 'SESSION',
      sourceType: NotificationSourceType.SYSTEM,
    } as any);

    expect(model.create).toHaveBeenCalledWith(
      expect.objectContaining({ readAt: null }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        id: id.toString(),
        severity: NotificationSeverity.INFO,
        sourceType: NotificationSourceType.SYSTEM,
        readAt: null,
      }),
    );
  });

  it('creates notifications in batch with defaults', async () => {
    model.insertMany.mockResolvedValue([
      {
        _id: new Types.ObjectId(),
        recipientUserId: 'u1',
        title: 'System maintenance',
        message: 'Planned',
        type: 'SYSTEM',
        sourceType: NotificationSourceType.SYSTEM,
        severity: NotificationSeverity.WARNING,
        metadata: { window: '02:00' },
        readAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const result = await service.createBatch({
      recipientUserIds: ['u1'],
      title: 'System maintenance',
      message: 'Planned',
      type: 'SYSTEM',
      severity: NotificationSeverity.WARNING,
      sourceType: NotificationSourceType.SYSTEM,
      metadata: { window: '02:00' },
    } as any);

    expect(model.insertMany).toHaveBeenCalledWith([
      expect.objectContaining({ recipientUserId: 'u1', readAt: null }),
    ]);
    expect(result.insertedCount).toBe(1);
    expect(result.notifications[0].severity).toBe(NotificationSeverity.WARNING);
  });

  it('lists notifications using filters and pagination', async () => {
    const exec = jest.fn().mockResolvedValue([
      {
        _id: 'abc123',
        recipientUserId: 'u1',
        title: 'T',
        message: 'M',
        type: 'SESSION',
        sourceType: NotificationSourceType.USER,
        sourceUserId: 'u2',
        metadata: { sessionId: 's1' },
        readAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    const limit = jest.fn().mockReturnValue({ exec });
    const skip = jest.fn().mockReturnValue({ limit });
    const sort = jest.fn().mockReturnValue({ skip });
    model.find.mockReturnValue({ sort });
    model.countDocuments.mockResolvedValue(1);

    const result = await service.list({
      recipientUserId: 'u1',
      unreadOnly: true,
      type: 'SESSION',
      skip: 5,
      limit: 10,
    } as any);

    expect(model.find).toHaveBeenCalledWith({
      recipientUserId: 'u1',
      readAt: null,
      type: 'SESSION',
    });
    expect(sort).toHaveBeenCalledWith({ createdAt: -1 });
    expect(skip).toHaveBeenCalledWith(5);
    expect(limit).toHaveBeenCalledWith(10);
    expect(result.total).toBe(1);
    expect(result.skip).toBe(5);
    expect(result.limit).toBe(10);
  });

  it('returns unread count for a user', async () => {
    model.countDocuments.mockResolvedValue(3);

    await expect(service.unreadCount('u1')).resolves.toBe(3);
    expect(model.countDocuments).toHaveBeenCalledWith({
      recipientUserId: 'u1',
      readAt: null,
    });
  });

  it('marks selected notifications as read with optional recipient filter', async () => {
    model.updateMany.mockResolvedValue({ matchedCount: 2, modifiedCount: 2 });
    const ids = [
      new Types.ObjectId().toString(),
      new Types.ObjectId().toString(),
    ];

    const result = await service.markRead({
      notificationIds: ids,
      recipientUserId: 'u1',
    } as any);

    expect(model.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: { $in: expect.any(Array) },
        recipientUserId: 'u1',
      }),
      { $set: { readAt: expect.any(Date) } },
    );
    expect(result).toEqual({ matched: 2, modified: 2 });
  });

  it('marks all unread notifications as read for a user', async () => {
    model.updateMany.mockResolvedValue({ matchedCount: 4, modifiedCount: 3 });

    await expect(service.markAllRead('u1')).resolves.toEqual({
      matched: 4,
      modified: 3,
    });
    expect(model.updateMany).toHaveBeenCalledWith(
      { recipientUserId: 'u1', readAt: null },
      { $set: { readAt: expect.any(Date) } },
    );
  });
});
