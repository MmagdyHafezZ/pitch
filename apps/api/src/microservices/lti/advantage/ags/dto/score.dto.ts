import {
  IsString,
  IsOptional,
  IsNumber,
  Min,
  IsEnum,
  IsUrl,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ActivityProgress, GradingProgress } from '@prisma/lti-client';

export class CreateLineItemDto {
  @ApiProperty({ description: 'LTI session ID' })
  @IsString()
  sessionId: string;

  @ApiProperty({ description: 'Label shown in the LMS gradebook column' })
  @IsString()
  label: string;

  @ApiProperty({ description: 'Maximum score for this assignment' })
  @IsNumber()
  @Min(0)
  scoreMaximum: number;

  @ApiPropertyOptional({
    description: 'Resource ID for matching to existing line items',
  })
  @IsOptional()
  @IsString()
  resourceId?: string;

  @ApiPropertyOptional({ description: 'Categorisation tag' })
  @IsOptional()
  @IsString()
  tag?: string;

  @ApiPropertyOptional({
    description: 'Pre-existing line item URL from LMS (if known)',
  })
  @IsOptional()
  @IsUrl()
  lineItemUrl?: string;
}

export class SubmitScoreDto {
  @ApiProperty({ description: 'Internal LTI line item ID' })
  @IsString()
  lineItemId: string;

  @ApiProperty({ description: 'LMS user ID (sub from JWT)' })
  @IsString()
  userId: string;

  @ApiPropertyOptional({ description: 'Score to submit (null = unscored)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  scoreGiven?: number;

  @ApiProperty({ description: 'Maximum possible score' })
  @IsNumber()
  @Min(0)
  scoreMaximum: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  comment?: string;

  @ApiProperty({ enum: ActivityProgress })
  @IsEnum(ActivityProgress)
  activityProgress: ActivityProgress;

  @ApiProperty({ enum: GradingProgress })
  @IsEnum(GradingProgress)
  gradingProgress: GradingProgress;
}

export class GetResultsDto {
  @ApiProperty({ description: 'Internal LTI line item ID' })
  @IsString()
  lineItemId: string;

  @ApiPropertyOptional({ description: 'Filter results to a specific user ID' })
  @IsOptional()
  @IsString()
  userId?: string;
}
