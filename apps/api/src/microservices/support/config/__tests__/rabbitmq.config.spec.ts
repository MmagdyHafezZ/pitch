import { getRabbitMQUrl } from '../rabbitmq.config';

describe('support rabbitmq.config', () => {
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
      process.env.CLOUDAMQP_URL = 'amqp://cloud:5672';

      expect(getRabbitMQUrl()).toBe('amqp://cloud:5672');
    });

    it('returns CLOUDAMQP_URL when DEP_MODE is production', () => {
      process.env.DEP_MODE = 'production';
      process.env.CLOUDAMQP_URL = 'amqp://prod-cloud:5672';

      expect(getRabbitMQUrl()).toBe('amqp://prod-cloud:5672');
    });

    it('throws when RABBITMQ_URL is missing in dev mode', () => {
      expect(() => getRabbitMQUrl()).toThrow('RABBITMQ_URL');
    });

    it('throws when CLOUDAMQP_URL is missing in prod mode', () => {
      process.env.DEP_MODE = 'prod';

      expect(() => getRabbitMQUrl()).toThrow('CLOUDAMQP_URL');
    });

    it('handles DEP_MODE with extra whitespace', () => {
      process.env.DEP_MODE = '  PROD  ';
      process.env.CLOUDAMQP_URL = 'amqp://ws:5672';

      expect(getRabbitMQUrl()).toBe('amqp://ws:5672');
    });
  });
});
