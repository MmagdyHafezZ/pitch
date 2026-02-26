import { IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CoinAdjustEventDto {
  @IsString()
  @IsNotEmpty()
  eventId: string; // UUID

  @IsString()
  @IsNotEmpty()
  reservationId: string;

  @IsString()
  @IsNotEmpty()
  teamId: string;

  @IsString()
  @IsNotEmpty()
  periodKey: string;

  @IsInt()
  deltaCoins: number;

  @IsString()
  @IsNotEmpty()
  requestId: string;

  @IsOptional()
  @IsString()
  sessionId?: string;

  @IsOptional()
  @IsString()
  model?: string;
}
