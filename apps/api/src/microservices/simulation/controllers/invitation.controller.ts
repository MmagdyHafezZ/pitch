import { Controller, ValidationPipe, UsePipes, Logger } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { InvitationService } from '../services/invitation.service';
import { SIMULATION_SERVICE_PATTERNS } from '@pitch/shared-backend/interfaces/message-patterns.interface';
import { toRpcException } from '@pitch/shared-backend/helpers/exceptions';
import {
  CreateInvitationDto,
  UpdateInvitationStatusDto,
  InvitationStatus,
} from '../dto/invitation.dto';
import * as userClaimsInterface from '@pitch/shared-backend/interfaces/user-claims.interface';

/**
 * Invitation Controller (Message-based)
 *
 * Handles RPC message patterns for invitation operations
 */
@Controller()
export class InvitationController {
  private readonly logger = new Logger(InvitationController.name);

  constructor(private readonly invitationService: InvitationService) {}

  /**
   * Create invitations for a session
   */
  @MessagePattern(SIMULATION_SERVICE_PATTERNS.CREATE_INVITATIONS)
  @UsePipes(new ValidationPipe({ transform: true }))
  async createInvitations(
    @Payload()
    data: { sessionId: string; inviterId: string } & CreateInvitationDto &
      userClaimsInterface.MessageWithUserClaims,
  ) {
    try {
      this.logger.log(
        `Creating invitations for session ${data.sessionId} - Requested by: ${data.userClaims?.email || 'unknown'}`,
      );
      const {
        userClaims: _userClaims,
        sessionId,
        inviterId,
        ...createDto
      } = data;
      void _userClaims;
      return await this.invitationService.createInvitations(
        sessionId,
        inviterId,
        createDto as CreateInvitationDto,
      );
    } catch (error) {
      this.logger.error('Failed to create invitations', error);
      throw toRpcException(error);
    }
  }

  /**
   * Get invitation by ID
   */
  @MessagePattern(SIMULATION_SERVICE_PATTERNS.GET_INVITATION)
  async getInvitation(
    @Payload()
    data: { id: string } & userClaimsInterface.MessageWithUserClaims,
  ) {
    try {
      this.logger.log(
        `Getting invitation ${data.id} - Requested by: ${data.userClaims?.email || 'unknown'}`,
      );
      return await this.invitationService.findOne(data.id);
    } catch (error) {
      this.logger.error(`Failed to get invitation ${data.id}`, error);
      throw toRpcException(error);
    }
  }

  /**
   * List invitations for a session
   */
  @MessagePattern(SIMULATION_SERVICE_PATTERNS.LIST_SESSION_INVITATIONS)
  async listSessionInvitations(
    @Payload()
    data: { sessionId: string } & userClaimsInterface.MessageWithUserClaims,
  ) {
    try {
      this.logger.log(
        `Listing invitations for session ${data.sessionId} - Requested by: ${data.userClaims?.email || 'unknown'}`,
      );
      return await this.invitationService.findBySessionId(data.sessionId);
    } catch (error) {
      this.logger.error('Failed to list session invitations', error);
      throw toRpcException(error);
    }
  }

  /**
   * List invitations for a user (received)
   */
  @MessagePattern(SIMULATION_SERVICE_PATTERNS.LIST_USER_INVITATIONS)
  async listUserInvitations(
    @Payload()
    data: {
      userId: string;
      status?: InvitationStatus;
    } & userClaimsInterface.MessageWithUserClaims,
  ) {
    try {
      this.logger.log(
        `Listing invitations for user ${data.userId} - Requested by: ${data.userClaims?.email || 'unknown'}`,
      );
      return await this.invitationService.findInvitationsForUser(
        data.userId,
        data.status,
      );
    } catch (error) {
      this.logger.error('Failed to list user invitations', error);
      throw toRpcException(error);
    }
  }

