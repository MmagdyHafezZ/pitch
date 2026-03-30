import type { Channel } from 'amqplib';
import {
  type AdminQueueStats,
  RabbitMqAdminService,
} from './rabbitmq-admin.service';

type MockChannel = Pick<
  Channel,
  | 'checkQueue'
  | 'close'
  | 'on'
  | 'removeListener'
  | 'get'
  | 'sendToQueue'
  | 'ack'
>;

function createMockChannel(checkQueue: jest.Mock): MockChannel {
  return {
    checkQueue,
    close: jest.fn().mockResolvedValue(undefined),
    on: jest.fn(),
    removeListener: jest.fn(),
    get: jest.fn(),
    sendToQueue: jest.fn(),
    ack: jest.fn(),
  };
}

class TestRabbitMqAdminService extends RabbitMqAdminService {
  inspect(channel: MockChannel, queueName: string): Promise<AdminQueueStats> {
    return this.inspectQueue(channel as Channel, queueName);
  }
}

describe('RabbitMqAdminService', () => {
  it('treats a missing standardized dead-letter queue as absent', async () => {
    const checkQueue = jest.fn().mockImplementation((queueName: string) => {
      if (queueName === 'user_queue') {
        return Promise.resolve({
          messageCount: 4,
          consumerCount: 1,
        });
      }

      return Promise.reject(
        new Error(
          `Channel closed by server: 404 (NOT-FOUND) with message "NOT_FOUND - no queue '${queueName}' in vhost 'pitch_local'"`,
        ),
      );
    });

    const service = new TestRabbitMqAdminService({
      get: jest.fn().mockReturnValue('amqp://localhost/pitch_local'),
    } as never);

    const result = await service.inspect(
      createMockChannel(checkQueue),
      'user_queue',
    );

    expect(result).toEqual({
      name: 'user_queue',
      messageCount: 4,
      consumerCount: 1,
      deadLetterQueue: undefined,
      deadLetterMessageCount: null,
      status: 'ok',
    });
  });

  it('returns an error status when the main queue is missing', async () => {
    const missingQueueError = new Error(
      `Channel closed by server: 404 (NOT-FOUND) with message "NOT_FOUND - no queue 'user_queue' in vhost 'pitch_local'"`,
    );

    const service = new TestRabbitMqAdminService({
      get: jest.fn().mockReturnValue('amqp://localhost/pitch_local'),
    } as never);

    const result = await service.inspect(
      createMockChannel(jest.fn().mockRejectedValue(missingQueueError)),
      'user_queue',
    );

    expect(result).toEqual({
      name: 'user_queue',
      messageCount: null,
      consumerCount: null,
      status: 'error',
      error: missingQueueError.message,
    });
  });
});
