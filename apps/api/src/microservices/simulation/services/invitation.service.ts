import {
  Injectable,
  NotFoundException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { InvitationRepository } from '../repositories/invitation.repository';
import { SessionRepository } from '../repositories/session.repository';
import type { PrismaError } from '@pitch/shared-backend/interfaces/error.interface';
import {
  CreateInvitationDto,
  InvitationResponseDto,
  InvitationListResponseDto,
  DeleteInvitationResponseDto,
  BulkCreateInvitationsResponseDto,
  InvitationStatus,
} from '../dto/invitation.dto';
import type { ISessionInvitation } from '../schemas/mongodb';
import { SessionMemberRepository } from '../repositories/session-member.repository';

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
    private readonly sessionMemberRepository: SessionMemberRepository,
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

    const inviterMember =
      await this.sessionMemberRepository.findBySessionIdAndUserId(
        sessionId,
        inviterId,
      );

    if (!inviterMember || inviterMember.role !== 'owner') {
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

        const existingMember =
          await this.sessionMemberRepository.findBySessionIdAndUserId(
            sessionId,
            inviteeId,
          );
        if (existingMember) {
          errors.push(
            `User ${inviteeId} is already a member of session ${sessionId}`,
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

    const sessions = await this.sessionRepository.findByIds([
      ...new Set(invitations.map((invite) => invite.sessionId)),
    ]);
    const sessionMap = new Map(
      sessions.map((session) => [session.id, session]),
    );

    return {
      invitations: invitations.map((invitation) =>
        this.mapToResponseDto(invitation, sessionMap.get(invitation.sessionId)),
      ),
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
      status,
    );

    const sessions = await this.sessionRepository.findByIds([
      ...new Set(invitations.map((invite) => invite.sessionId)),
    ]);
    const sessionMap = new Map(
      sessions.map((session) => [session.id, session]),
    );

    return {
      invitations: invitations.map((invitation) =>
        this.mapToResponseDto(invitation, sessionMap.get(invitation.sessionId)),
      ),
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
      status,
    );

    const sessions = await this.sessionRepository.findByIds([
      ...new Set(invitations.map((invite) => invite.sessionId)),
    ]);
    const sessionMap = new Map(
      sessions.map((session) => [session.id, session]),
    );

    return {
      invitations: invitations.map((invitation) =>
        this.mapToResponseDto(invitation, sessionMap.get(invitation.sessionId)),
      ),
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

    const session = await this.sessionRepository.findById(invitation.sessionId);
    return this.mapToResponseDto(invitation, session || undefined);
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

    const existingMember =
      await this.sessionMemberRepository.findBySessionIdAndUserId(
        invitation.sessionId,
        userId,
      );
    if (!existingMember) {
      await this.sessionMemberRepository.create({
        sessionId: invitation.sessionId,
        userId,
        role: 'viewer',
        userSnapshot: invitation.inviteeSnapshot,
      });
    }

    this.logger.log(`Invitation ${id} accepted`);

    const sessionSummary = session
      ? session
      : await this.sessionRepository.findById(invitation.sessionId);
    return this.mapToResponseDto(updated, sessionSummary || undefined);
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

    const session = await this.sessionRepository.findById(updated.sessionId);
    return this.mapToResponseDto(updated, session || undefined);
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
    invitation: ISessionInvitation,
    session?: { id: string; type: string; status: string; createdAt: Date },
  ): InvitationResponseDto {
    return {
      id: invitation._id,
      sessionId: invitation.sessionId,
      inviterId: invitation.inviterId,
      inviterSnapshot: invitation.inviterSnapshot,
      inviteeId: invitation.inviteeId,
      inviteeSnapshot: invitation.inviteeSnapshot,
      status: invitation.status as InvitationStatus,
      message: invitation.message || undefined,
      respondedAt: invitation.respondedAt || undefined,
      createdAt: invitation.createdAt,
      updatedAt: invitation.updatedAt,
      session: session
        ? {
            id: session.id,
            type: session.type,
            status: session.status,
            createdAt: session.createdAt,
          }
        : undefined,
    };
  }
}
