import { UserController } from '../controllers/user.controller';
import type { UserService } from '../services/user.service';
import { toRpcException } from '@pitch/shared-backend/helpers/exceptions';
import { RpcException } from '@nestjs/microservices';
import type { OAuthProviderFactory } from '../factories/oauth-provider.factory';
import type { User } from '@pitch/shared-backend/interfaces/user.interface';
import type { MessageWithUserClaims } from '@pitch/shared-backend/interfaces/user-claims.interface';

jest.mock('@pitch/shared-backend/helpers/exceptions', () => ({
  toRpcException: jest.fn((error: unknown) => error),
}));

describe('UserController', () => {
  const createServiceMock = (): jest.Mocked<UserService> =>
    ({
      findAll: jest.fn(),
      findOne: jest.fn(),
      findByEmail: jest.fn(),
      findByOAuthAccount: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      getOAuthAccountsByUserId: jest.fn(),
    }) as unknown as jest.Mocked<UserService>;

  const createOauthProviderFactoryMock =
    (): jest.Mocked<OAuthProviderFactory> =>
      ({
        getProvider: jest.fn(),
        getEnabledProviders: jest.fn(),
        getAllProviders: jest.fn(),
      }) as unknown as jest.Mocked<OAuthProviderFactory>;

  const basePayload: MessageWithUserClaims = {
    userClaims: {
      id: 'admin-1',
      email: 'admin@example.com',
      name: 'Admin User',
    },
  };

  const user: User = {
    id: 'user-1',
    email: 'user@example.com',
    name: 'Test User',
    avatar: null,
    isActive: true,
    createdAt: new Date('2023-01-01T00:00:00.000Z'),
    updatedAt: new Date('2023-01-01T00:00:00.000Z'),
    oauthAccounts: [],
  };
  const toRpcExceptionMock = jest.mocked(toRpcException);

  beforeEach(() => {
    jest.clearAllMocks();
    toRpcExceptionMock.mockReset();
  });

  it('returns all users', async () => {
    const service = createServiceMock();
    const oauthProviderFactory = createOauthProviderFactoryMock();
    service.findAll.mockResolvedValue([user]);
    const controller = new UserController(service, oauthProviderFactory);

    await expect(controller.getUsers(basePayload)).resolves.toEqual([user]);
  });

  it('returns a single user', async () => {
    const service = createServiceMock();
    const oauthProviderFactory = createOauthProviderFactoryMock();
    service.findOne.mockResolvedValue(user);
    const controller = new UserController(service, oauthProviderFactory);

    const payload = { userId: 'user-1', ...basePayload };

    await expect(controller.getUser(payload)).resolves.toEqual(user);
    expect(service.findOne).toHaveBeenCalledWith('user-1');
  });

  it('creates a user after removing user claims from payload', async () => {
    const service = createServiceMock();
    const oauthProviderFactory = createOauthProviderFactoryMock();
    service.create.mockResolvedValue(user);
    const controller = new UserController(service, oauthProviderFactory);

    const payload = {
      email: 'user@example.com',
      name: 'User',
      ...basePayload,
    };

    await expect(controller.createUser(payload)).resolves.toEqual(user);
    expect(service.create).toHaveBeenCalledWith({
      email: 'user@example.com',
      name: 'User',
    });
  });

  it('updates a user', async () => {
    const service = createServiceMock();
    const oauthProviderFactory = createOauthProviderFactoryMock();
    service.update.mockResolvedValue(user);
    const controller = new UserController(service, oauthProviderFactory);

    const payload = {
      userId: 'user-1',
      name: 'Updated',
      ...basePayload,
    };

    await expect(controller.updateUser(payload)).resolves.toEqual(user);
    expect(service.update).toHaveBeenCalledWith('user-1', { name: 'Updated' });
  });

  it('deletes a user', async () => {
    const service = createServiceMock();
    const oauthProviderFactory = createOauthProviderFactoryMock();
    service.remove.mockResolvedValue({ message: 'deleted' });
    const controller = new UserController(service, oauthProviderFactory);

    await expect(
      controller.deleteUser({ userId: 'user-1', ...basePayload }),
    ).resolves.toEqual({ message: 'deleted' });
    expect(service.remove).toHaveBeenCalledWith('user-1');
  });

  it('transforms errors using toRpcException helper', async () => {
    const service = createServiceMock();
    const oauthProviderFactory = createOauthProviderFactoryMock();
    const error = new Error('failure');
    const rpcError = new RpcException('rpc');
    service.findAll.mockRejectedValue(error);
    toRpcExceptionMock.mockReturnValueOnce(rpcError);
    const controller = new UserController(service, oauthProviderFactory);

    await expect(controller.getUsers(basePayload)).rejects.toThrow(rpcError);
    expect(toRpcExceptionMock).toHaveBeenCalledWith(error);
  });

  it('wraps errors when retrieving a user', async () => {
    const service = createServiceMock();
    const oauthProviderFactory = createOauthProviderFactoryMock();
    const error = new Error('failure');
    const rpcError = new RpcException('rpc');
    service.findOne.mockRejectedValue(error);
    toRpcExceptionMock.mockReturnValueOnce(rpcError);
    const controller = new UserController(service, oauthProviderFactory);

    await expect(
      controller.getUser({ userId: 'user-1', ...basePayload }),
    ).rejects.toThrow(rpcError);
  });

  it('wraps errors when creating a user', async () => {
    const service = createServiceMock();
    const oauthProviderFactory = createOauthProviderFactoryMock();
    const error = new Error('failure');
    const rpcError = new RpcException('rpc');
    service.create.mockRejectedValue(error);
    toRpcExceptionMock.mockReturnValueOnce(rpcError);
    const controller = new UserController(service, oauthProviderFactory);

    await expect(
      controller.createUser({
        email: 'user@example.com',
        name: 'User',
        ...basePayload,
      }),
    ).rejects.toThrow(rpcError);
  });

  it('wraps errors when updating a user', async () => {
    const service = createServiceMock();
    const oauthProviderFactory = createOauthProviderFactoryMock();
    const error = new Error('failure');
    const rpcError = new RpcException('rpc');
    service.update.mockRejectedValue(error);
    toRpcExceptionMock.mockReturnValueOnce(rpcError);
    const controller = new UserController(service, oauthProviderFactory);

    await expect(
      controller.updateUser({
        userId: 'user-1',
        name: 'Updated',
        ...basePayload,
      }),
    ).rejects.toThrow(rpcError);
  });

  it('wraps errors when deleting a user', async () => {
    const service = createServiceMock();
    const oauthProviderFactory = createOauthProviderFactoryMock();
    const error = new Error('failure');
    const rpcError = new RpcException('rpc');
    service.remove.mockRejectedValue(error);
    toRpcExceptionMock.mockReturnValueOnce(rpcError);
    const controller = new UserController(service, oauthProviderFactory);

    await expect(
      controller.deleteUser({ userId: 'user-1', ...basePayload }),
    ).rejects.toThrow(rpcError);
  });
});
