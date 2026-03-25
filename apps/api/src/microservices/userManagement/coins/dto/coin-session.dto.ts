export class CoinSessionReserveResponseDto {
  approved: boolean;
  reservationId?: string;
  periodKey?: string;
  estimatedCoins?: number;
  coinPriceUsd?: number;
  remainingAfter?: number;
  reason?: 'NO_ACTIVE_SUBSCRIPTION' | 'INSUFFICIENT_COINS' | 'INVALID_REQUEST';
}
