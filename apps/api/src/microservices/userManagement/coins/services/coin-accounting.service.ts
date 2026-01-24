import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';

import { CoinRedisService } from './coin-redis.service';
import { CoinLedgerRepository } from '../repositories/coin-ledger.repository';
import { CoinBalanceRepository } from '../repositories/coin-balance.repository';
import { CoinLedgerType } from '../../mongo/schemas/coin-ledger.schema';

import { PlanRepository } from '../../plans/repositories/plans.repository';

import {
  ReserveCoinsRequestDto,
  ReserveCoinsResponseDto,
} from '../dto/coin-reserve.dto';
import { CoinAdjustEventDto } from '../dto/coin-adjust.event';
import { SubscriptionRepository } from '../../subscription/repositories/subscription.repository';

@Injectable()
export class CoinAccountingService {
  constructor(
    private readonly redis: CoinRedisService,
    private readonly coinLedgerRepo: CoinLedgerRepository,
    private readonly coinBalanceRepo: CoinBalanceRepository,

    private readonly subscriptionRepository: SubscriptionRepository,
    private readonly planRepository: PlanRepository,
  ) {}

  private normalizeEpochToMs(v: number): number {
    return v < 10_000_000_000 ? v * 1000 : v;
  }

  public buildPeriodKey(args: {
    subscriptionId: string;
    startMs: number;
    endMs: number;
  }): string {
    return `${args.subscriptionId}:${args.startMs}-${args.endMs}`;
  }

  /**
   * Entitlement = active subscription + plan allowance + current billing cycle key.
   */
  private async getEntitlementOrNull(teamId: string): Promise<null | {
    subscriptionId: string;
    planId: string;
    allowance: number;
    periodKey: string;
    periodTtlSeconds: number;
  }> {
    const sub = await this.subscriptionRepository.findActiveByTeamId(teamId);
    if (!sub) return null;

    const plan = await this.planRepository.findById(sub.planId);
    if (!plan || !plan.isActive) return null;

    const startMs = this.normalizeEpochToMs(Number(sub.currentPeriodStart));
    const endMs = this.normalizeEpochToMs(Number(sub.currentPeriodEnd));

    const periodKey = this.buildPeriodKey({
      subscriptionId: sub.id,
      startMs,
      endMs,
    });

    const nowMs = Date.now();
    const bufferMs = 7 * 24 * 60 * 60 * 1000;
    const ttlMs = Math.max(60 * 60 * 1000, endMs - nowMs + bufferMs);
    const periodTtlSeconds = Math.floor(ttlMs / 1000);

    const allowance = Number(plan.maxCoins);

    return {
      subscriptionId: sub.id,
      planId: plan.id,
      allowance,
      periodKey,
      periodTtlSeconds,
    };
  }

  async getRemainingCoins(
    teamId: string,
  ): Promise<
    | { ok: false; reason: 'NO_ACTIVE_SUBSCRIPTION' }
    | {
        ok: true;
        teamId: string;
        periodKey: string;
        allowance: number;
        remaining: number;
      }
  > {
    const ent = await this.getEntitlementOrNull(teamId);
    if (!ent) return { ok: false, reason: 'NO_ACTIVE_SUBSCRIPTION' };

    // Ensure the period remaining exists (NX). If it already exists, this is a no-op.
    await this.redis.initRemainingIfMissing(
      teamId,
      ent.periodKey,
      ent.allowance,
      ent.periodTtlSeconds,
    );

    // Prefer Redis (real-time)
    const redisRemaining = await this.redis.getRemaining(teamId, ent.periodKey);
    if (redisRemaining !== null) {
      return {
        ok: true,
        teamId,
        periodKey: ent.periodKey,
        allowance: ent.allowance,
        remaining: redisRemaining,
      };
    }

    // Fallback: Mongo snapshot (might be slightly stale)
    const mongoRemaining = await this.coinBalanceRepo.getRemaining(
      teamId,
      ent.periodKey,
    );

    return {
      ok: true,
      teamId,
      periodKey: ent.periodKey,
      allowance: ent.allowance,
      remaining: mongoRemaining ?? ent.allowance,
    };
  }

  async reserveCoins(
    dto: ReserveCoinsRequestDto,
  ): Promise<ReserveCoinsResponseDto> {
    const ent = await this.getEntitlementOrNull(dto.teamId);
    if (!ent) return { approved: false, reason: 'NO_ACTIVE_SUBSCRIPTION' };

    await this.redis.initRemainingIfMissing(
      dto.teamId,
      ent.periodKey,
      ent.allowance,
      ent.periodTtlSeconds,
    );

    const reserveRes = await this.redis.reserveIfEnough({
      teamId: dto.teamId,
      periodKey: ent.periodKey,
      estimatedCoins: dto.estimatedCoins,
      idempotencyKey: dto.idempotencyKey,
      ttlSeconds: ent.periodTtlSeconds,
    });

    if (!reserveRes.approved) {
      return { approved: false, reason: 'INSUFFICIENT_COINS' };
    }

    if (reserveRes.alreadyProcessed) {
      return {
        approved: true,
        periodKey: ent.periodKey,
        remainingAfter: reserveRes.remainingAfter,
      };
    }

    const reservationId = randomUUID();

    await this.coinLedgerRepo.create({
      type: CoinLedgerType.RESERVE,
      reservationId,
      requestId: dto.requestId,
      sessionId: dto.sessionId,
      teamId: dto.teamId,
      userId: dto.userId,
      subscriptionId: ent.subscriptionId,
      planId: ent.planId,
      periodKey: ent.periodKey,
      estimatedCoins: dto.estimatedCoins,
    });

    await this.coinBalanceRepo.upsertReserve({
      teamId: dto.teamId,
      subscriptionId: ent.subscriptionId,
      periodKey: ent.periodKey,
      allowance: ent.allowance,
      estimatedCoins: dto.estimatedCoins,
      remainingAfter: reserveRes.remainingAfter!,
      reservationId,
      requestId: dto.requestId,
    });

    return {
      approved: true,
      reservationId,
      periodKey: ent.periodKey,
      remainingAfter: reserveRes.remainingAfter,
    };
  }

  async applyAdjustment(event: CoinAdjustEventDto): Promise<void> {
    const ttlSeconds = 60 * 60 * 24 * 40;
    const res = await this.redis.applyDeltaIdempotent({
      teamId: event.teamId,
      periodKey: event.periodKey,
      deltaCoins: event.deltaCoins,
      eventId: event.eventId,
      ttlSeconds,
    });

    if (!res.applied) return;

    await this.coinLedgerRepo.create({
      type: CoinLedgerType.ADJUST,
      eventId: event.eventId,
      reservationId: event.reservationId,
      requestId: event.requestId,
      sessionId: event.sessionId,
      teamId: event.teamId,
      userId: (event as any).userId ?? 'unknown',
      subscriptionId: (event as any).subscriptionId ?? 'unknown',
      planId: (event as any).planId ?? 'unknown',
      periodKey: event.periodKey,
      deltaCoins: event.deltaCoins,
      model: event.model,
    });

    await this.coinBalanceRepo.upsertAdjust({
      teamId: event.teamId,
      periodKey: event.periodKey,
      remainingAfter: res.remainingAfter!,
      eventId: event.eventId,
      reservationId: event.reservationId,
      requestId: event.requestId,
    });
  }
}
