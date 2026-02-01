import {
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
  IsObject,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

/**
 * Invitation Status Enum
 */
export enum InvitationStatus {
  pending = 'pending',
  accepted = 'accepted',
  declined = 'declined',
  revoked = 'revoked',
}

/**
 * Create Invitation DTO
 *
 * Used to invite one or more users to a session
 */
export class CreateInvitationDto {
  @ApiProperty({
    example: ['user_456', 'user_789'],
    description: 'IDs of users to invite',
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  inviteeIds: string[];

  @ApiPropertyOptional({
    example: 'Join me for a sales training session!',
    description: 'Optional message for the invitees',
  })
  @IsString()
  @IsOptional()
  message?: string;

  @ApiPropertyOptional({
    example: { id: 'user_123', email: 'inviter@example.com', name: 'John Doe' },
    description: 'Snapshot of inviter info',
  })
  @IsObject()
  @IsOptional()
  inviterSnapshot?: Record<string, any>;
}

/**
 * Update Invitation Status DTO
 *
 * Used to accept or decline an invitation
 */
export class UpdateInvitationStatusDto {
  @ApiProperty({
    enum: InvitationStatus,
    example: InvitationStatus.accepted,
    description: 'New status for the invitation',
  })
  @IsEnum(InvitationStatus)
  status: InvitationStatus;
}

/**
 * Invitation Response DTO
 *
 * Response format for a single invitation
 */
export class InvitationResponseDto {
  @ApiProperty({ example: 'invitation_123' })
  id: string;

  @ApiProperty({ example: 'session_123' })
  sessionId: string;

  @ApiProperty({ example: 'user_123' })
  inviterId: string;

  @ApiPropertyOptional({
    example: { id: 'user_123', email: 'inviter@example.com', name: 'John Doe' },
  })
  inviterSnapshot?: Record<string, any>;

  @ApiProperty({ example: 'user_456' })
  inviteeId: string;

  @ApiPropertyOptional({
    example: {
      id: 'user_456',
      email: 'invitee@example.com',
      name: 'Jane Smith',
    },
  })
  inviteeSnapshot?: Record<string, any>;

  @ApiProperty({ enum: InvitationStatus, example: InvitationStatus.pending })
  status: InvitationStatus;

  @ApiPropertyOptional({
    example: 'Join me for a sales training session!',
  })
  message?: string;

  @ApiPropertyOptional({ example: '2024-01-23T18:30:00.000Z' })
  respondedAt?: Date;

  @ApiProperty({ example: '2024-01-23T18:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2024-01-23T18:30:00.000Z' })
  updatedAt: Date;

  @ApiPropertyOptional()
  session?: {
    id: string;
    type: string;
    status: string;
    createdAt: Date;
  };
}

/**
 * Invitation List Response DTO
 *
 * Response format for a list of invitations
 */
export class InvitationListResponseDto {
  @ApiProperty({ type: [InvitationResponseDto] })
  @ValidateNested({ each: true })
  @Type(() => InvitationResponseDto)
  invitations: InvitationResponseDto[];

  @ApiProperty({ example: 25 })
  total: number;
}

/**
 * Delete Invitation Response DTO
 *
 * Response format after deleting/revoking an invitation
 */
export class DeleteInvitationResponseDto {
  @ApiProperty({
    example: 'Invitation invitation_123 has been revoked successfully',
  })
  message: string;

  @ApiProperty({ example: 'invitation_123' })
  id: string;
}

/**
 * Bulk Create Invitations Response DTO
 *
 * Response after creating multiple invitations
 */
export class BulkCreateInvitationsResponseDto {
  @ApiProperty({ type: [InvitationResponseDto] })
  @ValidateNested({ each: true })
  @Type(() => InvitationResponseDto)
  invitations: InvitationResponseDto[];

  @ApiProperty({ example: 3 })
  created: number;

  @ApiProperty({ example: 1 })
  failed: number;

  @ApiPropertyOptional({
    example: ['User user_999 already invited to this session'],
    type: [String],
  })
  errors?: string[];
}
