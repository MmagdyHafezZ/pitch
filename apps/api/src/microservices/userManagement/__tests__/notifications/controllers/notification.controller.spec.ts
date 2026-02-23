/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/unbound-method */
import { NotificationController } from '../../../notifications/controllers/notification.controller';
import type { NotificationService } from '../../../notifications/service/notification.service';

describe('NotificationController', () => {
  let controller: NotificationController;
  let service: jest.Mocked<NotificationService>;

  beforeEach(() => {
    service = {
      createOne: jest.fn(),
      createBatch: jest.fn(),
      list: jest.fn(),
      unreadCount: jest.fn(),
      markRead: jest.fn(),
      markAllRead: jest.fn(),
    } as unknown as jest.Mocked<NotificationService>;

    controller = new NotificationController(service);
  });

  it('delegates createOne/createBatch/list', async () => {
    service.createOne.mockResolvedValue({ id: 'n1' } as any);
    service.createBatch.mockResolvedValue({
      insertedCount: 1,
      notifications: [],
    } as any);
    service.list.mockResolvedValue({
      data: [],
      total: 0,
      skip: 0,
      limit: 20,
    } as any);

    await expect(controller.createOne({ title: 'T' } as any)).resolves.toEqual({
      id: 'n1',
    });
    await expect(
      controller.createBatch({ recipientUserIds: ['u1'] } as any),
    ).resolves.toEqual({ insertedCount: 1, notifications: [] });
    await expect(
      controller.list({ recipientUserId: 'u1' } as any),
    ).resolves.toEqual({ data: [], total: 0, skip: 0, limit: 20 });
  });

  it('returns unread count payload shape', async () => {
    service.unreadCount.mockResolvedValue(5);

    await expect(controller.unreadCount('u1')).resolves.toEqual({ count: 5 });
    expect(service.unreadCount).toHaveBeenCalledWith('u1');
  });

  it('delegates markRead and markAllRead', async () => {
    service.markRead.mockResolvedValue({ matched: 2, modified: 2 });
    service.markAllRead.mockResolvedValue({ matched: 3, modified: 3 });

    await expect(
      controller.markRead({ notificationIds: ['id'] } as any),
    ).resolves.toEqual({ matched: 2, modified: 2 });
    await expect(controller.markAllRead('u1')).resolves.toEqual({
      matched: 3,
      modified: 3,
    });
  });
});
