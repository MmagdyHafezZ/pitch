import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsEmail,
  IsEnum,
  IsObject,
  IsDateString,
  IsArray,
} from 'class-validator';

export enum ContactStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  BLOCKED = 'blocked',
}

export enum LeadStatus {
  NEW = 'new',
  CONTACTED = 'contacted',
  QUALIFIED = 'qualified',
  UNQUALIFIED = 'unqualified',
}

export enum CustomerType {
  PROSPECT = 'prospect',
  CUSTOMER = 'customer',
  PARTNER = 'partner',
  VENDOR = 'vendor',
}

export class AddressDto {
  @ApiPropertyOptional({ example: '123 Main St' })
  @IsString()
  @IsOptional()
  street?: string;

  @ApiPropertyOptional({ example: 'San Francisco' })
  @IsString()
  @IsOptional()
  city?: string;

  @ApiPropertyOptional({ example: 'CA' })
  @IsString()
  @IsOptional()
  state?: string;

  @ApiPropertyOptional({ example: '94102' })
  @IsString()
  @IsOptional()
  zip?: string;

  @ApiPropertyOptional({ example: 'USA' })
  @IsString()
  @IsOptional()
  country?: string;
}

export class SocialMediaDto {
  @ApiPropertyOptional({ example: 'https://linkedin.com/in/johndoe' })
  @IsString()
  @IsOptional()
  linkedin?: string;

  @ApiPropertyOptional({ example: 'https://twitter.com/johndoe' })
  @IsString()
  @IsOptional()
  twitter?: string;

  @ApiPropertyOptional({ example: 'https://facebook.com/johndoe' })
  @IsString()
  @IsOptional()
  facebook?: string;
}

export class CreateContactDto {
  @ApiProperty({ example: 'John', description: 'First name of the contact' })
  @IsString()
  firstName: string;

  @ApiProperty({ example: 'Doe', description: 'Last name of the contact' })
  @IsString()
  lastName: string;

  @ApiProperty({
    example: 'john.doe@example.com',
    description: 'Email address',
  })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({
    example: '+1-555-123-4567',
    description: 'Phone number',
  })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ example: 'Sales Manager', description: 'Job title' })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({ example: 'Acme Corp', description: 'Company name' })
  @IsString()
  @IsOptional()
  company?: string;

  @ApiPropertyOptional({ enum: ContactStatus, default: ContactStatus.ACTIVE })
  @IsEnum(ContactStatus)
  @IsOptional()
  status?: ContactStatus;

  @ApiPropertyOptional({ enum: LeadStatus })
  @IsEnum(LeadStatus)
  @IsOptional()
  leadStatus?: LeadStatus;

  @ApiPropertyOptional({ enum: CustomerType })
  @IsEnum(CustomerType)
  @IsOptional()
  customerType?: CustomerType;

  @ApiPropertyOptional({ description: 'Account ID to associate with' })
  @IsString()
  @IsOptional()
  accountId?: string;

  @ApiPropertyOptional({ description: 'User ID of the owner/sales rep' })
  @IsString()
  @IsOptional()
  ownerId?: string;

  @ApiPropertyOptional({ type: AddressDto })
  @IsObject()
  @IsOptional()
  address?: AddressDto;

  @ApiPropertyOptional({ type: SocialMediaDto })
  @IsObject()
  @IsOptional()
  socialMedia?: SocialMediaDto;

  @ApiPropertyOptional({ description: 'Custom fields as key-value pairs' })
  @IsObject()
  @IsOptional()
  customFields?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Next follow-up date' })
  @IsDateString()
  @IsOptional()
  nextFollowUpAt?: string;

  @ApiPropertyOptional({
    description: 'Array of tag IDs to assign',
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tagIds?: string[];
}

export class UpdateContactDto extends PartialType(CreateContactDto) {}

export class ContactResponseDto {
  @ApiProperty({ example: 'clx123abc456' })
  id: string;

  @ApiProperty({ example: 'org_123' })
  orgId: string;

  @ApiProperty({ example: 'John' })
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  lastName: string;

  @ApiProperty({ example: 'john.doe@example.com' })
  email: string;

  @ApiPropertyOptional({ example: '+1-555-123-4567' })
  phone?: string;

  @ApiPropertyOptional({ example: 'Sales Manager' })
  title?: string;

  @ApiPropertyOptional({ example: 'Acme Corp' })
  company?: string;

  @ApiProperty({ enum: ContactStatus })
  status: ContactStatus;

  @ApiPropertyOptional({ enum: LeadStatus })
  leadStatus?: LeadStatus;

  @ApiPropertyOptional({ enum: CustomerType })
  customerType?: CustomerType;

  @ApiPropertyOptional()
  accountId?: string;

  @ApiPropertyOptional()
  ownerId?: string;

  @ApiPropertyOptional({ type: AddressDto })
  address?: AddressDto;

  @ApiPropertyOptional({ type: SocialMediaDto })
  socialMedia?: SocialMediaDto;

  @ApiPropertyOptional()
  customFields?: Record<string, any>;

  @ApiPropertyOptional()
  lastContactedAt?: Date;

  @ApiPropertyOptional()
  nextFollowUpAt?: Date;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class ContactListQueryDto {
  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ description: 'Items per page', default: 20 })
  @IsOptional()
  limit?: number;

  @ApiPropertyOptional({ description: 'Search by name or email' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ enum: ContactStatus })
  @IsEnum(ContactStatus)
  @IsOptional()
  status?: ContactStatus;

  @ApiPropertyOptional({ enum: LeadStatus })
  @IsEnum(LeadStatus)
  @IsOptional()
  leadStatus?: LeadStatus;

  @ApiPropertyOptional({ enum: CustomerType })
  @IsEnum(CustomerType)
  @IsOptional()
  customerType?: CustomerType;

  @ApiPropertyOptional({ description: 'Filter by account ID' })
  @IsString()
  @IsOptional()
  accountId?: string;

  @ApiPropertyOptional({ description: 'Filter by owner ID' })
  @IsString()
  @IsOptional()
  ownerId?: string;

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
