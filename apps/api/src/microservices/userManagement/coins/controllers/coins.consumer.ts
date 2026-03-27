import { Controller, UsePipes, ValidationPipe } from '@nestjs/common';
import { EventPattern, MessagePattern, Payload } from '@nestjs/microservices';
import { CoinAccountingService } from '../services/coin-accounting.service';
import { CoinSessionService } from '../services/coin-session.service';
import { CoinRefillService } from '../services/coin-refill.service';
import { CoinAdjustEventDto } from '../dto/coin-adjust.event';
import {
  ReserveCoinsRequestDto,
  ReserveCoinsResponseDto,
} from '../dto/coin-reserve.dto';
import { CoinSessionReserveResponseDto } from '../dto/coin-session.dto';

@Controller()
export class CoinsConsumer {
  constructor(
    private readonly coins: CoinAccountingService,
    private readonly coinSession: CoinSessionService,
    private readonly coinRefill: CoinRefillService,
  ) {}

  @MessagePattern('coin.reserve')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async onReserve(
    @Payload() dto: ReserveCoinsRequestDto,
  ): Promise<ReserveCoinsResponseDto> {
    return this.coins.reserveCoins(dto);
  }

  @MessagePattern('coin.session.reserve')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async onSessionReserve(
    @Payload()
    dto: {
      teamId: string;
      userId: string;
      sessionType: string;
      requestId: string;
      idempotencyKey: string;
      /** Pre-calculated by CoinEstimationService */
      estimatedCoins?: number;
      coinPriceUsd?: number;
      sessionId?: string;
    },
  ): Promise<CoinSessionReserveResponseDto> {
    return this.coinSession.reserveForSession(dto);
  }

  @MessagePattern('coin.balance.get')
  async onGetBalance(@Payload() { teamId }: { teamId: string }) {
    return this.coins.getRemainingCoins(teamId, { initIfMissing: true });
  }

  @MessagePattern('coin.user.balance.get')
  async onGetUserBalance(@Payload() { userId }: { userId: string }) {
    return this.coins.getRemainingCoinsForUser(userId);
  }

  @EventPattern('coin.adjust')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async onAdjust(@Payload() event: CoinAdjustEventDto) {
    await this.coins.applyAdjustment(event);
  }

  @MessagePattern('coin.refill.request')
  async onRefillRequest(
    @Payload() dto: { userId: string; teamId: string; requestedCoins: number },
  ) {
    return this.coinRefill.requestRefill(dto);
  }

  @MessagePattern('coin.refill.my-request')
  async onMyRefillRequest(@Payload() { userId }: { userId: string }) {
    return this.coinRefill.getMyRefillRequest(userId);
  }

  @MessagePattern('coin.refill.list')
  async onRefillList() {
    return this.coinRefill.listPendingRefills();
  }

  @MessagePattern('coin.refill.approve')
  async onRefillApprove(
    @Payload()
    dto: {
      userId: string;
      approvedCoins: number;
      reviewer: string;
    },
  ) {
    return this.coinRefill.approveRefill(dto);
  }

  @MessagePattern('coin.refill.deny')
  async onRefillDeny(@Payload() dto: { userId: string; reviewer: string }) {
    return this.coinRefill.denyRefill(dto);
  }

  @MessagePattern('coin.usage.admin')
  async onAdminUsage() {
    return this.coins.getAdminUsageSummary();
  }

  @MessagePattern('coin.ledger.history')
  async onLedgerHistory(
    @Payload() { teamId, periodKey }: { teamId: string; periodKey?: string },
  ) {
    return this.coins.getLedgerHistory(teamId, periodKey);
  }
}
