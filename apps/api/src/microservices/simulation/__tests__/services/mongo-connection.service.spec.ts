import { ConfigService } from '@nestjs/config';
import mongoose from 'mongoose';
import { MongoConnectionService } from '../../services/mongo/mongo-connection.service';

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
      if (key === 'MONGODB_URL') return mongoUrl;
      return undefined;
    }),
  } as unknown as ConfigService;
}

describe('MongoConnectionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.MONGODB_URL;
  });

  describe('onModuleInit', () => {
    it('connects when MONGODB_URL is configured', async () => {
      const service = new MongoConnectionService(
        makeConfigService('mongodb://localhost:27017/test'),
      );

      await service.onModuleInit();

      expect(mongooseMock.createConnection).toHaveBeenCalledWith(
        'mongodb://localhost:27017/test',
      );
    });

    it('skips connection when MONGODB_URL is not configured', async () => {
      const service = new MongoConnectionService(makeConfigService(undefined));

      await service.onModuleInit();

      expect(mongooseMock.createConnection).not.toHaveBeenCalled();
    });

    it('falls back to process.env.MONGODB_URL', async () => {
      process.env.MONGODB_URL = 'mongodb://env-url/db';
      const service = new MongoConnectionService(makeConfigService(undefined));

      await service.onModuleInit();

      expect(mongooseMock.createConnection).toHaveBeenCalledWith(
        'mongodb://env-url/db',
      );
    });
  });

  describe('onModuleDestroy', () => {
    it('closes the connection when connected', async () => {
      const service = new MongoConnectionService(
        makeConfigService('mongodb://localhost/test'),
      );
      await service.onModuleInit();

      await service.onModuleDestroy();

      const conn = await (
        mongooseMock.createConnection as jest.Mock
      ).mock.results[0].value.asPromise();
      expect(conn.close).toHaveBeenCalled();
    });

    it('is safe to call when not connected', async () => {
      const service = new MongoConnectionService(makeConfigService(undefined));
      await service.onModuleInit();

      await expect(service.onModuleDestroy()).resolves.toBeUndefined();
    });
  });

  describe('isConnected', () => {
    it('returns true after successful connection', async () => {
      const service = new MongoConnectionService(
        makeConfigService('mongodb://localhost/test'),
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
    it('returns true immediately when already connected', async () => {
      const service = new MongoConnectionService(
        makeConfigService('mongodb://localhost/test'),
      );
      await service.onModuleInit();

      const result = await service.waitUntilConnected();

      expect(result).toBe(true);
    });

    it('returns false when no mongoUrl configured', async () => {
      const service = new MongoConnectionService(makeConfigService(undefined));
      await service.onModuleInit();

      const result = await service.waitUntilConnected(100);

      expect(result).toBe(false);
    });
  });

  describe('getModel', () => {
    it('throws when connection is not initialized', () => {
      const service = new MongoConnectionService(makeConfigService(undefined));

      expect(() => service.getModel('Test', new (jest.fn())())).toThrow(
        'MongoDB connection is not initialized',
      );
    });

    it('returns existing model from cache', async () => {
      const service = new MongoConnectionService(
        makeConfigService('mongodb://localhost/test'),
      );
      await service.onModuleInit();

      const conn = await (
        mongooseMock.createConnection as jest.Mock
      ).mock.results[0].value.asPromise();
      conn.models['CachedModel'] = { name: 'CachedModel' };

      const result = service.getModel('CachedModel', new (jest.fn())());
      expect(result).toEqual({ name: 'CachedModel' });
    });

    it('creates new model when not in cache', async () => {
      const service = new MongoConnectionService(
        makeConfigService('mongodb://localhost/test'),
      );
      await service.onModuleInit();

      const schema = new (jest.fn())();
      const result = service.getModel('NewModel', schema);
      expect(result).toBeDefined();
    });
  });
});
