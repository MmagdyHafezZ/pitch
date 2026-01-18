import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsObject,
  IsNumber,
  IsUrl,
} from 'class-validator';
import { AddressDto } from './contact.dto';

export enum AccountType {
  PROSPECT = 'prospect',
  CUSTOMER = 'customer',
  PARTNER = 'partner',
  VENDOR = 'vendor',
}

export enum AccountStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  CHURNED = 'churned',
}

export enum EmployeeCount {
  SMALL_1_10 = '1-10',
  SMALL_11_50 = '11-50',
  MEDIUM_51_200 = '51-200',
  MEDIUM_201_500 = '201-500',
  LARGE_501_1000 = '501-1000',
  ENTERPRISE_1000_PLUS = '1000+',
}

export class CreateAccountDto {
  @ApiProperty({ example: 'Acme Corporation', description: 'Company name' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'acme.com', description: 'Company domain' })
  @IsString()
  @IsOptional()
  domain?: string;

  @ApiPropertyOptional({ enum: AccountType, default: AccountType.PROSPECT })
  @IsEnum(AccountType)
  @IsOptional()
  type?: AccountType;

  @ApiPropertyOptional({ enum: AccountStatus, default: AccountStatus.ACTIVE })
  @IsEnum(AccountStatus)
  @IsOptional()
  status?: AccountStatus;

  @ApiPropertyOptional({
    example: 'Technology',
    description: 'Industry sector',
  })
  @IsString()
  @IsOptional()
  industry?: string;

  @ApiPropertyOptional({
    enum: EmployeeCount,
    description: 'Number of employees',
  })
  @IsEnum(EmployeeCount)
  @IsOptional()
  employeeCount?: EmployeeCount;

  @ApiPropertyOptional({
    example: 1000000,
    description: 'Annual revenue in USD',
  })
  @IsNumber()
  @IsOptional()
  annualRevenue?: number;

  @ApiPropertyOptional({
    example: 'https://acme.com',
    description: 'Company website',
  })
  @IsUrl()
  @IsOptional()
  website?: string;

  @ApiPropertyOptional({
    example: 'Leading provider of...',
    description: 'Company description',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ type: AddressDto, description: 'Primary address' })
  @IsObject()
  @IsOptional()
  address?: AddressDto;

  @ApiPropertyOptional({ type: AddressDto, description: 'Billing address' })
  @IsObject()
  @IsOptional()
  billingAddress?: AddressDto;

  @ApiPropertyOptional({ type: AddressDto, description: 'Shipping address' })
  @IsObject()
  @IsOptional()
  shippingAddress?: AddressDto;

  @ApiPropertyOptional({ description: 'Parent account ID for hierarchies' })
  @IsString()
  @IsOptional()
  parentAccountId?: string;

  @ApiPropertyOptional({ description: 'User ID of account owner' })
  @IsString()
  @IsOptional()
  ownerId?: string;

  @ApiPropertyOptional({ description: 'Custom fields as key-value pairs' })
  @IsObject()
  @IsOptional()
  customFields?: Record<string, any>;
}

export class UpdateAccountDto extends PartialType(CreateAccountDto) {}

export class AccountResponseDto {
  @ApiProperty({ example: 'clx123abc456' })
  id: string;

  @ApiProperty({ example: 'org_123' })
  orgId: string;

  @ApiProperty({ example: 'Acme Corporation' })
  name: string;

  @ApiPropertyOptional({ example: 'acme.com' })
  domain?: string;

  @ApiProperty({ enum: AccountType })
  type: AccountType;

  @ApiProperty({ enum: AccountStatus })
  status: AccountStatus;

  @ApiPropertyOptional({ example: 'Technology' })
  industry?: string;

  @ApiPropertyOptional({ enum: EmployeeCount })
  employeeCount?: EmployeeCount;

  @ApiPropertyOptional({ example: 1000000 })
  annualRevenue?: number;

  @ApiPropertyOptional({ example: 'https://acme.com' })
  website?: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiPropertyOptional({ type: AddressDto })
  address?: AddressDto;

  @ApiPropertyOptional({ type: AddressDto })
  billingAddress?: AddressDto;

  @ApiPropertyOptional({ type: AddressDto })
  shippingAddress?: AddressDto;

  @ApiPropertyOptional()
  parentAccountId?: string;

  @ApiPropertyOptional()
  ownerId?: string;

  @ApiPropertyOptional()
  customFields?: Record<string, any>;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class AccountListQueryDto {
  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ description: 'Items per page', default: 20 })
  @IsOptional()
  limit?: number;

  @ApiPropertyOptional({ description: 'Search by name or domain' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ enum: AccountType })
  @IsEnum(AccountType)
  @IsOptional()
  type?: AccountType;

  @ApiPropertyOptional({ enum: AccountStatus })
  @IsEnum(AccountStatus)
  @IsOptional()
  status?: AccountStatus;

  @ApiPropertyOptional({ description: 'Filter by industry' })
  @IsString()
  @IsOptional()
  industry?: string;

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
