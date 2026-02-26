import { ApiProperty } from '@nestjs/swagger';
import {
  IsDate,
  IsEnum,
  IsISO8601,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';
import { BillingInterval, Prisma } from '@prisma/user-client';

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

  @ApiProperty({
    description: 'Start date of the subscription (ISO string)',
    example: '2024-01-01T00:00:00.000Z',
    required: false,
  })
  @IsOptional()
  @IsISO8601()
  currentPeriodStart?: string | null;

  @ApiProperty({
    description: 'Billing interval',
    example: 'MONTH',
  })
  @IsEnum(BillingInterval)
  interval!: BillingInterval;

  @ApiProperty({
    description: 'Role-based limit',
    example: 100,
  })
  @IsNumber()
  @IsOptional()
  limits?: number;

  @ApiProperty({
    description:
      'Whether the subscription will cancel at the end of the current period',
    example: false,
  })
  @IsOptional()
  cancelAtPeriodEnd?: boolean;

  @ApiProperty({
    description: 'Optional subscription metadata',
    required: false,
    example: {
      billing: { provider: 'stripe', externalSubscriptionId: 'sub_123' },
      notes: 'Imported from legacy billing',
    },
  })
  @IsObject()
  @IsOptional()
  metadata?: Prisma.JsonValue | null;
}

export class UpdateSubscriptionRequestDTO {
  @ApiProperty({
    description: 'ID of the team associated with the subscription',
    example: 'team_12345',
  })
  @IsString()
  teamId!: string;

  @ApiProperty({
    description: 'Optional ID of the plan associated with the subscription',
    example: 'plan_12345',
  })
  @IsString()
  @IsOptional()
  planId: string;

  @ApiProperty({
    description: 'Billing interval',
    example: 'MONTH',
  })
  @IsEnum(BillingInterval)
  interval?: BillingInterval;

  @ApiProperty({
    description: 'Role-based limit',
    example: 100,
  })
  @IsNumber()
  @IsOptional()
  limits?: number;

  @ApiProperty({
    description:
      'Optional flag indicating whether the subscription will cancel at the end of the current period',
    example: false,
  })
  @IsOptional()
  cancelAtPeriodEnd?: boolean;

  @ApiProperty({
    description: 'Optional metadata patch',
    required: false,
    example: { notes: 'Updated by admin' },
  })
  @IsObject()
  @IsOptional()
  metadata?: Prisma.JsonValue | null;
}

export class UpgradeSubscriptionRequestDTO {
  @ApiProperty({
    description: 'Optional ID of the plan associated with the subscription',
    example: 'plan_12345',
  })
  @IsString()
  @IsOptional()
  planId: string;

  @ApiProperty({
    description: 'Optional start date of the subscription',
    example: '2024-01-01T00:00:00.000Z',
  })
  @IsDate()
  @IsOptional()
  currentPeriodStart?: Date;

  @ApiProperty({
    description: 'Billing interval',
    example: 'MONTH',
  })
  @IsEnum(BillingInterval)
  interval!: BillingInterval;

  @ApiProperty({
    description: 'Role-based limit',
    example: 100,
  })
  @IsNumber()
  @IsOptional()
  limits?: number;

  @ApiProperty({
    description:
      'Optional flag indicating whether the subscription will cancel at the end of the current period',
    example: false,
  })
  @IsOptional()
  cancelAtPeriodEnd?: boolean;

  @ApiProperty({
    description: 'Optional metadata patch for upgrade events',
    required: false,
    example: { notes: 'Upgraded to PRO after trial' },
  })
  @IsObject()
  @IsOptional()
  metadata?: Prisma.JsonValue | null;
}
