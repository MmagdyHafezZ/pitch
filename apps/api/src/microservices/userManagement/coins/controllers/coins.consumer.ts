import { Controller, UsePipes, ValidationPipe } from '@nestjs/common';
import { EventPattern, MessagePattern, Payload } from '@nestjs/microservices';
import { CoinAccountingService } from '../services/coin-accounting.service';
import { CoinAdjustEventDto } from '../dto/coin-adjust.event';
import {
  ReserveCoinsRequestDto,
  ReserveCoinsResponseDto,
} from '../dto/coin-reserve.dto';

@Controller()
export class CoinsConsumer {
  constructor(private readonly coins: CoinAccountingService) {}

  @MessagePattern('coin.reserve')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async onReserve(
    @Payload() dto: ReserveCoinsRequestDto,
  ): Promise<ReserveCoinsResponseDto> {
    return this.coins.reserveCoins(dto);
  }

  @EventPattern('coin.adjust')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async onAdjust(@Payload() event: CoinAdjustEventDto) {
    await this.coins.applyAdjustment(event);
  }
}
