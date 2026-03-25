import { connect } from 'amqplib';
import {
  getDeadLetterQueueOptions,
  getQueueOptions,
} from '../microservices.config';
import {
  RABBITMQ_DEAD_LETTER_EXCHANGE,
  buildRabbitMqQueueTopology,
  getDeadLetterQueueName,
  provisionRabbitMqTopology,
} from '../rabbitmq-topology';

jest.mock('amqplib', () => ({
  connect: jest.fn(),
}));

describe('rabbitmq-topology', () => {
  const mockConnect = connect as jest.MockedFunction<typeof connect>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('builds the standardized dead-letter queue name', () => {
    expect(getDeadLetterQueueName('user_queue')).toBe('user_queue.dlq');
  });

  it('provisions queues, DLQs, and DLX bindings for the requested topology', async () => {
    const channel = {
      on: jest.fn(),
      assertExchange: jest.fn().mockResolvedValue(undefined),
      assertQueue: jest.fn().mockResolvedValue(undefined),
      bindQueue: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
    };
    const connection = {
      createChannel: jest.fn().mockResolvedValue(channel),
      close: jest.fn().mockResolvedValue(undefined),
    };

    mockConnect.mockResolvedValue(connection as never);

    const topology = [
      buildRabbitMqQueueTopology('user_queue'),
      buildRabbitMqQueueTopology('support_queue'),
    ];

    await provisionRabbitMqTopology('amqp://localhost/pitch_local', topology);

    expect(channel.assertExchange).toHaveBeenCalledWith(
      RABBITMQ_DEAD_LETTER_EXCHANGE,
      'direct',
      { durable: true },
    );

    expect(channel.assertQueue).toHaveBeenNthCalledWith(
      1,
      'user_queue',
      getQueueOptions('amqp://localhost/pitch_local'),
    );
    expect(channel.assertQueue).toHaveBeenNthCalledWith(2, 'user_queue.dlq', {
      durable: true,
    });
    expect(channel.assertQueue).toHaveBeenNthCalledWith(
      3,
      'support_queue',
      getQueueOptions('amqp://localhost/pitch_local'),
    );
    expect(channel.assertQueue).toHaveBeenNthCalledWith(
      4,
      'support_queue.dlq',
      { durable: true },
    );

    expect(channel.bindQueue).toHaveBeenNthCalledWith(
      1,
      'user_queue.dlq',
      RABBITMQ_DEAD_LETTER_EXCHANGE,
      'user_queue',
    );
    expect(channel.bindQueue).toHaveBeenNthCalledWith(
      2,
      'support_queue.dlq',
      RABBITMQ_DEAD_LETTER_EXCHANGE,
      'support_queue',
    );
    expect(channel.close).toHaveBeenCalledTimes(1);
    expect(connection.close).toHaveBeenCalledTimes(1);
  });

  it('uses explicit dead-letter queue arguments outside the local definitions vhost', async () => {
    const channel = {
      on: jest.fn(),
      assertExchange: jest.fn().mockResolvedValue(undefined),
      assertQueue: jest.fn().mockResolvedValue(undefined),
      bindQueue: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
    };
    const connection = {
      createChannel: jest.fn().mockResolvedValue(channel),
      close: jest.fn().mockResolvedValue(undefined),
    };

    mockConnect.mockResolvedValue(connection as never);

    await provisionRabbitMqTopology('amqp://localhost/pitch_prod', [
      buildRabbitMqQueueTopology('user_queue'),
    ]);

    expect(channel.assertQueue).toHaveBeenNthCalledWith(
      1,
      'user_queue',
      getDeadLetterQueueOptions(),
    );
    expect(channel.assertQueue).toHaveBeenNthCalledWith(2, 'user_queue.dlq', {
      durable: true,
    });
    expect(channel.bindQueue).toHaveBeenCalledWith(
      'user_queue.dlq',
      RABBITMQ_DEAD_LETTER_EXCHANGE,
      'user_queue',
    );
    expect(channel.close).toHaveBeenCalledTimes(1);
    expect(connection.createChannel).toHaveBeenCalledTimes(1);
    expect(connection.close).toHaveBeenCalledTimes(1);
  });
});
