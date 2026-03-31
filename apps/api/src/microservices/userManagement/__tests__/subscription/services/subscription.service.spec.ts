import { ConflictException, NotFoundException } from '@nestjs/common';
import { BillingInterval } from '@prisma/user-client';
import { SubscriptionService } from '../../../subscription/services/subscription.service';
import { SubscriptionRepository } from '../../../subscription/repositories/subscription.repository';
import { PlanRepository } from '../../../plans/repositories/plans.repository';
import { CoinRefillService } from '../../../coins/services/coin-refill.service';
import { CoinRedisService } from '../../../coins/services/coin-redis.service';
import { CoinAccountingService } from '../../../coins/services/coin-accounting.service';
import { PlanChangeNotificationService } from '../../../subscription/services/plan-change-notification.service';
import { NotificationService } from '../../../notifications/service/notification.service';

describe('SubscriptionService', () => {
  let service: SubscriptionService;
  let subscriptionRepository: jest.Mocked<SubscriptionRepository>;
  let planRepository: jest.Mocked<PlanRepository>;
  let coinRefillService: jest.Mocked<CoinRefillService>;
  let coinRedisService: jest.Mocked<CoinRedisService>;
  let coinAccountingService: jest.Mocked<CoinAccountingService>;
  let planChangeNotificationService: jest.Mocked<PlanChangeNotificationService>;
  let notificationService: jest.Mocked<NotificationService>;

  const basePlan = {
    id: 'plan-1',
    name: 'Free',
    maxCoins: 100,
  } as any;

  const baseSubscriptionWithPlan = {
    id: 'sub-1',
    teamId: 'team-1',
    planId: 'plan-1',
    plan: basePlan,
    interval: BillingInterval.MONTH,
    currentPeriodStart: new Date('2024-01-01T00:00:00.000Z'),
    currentPeriodEnd: new Date('2024-02-01T00:00:00.000Z'),
    cancelAtPeriodEnd: false,
    canceledAt: null,
    isActive: true,
    metadata: null,
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    updatedAt: new Date('2024-01-01T00:00:00.000Z'),
  } as any;

  beforeEach(() => {
    coinAccountingService = {
      buildPeriodKey: jest.fn().mockReturnValue('period-key'),
      getRemainingCoins: jest.fn(),
      recordPlanUpgrade: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<CoinAccountingService>;
    coinRedisService = {
      initRemainingIfMissing: jest.fn(),
      applyDeltaIdempotent: jest.fn().mockResolvedValue({
        applied: true,
        remainingAfter: 250,
        reason: 'APPLIED',
      }),
    } as unknown as jest.Mocked<CoinRedisService>;
    coinRefillService = {
      refillInitialForSubscription: jest.fn().mockResolvedValue({
        periodKey: 'period-key',
        allowance: 100,
        remainingAfter: 100,
      }),
    } as unknown as jest.Mocked<CoinRefillService>;
    subscriptionRepository = {
      create: jest.fn(),
      update: jest.fn(),
      findById: jest.fn(),
      findActiveByTeamId: jest.fn(),
      findAll: jest.fn(),
      findAllActive: jest.fn(),
      findDueForRollover: jest.fn(),
    } as unknown as jest.Mocked<SubscriptionRepository>;
    planRepository = {
      findById: jest.fn(),
    } as unknown as jest.Mocked<PlanRepository>;
    planChangeNotificationService = {
      notifyAdminsOfRequest: jest.fn().mockResolvedValue(undefined),
      notifyUserOfDecision: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<PlanChangeNotificationService>;
    notificationService = {
      markMatchingRead: jest.fn().mockResolvedValue({
        matched: 0,
        modified: 0,
      }),
    } as unknown as jest.Mocked<NotificationService>;

    service = new SubscriptionService(
      coinAccountingService,
      coinRedisService,
      coinRefillService,
      subscriptionRepository,
      planRepository,
      planChangeNotificationService,
      notificationService,
    );
  });

  it('creates a subscription with default period start and metadata audit', async () => {
    subscriptionRepository.findActiveByTeamId.mockResolvedValue(null);
    planRepository.findById.mockResolvedValue(basePlan);
    subscriptionRepository.create.mockResolvedValue(baseSubscriptionWithPlan);
    coinRefillService.refillInitialForSubscription.mockResolvedValue({
      periodKey: 'period-key',
      allowance: 100,
      remainingAfter: 100,
    });

    const result = await service.createSubscription(
      {
        teamId: 'team-1',
        planId: 'plan-1',
        interval: BillingInterval.MONTH,
        currentPeriodStart: null,
        cancelAtPeriodEnd: false,
        metadata: { billing: { provider: 'stripe' } },
      } as any,
      'user-1',
    );

    expect(subscriptionRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        teamId: 'team-1',
        planId: 'plan-1',
        currentPeriodStart: expect.any(Date),
        currentPeriodEnd: expect.any(Date),
        metadata: expect.objectContaining({
          billing: { provider: 'stripe' },
          audit: expect.objectContaining({
            createdByUserId: 'user-1',
            updatedByUserId: 'user-1',
            version: 1,
          }),
        }),
      }),
    );
    expect(coinRefillService.refillInitialForSubscription).toHaveBeenCalledWith(
      baseSubscriptionWithPlan,
      'user-1',
    );
    expect(result).toEqual(baseSubscriptionWithPlan);
  });

  it('throws conflict when team already has active subscription', async () => {
    subscriptionRepository.findActiveByTeamId.mockResolvedValue(
      baseSubscriptionWithPlan,
    );

    await expect(
      service.createSubscription(
        {
          teamId: 'team-1',
          planId: 'plan-1',
          interval: BillingInterval.MONTH,
        } as any,
        'user-1',
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('throws when creating subscription with missing plan', async () => {
    subscriptionRepository.findActiveByTeamId.mockResolvedValue(null);
    planRepository.findById.mockResolvedValue(null);

    await expect(
      service.createSubscription(
        {
          teamId: 'team-1',
          planId: 'missing',
          interval: BillingInterval.MONTH,
        } as any,
        'user-1',
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('updates subscription and merges metadata audit/version', async () => {
    subscriptionRepository.findById.mockResolvedValue({
      ...baseSubscriptionWithPlan,
      metadata: {
        billing: { provider: 'stripe', customerId: 'cus_1' },
        audit: {
          createdByUserId: 'owner-1',
          createdAt: '2024-01-01T00:00:00.000Z',
          version: 2,
        },
      },
    });
    subscriptionRepository.update.mockResolvedValue(baseSubscriptionWithPlan);

    await service.updateSubscription(
      'sub-1',
      { metadata: { billing: { externalSubscriptionId: 'sub_ext' } } } as any,
      'admin-1',
    );

    expect(subscriptionRepository.update).toHaveBeenCalledWith(
      'sub-1',
      expect.objectContaining({
        metadata: expect.objectContaining({
          billing: {
            provider: 'stripe',
            customerId: 'cus_1',
            externalSubscriptionId: 'sub_ext',
          },
          audit: expect.objectContaining({
            createdByUserId: 'owner-1',
            updatedByUserId: 'admin-1',
            version: 3,
          }),
        }),
      }),
    );
  });

  it('throws not found when updating missing subscription', async () => {
    subscriptionRepository.findById.mockResolvedValue(null);

    await expect(
      service.updateSubscription('missing', {} as any),
    ).rejects.toThrow(NotFoundException);
  });

  it('upgrades subscription and records upgrade audit metadata', async () => {
    const existing = {
      ...baseSubscriptionWithPlan,
      metadata: { audit: { version: 1, createdByUserId: 'owner-1' } },
      currentPeriodEnd: new Date(Date.now() + 60 * 60 * 1000),
      currentPeriodStart: new Date(Date.now() - 60 * 60 * 1000),
      plan: { ...basePlan, maxCoins: 100 },
    };
    const newPlan = { ...basePlan, id: 'plan-2', maxCoins: 250 };
    subscriptionRepository.findById.mockResolvedValue(existing);
    planRepository.findById.mockResolvedValue(newPlan);
    coinAccountingService.getRemainingCoins.mockResolvedValue({
      ok: true,
      teamId: 'team-1',
      periodKey: 'period-key',
      allowance: 250,
      remaining: 250,
    });
    subscriptionRepository.update.mockResolvedValue({
      ...existing,
      planId: 'plan-2',
      plan: newPlan,
      interval: BillingInterval.ANNUAL,
    });

    const result = await service.upgradeSubscription(
      'sub-1',
      {
        planId: 'plan-2',
        interval: BillingInterval.ANNUAL,
        metadata: { notes: 'manual upgrade' },
      } as any,
      'admin-1',
    );

    expect(coinAccountingService.buildPeriodKey).toHaveBeenCalled();
    expect(coinRedisService.initRemainingIfMissing).toHaveBeenCalledWith(
      'team-1',
      'period-key',
      100,
      expect.any(Number),
    );
    expect(coinRedisService.applyDeltaIdempotent).toHaveBeenCalledWith(
      expect.objectContaining({ teamId: 'team-1', deltaCoins: -150 }),
    );
    expect(coinAccountingService.getRemainingCoins).toHaveBeenCalledWith(
      'team-1',
      {
        periodKey: 'period-key',
        allowanceFallback: 250,
        initIfMissing: false,
      },
    );
    expect(coinAccountingService.recordPlanUpgrade).toHaveBeenCalledWith(
      expect.objectContaining({
        teamId: 'team-1',
        subscriptionId: 'sub-1',
        planId: 'plan-2',
        requesterId: 'admin-1',
        allowance: 250,
        remainingAfter: 250,
        deltaCoins: 150,
        eventId: expect.stringContaining('upgrade:sub-1:plan-2:'),
      }),
    );
    expect(subscriptionRepository.update).toHaveBeenCalledWith(
      'sub-1',
      expect.objectContaining({
        planId: 'plan-2',
        interval: BillingInterval.ANNUAL,
        metadata: expect.objectContaining({
          billing: expect.any(Object),
          notes: 'manual upgrade',
          seating: expect.any(Object),
          audit: expect.objectContaining({
            updatedByUserId: 'admin-1',
            upgradedByUserId: 'admin-1',
            version: 2,
          }),
        }),
      }),
    );
    expect(result.planId).toBe('plan-2');
    expect(result.interval).toBe(BillingInterval.ANNUAL);
  });

  it('throws when upgrading missing subscription or plan', async () => {
    subscriptionRepository.findById.mockResolvedValue(null);
    await expect(
      service.upgradeSubscription('missing', { planId: 'p2' } as any),
    ).rejects.toThrow(NotFoundException);

    subscriptionRepository.findById.mockResolvedValue(baseSubscriptionWithPlan);
    planRepository.findById.mockResolvedValue(null);
    await expect(
      service.upgradeSubscription('sub-1', { planId: 'missing' } as any),
    ).rejects.toThrow(NotFoundException);
  });

  it('removeSubscription returns already-scheduled message when already canceling', async () => {
    subscriptionRepository.findById.mockResolvedValue({
      ...baseSubscriptionWithPlan,
      cancelAtPeriodEnd: true,
    });

    await expect(service.removeSubscription('sub-1')).resolves.toEqual({
      message:
        'Subscription with ID sub-1 is already scheduled to cancel at period end',
    });
    expect(subscriptionRepository.update).not.toHaveBeenCalled();
  });

  it('removeSubscription schedules cancellation before period end', async () => {
    subscriptionRepository.findById.mockResolvedValue({
      ...baseSubscriptionWithPlan,
      currentPeriodEnd: new Date(Date.now() + 60_000),
    });
    subscriptionRepository.update.mockResolvedValue(baseSubscriptionWithPlan);

    const result = await service.removeSubscription('sub-1');

    expect(subscriptionRepository.update).toHaveBeenCalledWith(
      'sub-1',
      expect.objectContaining({
        cancelAtPeriodEnd: true,
        canceledAt: expect.any(Date),
      }),
    );
    expect(result.message).toContain('will be canceled at period end');
  });

  it('removeSubscription deactivates subscription after period end', async () => {
    subscriptionRepository.findById.mockResolvedValue({
      ...baseSubscriptionWithPlan,
      currentPeriodEnd: new Date(Date.now() - 60_000),
    });
    subscriptionRepository.update.mockResolvedValue(baseSubscriptionWithPlan);

    await expect(service.removeSubscription('sub-1')).resolves.toEqual(
      expect.objectContaining({
        message: 'Subscription with ID sub-1 has been canceled',
      }),
    );
    expect(subscriptionRepository.update).toHaveBeenCalledWith(
      'sub-1',
      expect.objectContaining({ isActive: false, cancelAtPeriodEnd: false }),
    );
  });

  it('find methods normalize metadata and enforce not found branches', async () => {
    subscriptionRepository.findAll.mockResolvedValue([
      { ...baseSubscriptionWithPlan, metadata: 'invalid-json' },
      { ...baseSubscriptionWithPlan, id: 'sub-2', metadata: null },
    ] as any);
    subscriptionRepository.findActiveByTeamId.mockResolvedValue({
      ...baseSubscriptionWithPlan,
      metadata: { billing: { provider: 'stripe' } },
    });
    subscriptionRepository.findAllActive.mockResolvedValue([
      baseSubscriptionWithPlan,
    ] as any);
    subscriptionRepository.findDueForRollover.mockResolvedValue([
      baseSubscriptionWithPlan,
    ] as any);
    subscriptionRepository.findById
      .mockResolvedValueOnce(baseSubscriptionWithPlan)
      .mockResolvedValueOnce(null);

    const all = await service.findAll();
    expect(all[0].metadata).toBeUndefined();
    expect(all[1].metadata).toBeNull();

    await expect(service.findActiveByTeam('team-1')).resolves.toEqual(
      expect.objectContaining({
        metadata: { billing: { provider: 'stripe' } },
      }),
    );
    await expect(service.findActiveSubscriptions()).resolves.toHaveLength(1);
    await expect(service.findDueForRollover()).resolves.toHaveLength(1);
    await expect(service.findOne('sub-1')).resolves.toEqual(
      expect.objectContaining({ id: 'sub-1' }),
    );
    await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
  });

  it('findSubForTeam and updateSubscriptionPeriod enforce not found and update correctly', async () => {
    subscriptionRepository.findActiveByTeamId
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(baseSubscriptionWithPlan);
    subscriptionRepository.findById
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(baseSubscriptionWithPlan);
    subscriptionRepository.update.mockResolvedValue({
      ...baseSubscriptionWithPlan,
      currentPeriodStart: new Date('2024-03-01T00:00:00.000Z'),
      currentPeriodEnd: new Date('2024-04-01T00:00:00.000Z'),
    });

    await expect(service.findSubForTeam('team-1')).rejects.toThrow(
      NotFoundException,
    );
    await expect(service.findSubForTeam('team-1')).resolves.toEqual(
      expect.objectContaining({ id: 'sub-1' }),
    );

    await expect(
      service.updateSubscriptionPeriod('missing', {
        start: new Date(),
        end: new Date(),
      } as any),
    ).rejects.toThrow(NotFoundException);

    await expect(
      service.updateSubscriptionPeriod('sub-1', {
        start: new Date('2024-03-01T00:00:00.000Z'),
        end: new Date('2024-04-01T00:00:00.000Z'),
      } as any),
    ).resolves.toEqual(
      expect.objectContaining({
        currentPeriodStart: new Date('2024-03-01T00:00:00.000Z'),
      }),
    );
  });

  it('checkExistingSubscription delegates and addInterval handles all supported intervals', async () => {
    subscriptionRepository.findActiveByTeamId
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(baseSubscriptionWithPlan);

    await expect(service.checkExistingSubscription('team-1')).resolves.toBe(
      false,
    );
    await expect(service.checkExistingSubscription('team-1')).resolves.toBe(
      true,
    );

    const start = new Date(Date.UTC(2024, 0, 15, 12, 0, 0));
    expect(
      service.addInterval(start, BillingInterval.MONTH).getUTCMonth(),
    ).toBe(1);
    expect(
      service.addInterval(start, BillingInterval.QUARTER).getUTCMonth(),
    ).toBe(3);
    expect(
      service.addInterval(start, BillingInterval.SEMIANNUAL).getUTCMonth(),
    ).toBe(6);
    expect(
      service.addInterval(start, BillingInterval.ANNUAL).getUTCFullYear(),
    ).toBe(2025);
  });

  it('creates a pending plan change request and notifies admins with subscription metadata', async () => {
    subscriptionRepository.findById.mockResolvedValue(baseSubscriptionWithPlan);
    planRepository.findById.mockResolvedValue({
      ...basePlan,
      id: 'plan-2',
      name: 'Pro',
    });
    subscriptionRepository.update.mockResolvedValue({
      ...baseSubscriptionWithPlan,
      metadata: {
        pendingPlanChange: {
          requestedPlanId: 'plan-2',
          requestedInterval: BillingInterval.ANNUAL,
          requestedAt: '2026-03-29T00:00:00.000Z',
          requestedByUserId: 'user-9',
        },
      },
    });

    await service.requestPlanChange(
      'sub-1',
      { planId: 'plan-2', interval: BillingInterval.ANNUAL },
      'user-9',
    );

    expect(subscriptionRepository.update).toHaveBeenCalledWith(
      'sub-1',
      expect.objectContaining({
        metadata: expect.objectContaining({
          pendingPlanChange: expect.objectContaining({
            requestedPlanId: 'plan-2',
            requestedInterval: BillingInterval.ANNUAL,
            requestedByUserId: 'user-9',
          }),
        }),
      }),
    );
    expect(
      planChangeNotificationService.notifyAdminsOfRequest,
    ).toHaveBeenCalledWith({
      subscriptionId: 'sub-1',
      requesterId: 'user-9',
      currentPlanName: 'Free',
      requestedPlanName: 'Pro',
      requestedInterval: BillingInterval.ANNUAL,
    });
  });

  it('clears matching admin notifications after approving a pending plan change', async () => {
    subscriptionRepository.findById.mockResolvedValue({
      ...baseSubscriptionWithPlan,
      metadata: {
        pendingPlanChange: {
          requestedPlanId: 'plan-2',
          requestedInterval: BillingInterval.MONTH,
          requestedAt: '2026-03-29T00:00:00.000Z',
          requestedByUserId: 'user-9',
        },
      },
    });
    jest.spyOn(service, 'upgradeSubscription').mockResolvedValue({
      ...baseSubscriptionWithPlan,
      id: 'sub-1',
      planId: 'plan-2',
      plan: {
        id: 'plan-2',
        name: 'Pro',
        maxCoins: 500,
      },
      metadata: {
        pendingPlanChange: {
          requestedPlanId: 'plan-2',
        },
      },
    });
    subscriptionRepository.update.mockResolvedValue({
      ...baseSubscriptionWithPlan,
      id: 'sub-1',
      planId: 'plan-2',
      plan: {
        id: 'plan-2',
        name: 'Pro',
        maxCoins: 500,
      },
      metadata: {},
    });

    await service.approvePlanChange('sub-1', 'admin-1');

    expect(notificationService.markMatchingRead).toHaveBeenCalledWith({
      type: 'plan_change_request',
      metadata: { subscriptionId: 'sub-1' },
    });
    expect(
      planChangeNotificationService.notifyUserOfDecision,
    ).toHaveBeenCalledWith({
      requesterId: 'user-9',
      decision: 'approved',
      planName: 'Pro',
    });
  });

  it('clears matching admin notifications after rejecting a pending plan change', async () => {
    subscriptionRepository.findById.mockResolvedValue({
      ...baseSubscriptionWithPlan,
      metadata: {
        pendingPlanChange: {
          requestedPlanId: 'plan-2',
          requestedInterval: BillingInterval.MONTH,
          requestedAt: '2026-03-29T00:00:00.000Z',
          requestedByUserId: 'user-9',
        },
      },
    });
    planRepository.findById.mockResolvedValue({
      ...basePlan,
      id: 'plan-2',
      name: 'Pro',
      maxCoins: 500,
    });
    subscriptionRepository.update.mockResolvedValue({
      ...baseSubscriptionWithPlan,
      metadata: {},
    });

    await service.rejectPlanChange('sub-1');

    expect(notificationService.markMatchingRead).toHaveBeenCalledWith({
      type: 'plan_change_request',
      metadata: { subscriptionId: 'sub-1' },
    });
    expect(
      planChangeNotificationService.notifyUserOfDecision,
    ).toHaveBeenCalledWith({
      requesterId: 'user-9',
      decision: 'rejected',
      planName: 'Pro',
    });
  });
});
