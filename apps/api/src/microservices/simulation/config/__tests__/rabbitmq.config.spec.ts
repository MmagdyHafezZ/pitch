import { getRabbitMQUrl, getQueueOptions } from '../rabbitmq.config';

describe('rabbitmq.config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.DEP_MODE;
    delete process.env.CLOUDAMQP_URL;
    delete process.env.RABBITMQ_URL;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('getRabbitMQUrl', () => {
    it('returns RABBITMQ_URL in non-production mode', () => {
      process.env.RABBITMQ_URL = 'amqp://localhost:5672';

      expect(getRabbitMQUrl()).toBe('amqp://localhost:5672');
    });

    it('returns CLOUDAMQP_URL when DEP_MODE is prod', () => {
      process.env.DEP_MODE = 'prod';
      process.env.CLOUDAMQP_URL = 'amqp://cloud-host:5672';

      expect(getRabbitMQUrl()).toBe('amqp://cloud-host:5672');
    });

    it('returns CLOUDAMQP_URL when DEP_MODE is production', () => {
      process.env.DEP_MODE = 'production';
      process.env.CLOUDAMQP_URL = 'amqp://cloud-prod:5672';

      expect(getRabbitMQUrl()).toBe('amqp://cloud-prod:5672');
    });

    it('handles DEP_MODE with whitespace and mixed case', () => {
      process.env.DEP_MODE = '  Prod  ';
      process.env.CLOUDAMQP_URL = 'amqp://trimmed:5672';

      expect(getRabbitMQUrl()).toBe('amqp://trimmed:5672');
    });

    it('throws when RABBITMQ_URL is missing in non-prod mode', () => {
      process.env.DEP_MODE = 'dev';

      expect(() => getRabbitMQUrl()).toThrow('RABBITMQ_URL');
    });

    it('throws when CLOUDAMQP_URL is missing in prod mode', () => {
      process.env.DEP_MODE = 'prod';

      expect(() => getRabbitMQUrl()).toThrow('CLOUDAMQP_URL');
    });

    it('uses RABBITMQ_URL when DEP_MODE is empty', () => {
      process.env.DEP_MODE = '';
      process.env.RABBITMQ_URL = 'amqp://default:5672';

      expect(getRabbitMQUrl()).toBe('amqp://default:5672');
    });

    it('uses RABBITMQ_URL when DEP_MODE is unset', () => {
      process.env.RABBITMQ_URL = 'amqp://unset-mode:5672';

      expect(getRabbitMQUrl()).toBe('amqp://unset-mode:5672');
    });
  });

  describe('getQueueOptions', () => {
    it('returns durable: true', () => {
      expect(getQueueOptions()).toEqual({ durable: true });
    });
  });
});
