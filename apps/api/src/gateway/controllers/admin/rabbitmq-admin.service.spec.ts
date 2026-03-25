import { RabbitMqAdminService } from './rabbitmq-admin.service';

function createMockChannel(checkQueue: jest.Mock) {
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

describe('RabbitMqAdminService', () => {
  it('treats a missing standardized dead-letter queue as absent', async () => {
    const checkQueue = jest
      .fn()
      .mockImplementation(async (queueName: string) => {
        if (queueName === 'user_queue') {
          return {
            messageCount: 4,
            consumerCount: 1,
          };
        }

        throw new Error(
          `Channel closed by server: 404 (NOT-FOUND) with message "NOT_FOUND - no queue '${queueName}' in vhost 'pitch_local'"`,
        );
      });

    const service = new RabbitMqAdminService({
      get: jest.fn().mockReturnValue('amqp://localhost/pitch_local'),
    } as never);

    const result = await (service as any).inspectQueue(
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

    const service = new RabbitMqAdminService({
      get: jest.fn().mockReturnValue('amqp://localhost/pitch_local'),
    } as never);

    const result = await (service as any).inspectQueue(
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
