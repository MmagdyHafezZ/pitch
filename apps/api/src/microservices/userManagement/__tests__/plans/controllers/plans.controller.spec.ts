import { PlanController } from '../../../plans/controllers/plans.controller';
import { toRpcException } from '@pitch/shared-backend/helpers/exceptions';
import { PlanLevel } from '@prisma/user-client';
import type { PlanService } from '../../../plans/services/plans.service';

jest.mock('@pitch/shared-backend/helpers/exceptions', () => ({
  toRpcException: jest.fn((error: unknown) => error),
}));

describe('PlanController', () => {
  const createServiceMock = (): jest.Mocked<PlanService> =>
    ({
      createPlan: jest.fn(),
      updatePlan: jest.fn(),
      removePlan: jest.fn(),
      findOne: jest.fn(),
      findAll: jest.fn(),
    }) as unknown as jest.Mocked<PlanService>;

  const payloadBase = {
    userClaims: { id: 'admin-1', email: 'admin@example.com', name: 'Admin' },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('maps create payload and delegates to service', async () => {
    const service = createServiceMock();
    service.createPlan.mockResolvedValue({ id: 'plan-1' } as any);
    const controller = new PlanController(service);

    await expect(
      controller.createPlan({
        ...payloadBase,
        name: 'Pro',
        planLevel: PlanLevel.FREE,
        maxCoins: 1000,
      } as any),
    ).resolves.toEqual({ id: 'plan-1' });

    expect(service.createPlan).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Pro', isActive: true }),
    );
  });

  it('maps update payload and delegates to service', async () => {
    const service = createServiceMock();
    service.updatePlan.mockResolvedValue({ id: 'plan-1', name: 'Pro' } as any);
    const controller = new PlanController(service);

    await expect(
      controller.updatePlan({
        ...payloadBase,
        id: 'plan-1',
        name: 'Pro',
        maxCoins: 2000,
      } as any),
    ).resolves.toEqual({ id: 'plan-1', name: 'Pro' });

    expect(service.updatePlan).toHaveBeenCalledWith(
      'plan-1',
      expect.objectContaining({ name: 'Pro', maxCoins: 2000 }),
    );
  });

  it('delegates delete/get/getAll', async () => {
    const service = createServiceMock();
    service.removePlan.mockResolvedValue({ message: 'ok' });
    service.findOne.mockResolvedValue({ id: 'plan-1' } as any);
    service.findAll.mockResolvedValue([{ id: 'plan-1' }] as any);
    const controller = new PlanController(service);

    await expect(
      controller.deletePlan({ ...payloadBase, id: 'plan-1' } as any),
    ).resolves.toEqual({ message: 'ok' });
    await expect(
      controller.getPlan({ ...payloadBase, id: 'plan-1' } as any),
    ).resolves.toEqual({ id: 'plan-1' });
    await expect(controller.getPlans(payloadBase as any)).resolves.toEqual([
      { id: 'plan-1' },
    ]);
  });

  it('wraps service errors via toRpcException', async () => {
    const service = createServiceMock();
    const error = new Error('fail');
    const rpcError = new Error('rpc');
    service.createPlan.mockRejectedValue(error);
    jest.mocked(toRpcException).mockReturnValueOnce(rpcError as any);
    const controller = new PlanController(service);

    await expect(
      controller.createPlan({
        ...payloadBase,
        name: 'Pro',
        planLevel: PlanLevel.FREE,
        maxCoins: 1,
      } as any),
    ).rejects.toThrow(rpcError);
  });
});
