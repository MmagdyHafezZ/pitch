import { UserController } from '../../user/controllers/user.controller';
import type { UserService } from '../../user/services/user.service';
import { toRpcException } from '@pitch/shared-backend/helpers/exceptions';
import type { OAuthProviderFactory } from '../../auth/factories/oauth-provider.factory';
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
      getSettings: jest.fn(),
      findByOAuthAccount: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      getOAuthAccountsByUserId: jest.fn(),
      updateSettings: jest.fn(),
      touchLastSeen: jest.fn(),
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
    settings: null,
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

  it('touches last seen when user fetches their own profile', async () => {
    const service = createServiceMock();
    const oauthProviderFactory = createOauthProviderFactoryMock();
    service.touchLastSeen.mockResolvedValue(user);
    const controller = new UserController(service, oauthProviderFactory);

    const payload = {
      userId: 'admin-1',
      userClaims: {
        id: 'admin-1',
        email: 'admin@example.com',
        name: 'Admin User',
      },
    };

    await expect(controller.getUser(payload)).resolves.toEqual(user);
    expect(service.touchLastSeen).toHaveBeenCalledWith('admin-1');
    expect(service.findOne).not.toHaveBeenCalled();
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

  it('returns current user settings', async () => {
    const service = createServiceMock();
    const oauthProviderFactory = createOauthProviderFactoryMock();
    service.getSettings.mockResolvedValue({
      language: { locale: 'English (US)' },
    } as any);
    const controller = new UserController(service, oauthProviderFactory);

    await expect(controller.getMySettings(basePayload)).resolves.toEqual({
      language: { locale: 'English (US)' },
    });
    expect(service.getSettings).toHaveBeenCalledWith('admin-1');
  });

  it('updates current user settings', async () => {
    const service = createServiceMock();
    const oauthProviderFactory = createOauthProviderFactoryMock();
    service.updateSettings.mockResolvedValue({
      browser: { compactMode: true },
    } as any);
    const controller = new UserController(service, oauthProviderFactory);

    await expect(
      controller.updateMySettings({
        settings: { browser: { compactMode: true } } as any,
        ...basePayload,
      }),
    ).resolves.toEqual({
      browser: { compactMode: true },
    });

    expect(service.updateSettings).toHaveBeenCalledWith('admin-1', {
      browser: { compactMode: true },
    });
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
    const rpcError = new Error('rpc');
    service.findAll.mockRejectedValue(error);
    toRpcExceptionMock.mockReturnValueOnce(rpcError as any);
    const controller = new UserController(service, oauthProviderFactory);

    await expect(controller.getUsers(basePayload)).rejects.toThrow(rpcError);
    expect(toRpcExceptionMock).toHaveBeenCalledWith(error);
  });

  it('wraps errors when retrieving a user', async () => {
    const service = createServiceMock();
    const oauthProviderFactory = createOauthProviderFactoryMock();
    const error = new Error('failure');
    const rpcError = new Error('rpc');
    service.findOne.mockRejectedValue(error);
    toRpcExceptionMock.mockReturnValueOnce(rpcError as any);
    const controller = new UserController(service, oauthProviderFactory);

    await expect(
      controller.getUser({ userId: 'user-1', ...basePayload }),
    ).rejects.toThrow(rpcError);
  });

  it('wraps errors when creating a user', async () => {
    const service = createServiceMock();
    const oauthProviderFactory = createOauthProviderFactoryMock();
    const error = new Error('failure');
    const rpcError = new Error('rpc');
    service.create.mockRejectedValue(error);
    toRpcExceptionMock.mockReturnValueOnce(rpcError as any);
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
    const rpcError = new Error('rpc');
    service.update.mockRejectedValue(error);
    toRpcExceptionMock.mockReturnValueOnce(rpcError as any);
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
    const rpcError = new Error('rpc');
    service.remove.mockRejectedValue(error);
    toRpcExceptionMock.mockReturnValueOnce(rpcError as any);
    const controller = new UserController(service, oauthProviderFactory);

    await expect(
      controller.deleteUser({ userId: 'user-1', ...basePayload }),
    ).rejects.toThrow(rpcError);
  });

  it('wraps errors when getting current user settings', async () => {
    const service = createServiceMock();
    const oauthProviderFactory = createOauthProviderFactoryMock();
    const error = new Error('failure');
    const rpcError = new Error('rpc');
    service.getSettings.mockRejectedValue(error);
    toRpcExceptionMock.mockReturnValueOnce(rpcError as any);
    const controller = new UserController(service, oauthProviderFactory);

    await expect(controller.getMySettings(basePayload)).rejects.toThrow(
      rpcError,
    );
  });
});
