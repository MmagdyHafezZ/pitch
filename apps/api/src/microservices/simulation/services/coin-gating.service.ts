import { Injectable, Logger, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';
import { randomUUID } from 'crypto';

export interface CoinSessionReserveResponse {
  approved: boolean;
  reservationId?: string;
  periodKey?: string;
  estimatedCoins?: number;
  coinPriceUsd?: number;
  remainingAfter?: number;
  reason?: 'NO_ACTIVE_SUBSCRIPTION' | 'INSUFFICIENT_COINS' | 'INVALID_REQUEST';
}

@Injectable()
export class CoinGatingService {
  private readonly logger = new Logger(CoinGatingService.name);

  constructor(
    @Inject('USER_SERVICE') private readonly userClient: ClientProxy,
  ) {}

  async reserveForSession(args: {
    teamId: string;
    userId: string;
    sessionType: string;
    requestId: string;
    idempotencyKey: string;
    /** Pre-calculated coins to reserve (from CoinEstimationService). Falls back to plan value when omitted. */
    estimatedCoins?: number;
    /** USD value of one coin (used by USER_SERVICE for the ledger). */
    coinPriceUsd?: number;
  }): Promise<CoinSessionReserveResponse> {
    return firstValueFrom(
      this.userClient
        .send<CoinSessionReserveResponse>('coin.session.reserve', args)
        .pipe(timeout(5000)),
    );
  }

  /**
   * Fire-and-forget: emit a SIGNED coin adjustment when a session iteration ends.
   *
   * deltaCoins = actualCoins - estimatedCoins
   *   < 0 → refund unused reservation (remaining goes up)
   *   > 0 → charge more than estimated (remaining goes down further)
   *   = 0 → exact estimate, no change needed
   *
   * The USER_SERVICE applies: remaining -= deltaCoins
   * So a negative delta ADDS coins back to the balance.
   */
  emitAdjust(args: {
    reservationId: string;
    teamId: string;
    periodKey: string;
    estimatedCoins: number;
    actualCostUsd: number;
    coinPriceUsd: number;
    markupMultiplier: number;
    sessionId: string;
    requestId: string;
  }): void {
    const effectiveActualCost = args.actualCostUsd * args.markupMultiplier;
    const actualCoins = Math.max(
      0,
      Math.ceil(effectiveActualCost / args.coinPriceUsd),
    );
    // Signed delta: negative means we reserved more than used → refund
    const deltaCoins = actualCoins - args.estimatedCoins;
    const eventId = randomUUID();

    this.userClient.emit('coin.adjust', {
      eventId,
      reservationId: args.reservationId,
      teamId: args.teamId,
      periodKey: args.periodKey,
      deltaCoins,
      requestId: args.requestId,
      sessionId: args.sessionId,
    });

    this.logger.log(
      `Emitted coin.adjust: sessionId=${args.sessionId} ` +
        `estimated=${args.estimatedCoins} actual=${actualCoins} ` +
        `delta=${deltaCoins} (${deltaCoins < 0 ? 'refund' : deltaCoins > 0 ? 'extra charge' : 'exact'})`,
    );
  }
}
