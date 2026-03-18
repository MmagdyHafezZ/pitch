import {
  IsEnum,
  IsOptional,
  IsNumber,
  IsString,
  Min,
  Max,
} from 'class-validator';

export enum ChallengePeriodDto {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
}

export enum ChallengeDifficultyDto {
  BEGINNER = 'BEGINNER',
  INTERMEDIATE = 'INTERMEDIATE',
  EXPERT = 'EXPERT',
  MASTER = 'MASTER',
}

export class ListChallengesDto {
  @IsOptional()
  @IsEnum(ChallengePeriodDto)
  period?: ChallengePeriodDto;

  @IsOptional()
  @IsEnum(ChallengeDifficultyDto)
  difficulty?: ChallengeDifficultyDto;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  offset?: number;
}

export class ParticipateDto {
  @IsString()
  challengeId: string;
}

export class SubmitScoreDto {
  @IsString()
  challengeId: string;

  @IsString()
  sessionId: string;

  @IsNumber()
  @Min(0)
  @Max(100)
  score: number;
}

export class LeaderboardQueryDto {
  @IsOptional()
  @IsString()
  challengeId?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class TriggerGenerateDto {
  @IsEnum(ChallengePeriodDto)
  period: ChallengePeriodDto;
}
