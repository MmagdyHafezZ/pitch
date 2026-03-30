import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CoinAccountingService } from './coin-accounting.service';
import { SubscriptionRepository } from '../../subscription/repositories/subscription.repository';
import { TeamRepository } from '../../team/repositories/team.repository';
import { CoinSessionReserveResponseDto } from '../dto/coin-session.dto';

@Injectable()
export class CoinSessionService {
  private readonly logger = new Logger(CoinSessionService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly coins: CoinAccountingService,
    private readonly subscriptionRepo: SubscriptionRepository,
    private readonly teamRepo: TeamRepository,
  ) {}

  /**
   * Reserve coins for a session.
   *
   * Priority order for estimatedCoins:
   *   1. Pre-calculated value from CoinEstimationService (passed via dto.estimatedCoins)
   *   2. Plan's flat coinCostPerSession (for teams on fixed-rate plans)
   *   3. Personal fallback (PERSONAL_COIN_COST_PER_SESSION env var)
   *
   * coinPriceUsd follows the same priority, allowing the estimation service
   * to set a model-specific price instead of the plan default.
   */
  async reserveForSession(dto: {
    teamId: string;
    userId: string;
    sessionType: string;
    requestId: string;
    idempotencyKey: string;
    /** Pre-calculated by CoinEstimationService (model × duration × markup). */
    estimatedCoins?: number;
    /** Pre-calculated USD-per-coin rate, consistent with the estimation. */
    coinPriceUsd?: number;
    sessionId?: string;
  }): Promise<CoinSessionReserveResponseDto> {
    // When orgId === userId the session is personal — no team membership to check.
    // When orgId is a real teamId, verify the user is an active member before
    // allowing them to draw from that team's credit pool.
    const isTeamSession = dto.teamId !== dto.userId;
    let isSharedTeamSession = false;
    if (isTeamSession) {
      const membership = await this.teamRepo.findMembership(
        dto.teamId,
        dto.userId,
      );
      if (!membership || !membership.isActive) {
        this.logger.warn(
          `[GUARD] userId=${dto.userId} is not an active member of teamId=${dto.teamId}. Rejecting coin reservation.`,
        );
        return { approved: false, reason: 'INVALID_REQUEST' };
      }

      const team = await this.teamRepo.findById(dto.teamId);
      isSharedTeamSession =
        (team?.memberships?.filter(
          (teamMembership) => teamMembership?.isActive !== false,
        ).length ?? 0) > 1;
    }

    const sub = await this.subscriptionRepo.findActiveWithPlanByTeamId(
      dto.teamId,
    );

    if (sub) {
      const { coinCostPerSession, coinPriceUsd: planCoinPriceUsd } = sub.plan;

      // Prefer estimation-derived values; fall back to plan config
      const effectiveCost = dto.estimatedCoins ?? coinCostPerSession;
      const effectivePrice = dto.coinPriceUsd ?? planCoinPriceUsd;

      this.logger.log(
        `[TEAM] teamId=${dto.teamId} userId=${dto.userId} ` +
          `plan.coinCostPerSession=${coinCostPerSession} dto.estimatedCoins=${dto.estimatedCoins ?? 'none'} ` +
          `effectiveCost=${effectiveCost} effectivePrice=$${effectivePrice}`,
      );

      // Zero cost = unlimited plan — approve without touching the ledger
      if (effectiveCost === 0) {
        this.logger.warn(
          `[TEAM] effectiveCost=0 → UNLIMITED plan, skipping ledger write. teamId=${dto.teamId}`,
        );
        return {
          approved: true,
          estimatedCoins: 0,
          coinPriceUsd: effectivePrice,
        };
      }

      const result = await this.coins.reserveCoins({
        teamId: dto.teamId,
        userId: dto.userId,
        requestId: dto.requestId,
        idempotencyKey: dto.idempotencyKey,
        estimatedCoins: effectiveCost,
        sessionId: dto.sessionId,
      });

      if (
        !result.approved &&
        result.reason === 'INSUFFICIENT_COINS' &&
        isSharedTeamSession
      ) {
        this.logger.warn(
          `[TEAM] teamId=${dto.teamId} is out of team credits. Falling back to personal quota for userId=${dto.userId}.`,
        );

        const personalResult = await this.coins.reservePersonalCoins({
          userId: dto.userId,
          requestId: dto.requestId,
          idempotencyKey: dto.idempotencyKey,
          estimatedCoins: effectiveCost,
          sessionId: dto.sessionId,
        });

        return {
          ...personalResult,
          estimatedCoins: effectiveCost,
          coinPriceUsd: effectivePrice,
        };
      }

      this.logger.log(
        `[TEAM] reserveCoins result: approved=${result.approved} ` +
          `reservationId=${result.reservationId ?? 'none'} ` +
          `remainingAfter=${result.remainingAfter ?? 'n/a'} ` +
          `reason=${(result as { reason?: string }).reason ?? 'n/a'}`,
      );

      return {
        ...result,
        estimatedCoins: effectiveCost,
        coinPriceUsd: effectivePrice,
      };
    }

    // No team subscription — use personal monthly quota
    this.logger.log(
      `[PERSONAL] No active team subscription for teamId=${dto.teamId}. ` +
        `Falling back to personal quota for userId=${dto.userId}.`,
    );

    const personalCost =
      dto.estimatedCoins ??
      Number(this.config.get('PERSONAL_COIN_COST_PER_SESSION') ?? 10);
    const personalPriceUsd =
      dto.coinPriceUsd ??
      Number(this.config.get('PERSONAL_COIN_PRICE_USD') ?? 0.1);

    this.logger.log(
      `[PERSONAL] userId=${dto.userId} personalCost=${personalCost} personalPriceUsd=$${personalPriceUsd}`,
    );

    const result = await this.coins.reservePersonalCoins({
      userId: dto.userId,
      requestId: dto.requestId,
      idempotencyKey: dto.idempotencyKey,
      estimatedCoins: personalCost,
      sessionId: dto.sessionId,
    });

    this.logger.log(
      `[PERSONAL] reservePersonalCoins result: approved=${result.approved} ` +
        `reservationId=${result.reservationId ?? 'none'} ` +
        `remainingAfter=${result.remainingAfter ?? 'n/a'} ` +
        `reason=${(result as { reason?: string }).reason ?? 'n/a'}`,
    );

    return {
      ...result,
      estimatedCoins: personalCost,
      coinPriceUsd: personalPriceUsd,
    };
  }
}
