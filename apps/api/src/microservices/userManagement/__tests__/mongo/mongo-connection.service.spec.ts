import { ConfigService } from '@nestjs/config';
import mongoose from 'mongoose';
import { MongoConnectionService } from '../../mongo/mongo-connection.service';

jest.mock('mongoose', () => {
  const closeMock = jest.fn().mockResolvedValue(undefined);
  const modelMock = jest.fn().mockReturnValue({ name: 'TestModel' });
  const connectionMock = {
    readyState: 1,
    close: closeMock,
    model: modelMock,
    models: {} as Record<string, unknown>,
  };

  return {
    __esModule: true,
    default: {
      ConnectionStates: { connected: 1 },
      createConnection: jest.fn().mockReturnValue({
        asPromise: jest.fn().mockResolvedValue(connectionMock),
      }),
    },
    ConnectionStates: { connected: 1 },
    Schema: jest.fn(),
  };
});

const mongooseMock = mongoose as jest.Mocked<typeof mongoose>;

function makeConfigService(mongoUrl?: string): ConfigService {
  return {
    get: jest.fn((key: string) => {
      if (key === 'USER_MANAGEMENT_MONGODB_URL') return mongoUrl;
      return undefined;
    }),
  } as unknown as ConfigService;
}

describe('MongoConnectionService (userManagement)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.USER_MANAGEMENT_MONGODB_URL;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('onModuleInit', () => {
    it('connects when USER_MANAGEMENT_MONGODB_URL is configured', async () => {
      const service = new MongoConnectionService(
        makeConfigService('mongodb://localhost:27017/users'),
      );

      await service.onModuleInit();

      expect(mongooseMock.createConnection).toHaveBeenCalledWith(
        'mongodb://localhost:27017/users',
      );
    });

    it('skips connection when URL is not configured', async () => {
      const service = new MongoConnectionService(makeConfigService(undefined));

      await service.onModuleInit();

      expect(mongooseMock.createConnection).not.toHaveBeenCalled();
    });

    it('falls back to process.env when config returns undefined', async () => {
      process.env.USER_MANAGEMENT_MONGODB_URL = 'mongodb://env-url/users';
      const service = new MongoConnectionService(makeConfigService(undefined));

      await service.onModuleInit();

      expect(mongooseMock.createConnection).toHaveBeenCalledWith(
        'mongodb://env-url/users',
      );
    });
  });

  describe('onModuleDestroy', () => {
    it('closes the connection', async () => {
      const service = new MongoConnectionService(
        makeConfigService('mongodb://localhost/users'),
      );
      await service.onModuleInit();

      await service.onModuleDestroy();

      const conn = await (
        mongooseMock.createConnection as jest.Mock
      ).mock.results[0].value.asPromise();
      expect(conn.close).toHaveBeenCalled();
    });

    it('is safe when not connected', async () => {
      const service = new MongoConnectionService(makeConfigService(undefined));
      await service.onModuleInit();

      await expect(service.onModuleDestroy()).resolves.toBeUndefined();
    });
  });

  describe('isConnected', () => {
    it('returns true after successful connection', async () => {
      const service = new MongoConnectionService(
        makeConfigService('mongodb://localhost/users'),
      );
      await service.onModuleInit();

      expect(service.isConnected()).toBe(true);
    });

    it('returns false when never connected', () => {
      const service = new MongoConnectionService(makeConfigService(undefined));

      expect(service.isConnected()).toBe(false);
    });
  });

  describe('waitUntilConnected', () => {
    it('returns true immediately when connected', async () => {
      const service = new MongoConnectionService(
        makeConfigService('mongodb://localhost/users'),
      );
      await service.onModuleInit();

      expect(await service.waitUntilConnected()).toBe(true);
    });

    it('returns false when no URL configured', async () => {
      const service = new MongoConnectionService(makeConfigService(undefined));
      await service.onModuleInit();

      expect(await service.waitUntilConnected(100)).toBe(false);
    });
  });

  describe('getModel', () => {
    it('throws when connection is not initialized', () => {
      const service = new MongoConnectionService(makeConfigService(undefined));

      expect(() => service.getModel('Test', new (jest.fn())())).toThrow(
        'MongoDB connection is not initialized',
      );
    });

    it('returns cached model when it exists', async () => {
      const service = new MongoConnectionService(
        makeConfigService('mongodb://localhost/users'),
      );
      await service.onModuleInit();

      const conn = await (
        mongooseMock.createConnection as jest.Mock
      ).mock.results[0].value.asPromise();
      conn.models['ExistingModel'] = { name: 'ExistingModel' };

      const result = service.getModel('ExistingModel', new (jest.fn())());
      expect(result).toEqual({ name: 'ExistingModel' });
    });

    it('creates new model when not cached', async () => {
      const service = new MongoConnectionService(
        makeConfigService('mongodb://localhost/users'),
      );
      await service.onModuleInit();

      const result = service.getModel('NewModel', new (jest.fn())());
      expect(result).toBeDefined();
    });
  });
});
