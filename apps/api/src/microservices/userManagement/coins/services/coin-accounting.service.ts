import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';

import { CoinRedisService } from './coin-redis.service';
import { CoinLedgerRepository } from '../repositories/coin-ledger.repository';
import { CoinBalanceRepository } from '../repositories/coin-balance.repository';
import { CoinLedgerType } from '../../mongo/schemas/coin-ledger.schema';

import { SubscriptionService } from '../../subscription/services/subscription.service';
import { PlanRepository } from '../../plans/repositories/plans.repository';

import {
  ReserveCoinsRequestDto,
  ReserveCoinsResponseDto,
} from '../dto/coin-reserve.dto';
import { CoinAdjustEventDto } from '../dto/coin-adjust.event';

@Injectable()
export class CoinAccountingService {
  constructor(
    private readonly redis: CoinRedisService,
    private readonly coinLedgerRepo: CoinLedgerRepository,
    private readonly coinBalanceRepo: CoinBalanceRepository,

    // NEW:
    private readonly subscriptionService: SubscriptionService,
    private readonly planRepository: PlanRepository,
  ) {}

  private normalizeEpochToMs(v: number): number {
    // If it looks like seconds (e.g., 1700000000), convert to ms.
    // If it looks like ms (e.g., 1700000000000), keep.
    return v < 10_000_000_000 ? v * 1000 : v;
  }

  private buildPeriodKey(args: {
    subscriptionId: string;
    startMs: number;
    endMs: number;
  }): string {
    // Stable, unique per billing cycle
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
    const sub = await this.subscriptionService.findActiveByTeam(teamId);
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

    // TTL until period end + buffer (7 days). Minimum 1 hour.
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

    const idempotencyKey = dto.idempotencyKey ?? dto.requestId;

    const reserveRes = await this.redis.reserveIfEnough({
      teamId: dto.teamId,
      periodKey: ent.periodKey,
      estimatedCoins: dto.estimatedCoins,
      idempotencyKey,
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
    // Redis apply (idempotent by eventId)
    const ttlSeconds = 60 * 60 * 24 * 40; // replace with computed TTL based on periodKey
    const res = await this.redis.applyDeltaIdempotent({
      teamId: event.teamId,
      periodKey: event.periodKey,
      deltaCoins: event.deltaCoins,
      eventId: event.eventId,
      ttlSeconds,
    });

    if (!res.applied) return;

    // Receipt (Mongo idempotency via unique sparse eventId)
    await this.coinLedgerRepo.create({
      type: CoinLedgerType.ADJUST,
      eventId: event.eventId,
      reservationId: event.reservationId,
      requestId: event.requestId,
      sessionId: event.sessionId,
      teamId: event.teamId,
      // include these in the RMQ event ideally:
      userId: (event as any).userId ?? 'unknown',
      subscriptionId: (event as any).subscriptionId ?? 'unknown',
      planId: (event as any).planId ?? 'unknown',
      periodKey: event.periodKey,
      deltaCoins: event.deltaCoins,
      model: event.model,
    });

    // Balance snapshot
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
