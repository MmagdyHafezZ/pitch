import { BillingInterval } from '@prisma/user-client';
import { toRpcException } from '@pitch/shared-backend/helpers/exceptions';
import { SubscriptionController } from '../../../subscription/controllers/subscription.controller';
import type { SubscriptionService } from '../../../subscription/services/subscription.service';

jest.mock('@pitch/shared-backend/helpers/exceptions', () => ({
  toRpcException: jest.fn((error: unknown) => error),
}));

describe('SubscriptionController', () => {
  const createServiceMock = (): jest.Mocked<SubscriptionService> =>
    ({
      createSubscription: jest.fn(),
      updateSubscription: jest.fn(),
      upgradeSubscription: jest.fn(),
      removeSubscription: jest.fn(),
      findOne: jest.fn(),
      findSubForTeam: jest.fn(),
      findAll: jest.fn(),
    }) as unknown as jest.Mocked<SubscriptionService>;

  const baseClaims = {
    userClaims: { id: 'admin-1', email: 'admin@example.com', name: 'Admin' },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('maps create payload, converts date string, and delegates requester id', async () => {
    const service = createServiceMock();
    service.createSubscription.mockResolvedValue({ id: 'sub-1' } as any);
    const controller = new SubscriptionController(service);

    await expect(
      controller.createSubscription({
        ...baseClaims,
        teamId: 'team-1',
        planId: 'plan-1',
        interval: BillingInterval.MONTH,
        currentPeriodStart: '2024-01-01T00:00:00.000Z',
        metadata: { notes: 'create' },
      } as any),
    ).resolves.toEqual({ id: 'sub-1' });

    expect(service.createSubscription).toHaveBeenCalledWith(
      expect.objectContaining({
        currentPeriodStart: new Date('2024-01-01T00:00:00.000Z'),
        metadata: { notes: 'create' },
      }),
      'admin-1',
    );
  });

  it('maps update and upgrade payloads and delegates requester id', async () => {
    const service = createServiceMock();
    service.updateSubscription.mockResolvedValue({ id: 'sub-1' } as any);
    service.upgradeSubscription.mockResolvedValue({
      id: 'sub-1',
      planId: 'plan-2',
    } as any);
    const controller = new SubscriptionController(service);

    await expect(
      controller.updateSubscription({
        ...baseClaims,
        id: 'sub-1',
        planId: 'plan-2',
        interval: BillingInterval.MONTH,
        metadata: { notes: 'patch' },
      } as any),
    ).resolves.toEqual({ id: 'sub-1' });

    await expect(
      controller.upgradeSubscription({
        ...baseClaims,
        id: 'sub-1',
        planId: 'plan-2',
        interval: BillingInterval.MONTH,
        metadata: { notes: 'upgrade' },
      } as any),
    ).resolves.toEqual({ id: 'sub-1', planId: 'plan-2' });

    expect(service.updateSubscription).toHaveBeenCalledWith(
      'sub-1',
      expect.objectContaining({
        planId: 'plan-2',
        metadata: { notes: 'patch' },
      }),
      'admin-1',
    );
    expect(service.upgradeSubscription).toHaveBeenCalledWith(
      'sub-1',
      expect.objectContaining({
        planId: 'plan-2',
        metadata: { notes: 'upgrade' },
      }),
      'admin-1',
    );
  });

  it('delegates delete/get/getTeam/getAll', async () => {
    const service = createServiceMock();
    service.removeSubscription.mockResolvedValue({ message: 'ok' });
    service.findOne.mockResolvedValue({ id: 'sub-1' } as any);
    service.findSubForTeam.mockResolvedValue({
      id: 'sub-1',
      teamId: 'team-1',
    } as any);
    service.findAll.mockResolvedValue([{ id: 'sub-1' }] as any);
    const controller = new SubscriptionController(service);

    await expect(
      controller.deleteSubscription({ ...baseClaims, id: 'sub-1' } as any),
    ).resolves.toEqual({ message: 'ok' });
    await expect(
      controller.getSubscription({ ...baseClaims, id: 'sub-1' } as any),
    ).resolves.toEqual({ id: 'sub-1' });
    await expect(
      controller.getTeamSubscription({
        ...baseClaims,
        teamId: 'team-1',
      } as any),
    ).resolves.toEqual({ id: 'sub-1', teamId: 'team-1' });
    await expect(
      controller.getSubscriptions(baseClaims as any),
    ).resolves.toEqual([{ id: 'sub-1' }]);
  });

  it('wraps errors using toRpcException', async () => {
    const service = createServiceMock();
    const error = new Error('fail');
    const rpcError = new Error('rpc');
    service.findAll.mockRejectedValue(error);
    jest.mocked(toRpcException).mockReturnValueOnce(rpcError as any);
    const controller = new SubscriptionController(service);

    await expect(
      controller.getSubscriptions(baseClaims as any),
    ).rejects.toThrow(rpcError);
  });
});
