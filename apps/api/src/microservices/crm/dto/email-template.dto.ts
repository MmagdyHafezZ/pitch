import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, IsEnum } from 'class-validator';

export enum EmailTemplateCategory {
  FOLLOW_UP = 'follow_up',
  INTRODUCTION = 'introduction',
  PROPOSAL = 'proposal',
  THANK_YOU = 'thank_you',
  MEETING_REQUEST = 'meeting_request',
  NEWSLETTER = 'newsletter',
  OTHER = 'other',
}

export class CreateEmailTemplateDto {
  @ApiProperty({ example: 'Initial Outreach', description: 'Template name' })
  @IsString()
  name: string;

  @ApiProperty({
    example: 'Introduction to {{company_name}} Services',
    description: 'Email subject (supports variables)',
  })
  @IsString()
  subject: string;

  @ApiProperty({
    example: '<p>Hi {{first_name}},</p><p>I wanted to reach out about...</p>',
    description: 'HTML body content (supports variables)',
  })
  @IsString()
  body: string;

  @ApiPropertyOptional({ enum: EmailTemplateCategory })
  @IsEnum(EmailTemplateCategory)
  @IsOptional()
  category?: EmailTemplateCategory;

  @ApiPropertyOptional({ description: 'Template is active', default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateEmailTemplateDto extends PartialType(
  CreateEmailTemplateDto,
) {}

export class EmailTemplateResponseDto {
  @ApiProperty({ example: 'clx123abc456' })
  id: string;

  @ApiProperty({ example: 'org_123' })
  orgId: string;

  @ApiProperty({ example: 'Initial Outreach' })
  name: string;

  @ApiProperty({ example: 'Introduction to {{company_name}} Services' })
  subject: string;

  @ApiProperty({ example: '<p>Hi {{first_name}},</p>' })
  body: string;

  @ApiPropertyOptional({ enum: EmailTemplateCategory })
  category?: EmailTemplateCategory;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiPropertyOptional()
  createdById?: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class EmailTemplateListQueryDto {
  @ApiPropertyOptional({ description: 'Search by name' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ enum: EmailTemplateCategory })
  @IsEnum(EmailTemplateCategory)
  @IsOptional()
  category?: EmailTemplateCategory;

  @ApiPropertyOptional({ description: 'Filter by active status' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Sort field', default: 'name' })
  @IsString()
  @IsOptional()
  sortBy?: string;

  @ApiPropertyOptional({
    description: 'Sort order',
    enum: ['asc', 'desc'],
    default: 'asc',
  })
  @IsString()
  @IsOptional()
  sortOrder?: 'asc' | 'desc';
}

export class PreviewEmailTemplateDto {
  @ApiPropertyOptional({ description: 'Contact ID to merge variables from' })
  @IsString()
  @IsOptional()
  contactId?: string;

  @ApiPropertyOptional({ description: 'Account ID to merge variables from' })
  @IsString()
  @IsOptional()
  accountId?: string;

  @ApiPropertyOptional({
    description: 'Opportunity ID to merge variables from',
  })
  @IsString()
  @IsOptional()
  opportunityId?: string;

  @ApiPropertyOptional({
    description: 'Custom variables to merge',
    example: { custom_field: 'value' },
  })
  @IsOptional()
  variables?: Record<string, string>;
}

export class EmailTemplatePreviewResponseDto {
  @ApiProperty({ example: 'Introduction to Acme Corp Services' })
  subject: string;

  @ApiProperty({
    example: '<p>Hi John,</p><p>I wanted to reach out about...</p>',
  })
  body: string;
}
