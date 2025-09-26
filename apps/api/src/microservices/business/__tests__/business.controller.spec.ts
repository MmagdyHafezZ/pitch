import { BusinessController } from '../business.controller';
import type { BusinessService } from '../business.service';
import type { Business } from '../../../common/interfaces/business.interface';
import type { MessageWithUserClaims } from '../../../common/interfaces/user-claims.interface';
import { toRpcException } from '../../../common/helpers/exceptions';
import type { MockedClass } from '../../../../test/utils/test-helpers';

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
    }) as MockedClass<BusinessService>;

  const createController = (service: MockedClass<BusinessService>) =>
    new BusinessController(service as unknown as BusinessService);

  const basePayload: MessageWithUserClaims = {
    userClaims: {
      id: 'user-1',
      email: 'user@example.com',
      name: 'Test User',
    },
  };

  const business: Business = {
    id: 'biz-1',
    name: 'Acme Inc.',
    description: 'A business',
    userId: 'user-1',
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    updatedAt: new Date('2024-01-01T00:00:00.000Z'),
  };

  const toRpcExceptionMock = jest.mocked(toRpcException);

  beforeEach(() => {
    jest.clearAllMocks();
    toRpcExceptionMock.mockReset();
  });

  it('returns all businesses', async () => {
    const service = createServiceMock();
    service.findAll.mockResolvedValue([business]);
    const controller = createController(service);

    await expect(controller.getBusinesses(basePayload)).resolves.toEqual([
      business,
    ]);
  });

  it('returns a single business by id', async () => {
    const service = createServiceMock();
    service.findOne.mockResolvedValue(business);
    const controller = createController(service);

    await expect(
      controller.getBusiness({ id: 'biz-1', ...basePayload }),
    ).resolves.toEqual(business);

    expect(service.findOne).toHaveBeenCalledWith('biz-1');
  });

  it('returns a business with user information', async () => {
    const detailedBusiness = { ...business, user: { id: 'user-1' } };
    const service = createServiceMock();
    service.findOneWithUser.mockResolvedValue(detailedBusiness);
    const controller = createController(service);

    await expect(
      controller.getBusinessWithUser({ id: 'biz-1', ...basePayload }),
    ).resolves.toEqual(detailedBusiness);
  });

  it('creates a business after removing user claims', async () => {
    const service = createServiceMock();
    service.create.mockResolvedValue(business);
    const controller = createController(service);

    const payload: Parameters<BusinessController['createBusiness']>[0] = {
      id: 'biz-1',
      name: 'New Biz',
      userId: 'user-1',
      ...basePayload,
    };

    await expect(controller.createBusiness(payload)).resolves.toEqual(business);
    expect(service.create).toHaveBeenCalledWith({
      id: 'biz-1',
      name: 'New Biz',
      userId: 'user-1',
    });
  });

  it('updates a business', async () => {
    const service = createServiceMock();
    service.update.mockResolvedValue(business);
    const controller = createController(service);

    const payload: Parameters<BusinessController['updateBusiness']>[0] = {
      id: 'biz-1',
      name: 'Updated',
      ...basePayload,
    };

    await expect(controller.updateBusiness(payload)).resolves.toEqual(business);
    expect(service.update).toHaveBeenCalledWith('biz-1', { name: 'Updated' });
  });

  it('deletes a business', async () => {
    const service = createServiceMock();
    service.remove.mockResolvedValue({ message: 'ok' });
    const controller = createController(service);

    await expect(
      controller.deleteBusiness({ id: 'biz-1', ...basePayload }),
    ).resolves.toEqual({ message: 'ok' });

    expect(service.remove).toHaveBeenCalledWith('biz-1');
  });

  it('transforms service errors to RPC exceptions', async () => {
    const error = new Error('failure');
    const rpcError = new Error('rpc');
    const service = createServiceMock();
    service.findAll.mockRejectedValue(error);
    toRpcExceptionMock.mockReturnValueOnce(rpcError);
    const controller = createController(service);

    await expect(controller.getBusinesses(basePayload)).rejects.toThrow(
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
    const controller = createController(service);

    await expect(
      controller.getBusiness({ id: 'biz-1', ...basePayload }),
    ).rejects.toThrow(rpcError);
  });

  it('wraps errors when updating a business', async () => {
    const error = new Error('failure');
    const rpcError = new Error('rpc');
    const service = createServiceMock();
    service.update.mockRejectedValue(error);
    toRpcExceptionMock.mockReturnValueOnce(rpcError);
    const controller = createController(service);

    await expect(
      controller.updateBusiness({ id: 'biz-1', ...basePayload }),
    ).rejects.toThrow(rpcError);
  });

  it('wraps errors when retrieving a business with user info', async () => {
    const error = new Error('failure');
    const rpcError = new Error('rpc');
    const service = createServiceMock();
    service.findOneWithUser.mockRejectedValue(error);
    toRpcExceptionMock.mockReturnValueOnce(rpcError);
    const controller = createController(service);

    await expect(
      controller.getBusinessWithUser({ id: 'biz-1', ...basePayload }),
    ).rejects.toThrow(rpcError);
  });

  it('wraps errors when creating a business', async () => {
    const error = new Error('failure');
    const rpcError = new Error('rpc');
    const service = createServiceMock();
    service.create.mockRejectedValue(error);
    toRpcExceptionMock.mockReturnValueOnce(rpcError);
    const controller = createController(service);

    await expect(
      controller.createBusiness({
        name: 'Biz',
        userId: 'user-1',
        ...basePayload,
      }),
    ).rejects.toThrow(rpcError);
  });

  it('wraps errors when deleting a business', async () => {
    const error = new Error('failure');
    const rpcError = new Error('rpc');
    const service = createServiceMock();
    service.remove.mockRejectedValue(error);
    toRpcExceptionMock.mockReturnValueOnce(rpcError);
    const controller = createController(service);

    await expect(
      controller.deleteBusiness({ id: 'biz-1', ...basePayload }),
    ).rejects.toThrow(rpcError);
  });
});
