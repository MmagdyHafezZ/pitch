import { Controller, UsePipes, ValidationPipe } from '@nestjs/common';
import { EventPattern, MessagePattern, Payload } from '@nestjs/microservices';
import { CoinAccountingService } from '../services/coin-accounting.service';
import { CoinSessionService } from '../services/coin-session.service';
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
}
