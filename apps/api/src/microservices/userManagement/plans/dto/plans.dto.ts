import { ApiProperty } from '@nestjs/swagger';
import { Prisma } from '@prisma/user-client';
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';
import { PlanLevel } from '@prisma/user-client';

export class CreatePlanRequestDTO {
  @ApiProperty({ description: 'Plan name', example: 'Pro Plan' })
  @IsString()
  @Length(2, 64)
  name!: string;

  @ApiProperty({
    description: 'Optional Plan description',
    example: 'Access to pro features',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: 'Plan Level', example: PlanLevel.FREE })
  @IsEnum(PlanLevel)
  planLevel!: PlanLevel;

  @ApiProperty({ description: 'Maximum number of tokens', example: 1999 })
  @IsNumber()
  @Min(0)
  maxCoins!: number;

  @ApiProperty({ description: 'Is the plan active?', example: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdatePlanRequestDTO {
  @ApiProperty({ description: 'Optional Plan name', example: 'Pro Plan' })
  @IsString()
  @Length(2, 64)
  @IsOptional()
  name?: string;

  @ApiProperty({
    description: 'Optional Plan description',
    example: 'Access to pro features',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: 'Plan Level', example: PlanLevel.FREE })
  @IsEnum(PlanLevel)
  @IsOptional()
  planLevel?: PlanLevel;

  @ApiProperty({ description: 'Maximum number of tokens', example: 1999 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  maxCoins?: number;

  @ApiProperty({ description: 'Is the plan active?', example: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
