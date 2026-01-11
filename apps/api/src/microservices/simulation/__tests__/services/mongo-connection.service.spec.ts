import { MongoConnectionService } from '../../services/mongo/mongo-connection.service';
import mongoose from 'mongoose';

jest.mock('mongoose', () => {
  const mockMongoose = {
    createConnection: jest.fn(),
  };
  return { __esModule: true, default: mockMongoose, Schema: class {} };
});

describe('MongoConnectionService', () => {
  it('skips connection when MONGODB_URL is not set', async () => {
    const configService = { get: jest.fn(() => undefined) } as any;
    const service = new MongoConnectionService(configService);

    await service.onModuleInit();

    expect(mongoose.createConnection).not.toHaveBeenCalled();
    expect(service.isConnected()).toBe(false);
    expect(() => service.getModel('Test', {} as any)).toThrow(
      'MongoDB connection',
    );
  });

  it('connects and returns models', async () => {
    const connection = {
      readyState: 1,
      models: {},
      model: jest.fn((name: string) => ({ name })),
      close: jest.fn(),
    };

    (mongoose.createConnection as jest.Mock).mockReturnValue({
      asPromise: jest.fn().mockResolvedValue(connection),
    });

    const configService = {
      get: jest.fn(() => 'mongodb://localhost:27017/test'),
    } as any;
    const service = new MongoConnectionService(configService);

    await service.onModuleInit();

    const model = service.getModel('Test', {} as any);
    expect(model).toEqual({ name: 'Test' });

    await service.onModuleDestroy();
    expect(connection.close).toHaveBeenCalled();
  });
});
