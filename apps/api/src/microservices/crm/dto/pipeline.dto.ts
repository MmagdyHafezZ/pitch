import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsInt,
  IsArray,
  ValidateNested,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum OpportunityStageType {
  PROSPECTING = 'PROSPECTING',
  QUALIFICATION = 'QUALIFICATION',
  PROPOSAL = 'PROPOSAL',
  NEGOTIATION = 'NEGOTIATION',
  CLOSED_WON = 'CLOSED_WON',
  CLOSED_LOST = 'CLOSED_LOST',
}

export class CreateStageDto {
  @ApiProperty({ example: 'Prospecting', description: 'Stage name' })
  @IsString()
  name: string;

  @ApiProperty({ enum: OpportunityStageType, description: 'Stage type' })
  @IsEnum(OpportunityStageType)
  type: OpportunityStageType;

  @ApiProperty({ example: 1, description: 'Stage order in pipeline' })
  @IsInt()
  @Min(0)
  order: number;

  @ApiPropertyOptional({
    example: 10,
    description: 'Default probability (0-100)',
    default: 0,
  })
  @IsInt()
  @Min(0)
  @Max(100)
  @IsOptional()
  probability?: number;

  @ApiPropertyOptional({ example: '#3B82F6', description: 'Hex color for UI' })
  @IsString()
  @IsOptional()
  color?: string;
}

export class UpdateStageDto extends PartialType(CreateStageDto) {}

export class StageResponseDto {
  @ApiProperty({ example: 'clx123abc456' })
  id: string;

  @ApiProperty({ example: 'clx789def012' })
  pipelineId: string;

  @ApiProperty({ example: 'Prospecting' })
  name: string;

  @ApiProperty({ enum: OpportunityStageType })
  type: OpportunityStageType;

  @ApiProperty({ example: 1 })
  order: number;

  @ApiProperty({ example: 10 })
  probability: number;

  @ApiPropertyOptional({ example: '#3B82F6' })
  color?: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class CreatePipelineDto {
  @ApiProperty({ example: 'Sales Pipeline', description: 'Pipeline name' })
  @IsString()
  name: string;

  @ApiPropertyOptional({
    example: 'Main sales pipeline for enterprise deals',
    description: 'Pipeline description',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description: 'Set as default pipeline',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;

  @ApiPropertyOptional({ description: 'Pipeline is active', default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({
    type: [CreateStageDto],
    description: 'Initial stages for the pipeline',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateStageDto)
  @IsOptional()
  stages?: CreateStageDto[];
}

export class UpdatePipelineDto extends PartialType(CreatePipelineDto) {}

export class PipelineResponseDto {
  @ApiProperty({ example: 'clx123abc456' })
  id: string;

  @ApiProperty({ example: 'org_123' })
  orgId: string;

  @ApiProperty({ example: 'Sales Pipeline' })
  name: string;

  @ApiPropertyOptional({ example: 'Main sales pipeline for enterprise deals' })
  description?: string;

  @ApiProperty({ example: true })
  isDefault: boolean;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiPropertyOptional({ type: [StageResponseDto] })
  stages?: StageResponseDto[];

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class PipelineListQueryDto {
  @ApiPropertyOptional({ description: 'Filter by active status' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Include stages in response',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  includeStages?: boolean;
}

export class ReorderStagesDto {
  @ApiProperty({
    description: 'Array of stage IDs in new order',
    type: [String],
    example: ['stage_1', 'stage_2', 'stage_3'],
  })
  @IsArray()
  @IsString({ each: true })
  stageIds: string[];
}
