import { Transport } from '@nestjs/microservices';
import {
  MICROSERVICES_CONFIG,
  createMicroserviceOptions,
  getQueueOptions,
  getRabbitMQUrl,
  getRabbitMQUrls,
} from '../microservices.config';

describe('microservices.config', () => {
  const originalEnv = process.env.RABBITMQ_URL;
  const originalSecondaryEnv = process.env.RABBITMQ_URL_SECONDARY;
  const originalCloudEnv = process.env.CLOUDAMQP_URL;
  const originalCloudSecondaryEnv = process.env.CLOUDAMQP_URL_SECONDARY;
  const originalDepMode = process.env.DEP_MODE;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.RABBITMQ_URL;
    } else {
      process.env.RABBITMQ_URL = originalEnv;
    }
    if (originalSecondaryEnv === undefined) {
      delete process.env.RABBITMQ_URL_SECONDARY;
    } else {
      process.env.RABBITMQ_URL_SECONDARY = originalSecondaryEnv;
    }
    if (originalCloudEnv === undefined) {
      delete process.env.CLOUDAMQP_URL;
    } else {
      process.env.CLOUDAMQP_URL = originalCloudEnv;
    }
    if (originalCloudSecondaryEnv === undefined) {
      delete process.env.CLOUDAMQP_URL_SECONDARY;
    } else {
      process.env.CLOUDAMQP_URL_SECONDARY = originalCloudSecondaryEnv;
    }
    if (originalDepMode === undefined) {
      delete process.env.DEP_MODE;
    } else {
      process.env.DEP_MODE = originalDepMode;
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
      { name: 'JOBS_SERVICE', queue: 'jobs_queue' },
      { name: 'GATEWAY_SERVICE', queue: 'gateway_queue' },
    ]);
  });

  it('builds microservice options using the queue name', () => {
    process.env.DEP_MODE = 'local';
    process.env.RABBITMQ_URL = 'amqp://custom-primary';
    process.env.RABBITMQ_URL_SECONDARY = 'amqp://custom-secondary';

    const options = createMicroserviceOptions('sample_queue');

    expect(options).toEqual({
      transport: Transport.RMQ,
      options: {
        urls: ['amqp://custom-primary', 'amqp://custom-secondary'],
        queue: 'sample_queue',
        noAck: true,
        prefetchCount: 10,
        queueOptions: { durable: true },
        socketOptions: {
          heartbeatIntervalInSeconds: 60,
        },
      },
    });
  });

  it('uses CloudAMQP when DEP_MODE is prod', () => {
    process.env.DEP_MODE = 'prod';
    process.env.CLOUDAMQP_URL = 'amqp://cloud';
    process.env.CLOUDAMQP_URL_SECONDARY = 'amqp://cloud-secondary';

    expect(getRabbitMQUrl()).toBe('amqp://cloud');
    expect(getRabbitMQUrls()).toEqual([
      'amqp://cloud',
      'amqp://cloud-secondary',
    ]);
  });

  it('falls back to RABBITMQ_URL_SECONDARY alias in prod when cloud secondary is unset', () => {
    process.env.DEP_MODE = 'production';
    process.env.CLOUDAMQP_URL = 'amqp://cloud-primary';
    delete process.env.CLOUDAMQP_URL_SECONDARY;
    process.env.RABBITMQ_URL_SECONDARY = 'amqp://rabbit-secondary';

    expect(getRabbitMQUrls()).toEqual([
      'amqp://cloud-primary',
      'amqp://rabbit-secondary',
    ]);
  });

  it('returns only primary URL when no secondary URL is configured', () => {
    process.env.DEP_MODE = 'local';
    process.env.RABBITMQ_URL = 'amqp://primary-only';
    delete process.env.RABBITMQ_URL_SECONDARY;

    expect(getRabbitMQUrls()).toEqual(['amqp://primary-only']);
  });

  it('throws error when RABBITMQ_URL environment variable is missing', () => {
    process.env.DEP_MODE = 'local';
    delete process.env.RABBITMQ_URL;
    expect(() => getRabbitMQUrl()).toThrow(
      'RABBITMQ_URL environment variable is required. Format: amqp://username:password@host:port/vhost',
    );
  });

  it('throws error when CLOUDAMQP_URL environment variable is missing in prod', () => {
    process.env.DEP_MODE = 'prod';
    delete process.env.CLOUDAMQP_URL;
    expect(() => getRabbitMQUrl()).toThrow(
      'CLOUDAMQP_URL environment variable is required. Format: amqp://username:password@host:port/vhost',
    );
  });

  it('returns queue options with durable queue', () => {
    expect(getQueueOptions()).toEqual({ durable: true });
  });
});
