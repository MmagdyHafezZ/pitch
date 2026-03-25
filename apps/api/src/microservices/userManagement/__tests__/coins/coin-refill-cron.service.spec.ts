import { CoinRefillCron } from '../../coins/services/coin-refill-cron.service';

describe('CoinRefillCron', () => {
  const coinRefillService = {
    buildPeriodKey: jest.fn(),
    refillAfterRollover: jest.fn(),
  };

  const coinAccountingService = {
    getRemainingCoins: jest.fn(),
  };

  const subscriptionService = {
    findDueForRollover: jest.fn(),
    removeSubscription: jest.fn(),
    addInterval: jest.fn(),
    updateSubscriptionPeriod: jest.fn(),
  };

  let cron: CoinRefillCron;

  beforeEach(() => {
    jest.clearAllMocks();
    cron = new CoinRefillCron(
      coinRefillService as never,
      coinAccountingService as never,
      subscriptionService as never,
    );
  });

  describe('rolloverSubscriptions', () => {
    it('processes zero subscriptions gracefully', async () => {
      subscriptionService.findDueForRollover.mockResolvedValue([]);

      await cron.rolloverSubscriptions();

      expect(subscriptionService.findDueForRollover).toHaveBeenCalled();
    });

    it('cancels subscription when cancelAtPeriodEnd is true', async () => {
      subscriptionService.findDueForRollover.mockResolvedValue([
        {
          id: 'sub-1',
          teamId: 'team1',
          planId: 'plan-1',
          cancelAtPeriodEnd: true,
          plan: { maxCoins: 1000 },
          currentPeriodStart: new Date('2025-01-01'),
          currentPeriodEnd: new Date('2025-02-01'),
          interval: 'monthly',
        },
      ]);

      await cron.rolloverSubscriptions();

      expect(subscriptionService.removeSubscription).toHaveBeenCalledWith(
        'sub-1',
      );
      expect(coinRefillService.refillAfterRollover).not.toHaveBeenCalled();
    });

    it('processes rollover with zero debt', async () => {
      const sub = {
        id: 'sub-1',
        teamId: 'team1',
        planId: 'plan-1',
        cancelAtPeriodEnd: false,
        plan: { maxCoins: 1000 },
        currentPeriodStart: new Date('2025-01-01'),
        currentPeriodEnd: new Date('2025-02-01'),
        interval: 'monthly',
      };

      subscriptionService.findDueForRollover.mockResolvedValue([sub]);
      coinRefillService.buildPeriodKey.mockReturnValue('sub-1:old');
      coinAccountingService.getRemainingCoins.mockResolvedValue({
        ok: true,
        remaining: 200,
      });
      subscriptionService.addInterval.mockReturnValue(new Date('2025-03-01'));
      coinRefillService.refillAfterRollover.mockResolvedValue({
        remainingAfter: 1000,
      });
      subscriptionService.updateSubscriptionPeriod.mockResolvedValue({});

      await cron.rolloverSubscriptions();

      expect(coinRefillService.refillAfterRollover).toHaveBeenCalledWith(
        expect.objectContaining({
          teamId: 'team1',
          debt: 0,
          allowance: 1000,
        }),
      );
      expect(subscriptionService.updateSubscriptionPeriod).toHaveBeenCalled();
    });

    it('processes rollover with debt (negative remaining)', async () => {
      const sub = {
        id: 'sub-1',
        teamId: 'team1',
        planId: 'plan-1',
        cancelAtPeriodEnd: false,
        plan: { maxCoins: 1000 },
        currentPeriodStart: new Date('2025-01-01'),
        currentPeriodEnd: new Date('2025-02-01'),
        interval: 'monthly',
      };

      subscriptionService.findDueForRollover.mockResolvedValue([sub]);
      coinRefillService.buildPeriodKey.mockReturnValue('sub-1:old');
      coinAccountingService.getRemainingCoins.mockResolvedValue({
        ok: true,
        remaining: -50,
      });
      subscriptionService.addInterval.mockReturnValue(new Date('2025-03-01'));
      coinRefillService.refillAfterRollover.mockResolvedValue({
        remainingAfter: 950,
      });
      subscriptionService.updateSubscriptionPeriod.mockResolvedValue({});

      await cron.rolloverSubscriptions();

      expect(coinRefillService.refillAfterRollover).toHaveBeenCalledWith(
        expect.objectContaining({
          debt: 50,
        }),
      );
    });

    it('skips rollover when balance check fails', async () => {
      const sub = {
        id: 'sub-1',
        teamId: 'team1',
        planId: 'plan-1',
        cancelAtPeriodEnd: false,
        plan: { maxCoins: 1000 },
        currentPeriodStart: new Date('2025-01-01'),
        currentPeriodEnd: new Date('2025-02-01'),
        interval: 'monthly',
      };

      subscriptionService.findDueForRollover.mockResolvedValue([sub]);
      coinRefillService.buildPeriodKey.mockReturnValue('sub-1:old');
      coinAccountingService.getRemainingCoins.mockResolvedValue({
        ok: false,
        reason: 'NO_ACTIVE_SUBSCRIPTION',
      });

      await cron.rolloverSubscriptions();

      expect(coinRefillService.refillAfterRollover).not.toHaveBeenCalled();
    });

    it('catches and logs errors without stopping other subs', async () => {
      const subs = [
        {
          id: 'sub-1',
          teamId: 'team1',
          planId: 'plan-1',
          cancelAtPeriodEnd: false,
          plan: { maxCoins: 1000 },
          currentPeriodStart: new Date('2025-01-01'),
          currentPeriodEnd: new Date('2025-02-01'),
          interval: 'monthly',
        },
        {
          id: 'sub-2',
          teamId: 'team2',
          planId: 'plan-1',
          cancelAtPeriodEnd: true,
          plan: { maxCoins: 1000 },
          currentPeriodStart: new Date('2025-01-01'),
          currentPeriodEnd: new Date('2025-02-01'),
          interval: 'monthly',
        },
      ];

      subscriptionService.findDueForRollover.mockResolvedValue(subs);
      coinRefillService.buildPeriodKey.mockReturnValue('sub-1:old');
      coinAccountingService.getRemainingCoins.mockRejectedValue(
        new Error('DB failure'),
      );
      subscriptionService.removeSubscription.mockResolvedValue({});

      await expect(cron.rolloverSubscriptions()).resolves.toBeUndefined();
      expect(subscriptionService.removeSubscription).toHaveBeenCalledWith(
        'sub-2',
      );
    });

    it('handles non-Error thrown values', async () => {
      const sub = {
        id: 'sub-1',
        teamId: 'team1',
        planId: 'plan-1',
        cancelAtPeriodEnd: false,
        plan: { maxCoins: 1000 },
        currentPeriodStart: new Date('2025-01-01'),
        currentPeriodEnd: new Date('2025-02-01'),
        interval: 'monthly',
      };

      subscriptionService.findDueForRollover.mockResolvedValue([sub]);
      coinRefillService.buildPeriodKey.mockReturnValue('sub-1:old');
      coinAccountingService.getRemainingCoins.mockRejectedValue('string error');

      await expect(cron.rolloverSubscriptions()).resolves.toBeUndefined();
    });

    it('handles non-string, non-Error thrown values', async () => {
      const sub = {
        id: 'sub-1',
        teamId: 'team1',
        planId: 'plan-1',
        cancelAtPeriodEnd: false,
        plan: { maxCoins: 1000 },
        currentPeriodStart: new Date('2025-01-01'),
        currentPeriodEnd: new Date('2025-02-01'),
        interval: 'monthly',
      };

      subscriptionService.findDueForRollover.mockResolvedValue([sub]);
      coinRefillService.buildPeriodKey.mockReturnValue('sub-1:old');
      coinAccountingService.getRemainingCoins.mockRejectedValue({ code: 42 });

      await expect(cron.rolloverSubscriptions()).resolves.toBeUndefined();
    });
  });
});