  /**
   * List invitations sent by a user
   */
  @MessagePattern(SIMULATION_SERVICE_PATTERNS.LIST_SENT_INVITATIONS)
  async listSentInvitations(
    @Payload()
    data: {
      userId: string;
      status?: InvitationStatus;
    } & userClaimsInterface.MessageWithUserClaims,
  ) {
    try {
      this.logger.log(
        `Listing sent invitations for user ${data.userId} - Requested by: ${data.userClaims?.email || 'unknown'}`,
      );
      return await this.invitationService.findInvitationsSentByUser(
        data.userId,
        data.status,
      );
    } catch (error) {
      this.logger.error('Failed to list sent invitations', error);
      throw toRpcException(error);
    }
  }

  /**
   * Accept an invitation
   */
  @MessagePattern(SIMULATION_SERVICE_PATTERNS.ACCEPT_INVITATION)
  async acceptInvitation(
    @Payload()
    data: {
      id: string;
      userId: string;
    } & userClaimsInterface.MessageWithUserClaims,
  ) {
    try {
      this.logger.log(
        `Accepting invitation ${data.id} - Requested by: ${data.userClaims?.email || 'unknown'}`,
      );
      return await this.invitationService.acceptInvitation(
        data.id,
        data.userId,
      );
    } catch (error) {
      this.logger.error(`Failed to accept invitation ${data.id}`, error);
      throw toRpcException(error);
    }
  }

  /**
   * Decline an invitation
   */
  @MessagePattern(SIMULATION_SERVICE_PATTERNS.DECLINE_INVITATION)
  async declineInvitation(
    @Payload()
    data: {
      id: string;
      userId: string;
    } & userClaimsInterface.MessageWithUserClaims,
  ) {
    try {
      this.logger.log(
        `Declining invitation ${data.id} - Requested by: ${data.userClaims?.email || 'unknown'}`,
      );
      return await this.invitationService.declineInvitation(
        data.id,
        data.userId,
      );
    } catch (error) {
      this.logger.error(`Failed to decline invitation ${data.id}`, error);
      throw toRpcException(error);
    }
  }

  /**
   * Revoke an invitation
   */
  @MessagePattern(SIMULATION_SERVICE_PATTERNS.REVOKE_INVITATION)
  async revokeInvitation(
    @Payload()
    data: {
      id: string;
      userId: string;
    } & userClaimsInterface.MessageWithUserClaims,
  ) {
    try {
      this.logger.log(
        `Revoking invitation ${data.id} - Requested by: ${data.userClaims?.email || 'unknown'}`,
      );
      return await this.invitationService.revokeInvitation(
        data.id,
        data.userId,
      );
    } catch (error) {
      this.logger.error(`Failed to revoke invitation ${data.id}`, error);
      throw toRpcException(error);
    }
  }

  /**
   * Delete an invitation
   */
  @MessagePattern(SIMULATION_SERVICE_PATTERNS.DELETE_INVITATION)
  async deleteInvitation(
    @Payload()
    data: { id: string } & userClaimsInterface.MessageWithUserClaims,
  ) {
    try {
      this.logger.log(
        `Deleting invitation ${data.id} - Requested by: ${data.userClaims?.email || 'unknown'}`,
      );
      return await this.invitationService.deleteInvitation(data.id);
    } catch (error) {
      this.logger.error(`Failed to delete invitation ${data.id}`, error);
      throw toRpcException(error);
    }
  }

  /**
   * Get pending invitation count
   */
  @MessagePattern(SIMULATION_SERVICE_PATTERNS.GET_PENDING_COUNT)
  async getPendingCount(
    @Payload()
    data: { userId: string } & userClaimsInterface.MessageWithUserClaims,
  ) {
    try {
      this.logger.log(
        `Getting pending count for user ${data.userId} - Requested by: ${data.userClaims?.email || 'unknown'}`,
      );
      return await this.invitationService.getPendingCount(data.userId);
    } catch (error) {
      this.logger.error('Failed to get pending count', error);
      throw toRpcException(error);
    }
  }
}
