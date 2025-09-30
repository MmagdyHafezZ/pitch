import { Transport } from '@nestjs/microservices';
import type { INestApplication } from '@nestjs/common';
import { MicroserviceConfigService } from '../microservice.service';

describe('MicroserviceConfigService', () => {
  let service: MicroserviceConfigService;
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    service = new MicroserviceConfigService();
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  it('returns enabled services sorted by priority', () => {
    process.env.ENABLE_USER_SERVICE = 'false';

    const services = service.getEnabledServices();

    expect(services).toEqual([
      { name: 'AUTH_SERVICE', queue: 'auth_queue', priority: 1 },
      { name: 'BUSINESS_SERVICE', queue: 'business_queue', priority: 3 },
    ]);
  });

  it('creates RMQ microservice options from environment variables', () => {
    process.env.RABBITMQ_URL = 'amqp://custom';

    const options = service.createMicroserviceOptions('custom_queue');

    expect(options).toEqual({
      transport: Transport.RMQ,
      options: {
        urls: ['amqp://custom'],
        queue: 'custom_queue',
        queueOptions: { durable: true },
      },
    });
  });

  it('throws when no RabbitMQ URL can be resolved', () => {
    const spy = jest
      .spyOn(service as any, 'getRabbitMQUrl')
      .mockReturnValue('');

    expect(() => service.createMicroserviceOptions('queue')).toThrow(
      'RABBITMQ_URL environment variable is required',
    );
    spy.mockRestore();
  });

  it('connects all enabled microservices to the Nest application', async () => {
    const connectMicroservice = jest.fn();
    const startAllMicroservices = jest.fn().mockResolvedValue(undefined);
    const app = {
      connectMicroservice,
      startAllMicroservices,
    } as unknown as INestApplication;

    const options = { transport: Transport.RMQ } as const;
    const optionsSpy = jest
      .spyOn(service, 'createMicroserviceOptions')
      .mockReturnValue(options);

    await service.connectAllMicroservices(app);

    expect(connectMicroservice).toHaveBeenCalledTimes(3);
    expect(optionsSpy).toHaveBeenCalledTimes(3);
    expect(startAllMicroservices).toHaveBeenCalled();
  });

  it('propagates errors when connecting microservices fails', async () => {
    const connectMicroservice = jest.fn().mockImplementationOnce(() => {
      throw new Error('connection failed');
    });
    const startAllMicroservices = jest.fn();
    const app = {
      connectMicroservice,
      startAllMicroservices,
    } as unknown as INestApplication;

    await expect(service.connectAllMicroservices(app)).rejects.toThrow(
      'connection failed',
    );
    expect(startAllMicroservices).not.toHaveBeenCalled();
  });

  it('returns client configurations for gateway module', () => {
    process.env.RABBITMQ_URL = 'amqp://custom';

    const configs = service.getClientConfigurations();

    expect(configs).toEqual([
      {
        name: 'AUTH_SERVICE',
        transport: Transport.RMQ,
        options: {
          urls: ['amqp://custom'],
          queue: 'auth_queue',
          queueOptions: { durable: true },
        },
      },
      {
        name: 'USER_SERVICE',
        transport: Transport.RMQ,
        options: {
          urls: ['amqp://custom'],
          queue: 'user_queue',
          queueOptions: { durable: true },
        },
      },
      {
        name: 'BUSINESS_SERVICE',
        transport: Transport.RMQ,
        options: {
          urls: ['amqp://custom'],
          queue: 'business_queue',
          queueOptions: { durable: true },
        },
      },
    ]);
  });
});
