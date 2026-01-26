import {
  Injectable,
  NotFoundException,
  Logger,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InvitationRepository } from '../repositories/invitation.repository';
import { SessionRepository } from '../repositories/session.repository';
import type { SessionInvitation } from '@prisma/simulation-client';
import type { PrismaError } from '@pitch/shared-backend/interfaces/error.interface';
import {
  CreateInvitationDto,
  UpdateInvitationStatusDto,
  InvitationResponseDto,
  InvitationListResponseDto,
  DeleteInvitationResponseDto,
  BulkCreateInvitationsResponseDto,
  InvitationStatus,
} from '../dto/invitation.dto';

/**
 * Invitation Service
 *
 * Handles business logic for session invitations
 */
@Injectable()
export class InvitationService {
  private readonly logger = new Logger(InvitationService.name);

  constructor(
    private readonly invitationRepository: InvitationRepository,
    private readonly sessionRepository: SessionRepository,
  ) {}

  /**
   * Create invitations for a session
   */
  async createInvitations(
    sessionId: string,
    inviterId: string,
    createInvitationDto: CreateInvitationDto,
  ): Promise<BulkCreateInvitationsResponseDto> {
    this.logger.log(
      `Creating ${createInvitationDto.inviteeIds.length} invitations for session ${sessionId}`,
    );

    const session = await this.sessionRepository.findById(sessionId);
    if (!session) {
      throw new NotFoundException(`Session with ID ${sessionId} not found`);
    }

    if (session.status === 'ended') {
      throw new BadRequestException(
        `Cannot invite users to session ${sessionId} because it has ended`,
      );
    }

    if (session.userId !== inviterId) {
      throw new BadRequestException(
        `User ${inviterId} does not have permission to invite users to session ${sessionId}`,
      );
    }

    const invitations: InvitationResponseDto[] = [];
    const errors: string[] = [];
    let created = 0;
    let failed = 0;

    for (const inviteeId of createInvitationDto.inviteeIds) {
      try {
        const existing =
          await this.invitationRepository.existsForSessionAndInvitee(
            sessionId,
            inviteeId,
          );

        if (existing) {
          errors.push(
            `User ${inviteeId} already invited to session ${sessionId} (status: ${existing.status})`,
          );
          failed++;
          continue;
        }

        const invitation = await this.invitationRepository.create({
          sessionId,
          inviterId,
          inviterSnapshot: createInvitationDto.inviterSnapshot,
          inviteeId,
          message: createInvitationDto.message,
        });

        invitations.push(this.mapToResponseDto(invitation));
        created++;
        this.logger.log(`Created invitation for user ${inviteeId}`);
      } catch (error) {
        this.logger.error(
          `Failed to create invitation for user ${inviteeId}: ${error}`,
        );
        errors.push(
          `Failed to invite ${inviteeId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
        failed++;
      }
    }

    this.logger.log(
      `Created ${created} invitations, ${failed} failed for session ${sessionId}`,
    );

    return {
      invitations,
      created,
      failed,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Get all invitations for a session
   */
  async findBySessionId(sessionId: string): Promise<InvitationListResponseDto> {
    this.logger.log(`Finding invitations for session: ${sessionId}`);

    const invitations =
      await this.invitationRepository.findBySessionId(sessionId);

    return {
      invitations: invitations.map(this.mapToResponseDto),
      total: invitations.length,
    };
  }

  /**
   * Get invitations received by a user
   */
  async findInvitationsForUser(
    userId: string,
    status?: InvitationStatus,
  ): Promise<InvitationListResponseDto> {
    this.logger.log(
      `Finding invitations for user: ${userId}, status: ${status || 'all'}`,
    );

    const invitations = await this.invitationRepository.findByInviteeId(
      userId,
      status as any,
    );

    return {
      invitations: invitations.map(this.mapToResponseDto),
      total: invitations.length,
    };
  }

  /**
   * Get invitations sent by a user
   */
  async findInvitationsSentByUser(
    userId: string,
    status?: InvitationStatus,
  ): Promise<InvitationListResponseDto> {
    this.logger.log(
      `Finding invitations sent by user: ${userId}, status: ${status || 'all'}`,
    );

    const invitations = await this.invitationRepository.findByInviterId(
      userId,
      status as any,
    );

    return {
      invitations: invitations.map(this.mapToResponseDto),
      total: invitations.length,
    };
  }

  /**
   * Get invitation by ID
   */
  async findOne(id: string): Promise<InvitationResponseDto> {
    this.logger.log(`Finding invitation: ${id}`);

    const invitation = await this.invitationRepository.findById(id);
    if (!invitation) {
      throw new NotFoundException(`Invitation with ID ${id} not found`);
    }

    return this.mapToResponseDto(invitation);
  }

  /**
   * Accept an invitation
   */
  async acceptInvitation(
    id: string,
    userId: string,
  ): Promise<InvitationResponseDto> {
    this.logger.log(`User ${userId} accepting invitation: ${id}`);

    const invitation = await this.invitationRepository.findById(id);
    if (!invitation) {
      throw new NotFoundException(`Invitation with ID ${id} not found`);
    }

    if (invitation.inviteeId !== userId) {
      throw new BadRequestException(
        `User ${userId} is not authorized to accept invitation ${id}`,
      );
    }

    if (invitation.status !== 'pending') {
      throw new BadRequestException(
        `Invitation ${id} has already been ${invitation.status}`,
      );
    }

    const session = await this.sessionRepository.findById(invitation.sessionId);

    if (session?.status === 'ended') {
      throw new BadRequestException(
        `Cannot accept invitation to session ${invitation.sessionId} because it has ended`,
      );
    }

    const updated = await this.invitationRepository.updateStatus(
      id,
      'accepted',
    );
    this.logger.log(`Invitation ${id} accepted`);

    return this.mapToResponseDto(updated);
  }

  /**
   * Decline an invitation
   */
  async declineInvitation(
    id: string,
    userId: string,
  ): Promise<InvitationResponseDto> {
    this.logger.log(`User ${userId} declining invitation: ${id}`);

    const invitation = await this.invitationRepository.findById(id);
    if (!invitation) {
      throw new NotFoundException(`Invitation with ID ${id} not found`);
    }

    if (invitation.inviteeId !== userId) {
      throw new BadRequestException(
        `User ${userId} is not authorized to decline invitation ${id}`,
      );
    }

    if (invitation.status !== 'pending') {
      throw new BadRequestException(
        `Invitation ${id} has already been ${invitation.status}`,
      );
    }

    const updated = await this.invitationRepository.updateStatus(
      id,
      'declined',
    );
    this.logger.log(`Invitation ${id} declined`);

    return this.mapToResponseDto(updated);
  }

  /**
   * Revoke an invitation
   */
  async revokeInvitation(
    id: string,
    userId: string,
  ): Promise<DeleteInvitationResponseDto> {
    this.logger.log(`User ${userId} revoking invitation: ${id}`);

    const invitation = await this.invitationRepository.findById(id);
    if (!invitation) {
      throw new NotFoundException(`Invitation with ID ${id} not found`);
    }

    if (invitation.inviterId !== userId) {
      throw new BadRequestException(
        `User ${userId} is not authorized to revoke invitation ${id}`,
      );
    }

    if (invitation.status !== 'pending') {
      throw new BadRequestException(
        `Cannot revoke invitation ${id} because it has already been ${invitation.status}`,
      );
    }

    await this.invitationRepository.delete(id);
    this.logger.log(`Invitation ${id} revoked`);

    return {
      message: `Invitation ${id} has been revoked successfully`,
      id,
    };
  }

  /**
   * Delete an invitation (admin)
   */
  async deleteInvitation(id: string): Promise<DeleteInvitationResponseDto> {
    this.logger.log(`Deleting invitation: ${id}`);

    const invitation = await this.invitationRepository.findById(id);
    if (!invitation) {
      throw new NotFoundException(`Invitation with ID ${id} not found`);
    }

    try {
      await this.invitationRepository.delete(id);
      this.logger.log(`Deleted invitation: ${id}`);

      return {
        message: `Invitation ${id} has been deleted successfully`,
        id,
      };
    } catch (error) {
      const err = error as PrismaError;
      if (err.code === 'P2025') {
        throw new NotFoundException(`Invitation with ID ${id} not found`);
      }
      throw error;
    }
  }

  /**
   * Get pending invitation count for a user
   */
  async getPendingCount(userId: string): Promise<{ count: number }> {
    const count =
      await this.invitationRepository.countPendingForInvitee(userId);
    return { count };
  }

  /**
   * Map SessionInvitation to InvitationResponseDto
   */
  private mapToResponseDto(
    invitation: SessionInvitation,
  ): InvitationResponseDto {
    return {
      id: invitation.id,
      sessionId: invitation.sessionId,
      inviterId: invitation.inviterId,
      inviterSnapshot: invitation.inviterSnapshot as
        | Record<string, any>
        | undefined,
      inviteeId: invitation.inviteeId,
      inviteeSnapshot: invitation.inviteeSnapshot as
        | Record<string, any>
        | undefined,
      status: invitation.status as InvitationStatus,
      message: invitation.message || undefined,
      respondedAt: invitation.respondedAt || undefined,
      createdAt: invitation.createdAt,
      updatedAt: invitation.updatedAt,
      session: (invitation as any).session
        ? {
            id: (invitation as any).session.id,
            type: (invitation as any).session.type,
            status: (invitation as any).session.status,
            createdAt: (invitation as any).session.createdAt,
          }
        : undefined,
    };
  }
}
