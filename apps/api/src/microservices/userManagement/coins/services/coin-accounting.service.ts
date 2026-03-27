import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
  private readonly logger = new Logger(CoinAccountingService.name);

  constructor(
    private readonly config: ConfigService,
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
    opts?: {
      periodKey?: string;
      allowanceFallback?: number;
      initIfMissing?: boolean;
    },
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
    if (opts?.periodKey) {
      const periodKey = opts.periodKey;
      const redisRemaining = await this.redis.getRemaining(teamId, periodKey);
      if (redisRemaining !== null) {
        return {
          ok: true,
          teamId,
          periodKey,
          allowance: opts.allowanceFallback ?? 0,
          remaining: redisRemaining,
        };
      }

      const mongoRemaining = await this.coinBalanceRepo.getRemaining(
        teamId,
        periodKey,
      );
      return {
        ok: true,
        teamId,
        periodKey,
        allowance: opts.allowanceFallback ?? 0,
        remaining: mongoRemaining ?? opts.allowanceFallback ?? 0,
      };
    }

    const ent = await this.getEntitlementOrNull(teamId);
    if (!ent) return { ok: false, reason: 'NO_ACTIVE_SUBSCRIPTION' };

    const init = opts?.initIfMissing ?? true;
    if (init) {
      await this.redis.initRemainingIfMissing(
        teamId,
        ent.periodKey,
        ent.allowance,
        ent.periodTtlSeconds,
      );
    }

    const redisRemaining = await this.redis.getRemaining(teamId, ent.periodKey);

    const redisKey = this.redis.keyRemaining(teamId, ent.periodKey);
    if (redisRemaining !== null) {
      this.logger.debug(
        `getRemainingCoins [REDIS HIT] key=${redisKey} remaining=${redisRemaining} allowance=${ent.allowance}`,
      );
      return {
        ok: true,
        teamId,
        periodKey: ent.periodKey,
        allowance: ent.allowance,
        remaining: redisRemaining,
      };
    }

    const mongoRemaining = await this.coinBalanceRepo.getRemaining(
      teamId,
      ent.periodKey,
    );
    this.logger.warn(
      `getRemainingCoins [REDIS MISS] key=${redisKey} — falling back to mongo=${mongoRemaining ?? 'null'} → returning ${mongoRemaining ?? ent.allowance}`,
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
    const reserved_entry = await this.coinLedgerRepo.findByReservationId(
      event.reservationId,
    );
    if (reserved_entry === null) {
      throw new Error(`Could not find the corresponding RESERVE entry`);
    }

    const state = await this.guardReservationLifecycle(event.reservationId);

    if (!state.hasReserve) {
      throw new Error(
        `Cannot ADJUST without RESERVE for ${event.reservationId}`,
      );
    }

    if (state.hasAdjust) {
      throw new Error(`Reservation ${event.reservationId} already adjusted`);
    }

    // Personal-quota sessions have periodKey = "personal:{userId}:YYYY-MM".
    // Derive the correct entity key so Redis targets the right namespace.
    const entityKey = event.periodKey.startsWith('personal:')
      ? `user:${event.periodKey.split(':')[1]}`
      : event.teamId;

    const ttlSeconds = 60 * 60 * 24 * 40;
    const res = await this.redis.applyDeltaIdempotent({
      teamId: entityKey,
      periodKey: event.periodKey,
      deltaCoins: event.deltaCoins,
      eventId: event.eventId,
      ttlSeconds,
    });

    if (!res.applied) {
      if (res.reason === 'ALREADY_PROCESSED') return;

      if (res.reason === 'REMAINING_ALREADY_NEGATIVE') {
        throw new Error(
          `Cannot apply adjustment; remaining is already negative for team=${event.teamId} period=${event.periodKey} (remaining=${res.remainingAfter})`,
        );
      }
      throw new Error(
        `Cannot apply adjustment; missing remaining key for team=${event.teamId} period=${event.periodKey}`,
      );
    }

    await this.coinLedgerRepo.create({
      type: CoinLedgerType.ADJUST,
      eventId: event.eventId,
      reservationId: event.reservationId,
      requestId: event.requestId,
      sessionId: event.sessionId,
      teamId: entityKey,
      userId: reserved_entry.userId,
      subscriptionId: reserved_entry.subscriptionId,
      planId: reserved_entry.planId,
      periodKey: event.periodKey,
      deltaCoins: event.deltaCoins,
      model: event.model,
    });

    await this.coinBalanceRepo.upsertAdjust({
      teamId: entityKey,
      periodKey: event.periodKey,
      remainingAfter: res.remainingAfter,
      eventId: event.eventId,
      reservationId: event.reservationId,
      requestId: event.requestId,
      estimatedCoins: reserved_entry.estimatedCoins ?? 0,
      deltaCoins: event.deltaCoins,
    });
  }

  async getAdminUsageSummary(): Promise<
    Array<{
      teamId: string;
      periodKey: string;
      subscriptionId: string;
      allowance: number;
      usedActual: number;
      remaining: number;
    }>
  > {
    const balances = await this.coinBalanceRepo.findAll();
    // Exclude personal "user:xxx" quota entries
    return balances
      .filter((b) => !b.teamId.startsWith('user:'))
      .map((b) => ({
        teamId: b.teamId,
        subscriptionId: b.subscriptionId,
        periodKey: b.periodKey,
        allowance: b.allowance,
        usedActual: b.usedActual,
        remaining: b.remaining,
      }));
  }

  async getLedgerHistory(
    teamId: string,
    periodKey?: string,
  ): Promise<
    Array<{
      type: string;
      createdAt?: Date;
      estimatedCoins?: number;
      deltaCoins?: number;
      sessionId?: string;
      model?: string;
      allowance?: number;
      remainingAfter?: number;
    }>
  > {
    const entries = await this.coinLedgerRepo.findByTeamId(teamId, periodKey);
    return entries.map((e) => ({
      type: e.type,
      createdAt: (e as any).createdAt,
      estimatedCoins: e.estimatedCoins,
      deltaCoins: e.deltaCoins,
      sessionId: e.sessionId,
      model: e.model,
      allowance: e.allowance,
      remainingAfter: e.remainingAfter,
    }));
  }

  private async guardReservationLifecycle(reservationId: string) {
    const entries =
      await this.coinLedgerRepo.findAllByReservationId(reservationId);
    if (entries.length === 0) {
      return { hasReserve: false, hasAdjust: false };
    }
    if (entries.length > 2) {
      throw new Error(
        `Invalid ledger state for reservation ${reservationId}: more than 2 entries`,
      );
    }
    const hasReserve = entries.some((e) => e.type === CoinLedgerType.RESERVE);
    const hasAdjust = entries.some((e) => e.type === CoinLedgerType.ADJUST);
    if (hasAdjust && !hasReserve) {
      throw new Error(
        `Invalid ledger state for reservation ${reservationId}: ADJUST without RESERVE`,
      );
    }
    if (hasReserve && hasAdjust) {
      return { hasReserve: true, hasAdjust: true };
    }
    if (hasReserve) {
      return { hasReserve: true, hasAdjust: false };
    }
    throw new Error(`Invalid ledger state for reservation ${reservationId}`);
  }

  /**
   * Reserve coins from the user's personal monthly quota.
   * Bypasses the team-subscription lookup — uses "user:{userId}" as entity key.
   */
  async reservePersonalCoins(args: {
    userId: string;
    requestId: string;
    idempotencyKey: string;
    estimatedCoins: number;
    sessionId?: string;
  }): Promise<{
    approved: boolean;
    reservationId?: string;
    periodKey?: string;
    remainingAfter?: number;
    reason?: 'INSUFFICIENT_COINS';
  }> {
    const allowance = Number(
      this.config.get('PERSONAL_COINS_PER_MONTH') ?? 100,
    );
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const periodKey = `personal:${args.userId}:${ym}`;
    const entityKey = `user:${args.userId}`;

    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const ttlSeconds = Math.max(
      3600,
      Math.floor((endOfMonth.getTime() - now.getTime()) / 1000) + 7 * 24 * 3600,
    );

    await this.redis.initRemainingIfMissing(
      entityKey,
      periodKey,
      allowance,
      ttlSeconds,
    );

    const reserveRes = await this.redis.reserveIfEnough({
      teamId: entityKey,
      periodKey,
      estimatedCoins: args.estimatedCoins,
      idempotencyKey: args.idempotencyKey,
      ttlSeconds,
    });

    if (!reserveRes.approved) {
      return { approved: false, reason: 'INSUFFICIENT_COINS' };
    }

    if (reserveRes.alreadyProcessed) {
      return {
        approved: true,
        periodKey,
        remainingAfter: reserveRes.remainingAfter,
      };
    }

    const reservationId = randomUUID();

    await this.coinLedgerRepo.create({
      type: CoinLedgerType.RESERVE,
      reservationId,
      requestId: args.requestId,
      sessionId: args.sessionId,
      teamId: entityKey,
      userId: args.userId,
      subscriptionId: 'personal',
      planId: 'personal',
      periodKey,
      estimatedCoins: args.estimatedCoins,
    });

    await this.coinBalanceRepo.upsertReserve({
      teamId: entityKey,
      subscriptionId: 'personal',
      periodKey,
      allowance,
      estimatedCoins: args.estimatedCoins,
      remainingAfter: reserveRes.remainingAfter!,
      reservationId,
      requestId: args.requestId,
    });

    return {
      approved: true,
      reservationId,
      periodKey,
      remainingAfter: reserveRes.remainingAfter,
    };
  }

  /**
   * Get remaining personal coins for a user.
   *
   * Personal quota is per-user, per-month, independent of team membership.
   * Allowance is controlled by the PERSONAL_COINS_PER_MONTH env var (default 100).
   *
   * The user entity is stored in Redis / Mongo under the key prefix "user:{userId}"
   * so it never collides with team IDs.
   */
  async getRemainingCoinsForUser(userId: string): Promise<{
    ok: true;
    userId: string;
    remaining: number;
    allowance: number;
    periodKey: string;
  }> {
    const allowance = Number(
      this.config.get('PERSONAL_COINS_PER_MONTH') ?? 100,
    );

    // Build a stable monthly period key
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const periodKey = `personal:${userId}:${ym}`;

    // Entity key uses "user:" prefix to avoid collision with UUID team IDs
    const entityKey = `user:${userId}`;

    // TTL: rest of month + 7-day buffer
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const ttlSeconds = Math.max(
      3600,
      Math.floor((endOfMonth.getTime() - now.getTime()) / 1000) + 7 * 24 * 3600,
    );

    await this.redis.initRemainingIfMissing(
      entityKey,
      periodKey,
      allowance,
      ttlSeconds,
    );

    const remaining = await this.redis.getRemaining(entityKey, periodKey);

    return {
      ok: true,
      userId,
      remaining: remaining ?? allowance,
      allowance,
      periodKey,
    };
  }
}
