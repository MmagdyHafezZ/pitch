import { Injectable, Logger } from '@nestjs/common';
import { CoinRedisService } from './coin-redis.service';
import { CoinLedgerRepository } from '../repositories/coin-ledger.repository';
import { CoinBalanceRepository } from '../repositories/coin-balance.repository';
import { SubscriptionWithPlan } from '../../subscription/repositories/subscription.repository';

function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'string') return e;
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}

function getRemainingAfter(v: unknown): number | undefined {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

@Injectable()
export class CoinRefillService {
  constructor(
    private readonly coinRedis: CoinRedisService,
    private readonly coinLedgerRepo: CoinLedgerRepository,
    private readonly coinBalanceRepo: CoinBalanceRepository,
  ) {}

  public buildPeriodKey(subscriptionId: string, start: Date, end: Date) {
    return `${subscriptionId}:${start.getTime()}-${end.getTime()}`;
  }

  async refillInitialForSubscription(
    sub: SubscriptionWithPlan,
    requesterId: string,
  ) {
    const { id: subscriptionId, teamId: teamId, plan: plan } = sub;

    const start = new Date(sub.currentPeriodStart);
    const end = new Date(sub.currentPeriodEnd);
    const periodKey = this.buildPeriodKey(subscriptionId, start, end);

    const allowance = Number(plan.maxCoins);

    const ttlSeconds = Math.max(
      60,
      Math.ceil((end.getTime() - Date.now()) / 1000),
    );
    await this.coinRedis.initRemainingIfMissing(
      teamId,
      periodKey,
      allowance,
      ttlSeconds,
    );

    const rem = await this.coinRedis.getRemaining(teamId, periodKey);
    const remainingAfter = rem ?? allowance;

    const eventId = `refill:init:${teamId}:${periodKey}`;

    await this.coinLedgerRepo.createRefillIfNotExists({
      userId: requesterId,
      eventId,
      teamId,
      subscriptionId,
      planId: sub.planId,
      requestId: eventId,
      reservationId: eventId,
      periodKey,
      allowance,
      debtApplied: 0,
      remainingAfter,
    });

    await this.coinBalanceRepo.upsertRefill({
      teamId,
      subscriptionId,
      periodKey,
      allowance,
      remainingAfter,
      debtApplied: 0,
      eventId,
    });

    return { periodKey, allowance, remainingAfter };
  }

  async refillAfterRollover(args: {
    teamId: string;
    subscriptionId: string;
    planId: string;
    allowance: number;
    newPeriodKey: string;
    newPeriodEnd: Date;
    debt: number;
  }): Promise<{ remainingAfter: number }> {
    const {
      teamId,
      subscriptionId,
      planId,
      allowance,
      newPeriodKey,
      newPeriodEnd,
      debt,
    } = args;

    const ttlSeconds = Math.max(
      60,
      Math.ceil((newPeriodEnd.getTime() - Date.now()) / 1000),
    );
    try {
      await this.coinRedis.initRemainingIfMissing(
        teamId,
        newPeriodKey,
        allowance,
        ttlSeconds,
      );
      Logger.log(`[REDIS INIT OK] ${newPeriodKey}`);
    } catch (err: unknown) {
      Logger.error(
        `[REDIS INIT FAIL] period=${newPeriodKey} err=${errorMessage(err)}`,
      );
      throw err;
    }

    const eventId = `refill:${teamId}:${newPeriodKey}`;

    let remainingAfter: number;
    try {
      const adj: unknown = await this.coinRedis.applyDeltaIdempotent({
        teamId,
        periodKey: newPeriodKey,
        deltaCoins: debt,
        eventId,
        ttlSeconds,
      });
      const ra =
        typeof adj === 'object' && adj !== null && 'remainingAfter' in adj
          ? getRemainingAfter((adj as Record<string, unknown>).remainingAfter)
          : undefined;

      remainingAfter = ra ?? allowance - debt;

      Logger.log(
        `[DELTA OK] event=${eventId} delta=${debt} remainingAfter=${remainingAfter}`,
      );
    } catch (err: unknown) {
      Logger.error(
        `[DELTA FAIL] event=${eventId} delta=${debt} err=${errorMessage(err)}`,
      );
      throw err;
    }

    try {
      await this.coinLedgerRepo.createRefillIfNotExists({
        userId: 'system',
        eventId,
        teamId,
        subscriptionId,
        planId,
        requestId: eventId,
        reservationId: eventId,
        periodKey: newPeriodKey,
        allowance,
        debtApplied: debt,
        remainingAfter,
      });

      Logger.log(`[LEDGER OK] ${eventId}`);
    } catch (err: unknown) {
      Logger.error(`[LEDGER FAIL] event=${eventId} err=${errorMessage(err)}`);
      throw err;
    }

    try {
      await this.coinBalanceRepo.upsertRefill({
        teamId,
        subscriptionId,
        periodKey: newPeriodKey,
        allowance,
        remainingAfter,
        debtApplied: debt,
        eventId,
      });

      Logger.log(`[BALANCE OK] ${eventId}`);
    } catch (err: unknown) {
      Logger.error(`[BALANCE FAIL] event=${eventId} err=${errorMessage(err)}`);
      throw err;
    }

    Logger.log(
      `[REFILL DONE] team=${teamId} period=${newPeriodKey} remaining=${remainingAfter}`,
    );
    return { remainingAfter };
  }
}
