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
      { name: 'SIMULATION_SERVICE', queue: 'simulation_queue' },
      { name: 'ANALYTICS_SERVICE', queue: 'analytics_queue' },
      { name: 'SUPPORT_SERVICE', queue: 'support_queue' },
      { name: 'LTI_SERVICE', queue: 'lti_queue' },
      { name: 'S3_SERVICE', queue: 's3_queue' },
      { name: 'CRM_SERVICE', queue: 'crm_queue' },
      { name: 'GATEWAY_SERVICE', queue: 'gateway_queue' },
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
        prefetchCount: 10,
        queueOptions: { durable: true },
      },
    });
  });

  it('throws error when RABBITMQ_URL environment variable is missing', () => {
    delete process.env.RABBITMQ_URL;
    expect(() => getRabbitMQUrl()).toThrow(
      'RABBITMQ_URL environment variable is required. Format: amqp://username:password@host:port/vhost',
    );
  });

  it('returns queue options with durable queue', () => {
    expect(getQueueOptions()).toEqual({ durable: true });
  });
});
