import { Injectable } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class CoinRedisService {
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
  ) {
    const key = this.keyRemaining(teamId, periodKey);
    await this.redis.call(
      'SET',
      key,
      String(allowance),
      'EX',
      ttlSeconds,
      'NX',
    );
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
  }): Promise<{ applied: boolean; remainingAfter?: number }> {
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
    if (code === 0) return { applied: false, remainingAfter };
    if (code === 1) return { applied: true, remainingAfter };
    // -1 missing key
    return { applied: false };
  }
}
