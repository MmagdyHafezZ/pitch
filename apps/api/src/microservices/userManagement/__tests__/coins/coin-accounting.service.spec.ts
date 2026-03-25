jest.mock('mongoose', () => ({
  Model: class {},
  Document: class {},
  Schema: class {},
}));

jest.mock('@nestjs/mongoose', () => ({
  InjectModel: () => () => {},
  Prop: () => () => {},
  Schema: () => (cls: any) => cls,
  SchemaFactory: { createForClass: () => ({ index: jest.fn() }) },
}));

jest.mock('ioredis', () => jest.fn(() => ({})));

jest.mock('crypto', () => ({
  randomUUID: jest.fn(() => 'mock-uuid'),
}));

import { CoinAccountingService } from '../../coins/services/coin-accounting.service';
import { CoinLedgerType } from '../../mongo/schemas/coin-ledger.schema';

describe('CoinAccountingService', () => {
  const redis = {
    getRemaining: jest.fn(),
    initRemainingIfMissing: jest.fn(),
    reserveIfEnough: jest.fn(),
    applyDeltaIdempotent: jest.fn(),
  };

  const coinLedgerRepo = {
    create: jest.fn(),
    findByReservationId: jest.fn(),
    findAllByReservationId: jest.fn(),
  };

  const coinBalanceRepo = {
    getRemaining: jest.fn(),
    upsertReserve: jest.fn(),
    upsertAdjust: jest.fn(),
  };

  const subscriptionRepository = {
    findActiveByTeamId: jest.fn(),
  };

  const planRepository = {
    findById: jest.fn(),
  };

  let service: CoinAccountingService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CoinAccountingService(
      redis as never,
      coinLedgerRepo as never,
      coinBalanceRepo as never,
      subscriptionRepository as never,
      planRepository as never,
    );
  });

  // ── buildPeriodKey ─────────────────────────────────────────────────────────

  describe('buildPeriodKey', () => {
    it('builds period key from subscriptionId, startMs, endMs', () => {
      const key = service.buildPeriodKey({
        subscriptionId: 'sub-1',
        startMs: 1000,
        endMs: 2000,
      });
      expect(key).toBe('sub-1:1000-2000');
    });
  });

  // ── getRemainingCoins ──────────────────────────────────────────────────────

  describe('getRemainingCoins', () => {
    describe('with explicit periodKey', () => {
      it('returns from Redis when available', async () => {
        redis.getRemaining.mockResolvedValue(500);

        const result = await service.getRemainingCoins('team1', {
          periodKey: 'pk1',
          allowanceFallback: 1000,
        });

        expect(result).toEqual({
          ok: true,
          teamId: 'team1',
          periodKey: 'pk1',
          allowance: 1000,
          remaining: 500,
        });
      });

      it('falls back to MongoDB when Redis returns null', async () => {
        redis.getRemaining.mockResolvedValue(null);
        coinBalanceRepo.getRemaining.mockResolvedValue(750);

        const result = await service.getRemainingCoins('team1', {
          periodKey: 'pk1',
          allowanceFallback: 1000,
        });

        expect(result).toEqual({
          ok: true,
          teamId: 'team1',
          periodKey: 'pk1',
          allowance: 1000,
          remaining: 750,
        });
      });

      it('uses allowanceFallback when MongoDB also returns null', async () => {
        redis.getRemaining.mockResolvedValue(null);
        coinBalanceRepo.getRemaining.mockResolvedValue(null);

        const result = await service.getRemainingCoins('team1', {
          periodKey: 'pk1',
          allowanceFallback: 1000,
        });

        expect(result).toEqual({
          ok: true,
          teamId: 'team1',
          periodKey: 'pk1',
          allowance: 1000,
          remaining: 1000,
        });
      });

      it('defaults allowance to 0 when allowanceFallback not provided', async () => {
        redis.getRemaining.mockResolvedValue(300);

        const result = await service.getRemainingCoins('team1', {
          periodKey: 'pk1',
        });

        expect(result).toEqual({
          ok: true,
          teamId: 'team1',
          periodKey: 'pk1',
          allowance: 0,
          remaining: 300,
        });
      });
    });

    describe('without explicit periodKey (subscription lookup)', () => {
      const mockSub = {
        id: 'sub-1',
        teamId: 'team1',
        planId: 'plan-1',
        currentPeriodStart: 1700000000000,
        currentPeriodEnd: 1702592000000,
      };

      const mockPlan = {
        id: 'plan-1',
        isActive: true,
        maxCoins: 1000,
      };

      it('returns NO_ACTIVE_SUBSCRIPTION when no sub found', async () => {
        subscriptionRepository.findActiveByTeamId.mockResolvedValue(null);

        const result = await service.getRemainingCoins('team1');

        expect(result).toEqual({ ok: false, reason: 'NO_ACTIVE_SUBSCRIPTION' });
      });

      it('returns NO_ACTIVE_SUBSCRIPTION when plan not found', async () => {
        subscriptionRepository.findActiveByTeamId.mockResolvedValue(mockSub);
        planRepository.findById.mockResolvedValue(null);

        const result = await service.getRemainingCoins('team1');

        expect(result).toEqual({ ok: false, reason: 'NO_ACTIVE_SUBSCRIPTION' });
      });

      it('returns NO_ACTIVE_SUBSCRIPTION when plan is inactive', async () => {
        subscriptionRepository.findActiveByTeamId.mockResolvedValue(mockSub);
        planRepository.findById.mockResolvedValue({
          ...mockPlan,
          isActive: false,
        });

        const result = await service.getRemainingCoins('team1');

        expect(result).toEqual({ ok: false, reason: 'NO_ACTIVE_SUBSCRIPTION' });
      });

      it('initializes Redis and returns remaining from Redis', async () => {
        subscriptionRepository.findActiveByTeamId.mockResolvedValue(mockSub);
        planRepository.findById.mockResolvedValue(mockPlan);
        redis.initRemainingIfMissing.mockResolvedValue(undefined);
        redis.getRemaining.mockResolvedValue(800);

        const result = await service.getRemainingCoins('team1');

        expect(redis.initRemainingIfMissing).toHaveBeenCalled();
        expect(result).toEqual(
          expect.objectContaining({
            ok: true,
            teamId: 'team1',
            allowance: 1000,
            remaining: 800,
          }),
        );
      });

      it('skips init when initIfMissing is false', async () => {
        subscriptionRepository.findActiveByTeamId.mockResolvedValue(mockSub);
        planRepository.findById.mockResolvedValue(mockPlan);
        redis.getRemaining.mockResolvedValue(800);

        await service.getRemainingCoins('team1', { initIfMissing: false });

        expect(redis.initRemainingIfMissing).not.toHaveBeenCalled();
      });

      it('falls back to MongoDB when Redis returns null after init', async () => {
        subscriptionRepository.findActiveByTeamId.mockResolvedValue(mockSub);
        planRepository.findById.mockResolvedValue(mockPlan);
        redis.initRemainingIfMissing.mockResolvedValue(undefined);
        redis.getRemaining.mockResolvedValue(null);
        coinBalanceRepo.getRemaining.mockResolvedValue(600);

        const result = await service.getRemainingCoins('team1');

        expect(result).toEqual(
          expect.objectContaining({
            ok: true,
            remaining: 600,
          }),
        );
      });

      it('uses allowance when both Redis and MongoDB return null', async () => {
        subscriptionRepository.findActiveByTeamId.mockResolvedValue(mockSub);
        planRepository.findById.mockResolvedValue(mockPlan);
        redis.initRemainingIfMissing.mockResolvedValue(undefined);
        redis.getRemaining.mockResolvedValue(null);
        coinBalanceRepo.getRemaining.mockResolvedValue(null);

        const result = await service.getRemainingCoins('team1');

        expect(result).toEqual(
          expect.objectContaining({
            ok: true,
            remaining: 1000,
          }),
        );
      });

      it('normalizes epoch seconds to ms', async () => {
        const subWithSeconds = {
          ...mockSub,
          currentPeriodStart: 1700000000,
          currentPeriodEnd: 1702592000,
        };
        subscriptionRepository.findActiveByTeamId.mockResolvedValue(
          subWithSeconds,
        );
        planRepository.findById.mockResolvedValue(mockPlan);
        redis.initRemainingIfMissing.mockResolvedValue(undefined);
        redis.getRemaining.mockResolvedValue(500);

        const result = await service.getRemainingCoins('team1');

        expect(result).toEqual(
          expect.objectContaining({ ok: true, remaining: 500 }),
        );
      });
    });
  });

  // ── reserveCoins ───────────────────────────────────────────────────────────

  describe('reserveCoins', () => {
    const dto = {
      teamId: 'team1',
      userId: 'user1',
      requestId: 'req-1',
      estimatedCoins: 100,
      sessionId: 'session-1',
      idempotencyKey: 'idemp-1',
    };

    const mockSub = {
      id: 'sub-1',
      teamId: 'team1',
      planId: 'plan-1',
      currentPeriodStart: 1700000000000,
      currentPeriodEnd: 1702592000000,
    };

    const mockPlan = {
      id: 'plan-1',
      isActive: true,
      maxCoins: 1000,
    };

    it('returns NO_ACTIVE_SUBSCRIPTION when no entitlement', async () => {
      subscriptionRepository.findActiveByTeamId.mockResolvedValue(null);

      const result = await service.reserveCoins(dto);

      expect(result).toEqual({
        approved: false,
        reason: 'NO_ACTIVE_SUBSCRIPTION',
      });
    });

    it('returns INSUFFICIENT_COINS when reserve is denied', async () => {
      subscriptionRepository.findActiveByTeamId.mockResolvedValue(mockSub);
      planRepository.findById.mockResolvedValue(mockPlan);
      redis.initRemainingIfMissing.mockResolvedValue(undefined);
      redis.reserveIfEnough.mockResolvedValue({ approved: false });

      const result = await service.reserveCoins(dto);

      expect(result).toEqual({
        approved: false,
        reason: 'INSUFFICIENT_COINS',
      });
    });

    it('returns approved without creating ledger when already processed', async () => {
      subscriptionRepository.findActiveByTeamId.mockResolvedValue(mockSub);
      planRepository.findById.mockResolvedValue(mockPlan);
      redis.initRemainingIfMissing.mockResolvedValue(undefined);
      redis.reserveIfEnough.mockResolvedValue({
        approved: true,
        alreadyProcessed: true,
        remainingAfter: 900,
      });

      const result = await service.reserveCoins(dto);

      expect(result.approved).toBe(true);
      expect(result.remainingAfter).toBe(900);
      expect(coinLedgerRepo.create).not.toHaveBeenCalled();
      expect(coinBalanceRepo.upsertReserve).not.toHaveBeenCalled();
    });

    it('creates ledger and balance entries on successful reserve', async () => {
      subscriptionRepository.findActiveByTeamId.mockResolvedValue(mockSub);
      planRepository.findById.mockResolvedValue(mockPlan);
      redis.initRemainingIfMissing.mockResolvedValue(undefined);
      redis.reserveIfEnough.mockResolvedValue({
        approved: true,
        alreadyProcessed: false,
        remainingAfter: 900,
      });
      coinLedgerRepo.create.mockResolvedValue({});
      coinBalanceRepo.upsertReserve.mockResolvedValue({});

      const result = await service.reserveCoins(dto);

      expect(result.approved).toBe(true);
      expect(result.reservationId).toBe('mock-uuid');
      expect(coinLedgerRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: CoinLedgerType.RESERVE,
          reservationId: 'mock-uuid',
          teamId: 'team1',
          estimatedCoins: 100,
        }),
      );
      expect(coinBalanceRepo.upsertReserve).toHaveBeenCalledWith(
        expect.objectContaining({
          teamId: 'team1',
          reservationId: 'mock-uuid',
          remainingAfter: 900,
        }),
      );
    });
  });

  // ── applyAdjustment ────────────────────────────────────────────────────────

  describe('applyAdjustment', () => {
    const event = {
      eventId: 'evt-1',
      reservationId: 'res-1',
      teamId: 'team1',
      periodKey: 'pk1',
      deltaCoins: -20,
      requestId: 'req-1',
    };

    it('throws when reservation not found', async () => {
      coinLedgerRepo.findByReservationId.mockResolvedValue(null);

      await expect(service.applyAdjustment(event)).rejects.toThrow(
        'Could not find the corresponding RESERVE entry',
      );
    });

    it('throws when no RESERVE exists in ledger', async () => {
      coinLedgerRepo.findByReservationId.mockResolvedValue({
        userId: 'u1',
        subscriptionId: 'sub-1',
        planId: 'plan-1',
      });
      coinLedgerRepo.findAllByReservationId.mockResolvedValue([]);

      await expect(service.applyAdjustment(event)).rejects.toThrow(
        'Cannot ADJUST without RESERVE',
      );
    });

    it('throws when already adjusted', async () => {
      coinLedgerRepo.findByReservationId.mockResolvedValue({
        userId: 'u1',
        subscriptionId: 'sub-1',
        planId: 'plan-1',
      });
      coinLedgerRepo.findAllByReservationId.mockResolvedValue([
        { type: CoinLedgerType.RESERVE },
        { type: CoinLedgerType.ADJUST },
      ]);

      await expect(service.applyAdjustment(event)).rejects.toThrow(
        'already adjusted',
      );
    });

    it('throws when more than 2 entries exist', async () => {
      coinLedgerRepo.findByReservationId.mockResolvedValue({
        userId: 'u1',
        subscriptionId: 'sub-1',
        planId: 'plan-1',
      });
      coinLedgerRepo.findAllByReservationId.mockResolvedValue([
        { type: CoinLedgerType.RESERVE },
        { type: CoinLedgerType.ADJUST },
        { type: CoinLedgerType.ADJUST },
      ]);

      await expect(service.applyAdjustment(event)).rejects.toThrow(
        'more than 2 entries',
      );
    });

    it('silently returns when delta already processed', async () => {
      coinLedgerRepo.findByReservationId.mockResolvedValue({
        userId: 'u1',
        subscriptionId: 'sub-1',
        planId: 'plan-1',
        estimatedCoins: 100,
      });
      coinLedgerRepo.findAllByReservationId.mockResolvedValue([
        { type: CoinLedgerType.RESERVE },
      ]);
      redis.applyDeltaIdempotent.mockResolvedValue({
        applied: false,
        reason: 'ALREADY_PROCESSED',
      });

      await expect(service.applyAdjustment(event)).resolves.toBeUndefined();
      expect(coinLedgerRepo.create).not.toHaveBeenCalled();
    });

    it('throws when remaining is already negative', async () => {
      coinLedgerRepo.findByReservationId.mockResolvedValue({
        userId: 'u1',
        subscriptionId: 'sub-1',
        planId: 'plan-1',
        estimatedCoins: 100,
      });
      coinLedgerRepo.findAllByReservationId.mockResolvedValue([
        { type: CoinLedgerType.RESERVE },
      ]);
      redis.applyDeltaIdempotent.mockResolvedValue({
        applied: false,
        reason: 'REMAINING_ALREADY_NEGATIVE',
        remainingAfter: -5,
      });

      await expect(service.applyAdjustment(event)).rejects.toThrow(
        'remaining is already negative',
      );
    });

    it('throws when remaining key missing', async () => {
      coinLedgerRepo.findByReservationId.mockResolvedValue({
        userId: 'u1',
        subscriptionId: 'sub-1',
        planId: 'plan-1',
        estimatedCoins: 100,
      });
      coinLedgerRepo.findAllByReservationId.mockResolvedValue([
        { type: CoinLedgerType.RESERVE },
      ]);
      redis.applyDeltaIdempotent.mockResolvedValue({
        applied: false,
        reason: 'MISSING_REMAINING_KEY',
      });

      await expect(service.applyAdjustment(event)).rejects.toThrow(
        'missing remaining key',
      );
    });

    it('creates ADJUST ledger and balance on success', async () => {
      const reserveEntry = {
        userId: 'u1',
        subscriptionId: 'sub-1',
        planId: 'plan-1',
        estimatedCoins: 100,
      };
      coinLedgerRepo.findByReservationId.mockResolvedValue(reserveEntry);
      coinLedgerRepo.findAllByReservationId.mockResolvedValue([
        { type: CoinLedgerType.RESERVE },
      ]);
      redis.applyDeltaIdempotent.mockResolvedValue({
        applied: true,
        remainingAfter: 920,
        reason: 'APPLIED',
      });
      coinLedgerRepo.create.mockResolvedValue({});
      coinBalanceRepo.upsertAdjust.mockResolvedValue({});

      await service.applyAdjustment(event);

      expect(coinLedgerRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: CoinLedgerType.ADJUST,
          eventId: 'evt-1',
          reservationId: 'res-1',
          deltaCoins: -20,
          userId: 'u1',
        }),
      );
      expect(coinBalanceRepo.upsertAdjust).toHaveBeenCalledWith(
        expect.objectContaining({
          teamId: 'team1',
          remainingAfter: 920,
          estimatedCoins: 100,
          deltaCoins: -20,
        }),
      );
    });

    it('handles ADJUST-without-RESERVE in ledger (invalid state)', async () => {
      coinLedgerRepo.findByReservationId.mockResolvedValue({
        userId: 'u1',
        subscriptionId: 'sub-1',
        planId: 'plan-1',
      });
      coinLedgerRepo.findAllByReservationId.mockResolvedValue([
        { type: CoinLedgerType.ADJUST },
      ]);

      await expect(service.applyAdjustment(event)).rejects.toThrow(
        'ADJUST without RESERVE',
      );
    });
  });
});
