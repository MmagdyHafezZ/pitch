import { ApiProperty } from '@nestjs/swagger';
import { Prisma, Role } from '@prisma/user-client';
import {
  IsBoolean,
  IsDate,
  IsEmail,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Matches,
  Min,
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

  @ApiProperty({
    description:
      'Optional team metadata (profile, preferences, tags, audit extras)',
    example: {
      profile: { industry: 'Software', timezone: 'America/New_York' },
      preferences: { allowMemberInvites: true },
      tags: ['sales-enablement'],
    },
    required: false,
  })
  @IsObject()
  @IsOptional()
  metadata?: Prisma.JsonValue | null;
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

  @ApiProperty({
    description: 'Optional team metadata patch',
    example: {
      profile: { industry: 'Healthcare' },
      tags: ['enterprise'],
    },
    required: false,
  })
  @IsObject()
  @IsOptional()
  metadata?: Prisma.JsonValue | null;
}

export class AddMemberRequestDTO {
  @ApiProperty({ description: 'Existing user ID to add to the team' })
  @IsString()
  @Length(2, 64)
  userId!: string;

  @ApiProperty({
    description: 'Membership role. Defaults to MEMBER',
    enum: Role,
    example: Role.MEMBER,
  })
  @IsEnum(Role)
  role!: Role;

  @ApiProperty({ description: 'Per-member token limit', example: 0 })
  @Min(0)
  @IsNumber()
  @IsOptional()
  tokenLimit?: number;

  @ApiProperty({
    description: 'Whether the membership starts active. Defaults to true',
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class InviteMemberRequestDTO {
  @ApiProperty({ description: 'Existing user ID to invite to the team' })
  @IsString()
  @Length(2, 64)
  userId!: string;

  @ApiProperty({
    description: 'Membership role for the invitation. Defaults to MEMBER',
    enum: Role,
    example: Role.MEMBER,
  })
  @IsEnum(Role)
  role!: Role;

  @ApiProperty({ description: 'Per-member token limit', example: 0 })
  @Min(0)
  @IsNumber()
  @IsOptional()
  tokenLimit?: number;
}

export class UpdateMemberRequestDto {
  @ApiProperty({
    description: 'Membership role. Defaults to MEMBER',
    enum: Role,
    example: Role.MEMBER,
  })
  @IsEnum(Role)
  @IsOptional()
  role?: Role;

  @ApiProperty({ description: 'Per-member token limit', example: 0 })
  @Min(0)
  @IsNumber()
  tokenLimit?: number;

  @ApiProperty({
    description: 'Whether the membership starts active. Defaults to true',
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiProperty({ description: 'Date when user accepted invite to the team' })
  @IsDate()
  @IsOptional()
  acceptedAt?: Date;
}

export class SendTeamSignupInviteRequestDto {
  @ApiProperty({
    description: 'Email address that should receive the signup invitation',
    example: 'new-member@example.com',
  })
  @IsEmail()
  email!: string;

  @ApiProperty({
    description:
      'Optional absolute signup URL. If omitted, support service will use configured WEB_APP_URL.',
    example: 'https://app.pitch.ai/signup?invite=abc123',
    required: false,
  })
  @IsOptional()
  @IsUrl({ require_tld: false })
  signupUrl?: string;

  @ApiProperty({
    description: 'Role to assign when the invited user completes signup',
    enum: Role,
    example: Role.MEMBER,
    required: false,
  })
  @IsEnum(Role)
  @IsOptional()
  role?: Role;
}
