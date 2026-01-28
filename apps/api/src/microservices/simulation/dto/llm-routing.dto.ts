import {
  IsBoolean,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

export class LLMRoutingConfigQueryDto {
  @IsEnum(['global', 'org', 'user'])
  @IsOptional()
  scope?: 'global' | 'org' | 'user';

  @IsString()
  @IsOptional()
  orgId?: string;

  @IsString()
  @IsOptional()
  userId?: string;
}

export class LLMRoutingConfigUpsertDto {
  @IsEnum(['global', 'org', 'user'])
  @IsOptional()
  scope?: 'global' | 'org' | 'user';

  @IsString()
  @IsOptional()
  orgId?: string;

  @IsString()
  @IsOptional()
  userId?: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsObject()
  config: Record<string, unknown>;
}
