import { CoinRefillService } from '../../coins/services/coin-refill.service';

describe('CoinRefillService', () => {
  const coinRedis = {
    initRemainingIfMissing: jest.fn(),
    getRemaining: jest.fn(),
    applyDeltaIdempotent: jest.fn(),
  };

  const coinLedgerRepo = {
    createRefillIfNotExists: jest.fn(),
  };

  const coinBalanceRepo = {
    upsertRefill: jest.fn(),
  };

  let service: CoinRefillService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CoinRefillService(
      coinRedis as never,
      coinLedgerRepo as never,
      coinBalanceRepo as never,
    );
  });

  // ── buildPeriodKey ─────────────────────────────────────────────────────────

  describe('buildPeriodKey', () => {
    it('builds period key from subscription ID and date range', () => {
      const start = new Date('2025-01-01T00:00:00Z');
      const end = new Date('2025-02-01T00:00:00Z');
      const key = service.buildPeriodKey('sub-1', start, end);
      expect(key).toBe(`sub-1:${start.getTime()}-${end.getTime()}`);
    });
  });

  // ── refillInitialForSubscription ───────────────────────────────────────────

  describe('refillInitialForSubscription', () => {
    const sub = {
      id: 'sub-1',
      teamId: 'team1',
      planId: 'plan-1',
      currentPeriodStart: new Date('2025-01-01T00:00:00Z'),
      currentPeriodEnd: new Date('2025-02-01T00:00:00Z'),
      plan: { maxCoins: 1000 },
      interval: 'monthly',
    };

    it('initializes Redis, reads remaining, creates ledger and balance', async () => {
      coinRedis.initRemainingIfMissing.mockResolvedValue(undefined);
      coinRedis.getRemaining.mockResolvedValue(1000);
      coinLedgerRepo.createRefillIfNotExists.mockResolvedValue(undefined);
      coinBalanceRepo.upsertRefill.mockResolvedValue({});

      const result = await service.refillInitialForSubscription(
        sub as never,
        'requester-1',
      );

      expect(coinRedis.initRemainingIfMissing).toHaveBeenCalledWith(
        'team1',
        expect.any(String),
        1000,
        expect.any(Number),
      );
      expect(result.allowance).toBe(1000);
      expect(result.remainingAfter).toBe(1000);
      expect(coinLedgerRepo.createRefillIfNotExists).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'requester-1',
          teamId: 'team1',
          allowance: 1000,
          debtApplied: 0,
        }),
      );
      expect(coinBalanceRepo.upsertRefill).toHaveBeenCalled();
    });

    it('uses allowance when Redis returns null for remaining', async () => {
      coinRedis.initRemainingIfMissing.mockResolvedValue(undefined);
      coinRedis.getRemaining.mockResolvedValue(null);
      coinLedgerRepo.createRefillIfNotExists.mockResolvedValue(undefined);
      coinBalanceRepo.upsertRefill.mockResolvedValue({});

      const result = await service.refillInitialForSubscription(
        sub as never,
        'requester-1',
      );

      expect(result.remainingAfter).toBe(1000);
    });

    it('ensures minimum TTL of 60 seconds', async () => {
      const pastSub = {
        ...sub,
        currentPeriodEnd: new Date(Date.now() - 10000),
      };
      coinRedis.initRemainingIfMissing.mockResolvedValue(undefined);
      coinRedis.getRemaining.mockResolvedValue(1000);
      coinLedgerRepo.createRefillIfNotExists.mockResolvedValue(undefined);
      coinBalanceRepo.upsertRefill.mockResolvedValue({});

      await service.refillInitialForSubscription(pastSub as never, 'r1');

      expect(coinRedis.initRemainingIfMissing).toHaveBeenCalledWith(
        'team1',
        expect.any(String),
        1000,
        60,
      );
    });
  });

  // ── refillAfterRollover ────────────────────────────────────────────────────

  describe('refillAfterRollover', () => {
    const baseArgs = {
      teamId: 'team1',
      subscriptionId: 'sub-1',
      planId: 'plan-1',
      allowance: 1000,
      newPeriodKey: 'sub-1:new',
      newPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      debt: 0,
    };

    it('initializes Redis, applies delta, creates ledger and balance', async () => {
      coinRedis.initRemainingIfMissing.mockResolvedValue(undefined);
      coinRedis.applyDeltaIdempotent.mockResolvedValue({
        applied: true,
        remainingAfter: 1000,
        reason: 'APPLIED',
      });
      coinLedgerRepo.createRefillIfNotExists.mockResolvedValue(undefined);
      coinBalanceRepo.upsertRefill.mockResolvedValue({});

      const result = await service.refillAfterRollover(baseArgs);

      expect(result.remainingAfter).toBe(1000);
      expect(coinRedis.initRemainingIfMissing).toHaveBeenCalled();
      expect(coinRedis.applyDeltaIdempotent).toHaveBeenCalledWith(
        expect.objectContaining({
          teamId: 'team1',
          deltaCoins: 0,
        }),
      );
      expect(coinLedgerRepo.createRefillIfNotExists).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'system',
          teamId: 'team1',
          debtApplied: 0,
        }),
      );
    });

    it('applies debt from previous period', async () => {
      coinRedis.initRemainingIfMissing.mockResolvedValue(undefined);
      coinRedis.applyDeltaIdempotent.mockResolvedValue({
        applied: true,
        remainingAfter: 950,
        reason: 'APPLIED',
      });
      coinLedgerRepo.createRefillIfNotExists.mockResolvedValue(undefined);
      coinBalanceRepo.upsertRefill.mockResolvedValue({});

      const result = await service.refillAfterRollover({
        ...baseArgs,
        debt: 50,
      });

      expect(result.remainingAfter).toBe(950);
      expect(coinLedgerRepo.createRefillIfNotExists).toHaveBeenCalledWith(
        expect.objectContaining({ debtApplied: 50 }),
      );
    });

    it('falls back to allowance-debt when delta result lacks remainingAfter', async () => {
      coinRedis.initRemainingIfMissing.mockResolvedValue(undefined);
      coinRedis.applyDeltaIdempotent.mockResolvedValue({
        applied: true,
      });
      coinLedgerRepo.createRefillIfNotExists.mockResolvedValue(undefined);
      coinBalanceRepo.upsertRefill.mockResolvedValue({});

      const result = await service.refillAfterRollover({
        ...baseArgs,
        debt: 100,
      });

      expect(result.remainingAfter).toBe(900);
    });

    it('throws when Redis init fails', async () => {
      coinRedis.initRemainingIfMissing.mockRejectedValue(
        new Error('REDIS DOWN'),
      );

      await expect(service.refillAfterRollover(baseArgs)).rejects.toThrow(
        'REDIS DOWN',
      );
    });

    it('throws when delta application fails', async () => {
      coinRedis.initRemainingIfMissing.mockResolvedValue(undefined);
      coinRedis.applyDeltaIdempotent.mockRejectedValue(new Error('Lua error'));

      await expect(service.refillAfterRollover(baseArgs)).rejects.toThrow(
        'Lua error',
      );
    });

    it('throws when ledger creation fails', async () => {
      coinRedis.initRemainingIfMissing.mockResolvedValue(undefined);
      coinRedis.applyDeltaIdempotent.mockResolvedValue({
        applied: true,
        remainingAfter: 1000,
      });
      coinLedgerRepo.createRefillIfNotExists.mockRejectedValue(
        new Error('Mongo error'),
      );

      await expect(service.refillAfterRollover(baseArgs)).rejects.toThrow(
        'Mongo error',
      );
    });

    it('throws when balance upsert fails', async () => {
      coinRedis.initRemainingIfMissing.mockResolvedValue(undefined);
      coinRedis.applyDeltaIdempotent.mockResolvedValue({
        applied: true,
        remainingAfter: 1000,
      });
      coinLedgerRepo.createRefillIfNotExists.mockResolvedValue(undefined);
      coinBalanceRepo.upsertRefill.mockRejectedValue(
        new Error('Balance upsert failed'),
      );

      await expect(service.refillAfterRollover(baseArgs)).rejects.toThrow(
        'Balance upsert failed',
      );
    });

    it('ensures minimum TTL of 60 seconds when period end is in the past', async () => {
      coinRedis.initRemainingIfMissing.mockResolvedValue(undefined);
      coinRedis.applyDeltaIdempotent.mockResolvedValue({
        applied: true,
        remainingAfter: 1000,
      });
      coinLedgerRepo.createRefillIfNotExists.mockResolvedValue(undefined);
      coinBalanceRepo.upsertRefill.mockResolvedValue({});

      await service.refillAfterRollover({
        ...baseArgs,
        newPeriodEnd: new Date(Date.now() - 10000),
      });

      expect(coinRedis.initRemainingIfMissing).toHaveBeenCalledWith(
        'team1',
        expect.any(String),
        1000,
        60,
      );
    });
  });
});
