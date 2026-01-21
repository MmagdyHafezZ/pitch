import { ApiProperty } from '@nestjs/swagger';
import { IsDate, IsEnum, IsOptional, IsString } from 'class-validator';
import { SubscriptionStatus } from '@prisma/user-client';

export class CreateSubscriptionRequestDTO {
  @ApiProperty({
    description: 'ID of the team associated with the subscription',
    example: 'team_12345',
  })
  @IsString()
  teamId!: string;

  @ApiProperty({
    description: 'ID of the plan associated with the subscription',
    example: 'plan_12345',
  })
  @IsString()
  planId!: string;

  @ApiProperty({ description: 'Subscription status', example: 'ACTIVE' })
  @IsEnum(SubscriptionStatus)
  status!: SubscriptionStatus;

  @ApiProperty({
    description: 'Start date of the subscription',
    example: '2024-01-01T00:00:00.000Z',
  })
  @IsDate()
  currentPeriodStart!: Date;

  @ApiProperty({
    description: 'End date of the subscription',
    example: '2025-01-01T00:00:00.000Z',
  })
  @IsDate()
  currentPeriodEnd!: Date;

  @ApiProperty({
    description:
      'Whether the subscription will cancel at the end of the current period',
    example: false,
  })
  @IsOptional()
  cancelAtPeriodEnd?: boolean;
}

export class UpdateSubscriptionRequestDTO {
  @ApiProperty({
    description: 'Optional ID of the plan associated with the subscription',
    example: 'plan_12345',
  })
  @IsString()
  @IsOptional()
  planId: string;

  @ApiProperty({
    description: 'Optional subscription status',
    example: 'ACTIVE',
  })
  @IsEnum(SubscriptionStatus)
  @IsOptional()
  status?: SubscriptionStatus;

  @ApiProperty({
    description: 'Optional start date of the subscription',
    example: '2024-01-01T00:00:00.000Z',
  })
  @IsDate()
  @IsOptional()
  currentPeriodStart?: Date;

  @ApiProperty({
    description: 'Optional end date of the subscription',
    example: '2025-01-01T00:00:00.000Z',
  })
  @IsDate()
  @IsOptional()
  currentPeriodEnd?: Date;

  @ApiProperty({
    description:
      'Optional flag indicating whether the subscription will cancel at the end of the current period',
    example: false,
  })
  @IsOptional()
  cancelAtPeriodEnd?: boolean;
}
