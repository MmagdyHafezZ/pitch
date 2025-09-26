import { BusinessController } from '../business.controller';
import type { BusinessService } from '../business.service';
import { toRpcException } from '../../../common/helpers/exceptions';

jest.mock('../../../common/helpers/exceptions', () => ({
  toRpcException: jest.fn((error: unknown) => error),
}));

describe('BusinessController', () => {
  const createServiceMock = () =>
    ({
      findAll: jest.fn(),
      findOne: jest.fn(),
      findOneWithUser: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    }) as unknown as jest.Mocked<BusinessService>;

  const basePayload = {
    userClaims: {
      id: 'user-1',
      email: 'user@example.com',
      name: 'Test User',
    },
  } as const;

  const business = { id: 'biz-1', name: 'Acme Inc.' } as const;

  const toRpcExceptionMock = jest.mocked(toRpcException);

  beforeEach(() => {
    jest.clearAllMocks();
    toRpcExceptionMock.mockReset();
  });

  it('returns all businesses', async () => {
    const service = createServiceMock();
    service.findAll.mockResolvedValue([business] as any);
    const controller = new BusinessController(service);

    await expect(controller.getBusinesses(basePayload as any)).resolves.toEqual(
      [business],
    );
  });

  it('returns a single business by id', async () => {
    const service = createServiceMock();
    service.findOne.mockResolvedValue(business as any);
    const controller = new BusinessController(service);

    await expect(
      controller.getBusiness({ id: 'biz-1', ...basePayload } as any),
    ).resolves.toEqual(business);

    expect(service.findOne).toHaveBeenCalledWith('biz-1');
  });

  it('returns a business with user information', async () => {
    const detailedBusiness = { ...business, user: { id: 'user-1' } };
    const service = createServiceMock();
    service.findOneWithUser.mockResolvedValue(detailedBusiness as any);
    const controller = new BusinessController(service);

    await expect(
      controller.getBusinessWithUser({ id: 'biz-1', ...basePayload } as any),
    ).resolves.toEqual(detailedBusiness);
  });

  it('creates a business after removing user claims', async () => {
    const service = createServiceMock();
    service.create.mockResolvedValue(business as any);
    const controller = new BusinessController(service);

    const payload = {
      id: 'biz-1',
      name: 'New Biz',
      userId: 'user-1',
      ...basePayload,
    } as any;

    await expect(controller.createBusiness(payload)).resolves.toEqual(business);
    expect(service.create).toHaveBeenCalledWith({
      id: 'biz-1',
      name: 'New Biz',
      userId: 'user-1',
    });
  });

  it('updates a business', async () => {
    const service = createServiceMock();
    service.update.mockResolvedValue(business as any);
    const controller = new BusinessController(service);

    const payload = {
      id: 'biz-1',
      name: 'Updated',
      ...basePayload,
    } as any;

    await expect(controller.updateBusiness(payload)).resolves.toEqual(business);
    expect(service.update).toHaveBeenCalledWith('biz-1', { name: 'Updated' });
  });

  it('deletes a business', async () => {
    const service = createServiceMock();
    service.remove.mockResolvedValue({ message: 'ok' } as any);
    const controller = new BusinessController(service);

    await expect(
      controller.deleteBusiness({ id: 'biz-1', ...basePayload } as any),
    ).resolves.toEqual({ message: 'ok' });

    expect(service.remove).toHaveBeenCalledWith('biz-1');
  });

  it('transforms service errors to RPC exceptions', async () => {
    const error = new Error('failure');
    const rpcError = new Error('rpc');
    const service = createServiceMock();
    service.findAll.mockRejectedValue(error);
    toRpcExceptionMock.mockReturnValueOnce(rpcError);
    const controller = new BusinessController(service);

    await expect(controller.getBusinesses(basePayload as any)).rejects.toThrow(
      rpcError,
    );
    expect(toRpcExceptionMock).toHaveBeenCalledWith(error);
  });

  it('wraps errors when retrieving a single business', async () => {
    const error = new Error('failure');
    const rpcError = new Error('rpc');
    const service = createServiceMock();
    service.findOne.mockRejectedValue(error);
    toRpcExceptionMock.mockReturnValueOnce(rpcError);
    const controller = new BusinessController(service);

    await expect(
      controller.getBusiness({ id: 'biz-1', ...basePayload } as any),
    ).rejects.toThrow(rpcError);
  });

  it('wraps errors when updating a business', async () => {
    const error = new Error('failure');
    const rpcError = new Error('rpc');
    const service = createServiceMock();
    service.update.mockRejectedValue(error);
    toRpcExceptionMock.mockReturnValueOnce(rpcError);
    const controller = new BusinessController(service);

    await expect(
      controller.updateBusiness({ id: 'biz-1', ...basePayload } as any),
    ).rejects.toThrow(rpcError);
  });

  it('wraps errors when retrieving a business with user info', async () => {
    const error = new Error('failure');
    const rpcError = new Error('rpc');
    const service = createServiceMock();
    service.findOneWithUser.mockRejectedValue(error);
    toRpcExceptionMock.mockReturnValueOnce(rpcError);
    const controller = new BusinessController(service);

    await expect(
      controller.getBusinessWithUser({ id: 'biz-1', ...basePayload } as any),
    ).rejects.toThrow(rpcError);
  });

  it('wraps errors when creating a business', async () => {
    const error = new Error('failure');
    const rpcError = new Error('rpc');
    const service = createServiceMock();
    service.create.mockRejectedValue(error);
    toRpcExceptionMock.mockReturnValueOnce(rpcError);
    const controller = new BusinessController(service);

    await expect(
      controller.createBusiness({
        name: 'Biz',
        userId: 'user-1',
        ...basePayload,
      } as any),
    ).rejects.toThrow(rpcError);
  });

  it('wraps errors when deleting a business', async () => {
    const error = new Error('failure');
    const rpcError = new Error('rpc');
    const service = createServiceMock();
    service.remove.mockRejectedValue(error);
    toRpcExceptionMock.mockReturnValueOnce(rpcError);
    const controller = new BusinessController(service);

    await expect(
      controller.deleteBusiness({ id: 'biz-1', ...basePayload } as any),
    ).rejects.toThrow(rpcError);
  });
});
