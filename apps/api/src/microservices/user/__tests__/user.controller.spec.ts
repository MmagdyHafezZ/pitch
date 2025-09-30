import { UserController } from '../user.controller';
import type { UserService } from '../user.service';
import { toRpcException } from '../../../common/helpers/exceptions';
import { RpcException } from '@nestjs/microservices';

jest.mock('../../../common/helpers/exceptions', () => ({
  toRpcException: jest.fn((error: unknown) => error),
}));

describe('UserController', () => {
  const createServiceMock = () =>
    ({
      findAll: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    }) as unknown as jest.Mocked<UserService>;

  const basePayload = {
    userClaims: {
      id: 'admin-1',
      email: 'admin@example.com',
      name: 'Admin User',
    },
  } as const;

  const user = { id: 'user-1', email: 'user@example.com' } as const;
  const toRpcExceptionMock = jest.mocked(toRpcException);

  beforeEach(() => {
    jest.clearAllMocks();
    toRpcExceptionMock.mockReset();
  });

  it('returns all users', async () => {
    const service = createServiceMock();
    service.findAll.mockResolvedValue([user] as any);
    const controller = new UserController(service);

    await expect(controller.getUsers(basePayload as any)).resolves.toEqual([
      user,
    ]);
  });

  it('returns a single user', async () => {
    const service = createServiceMock();
    service.findOne.mockResolvedValue(user as any);
    const controller = new UserController(service);

    await expect(
      controller.getUser({ id: 'user-1', ...basePayload } as any),
    ).resolves.toEqual(user);
    expect(service.findOne).toHaveBeenCalledWith('user-1');
  });

  it('creates a user after removing user claims from payload', async () => {
    const service = createServiceMock();
    service.create.mockResolvedValue(user as any);
    const controller = new UserController(service);

    const payload = {
      email: 'user@example.com',
      password: 'secret',
      name: 'User',
      ...basePayload,
    } as any;

    await expect(controller.createUser(payload)).resolves.toEqual(user);
    expect(service.create).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'secret',
      name: 'User',
    });
  });

  it('updates a user', async () => {
    const service = createServiceMock();
    service.update.mockResolvedValue(user as any);
    const controller = new UserController(service);

    const payload = {
      id: 'user-1',
      name: 'Updated',
      ...basePayload,
    } as any;

    await expect(controller.updateUser(payload)).resolves.toEqual(user);
    expect(service.update).toHaveBeenCalledWith('user-1', { name: 'Updated' });
  });

  it('deletes a user', async () => {
    const service = createServiceMock();
    service.remove.mockResolvedValue({ message: 'deleted' } as any);
    const controller = new UserController(service);

    await expect(
      controller.deleteUser({ id: 'user-1', ...basePayload } as any),
    ).resolves.toEqual({ message: 'deleted' });
    expect(service.remove).toHaveBeenCalledWith('user-1');
  });

  it('transforms errors using toRpcException helper', async () => {
    const service = createServiceMock();
    const error = new Error('failure');
    const rpcError = new RpcException('rpc');
    service.findAll.mockRejectedValue(error);
    toRpcExceptionMock.mockReturnValueOnce(rpcError);
    const controller = new UserController(service);

    await expect(controller.getUsers(basePayload as any)).rejects.toThrow(
      rpcError,
    );
    expect(toRpcExceptionMock).toHaveBeenCalledWith(error);
  });

  it('wraps errors when retrieving a user', async () => {
    const service = createServiceMock();
    const error = new Error('failure');
    const rpcError = new RpcException('rpc');
    service.findOne.mockRejectedValue(error);
    toRpcExceptionMock.mockReturnValueOnce(rpcError);
    const controller = new UserController(service);

    await expect(
      controller.getUser({ id: 'user-1', ...basePayload } as any),
    ).rejects.toThrow(rpcError);
  });

  it('wraps errors when creating a user', async () => {
    const service = createServiceMock();
    const error = new Error('failure');
    const rpcError = new RpcException('rpc');
    service.create.mockRejectedValue(error);
    toRpcExceptionMock.mockReturnValueOnce(rpcError);
    const controller = new UserController(service);

    await expect(
      controller.createUser({
        email: 'user@example.com',
        password: 'pwd',
        name: 'User',
        ...basePayload,
      } as any),
    ).rejects.toThrow(rpcError);
  });

  it('wraps errors when updating a user', async () => {
    const service = createServiceMock();
    const error = new Error('failure');
    const rpcError = new RpcException('rpc');
    service.update.mockRejectedValue(error);
    toRpcExceptionMock.mockReturnValueOnce(rpcError);
    const controller = new UserController(service);

    await expect(
      controller.updateUser({
        id: 'user-1',
        name: 'Updated',
        ...basePayload,
      } as any),
    ).rejects.toThrow(rpcError);
  });

  it('wraps errors when deleting a user', async () => {
    const service = createServiceMock();
    const error = new Error('failure');
    const rpcError = new RpcException('rpc');
    service.remove.mockRejectedValue(error);
    toRpcExceptionMock.mockReturnValueOnce(rpcError);
    const controller = new UserController(service);

    await expect(
      controller.deleteUser({ id: 'user-1', ...basePayload } as any),
    ).rejects.toThrow(rpcError);
  });
});
