import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class ReserveCoinsRequestDto {
  @IsString()
  @IsNotEmpty()
  teamId: string;

  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  requestId: string;

  @IsInt()
  @Min(1)
  estimatedCoins: number;

  @IsOptional()
  @IsString()
  sessionId?: string;

  @IsString()
  @IsNotEmpty()
  idempotencyKey: string;
}

export class ReserveCoinsResponseDto {
  approved: boolean;
  reservationId?: string;
  periodKey?: string;
  remainingAfter?: number;
  reason?: 'NO_ACTIVE_SUBSCRIPTION' | 'INSUFFICIENT_COINS' | 'INVALID_REQUEST';
}
