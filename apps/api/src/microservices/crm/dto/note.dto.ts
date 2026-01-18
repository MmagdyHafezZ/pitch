import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class CreateNoteDto {
  @ApiProperty({
    example: 'Met with the client today. They are interested in...',
    description: 'Note content',
  })
  @IsString()
  content: string;

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

  @ApiPropertyOptional({ description: 'Pin this note', default: false })
  @IsBoolean()
  @IsOptional()
  isPinned?: boolean;
}

export class UpdateNoteDto extends PartialType(CreateNoteDto) {}

export class NoteResponseDto {
  @ApiProperty({ example: 'clx123abc456' })
  id: string;

  @ApiProperty({ example: 'org_123' })
  orgId: string;

  @ApiProperty({
    example: 'Met with the client today. They are interested in...',
  })
  content: string;

  @ApiPropertyOptional()
  contactId?: string;

  @ApiPropertyOptional()
  accountId?: string;

  @ApiPropertyOptional()
  opportunityId?: string;

  @ApiPropertyOptional()
  createdById?: string;

  @ApiProperty({ example: false })
  isPinned: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class NoteListQueryDto {
  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ description: 'Items per page', default: 20 })
  @IsOptional()
  limit?: number;

  @ApiPropertyOptional({ description: 'Search in note content' })
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

  @ApiPropertyOptional({ description: 'Filter by creator ID' })
  @IsString()
  @IsOptional()
  createdById?: string;

  @ApiPropertyOptional({
    description: 'Show pinned notes only',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  pinnedOnly?: boolean;

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
