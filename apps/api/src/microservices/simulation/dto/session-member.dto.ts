import {
  IsArray,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export enum SessionMemberRoleDto {
  owner = 'owner',
  editor = 'editor',
  viewer = 'viewer',
}

export class AddSessionMembersDto {
  @ApiProperty({
    example: ['user_456', 'user_789'],
    description: 'IDs of users to add to the session',
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  userIds: string[];

  @ApiPropertyOptional({
    enum: SessionMemberRoleDto,
    example: SessionMemberRoleDto.viewer,
    description: 'Default role applied to added members',
  })
  @IsEnum(SessionMemberRoleDto)
  @IsOptional()
  role?: SessionMemberRoleDto;

  @ApiPropertyOptional({
    example: { user_456: { id: 'user_456', email: 'a@example.com' } },
    description: 'Optional user snapshot map keyed by userId',
  })
  @IsObject()
  @IsOptional()
  userSnapshots?: Record<string, any>;
}

export class SessionMemberResponseDto {
  @ApiProperty({ example: 'member_123' })
  id: string;

  @ApiProperty({ example: 'session_123' })
  sessionId: string;

  @ApiProperty({ example: 'user_123' })
  userId: string;

  @ApiProperty({
    enum: SessionMemberRoleDto,
    example: SessionMemberRoleDto.viewer,
  })
  role: SessionMemberRoleDto;

  @ApiPropertyOptional({
    example: { id: 'user_123', email: 'user@example.com', name: 'John Doe' },
  })
  userSnapshot?: Record<string, any>;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  joinedAt: Date;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  updatedAt: Date;
}

export class SessionMemberListResponseDto {
  @ApiProperty({ type: [SessionMemberResponseDto] })
  @ValidateNested({ each: true })
  @Type(() => SessionMemberResponseDto)
  members: SessionMemberResponseDto[];

  @ApiProperty({ example: 3 })
  total: number;
}

export class BulkAddSessionMembersResponseDto {
  @ApiProperty({ type: [SessionMemberResponseDto] })
  @ValidateNested({ each: true })
  @Type(() => SessionMemberResponseDto)
  members: SessionMemberResponseDto[];

  @ApiProperty({ example: 3 })
  created: number;

  @ApiProperty({ example: 1 })
  failed: number;

  @ApiPropertyOptional({
    example: ['User user_999 already added to session'],
    type: [String],
  })
  errors?: string[];
}

export class RemoveSessionMemberResponseDto {
  @ApiProperty({
    example: 'Member user_456 removed from session session_123',
  })
  message: string;

  @ApiProperty({ example: 'session_123' })
  sessionId: string;

  @ApiProperty({ example: 'user_456' })
  removedUserId: string;

  @ApiPropertyOptional({ example: 'user_789' })
  newOwnerId?: string;

  @ApiPropertyOptional({ example: true })
  sessionDeleted?: boolean;
}
