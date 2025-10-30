import { ApiProperty } from '@nestjs/swagger';
import { Prisma } from '@prisma/user-client';
import {
  IsBoolean,
  IsEmail,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';

export class CreateTeamRequestDto {
  @ApiProperty({ description: 'Required Team Name', example: 'My Team' })
  @IsString()
  @Length(2, 64)
  name!: string;

  @ApiProperty({
    description: 'Optional URL-friendly unique identifier',
    example: 'my-team-123',
  })
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  @IsOptional()
  slug?: string;

  @ApiProperty({
    description: 'Required Billing email address',
    example: 'billing@example.com',
  })
  @IsEmail()
  @IsOptional()
  billingEmail?: string;

  @ApiProperty({
    description: 'Required Billing address',
    example: {
      street: '123 Main St',
      city: 'Anytown',
      state: 'CA',
      zip: '12345',
    },
  })
  @IsObject()
  @IsOptional()
  billingAddress?: Prisma.JsonValue | null;
}

export class UpdateTeamRequestDto {
  @ApiProperty({ description: 'Optional Team Name', example: 'My Team' })
  @IsString()
  @Length(2, 64)
  @IsOptional()
  name?: string;

  @ApiProperty({
    description: 'Optional URL-friendly unique identifier',
    example: 'my-team',
  })
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  @IsOptional()
  slug?: string;

  @ApiProperty({ description: 'Optional Indicates if the team is active' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiProperty({
    description: 'Optional Billing email address',
    example: 'billing@example.com',
  })
  @IsEmail()
  @IsOptional()
  billingEmail?: string;

  @ApiProperty({
    description: 'Optional Billing address',
    example: {
      street: '123 Main St',
      city: 'Anytown',
      state: 'CA',
      zip: '12345',
    },
  })
  @IsObject()
  @IsOptional()
  billingAddress?: Prisma.JsonValue | null;
}
