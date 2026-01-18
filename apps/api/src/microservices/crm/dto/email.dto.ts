import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsArray,
  IsEmail,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class EmailRecipientDto {
  @ApiProperty({ example: 'john@example.com' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ example: 'John Doe' })
  @IsString()
  @IsOptional()
  name?: string;
}

export class SendEmailDto {
  @ApiProperty({
    example: 'Follow up on our meeting',
    description: 'Email subject',
  })
  @IsString()
  subject: string;

  @ApiProperty({
    example: '<p>Hi John,</p><p>Thank you for...</p>',
    description: 'HTML body content',
  })
  @IsString()
  body: string;

  @ApiPropertyOptional({
    example: 'Hi John, Thank you for...',
    description: 'Plain text body',
  })
  @IsString()
  @IsOptional()
  bodyText?: string;

  @ApiProperty({ type: [EmailRecipientDto], description: 'To recipients' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EmailRecipientDto)
  to: EmailRecipientDto[];

  @ApiPropertyOptional({
    type: [EmailRecipientDto],
    description: 'CC recipients',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EmailRecipientDto)
  @IsOptional()
  cc?: EmailRecipientDto[];

  @ApiPropertyOptional({
    type: [EmailRecipientDto],
    description: 'BCC recipients',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EmailRecipientDto)
  @IsOptional()
  bcc?: EmailRecipientDto[];

  @ApiPropertyOptional({ description: 'Associated contact ID' })
  @IsString()
  @IsOptional()
  contactId?: string;

  @ApiPropertyOptional({ description: 'Associated account ID' })
  @IsString()
  @IsOptional()
  accountId?: string;

  @ApiPropertyOptional({ description: 'Associated opportunity ID' })
  @IsString()
  @IsOptional()
  opportunityId?: string;

  @ApiPropertyOptional({ description: 'Email template ID to use' })
  @IsString()
  @IsOptional()
  templateId?: string;
}

export class ReplyEmailDto {
  @ApiProperty({
    example: '<p>Thank you for your response...</p>',
    description: 'Reply body HTML',
  })
  @IsString()
  body: string;

  @ApiPropertyOptional({ description: 'Plain text body' })
  @IsString()
  @IsOptional()
  bodyText?: string;

  @ApiPropertyOptional({
    type: [EmailRecipientDto],
    description: 'Additional CC recipients',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EmailRecipientDto)
  @IsOptional()
  cc?: EmailRecipientDto[];
}

export class EmailAttachmentDto {
  @ApiProperty({ example: 'proposal.pdf' })
  name: string;

  @ApiProperty({ example: 1024000 })
  size: number;

  @ApiProperty({ example: 'application/pdf' })
  mimeType: string;

  @ApiProperty({ example: 'https://s3.example.com/attachments/proposal.pdf' })
  url: string;
}

export class EmailMessageResponseDto {
  @ApiProperty({ example: 'clx123abc456' })
  id: string;

  @ApiProperty({ example: 'clx789def012' })
  threadId: string;

  @ApiProperty({ example: 'Re: Follow up on our meeting' })
  subject: string;

  @ApiProperty({ example: '<p>Hi John,</p>' })
  body: string;

  @ApiPropertyOptional({ example: 'Hi John,' })
  bodyText?: string;

  @ApiPropertyOptional({ example: 'Hi John,' })
  snippet?: string;

  @ApiProperty({ example: 'sales@company.com' })
  fromEmail: string;

  @ApiPropertyOptional({ example: 'Sales Team' })
  fromName?: string;

  @ApiProperty({ type: [EmailRecipientDto] })
  toEmails: EmailRecipientDto[];

  @ApiPropertyOptional({ type: [EmailRecipientDto] })
  ccEmails?: EmailRecipientDto[];

  @ApiProperty({ example: true })
  isInbound: boolean;

  @ApiProperty({ example: false })
  isRead: boolean;

  @ApiProperty({ example: false })
  isStarred: boolean;

  @ApiPropertyOptional()
  sentAt?: Date;

  @ApiPropertyOptional()
  receivedAt?: Date;

  @ApiPropertyOptional({ type: [EmailAttachmentDto] })
  attachments?: EmailAttachmentDto[];

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class EmailThreadResponseDto {
  @ApiProperty({ example: 'clx123abc456' })
  id: string;

  @ApiProperty({ example: 'org_123' })
  orgId: string;

  @ApiProperty({ example: 'Follow up on our meeting' })
  subject: string;

  @ApiPropertyOptional({ example: 'Hi John, Thank you for...' })
  snippet?: string;

  @ApiProperty({ example: 5 })
  messageCount: number;

  @ApiPropertyOptional()
  lastMessageAt?: Date;

  @ApiProperty({ example: true })
  isRead: boolean;

  @ApiProperty({ example: false })
  isStarred: boolean;

  @ApiProperty({ example: false })
  isArchived: boolean;

  @ApiPropertyOptional()
  contactId?: string;

  @ApiPropertyOptional()
  accountId?: string;

  @ApiPropertyOptional()
  opportunityId?: string;

  @ApiPropertyOptional({ type: [EmailMessageResponseDto] })
  messages?: EmailMessageResponseDto[];

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class EmailThreadListQueryDto {
  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ description: 'Items per page', default: 20 })
  @IsOptional()
  limit?: number;

  @ApiPropertyOptional({ description: 'Search in subject or content' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by contact ID' })
  @IsString()
  @IsOptional()
  contactId?: string;

  @ApiPropertyOptional({ description: 'Filter by account ID' })
  @IsString()
  @IsOptional()
  accountId?: string;

  @ApiPropertyOptional({ description: 'Filter by opportunity ID' })
  @IsString()
  @IsOptional()
  opportunityId?: string;

  @ApiPropertyOptional({ description: 'Show unread only', default: false })
  @IsBoolean()
  @IsOptional()
  unreadOnly?: boolean;

  @ApiPropertyOptional({ description: 'Show starred only', default: false })
  @IsBoolean()
  @IsOptional()
  starredOnly?: boolean;

  @ApiPropertyOptional({ description: 'Include archived', default: false })
  @IsBoolean()
  @IsOptional()
  includeArchived?: boolean;

  @ApiPropertyOptional({ description: 'Sort field', default: 'lastMessageAt' })
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

export class UpdateEmailThreadDto {
  @ApiPropertyOptional({ description: 'Mark as read/unread' })
  @IsBoolean()
  @IsOptional()
  isRead?: boolean;

  @ApiPropertyOptional({ description: 'Star/unstar thread' })
  @IsBoolean()
  @IsOptional()
  isStarred?: boolean;

  @ApiPropertyOptional({ description: 'Archive/unarchive thread' })
  @IsBoolean()
  @IsOptional()
  isArchived?: boolean;

  @ApiPropertyOptional({ description: 'Associate with contact' })
  @IsString()
  @IsOptional()
  contactId?: string;

  @ApiPropertyOptional({ description: 'Associate with account' })
  @IsString()
  @IsOptional()
  accountId?: string;

  @ApiPropertyOptional({ description: 'Associate with opportunity' })
  @IsString()
  @IsOptional()
  opportunityId?: string;
}
