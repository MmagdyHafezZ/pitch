import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsString, IsOptional, IsArray, Matches } from 'class-validator';

export class CreateTagDto {
  @ApiProperty({ example: 'VIP Customer', description: 'Tag name' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: '#EF4444', description: 'Hex color code' })
  @IsString()
  @Matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, {
    message: 'Color must be a valid hex color code',
  })
  @IsOptional()
  color?: string;
}

export class UpdateTagDto extends PartialType(CreateTagDto) {}

export class TagResponseDto {
  @ApiProperty({ example: 'clx123abc456' })
  id: string;

  @ApiProperty({ example: 'org_123' })
  orgId: string;

  @ApiProperty({ example: 'VIP Customer' })
  name: string;

  @ApiPropertyOptional({ example: '#EF4444' })
  color?: string;

  @ApiProperty()
  createdAt: Date;
}

export class AssignTagsDto {
  @ApiProperty({
    description: 'Array of tag IDs to assign',
    type: [String],
    example: ['tag_1', 'tag_2'],
  })
  @IsArray()
  @IsString({ each: true })
  tagIds: string[];
}

export class TagListQueryDto {
  @ApiPropertyOptional({ description: 'Search by tag name' })
  @IsString()
  @IsOptional()
  search?: string;

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
