import { CoinRedisService } from '../../coins/services/coin-redis.service';

jest.mock('ioredis', () => {
  const mockRedis = {
    get: jest.fn(),
    call: jest.fn(),
    eval: jest.fn(),
  };
  return jest.fn(() => mockRedis);
});

describe('CoinRedisService', () => {
  let service: CoinRedisService;
  let redis: {
    get: jest.Mock;
    call: jest.Mock;
    eval: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CoinRedisService();
    redis = (service as any).redis;
  });

  // ── Key generators ─────────────────────────────────────────────────────────

  describe('keyRemaining', () => {
    it('generates the remaining-coins key', () => {
      expect(service.keyRemaining('team1', 'sub1:100-200')).toBe(
        'coins:team1:sub1:100-200:remaining',
      );
    });
  });

  describe('keyIdempReserve', () => {
    it('generates idempotency key for reserve', () => {
      expect(service.keyIdempReserve('idemp-1')).toBe(
        'idemp:coins:reserve:idemp-1',
      );
    });
  });

  describe('keyIdempEvent', () => {
    it('generates idempotency key for event', () => {
      expect(service.keyIdempEvent('evt-1')).toBe('idemp:coins:event:evt-1');
    });
  });

  // ── getRemaining ───────────────────────────────────────────────────────────

  describe('getRemaining', () => {
    it('returns numeric value when key exists', async () => {
      redis.get.mockResolvedValue('500');
      const result = await service.getRemaining('team1', 'period1');
      expect(result).toBe(500);
    });

    it('returns null when key does not exist', async () => {
      redis.get.mockResolvedValue(null);
      const result = await service.getRemaining('team1', 'period1');
      expect(result).toBeNull();
    });

    it('returns null for non-finite values', async () => {
      redis.get.mockResolvedValue('NaN');
      const result = await service.getRemaining('team1', 'period1');
      expect(result).toBeNull();
    });

    it('returns null for Infinity', async () => {
      redis.get.mockResolvedValue('Infinity');
      const result = await service.getRemaining('team1', 'period1');
      expect(result).toBeNull();
    });

    it('handles zero correctly', async () => {
      redis.get.mockResolvedValue('0');
      const result = await service.getRemaining('team1', 'period1');
      expect(result).toBe(0);
    });

    it('handles negative values', async () => {
      redis.get.mockResolvedValue('-10');
      const result = await service.getRemaining('team1', 'period1');
      expect(result).toBe(-10);
    });
  });

  // ── initRemainingIfMissing ─────────────────────────────────────────────────

  describe('initRemainingIfMissing', () => {
    it('calls SET with NX to initialize only if missing', async () => {
      redis.call.mockResolvedValue('OK');
      await service.initRemainingIfMissing('team1', 'period1', 1000, 3600);

      expect(redis.call).toHaveBeenCalledWith(
        'SET',
        'coins:team1:period1:remaining',
        '1000',
        'EX',
        3600,
        'NX',
      );
    });

    it('throws on Redis error', async () => {
      redis.call.mockRejectedValue(new Error('REDIS_DOWN'));

      await expect(
        service.initRemainingIfMissing('team1', 'period1', 1000, 3600),
      ).rejects.toThrow('Redis SET failed');
    });
  });

  // ── reserveIfEnough ────────────────────────────────────────────────────────

  describe('reserveIfEnough', () => {
    const baseArgs = {
      teamId: 'team1',
      periodKey: 'period1',
      estimatedCoins: 50,
      idempotencyKey: 'idemp-1',
      ttlSeconds: 3600,
    };

    it('returns approved with remaining when Lua returns [1, remaining, 0]', async () => {
      redis.eval.mockResolvedValue([1, 450, 0]);

      const result = await service.reserveIfEnough(baseArgs);

      expect(result).toEqual({
        approved: true,
        remainingAfter: 450,
        alreadyProcessed: false,
      });
    });

    it('returns approved + alreadyProcessed when Lua returns [1, remaining, 1]', async () => {
      redis.eval.mockResolvedValue([1, 450, 1]);

      const result = await service.reserveIfEnough(baseArgs);

      expect(result).toEqual({
        approved: true,
        remainingAfter: 450,
        alreadyProcessed: true,
      });
    });

    it('returns denied when insufficient coins', async () => {
      redis.eval.mockResolvedValue([0, 30, 0]);

      const result = await service.reserveIfEnough(baseArgs);

      expect(result).toEqual({
        approved: false,
        remainingAfter: 30,
        alreadyProcessed: false,
      });
    });

    it('returns denied when remaining key missing', async () => {
      redis.eval.mockResolvedValue([0, -1, 0]);

      const result = await service.reserveIfEnough(baseArgs);

      expect(result).toEqual({
        approved: false,
        remainingAfter: -1,
        alreadyProcessed: false,
      });
    });

    it('passes correct keys and args to eval', async () => {
      redis.eval.mockResolvedValue([1, 100, 0]);

      await service.reserveIfEnough(baseArgs);

      expect(redis.eval).toHaveBeenCalledWith(
        expect.any(String),
        2,
        'idemp:coins:reserve:idemp-1',
        'coins:team1:period1:remaining',
        '50',
        '3600',
      );
    });
  });

  // ── applyDeltaIdempotent ───────────────────────────────────────────────────

  describe('applyDeltaIdempotent', () => {
    const baseArgs = {
      teamId: 'team1',
      periodKey: 'period1',
      deltaCoins: 10,
      eventId: 'evt-1',
      ttlSeconds: 3600,
    };

    it('returns APPLIED when Lua returns code 1', async () => {
      redis.eval.mockResolvedValue([1, 490]);

      const result = await service.applyDeltaIdempotent(baseArgs);

      expect(result).toEqual({
        applied: true,
        remainingAfter: 490,
        reason: 'APPLIED',
      });
    });

    it('returns ALREADY_PROCESSED when code=0 and remaining >= 0', async () => {
      redis.eval.mockResolvedValue([0, 500]);

      const result = await service.applyDeltaIdempotent(baseArgs);

      expect(result).toEqual({
        applied: false,
        remainingAfter: 500,
        reason: 'ALREADY_PROCESSED',
      });
    });

    it('returns MISSING_REMAINING_KEY when code=0 and remaining=-1', async () => {
      redis.eval.mockResolvedValue([0, -1]);

      const result = await service.applyDeltaIdempotent(baseArgs);

      expect(result).toEqual({
        applied: false,
        reason: 'MISSING_REMAINING_KEY',
      });
    });

    it('returns REMAINING_ALREADY_NEGATIVE when code=2', async () => {
      redis.eval.mockResolvedValue([2, -5]);

      const result = await service.applyDeltaIdempotent(baseArgs);

      expect(result).toEqual({
        applied: false,
        remainingAfter: -5,
        reason: 'REMAINING_ALREADY_NEGATIVE',
      });
    });

    it('returns MISSING_REMAINING_KEY for code=-1', async () => {
      redis.eval.mockResolvedValue([-1, -1]);

      const result = await service.applyDeltaIdempotent(baseArgs);

      expect(result).toEqual({
        applied: false,
        reason: 'MISSING_REMAINING_KEY',
      });
    });

    it('passes correct keys and args to eval', async () => {
      redis.eval.mockResolvedValue([1, 100]);

      await service.applyDeltaIdempotent(baseArgs);

      expect(redis.eval).toHaveBeenCalledWith(
        expect.any(String),
        2,
        'idemp:coins:event:evt-1',
        'coins:team1:period1:remaining',
        '10',
        '3600',
      );
    });
  });
});
