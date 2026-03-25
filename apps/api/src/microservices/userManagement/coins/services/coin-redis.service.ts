import { Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';

export type ApplyDeltaResult =
  | { applied: true; remainingAfter: number; reason: 'APPLIED' }
  | {
      applied: false;
      remainingAfter?: number;
      reason:
        | 'ALREADY_PROCESSED'
        | 'REMAINING_ALREADY_NEGATIVE'
        | 'MISSING_REMAINING_KEY';
    };

@Injectable()
export class CoinRedisService {
  private readonly logger = new Logger(CoinRedisService.name);
  private readonly redis: Redis;
  constructor() {
    this.redis = new Redis(process.env.REDIS_URL!);
  }

  keyRemaining(teamId: string, periodKey: string) {
    return `coins:${teamId}:${periodKey}:remaining`;
  }
  keyIdempReserve(idempotencyKey: string) {
    return `idemp:coins:reserve:${idempotencyKey}`;
  }
  keyIdempEvent(eventId: string) {
    return `idemp:coins:event:${eventId}`;
  }

  async getRemaining(
    teamId: string,
    periodKey: string,
  ): Promise<number | null> {
    const key = this.keyRemaining(teamId, periodKey);
    const v = await this.redis.get(key);
    if (v === null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  async initRemainingIfMissing(
    teamId: string,
    periodKey: string,
    allowance: number,
    ttlSeconds: number,
  ): Promise<void> {
    const key = this.keyRemaining(teamId, periodKey);
    try {
      const result = await this.redis.call(
        'SET',
        key,
        String(allowance),
        'EX',
        ttlSeconds,
        'NX',
      );
      // SET NX returns "OK" if key was created, null if it already existed
      if (result === 'OK') {
        this.logger.debug(
          `initRemainingIfMissing: CREATED key=${key} allowance=${allowance} ttl=${ttlSeconds}s`,
        );
      } else {
        this.logger.debug(
          `initRemainingIfMissing: SKIPPED (key exists) key=${key}`,
        );
      }
    } catch (err) {
      throw new Error(`Redis SET failed for key=${key}: ${String(err)}`);
    }
  }

  /**
   * Atomic reserve:
   * - if idempotencyKey already seen => returns existing remaining (no double charge)
   * - if remaining >= estimate => decrement and set idemp key
   * - else deny
   */
  async reserveIfEnough(args: {
    teamId: string;
    periodKey: string;
    estimatedCoins: number;
    idempotencyKey: string;
    ttlSeconds: number;
  }): Promise<{
    approved: boolean;
    remainingAfter?: number;
    alreadyProcessed?: boolean;
  }> {
    const { teamId, periodKey, estimatedCoins, idempotencyKey, ttlSeconds } =
      args;

    const remainingKey = this.keyRemaining(teamId, periodKey);
    const idempKey = this.keyIdempReserve(idempotencyKey);

    const lua = `
      local idemp = KEYS[1]
      local remainingKey = KEYS[2]
      local est = tonumber(ARGV[1])
      local ttl = tonumber(ARGV[2])

      if est < 0 then
        return {0, rem, 0}
      end

      local prev = redis.call("GET", idemp)
      if prev then
        local rem = redis.call("GET", remainingKey)
        return {1, tonumber(rem or "-1"), 1}
      end

      local rem = tonumber(redis.call("GET", remainingKey) or "-1")
      if rem < 0 then
        return {0, -1, 0}
      end

      if rem < est then
        return {0, rem, 0}
      end

      rem = rem - est
      redis.call("SET", remainingKey, tostring(rem), "EX", ttl)
      redis.call("SET", idemp, "1", "EX", ttl)
      return {1, rem, 0}
    `;

    const res = (await this.redis.eval(
      lua,
      2,
      idempKey,
      remainingKey,
      String(estimatedCoins),
      String(ttlSeconds),
    )) as any[];
    const approved = res[0] === 1;
    const remainingAfter = Number(res[1]);
    const alreadyProcessed = res[2] === 1;

    this.logger.log(
      `reserveIfEnough: key=${remainingKey} est=${estimatedCoins} ` +
        `approved=${approved} remainingAfter=${remainingAfter} alreadyProcessed=${alreadyProcessed}`,
    );

    return { approved, remainingAfter, alreadyProcessed };
  }

  /**
   * Apply delta (actual - estimate). Delta can be +/-.
   * Idempotent by eventId.
   */
  async applyDeltaIdempotent(args: {
    teamId: string;
    periodKey: string;
    deltaCoins: number;
    eventId: string;
    ttlSeconds: number;
  }): Promise<ApplyDeltaResult> {
    const { teamId, periodKey, deltaCoins, eventId, ttlSeconds } = args;

    const remainingKey = this.keyRemaining(teamId, periodKey);
    const idempKey = this.keyIdempEvent(eventId);

    const lua = `
      local idemp = KEYS[1]
      local remainingKey = KEYS[2]
      local delta = tonumber(ARGV[1])
      local ttl = tonumber(ARGV[2])

      if redis.call("GET", idemp) then
        local remStr = redis.call("GET", remainingKey)
        if not remStr then
          return {0, -1}
        end
        return {0, tonumber(remStr)}
      end

      local remStr = redis.call("GET", remainingKey)
      if not remStr then
        return {-1, -1}
      end

      local rem = tonumber(remStr)
      if rem < 0 then
        return {2, rem}
      end

      rem = rem - delta

      redis.call("SET", remainingKey, tostring(rem), "EX", ttl)
      redis.call("SET", idemp, "1", "EX", ttl)
      return {1, rem}
    `;

    const res = (await this.redis.eval(
      lua,
      2,
      idempKey,
      remainingKey,
      String(deltaCoins),
      String(ttlSeconds),
    )) as any[];

    const code = Number(res[0]);
    const remainingAfter = Number(res[1]);

    this.logger.log(
      `applyDeltaIdempotent: key=${remainingKey} delta=${deltaCoins} ` +
        `code=${code} remainingAfter=${remainingAfter}`,
    );

    if (code === 1) return { applied: true, remainingAfter, reason: 'APPLIED' };

    if (code === 0) {
      return remainingAfter === -1
        ? { applied: false, reason: 'MISSING_REMAINING_KEY' }
        : { applied: false, remainingAfter, reason: 'ALREADY_PROCESSED' };
    }

    if (code === 2)
      return {
        applied: false,
        remainingAfter,
        reason: 'REMAINING_ALREADY_NEGATIVE',
      };

    return { applied: false, reason: 'MISSING_REMAINING_KEY' };
  }
}
