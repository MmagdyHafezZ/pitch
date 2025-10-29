import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Matches,
  Min,
} from 'class-validator';

type JsonMap = Record<string, unknown>;

export class TeamResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  @IsString()
  @Length(2, 64)
  name: string;

  @ApiProperty({
    description: 'URL-friendly unique identifier',
    example: 'my-team-123',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug?: string;

  @ApiProperty({ description: 'Indicates if the team is active' })
  @IsBoolean()
  isActive: boolean;

  @IsInt()
  @Min(0)
  availableTokens: number;

  @IsInt()
  @Min(0)
  usedTokens: number;

  @IsEmail()
  billingEmail: string;

  @IsObject()
  billingAddress: JsonMap;

  @ApiProperty({ description: 'Additional metadata for the team' })
  @IsOptional()
  @IsObject()
  metadata?: JsonMap;
}
