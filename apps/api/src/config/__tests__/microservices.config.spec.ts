import { Transport } from '@nestjs/microservices';
import {
  MICROSERVICES_CONFIG,
  RABBITMQ_DEAD_LETTER_EXCHANGE,
  createMicroserviceOptions,
  getDeadLetterQueueOptions,
  getQueueOptions,
  getRabbitMQUrl,
  usesRabbitMqPolicyDeadLettering,
} from '../microservices.config';

describe('microservices.config', () => {
  const originalEnv = process.env.RABBITMQ_URL;
  const originalCloudEnv = process.env.CLOUDAMQP_URL;
  const originalDepMode = process.env.DEP_MODE;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.RABBITMQ_URL;
    } else {
      process.env.RABBITMQ_URL = originalEnv;
    }
    if (originalCloudEnv === undefined) {
      delete process.env.CLOUDAMQP_URL;
    } else {
      process.env.CLOUDAMQP_URL = originalCloudEnv;
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
    process.env.RABBITMQ_URL = 'amqp://custom/pitch_local';

    const options = createMicroserviceOptions('sample_queue');

    expect(options).toEqual({
      transport: Transport.RMQ,
      options: {
        urls: ['amqp://custom/pitch_local'],
        queue: 'sample_queue',
        noAck: true,
        prefetchCount: 10,
        queueOptions: {
          durable: true,
        },
        socketOptions: {
          heartbeatIntervalInSeconds: 60,
        },
      },
    });
  });

  it('uses CloudAMQP when DEP_MODE is prod', () => {
    process.env.DEP_MODE = 'prod';
    process.env.CLOUDAMQP_URL = 'amqp://cloud';

    expect(getRabbitMQUrl()).toBe('amqp://cloud');
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
    expect(
      getQueueOptions('amqp://admin:admin123@localhost:5672/pitch_local'),
    ).toEqual({
      durable: true,
    });
  });

  it('returns explicit dead-letter queue options outside the local definitions vhost', () => {
    expect(
      getQueueOptions('amqp://admin:admin123@localhost:5672/pitch_prod'),
    ).toEqual({
      durable: true,
      arguments: {
        'x-dead-letter-exchange': RABBITMQ_DEAD_LETTER_EXCHANGE,
      },
    });
  });

  it('detects when the local RabbitMQ policy should supply dead-letter routing', () => {
    expect(
      usesRabbitMqPolicyDeadLettering(
        'amqp://admin:admin123@localhost:5672/pitch_local',
      ),
    ).toBe(true);
    expect(
      usesRabbitMqPolicyDeadLettering(
        'amqp://admin:admin123@localhost:5672/pitch_prod',
      ),
    ).toBe(false);
  });

  it('returns topology queue options with dead-letter routing', () => {
    expect(getDeadLetterQueueOptions()).toEqual({
      durable: true,
      arguments: {
        'x-dead-letter-exchange': RABBITMQ_DEAD_LETTER_EXCHANGE,
      },
    });
  });
});
