import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsNumber,
  IsInt,
  IsDateString,
  IsEnum,
  IsObject,
  IsArray,
  Min,
  Max,
} from 'class-validator';

export enum OpportunityType {
  NEW_BUSINESS = 'new_business',
  UPSELL = 'upsell',
  RENEWAL = 'renewal',
  CROSS_SELL = 'cross_sell',
}

export enum OpportunitySource {
  WEBSITE = 'website',
  REFERRAL = 'referral',
  COLD_CALL = 'cold_call',
  EVENT = 'event',
  PARTNER = 'partner',
  SOCIAL_MEDIA = 'social_media',
  EMAIL_CAMPAIGN = 'email_campaign',
  OTHER = 'other',
}

export class LineItemDto {
  @ApiProperty({ example: 'Enterprise License' })
  @IsString()
  product: string;

  @ApiProperty({ example: 10 })
  @IsNumber()
  quantity: number;

  @ApiProperty({ example: 999.99 })
  @IsNumber()
  price: number;

  @ApiPropertyOptional({ example: 10, description: 'Discount percentage' })
  @IsNumber()
  @IsOptional()
  discount?: number;
}

export class CreateOpportunityDto {
  @ApiProperty({
    example: 'Acme Corp Enterprise Deal',
    description: 'Opportunity name',
  })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 50000, description: 'Deal amount in USD' })
  @IsNumber()
  @IsOptional()
  amount?: number;

  @ApiPropertyOptional({ description: 'Pipeline ID' })
  @IsString()
  @IsOptional()
  pipelineId?: string;

  @ApiPropertyOptional({ description: 'Stage ID' })
  @IsString()
  @IsOptional()
  stageId?: string;

  @ApiPropertyOptional({ example: 25, description: 'Win probability (0-100)' })
  @IsInt()
  @Min(0)
  @Max(100)
  @IsOptional()
  probability?: number;

  @ApiPropertyOptional({
    example: '2024-06-30',
    description: 'Expected close date',
  })
  @IsDateString()
  @IsOptional()
  expectedCloseDate?: string;

  @ApiPropertyOptional({ description: 'Associated account ID' })
  @IsString()
  @IsOptional()
  accountId?: string;

  @ApiPropertyOptional({ description: 'Primary contact ID' })
  @IsString()
  @IsOptional()
  contactId?: string;

  @ApiPropertyOptional({ description: 'Owner user ID' })
  @IsString()
  @IsOptional()
  ownerId?: string;

  @ApiPropertyOptional({ enum: OpportunityType })
  @IsEnum(OpportunityType)
  @IsOptional()
  type?: OpportunityType;

  @ApiPropertyOptional({ enum: OpportunitySource })
  @IsEnum(OpportunitySource)
  @IsOptional()
  source?: OpportunitySource;

  @ApiPropertyOptional({ description: 'Detailed description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Next step in sales process' })
  @IsString()
  @IsOptional()
  nextStep?: string;

  @ApiPropertyOptional({ description: 'Competitor information' })
  @IsObject()
  @IsOptional()
  competitorInfo?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Custom fields' })
  @IsObject()
  @IsOptional()
  customFields?: Record<string, any>;

  @ApiPropertyOptional({
    type: [LineItemDto],
    description: 'Line items/products',
  })
  @IsArray()
  @IsOptional()
  lineItems?: LineItemDto[];
}

export class UpdateOpportunityDto extends PartialType(CreateOpportunityDto) {
  @ApiPropertyOptional({
    description: 'Reason for losing the deal (if closed lost)',
  })
  @IsString()
  @IsOptional()
  lossReason?: string;

  @ApiPropertyOptional({
    example: '2024-06-15',
    description: 'Actual close date',
  })
  @IsDateString()
  @IsOptional()
  actualCloseDate?: string;
}

export class MoveOpportunityStageDto {
  @ApiProperty({ description: 'Target stage ID' })
  @IsString()
  stageId: string;

  @ApiPropertyOptional({
    description: 'Reason for losing (required when moving to CLOSED_LOST)',
  })
  @IsString()
  @IsOptional()
  lossReason?: string;
}

export class OpportunityResponseDto {
  @ApiProperty({ example: 'clx123abc456' })
  id: string;

  @ApiProperty({ example: 'org_123' })
  orgId: string;

  @ApiProperty({ example: 'Acme Corp Enterprise Deal' })
  name: string;

  @ApiPropertyOptional({ example: 50000 })
  amount?: number;

  @ApiPropertyOptional()
  pipelineId?: string;

  @ApiPropertyOptional()
  stageId?: string;

  @ApiPropertyOptional({ example: 25 })
  probability?: number;

  @ApiPropertyOptional()
  expectedCloseDate?: Date;

  @ApiPropertyOptional()
  actualCloseDate?: Date;

  @ApiPropertyOptional()
  accountId?: string;

  @ApiPropertyOptional()
  contactId?: string;

  @ApiPropertyOptional()
  ownerId?: string;

  @ApiPropertyOptional({ enum: OpportunityType })
  type?: OpportunityType;

  @ApiPropertyOptional({ enum: OpportunitySource })
  source?: OpportunitySource;

  @ApiPropertyOptional()
  description?: string;

  @ApiPropertyOptional()
  nextStep?: string;

  @ApiPropertyOptional()
  lossReason?: string;

  @ApiPropertyOptional()
  competitorInfo?: Record<string, any>;

  @ApiPropertyOptional()
  customFields?: Record<string, any>;

  @ApiPropertyOptional({ type: [LineItemDto] })
  lineItems?: LineItemDto[];

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class OpportunityListQueryDto {
  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ description: 'Items per page', default: 20 })
  @IsOptional()
  limit?: number;

  @ApiPropertyOptional({ description: 'Search by name' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by pipeline ID' })
  @IsString()
  @IsOptional()
  pipelineId?: string;

  @ApiPropertyOptional({ description: 'Filter by stage ID' })
  @IsString()
  @IsOptional()
  stageId?: string;

  @ApiPropertyOptional({ description: 'Filter by account ID' })
  @IsString()
  @IsOptional()
  accountId?: string;

  @ApiPropertyOptional({ description: 'Filter by contact ID' })
  @IsString()
  @IsOptional()
  contactId?: string;

  @ApiPropertyOptional({ description: 'Filter by owner ID' })
  @IsString()
  @IsOptional()
  ownerId?: string;

  @ApiPropertyOptional({ enum: OpportunityType })
  @IsEnum(OpportunityType)
  @IsOptional()
  type?: OpportunityType;

  @ApiPropertyOptional({ enum: OpportunitySource })
  @IsEnum(OpportunitySource)
  @IsOptional()
  source?: OpportunitySource;

  @ApiPropertyOptional({ description: 'Minimum amount' })
  @IsNumber()
  @IsOptional()
  minAmount?: number;

  @ApiPropertyOptional({ description: 'Maximum amount' })
  @IsNumber()
  @IsOptional()
  maxAmount?: number;

  @ApiPropertyOptional({ description: 'Expected close date from' })
  @IsDateString()
  @IsOptional()
  closeDateFrom?: string;

  @ApiPropertyOptional({ description: 'Expected close date to' })
  @IsDateString()
  @IsOptional()
  closeDateTo?: string;

  @ApiPropertyOptional({ description: 'Sort field', default: 'createdAt' })
  @IsString()
  @IsOptional()
  sortBy?: string;

  @ApiPropertyOptional({
    description: 'Sort order',
    enum: ['asc', 'desc'],
    default: 'desc',
  })
  @IsString()
  @IsOptional()
  sortOrder?: 'asc' | 'desc';
}
