import { Injectable } from '@nestjs/common';
import { CoinRedisService } from './coin-redis.service';
import { CoinLedgerRepository } from '../repositories/coin-ledger.repository';
import { CoinBalanceRepository } from '../repositories/coin-balance.repository';
import { SubscriptionWithPlan } from '../../subscription/repositories/subscription.repository';

@Injectable()
export class CoinRefillService {
  constructor(
    private readonly coinRedis: CoinRedisService,
    private readonly coinLedgerRepo: CoinLedgerRepository,
    private readonly coinBalanceRepo: CoinBalanceRepository,
  ) {}

  private buildPeriodKey(subscriptionId: string, start: Date, end: Date) {
    return `${subscriptionId}:${start.getTime()}-${end.getTime()}`;
  }

  async refillInitialForSubscription(sub: SubscriptionWithPlan) {
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
      eventId,
      teamId,
      subscriptionId,
      planId: sub.planId,
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
  }) {
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

    await this.coinRedis.initRemainingIfMissing(
      teamId,
      newPeriodKey,
      allowance,
      ttlSeconds,
    );

    const eventId = `refill:${teamId}:${newPeriodKey}`;

    const adj = await this.coinRedis.applyDeltaIdempotent({
      teamId,
      periodKey: newPeriodKey,
      deltaCoins: debt,
      eventId,
      ttlSeconds,
    });

    const remainingAfter = adj.remainingAfter ?? allowance - debt;

    await this.coinLedgerRepo.createRefillIfNotExists({
      eventId,
      teamId,
      subscriptionId,
      planId,
      periodKey: newPeriodKey,
      allowance,
      debtApplied: debt,
      remainingAfter,
    });

    await this.coinBalanceRepo.upsertRefill({
      teamId,
      subscriptionId,
      periodKey: newPeriodKey,
      allowance,
      remainingAfter,
      debtApplied: debt,
      eventId,
    });

    return { remainingAfter };
  }
}
