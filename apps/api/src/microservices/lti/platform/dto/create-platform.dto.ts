import {
  IsString,
  IsOptional,
  IsBoolean,
  IsArray,
  IsUrl,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePlatformDto {
  @ApiProperty({ description: 'Human-readable name for this LMS platform' })
  @IsString()
  @MinLength(2)
  name: string;

  // ── LTI 1.1 ────────────────────────────────────────────────────────────────

  @ApiPropertyOptional({ description: 'LTI 1.1 OAuth consumer key' })
  @IsOptional()
  @IsString()
  consumerKey?: string;

  @ApiPropertyOptional({
    description: 'LTI 1.1 OAuth shared secret (stored hashed)',
  })
  @IsOptional()
  @IsString()
  consumerSecret?: string;

  // ── LTI 1.3 / Advantage ────────────────────────────────────────────────────

  @ApiPropertyOptional({ description: 'Platform OIDC issuer URL' })
  @IsOptional()
  @IsUrl()
  issuer?: string;

  @ApiPropertyOptional({ description: 'Client ID assigned by the platform' })
  @IsOptional()
  @IsString()
  clientId?: string;

  @ApiPropertyOptional({ description: 'Platform OIDC authentication endpoint' })
  @IsOptional()
  @IsUrl()
  authLoginUrl?: string;

  @ApiPropertyOptional({ description: 'Platform OAuth2 token endpoint' })
  @IsOptional()
  @IsUrl()
  authTokenUrl?: string;

  @ApiPropertyOptional({
    description: "Platform's JWKS URL for verifying ID tokens",
  })
  @IsOptional()
  @IsUrl()
  keysetUrl?: string;

  @ApiPropertyOptional({
    description: 'Allowed redirect URIs for this tool',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  redirectUris?: string[];

  @ApiPropertyOptional({
    description: 'LTI 1.3 deployment ID assigned by the LMS',
  })
  @IsOptional()
  @IsString()
  deploymentId?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
