import { Transport } from '@nestjs/microservices';
import {
  MICROSERVICES_CONFIG,
  createMicroserviceOptions,
  getQueueOptions,
  getRabbitMQUrl,
} from '../microservices.config';

describe('microservices.config', () => {
  const originalEnv = process.env.RABBITMQ_URL;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.RABBITMQ_URL;
    } else {
      process.env.RABBITMQ_URL = originalEnv;
    }
  });

  it('exposes default microservice definitions', () => {
    expect(MICROSERVICES_CONFIG).toEqual([
      { name: 'USER_SERVICE', queue: 'user_queue' },
      { name: 'BUSINESS_SERVICE', queue: 'business_queue' },
      { name: 'AUTH_SERVICE', queue: 'auth_queue' },
    ]);
  });

  it('builds microservice options using the queue name', () => {
    process.env.RABBITMQ_URL = 'amqp://custom';

    const options = createMicroserviceOptions('sample_queue');

    expect(options).toEqual({
      transport: Transport.RMQ,
      options: {
        urls: ['amqp://custom'],
        queue: 'sample_queue',
        noAck: false,
        prefetchCount: 1,
        queueOptions: { durable: true },
      },
    });
  });

  it('falls back to default RabbitMQ URL when environment variable missing', () => {
    delete process.env.RABBITMQ_URL;
    expect(getRabbitMQUrl()).toBe('amqp://localhost:5672');
  });

  it('returns queue options with durable queue', () => {
    expect(getQueueOptions()).toEqual({ durable: true });
  });
});
