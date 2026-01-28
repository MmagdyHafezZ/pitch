import { Controller, Logger, ValidationPipe, UsePipes } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { SIMULATION_SERVICE_PATTERNS } from '@pitch/shared-backend/interfaces/message-patterns.interface';
import { toRpcException } from '@pitch/shared-backend/helpers/exceptions';
import * as userClaimsInterface from '@pitch/shared-backend/interfaces/user-claims.interface';
import { SessionMemberService } from '../services/session-member.service';
import {
  AddSessionMembersDto,
  BulkAddSessionMembersResponseDto,
  RemoveSessionMemberResponseDto,
  SessionMemberListResponseDto,
} from '../dto/session-member.dto';

@Controller()
export class SessionMemberController {
  private readonly logger = new Logger(SessionMemberController.name);

  constructor(private readonly sessionMemberService: SessionMemberService) {}

  @MessagePattern(SIMULATION_SERVICE_PATTERNS.ADD_SESSION_MEMBERS)
  @UsePipes(new ValidationPipe({ transform: true }))
  async addMembers(
    @Payload()
    data: { sessionId: string } & AddSessionMembersDto &
      userClaimsInterface.MessageWithUserClaims,
  ): Promise<BulkAddSessionMembersResponseDto> {
    try {
      const { sessionId, userClaims, ...payload } = data;
      if (!userClaims?.id) {
        throw new Error('User claims are required to add session members');
      }

      this.logger.log(
        `Adding members to session ${sessionId} - Requested by: ${userClaims.email}`,
      );

      return await this.sessionMemberService.addMembers(
        sessionId,
        userClaims.id,
        payload as AddSessionMembersDto,
      );
    } catch (error) {
      this.logger.error('Failed to add session members', error);
      throw toRpcException(error);
    }
  }

  @MessagePattern(SIMULATION_SERVICE_PATTERNS.LIST_SESSION_MEMBERS)
  async listMembers(
    @Payload()
    data: { sessionId: string } & userClaimsInterface.MessageWithUserClaims,
  ): Promise<SessionMemberListResponseDto> {
    try {
      const { sessionId, userClaims } = data;
      if (!userClaims?.id) {
        throw new Error('User claims are required to list session members');
      }

      this.logger.log(
        `Listing members for session ${sessionId} - Requested by: ${userClaims.email}`,
      );

      return await this.sessionMemberService.listMembers(
        sessionId,
        userClaims.id,
      );
    } catch (error) {
      this.logger.error('Failed to list session members', error);
      throw toRpcException(error);
    }
  }

  @MessagePattern(SIMULATION_SERVICE_PATTERNS.REMOVE_SESSION_MEMBER)
  async removeMember(
    @Payload()
    data: {
      sessionId: string;
      userId: string;
    } & userClaimsInterface.MessageWithUserClaims,
  ): Promise<RemoveSessionMemberResponseDto> {
    try {
      const { sessionId, userId, userClaims } = data;
      if (!userClaims?.id) {
        throw new Error('User claims are required to remove session members');
      }

      this.logger.log(
        `Removing member ${userId} from session ${sessionId} - Requested by: ${userClaims.email}`,
      );

      return await this.sessionMemberService.removeMember(
        sessionId,
        userClaims.id,
        userId,
      );
    } catch (error) {
      this.logger.error('Failed to remove session member', error);
      throw toRpcException(error);
    }
  }
}
