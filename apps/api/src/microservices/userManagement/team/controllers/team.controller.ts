import {
  Controller,
  Logger,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { TeamService } from '../services/team.service';
import { USER_SERVICE_PATTERNS } from '@pitch/shared-backend/interfaces/message-patterns.interface';
import * as userClaimsInterface from '@pitch/shared-backend/interfaces/user-claims.interface';
import { toRpcException } from '@pitch/shared-backend/helpers/exceptions';
import {
  AddMemberRequestDTO,
  CreateTeamRequestDto,
  InviteMemberRequestDTO,
  SendTeamSignupInviteRequestDto,
  UpdateMemberRequestDto,
  UpdateTeamRequestDto,
} from '../dto/team.dto';
import {
  AddMemberDto,
  UpdateMemberDto,
  CreateTeamDto,
  UpdateTeamDto,
  TeamMetadata,
} from '@pitch/shared-backend/interfaces/user.interface';
import { Prisma } from '@prisma/user-client';
import { ElevatedAccessGuard } from '../../guards/elevated-access.guard';

@Controller()
export class TeamController {
  private readonly logger = new Logger(TeamController.name);

  constructor(private readonly teamService: TeamService) {}

  @MessagePattern(USER_SERVICE_PATTERNS.CREATE_TEAM)
  @UsePipes(new ValidationPipe({ transform: true }))
  async createTeam(
    @Payload()
    data: CreateTeamRequestDto & userClaimsInterface.MessageWithUserClaims,
  ) {
    try {
      this.logger.log(
        `Creating team - Requested by: ${data.userClaims.email} (${data.userClaims.id})`,
      );
      const { userClaims: _userClaims, ...createTeamDto } = data;

      const dto: CreateTeamDto = {
        name: createTeamDto.name,
        slug: createTeamDto.slug,
        isActive: true,
        billingEmail: createTeamDto.billingEmail,
        billingAddress:
          createTeamDto.billingAddress as unknown as Prisma.JsonValue,
        metadata: createTeamDto.metadata as unknown as TeamMetadata,
      };

      return await this.teamService.createTeam(dto, _userClaims.id);
    } catch (error) {
      throw toRpcException(error);
    }
  }

  @UseGuards(ElevatedAccessGuard)
  @MessagePattern(USER_SERVICE_PATTERNS.UPDATE_TEAM)
  @UsePipes(
    new ValidationPipe({ transform: true, skipMissingProperties: true }),
  )
  async updateTeam(
    @Payload()
    data: { teamId: string } & UpdateTeamRequestDto &
      userClaimsInterface.MessageWithUserClaims,
  ) {
    try {
      this.logger.log(
        `Updating team - Requested by: ${data.userClaims?.email ?? 'admin'} (${data.userClaims?.id ?? 'N/A'})`,
      );
      const { userClaims: _userClaims, teamId, ...updateData } = data;

      const dto: UpdateTeamDto = {
        name: updateData.name,
        slug: updateData.slug,
        isActive: updateData.isActive,
        billingEmail: updateData.billingEmail,
        billingAddress:
          updateData.billingAddress as unknown as Prisma.JsonValue,
        metadata: updateData.metadata as unknown as TeamMetadata,
      };

      const isAdmin = (data as any).isAdmin === true;
      return await this.teamService.updateTeam(
        teamId,
        dto,
        _userClaims?.id ?? '',
        isAdmin,
      );
    } catch (error) {
      throw toRpcException(error);
    }
  }

  @UseGuards(ElevatedAccessGuard)
  @MessagePattern(USER_SERVICE_PATTERNS.DELETE_TEAM)
  async deleteTeam(
    @Payload()
    data: { teamId: string } & userClaimsInterface.MessageWithUserClaims,
  ) {
    try {
      this.logger.log(
        `Deleting team ${data.teamId} - Requested by: ${data.userClaims?.email ?? 'admin'} (${data.userClaims?.id ?? 'N/A'})`,
      );
      return await this.teamService.removeTeam(
        data.teamId,
        data.userClaims?.id ?? '',
      );
    } catch (error) {
      throw toRpcException(error);
    }
  }

  @MessagePattern(USER_SERVICE_PATTERNS.GET_TEAM)
  async getTeam(
    @Payload()
    data: { teamId: string } & userClaimsInterface.MessageWithUserClaims,
  ) {
    try {
      this.logger.log(
        `Getting team ${data.teamId} - Requested by: ${data.userClaims?.email ?? 'admin'} (${data.userClaims?.id ?? 'N/A'})`,
      );
      return await this.teamService.findById(data.teamId);
    } catch (error) {
      throw toRpcException(error);
    }
  }

  @MessagePattern(USER_SERVICE_PATTERNS.GET_TEAMS)
  async getTeams(@Payload() data: userClaimsInterface.MessageWithUserClaims) {
    try {
      this.logger.log(
        `Getting teams - Requested by: ${data.userClaims?.email ?? 'admin'} (${data.userClaims?.id ?? 'N/A'})`,
      );
      return await this.teamService.findAll();
    } catch (error) {
      throw toRpcException(error);
    }
  }

  @MessagePattern(USER_SERVICE_PATTERNS.GET_USER_TEAMS)
  async getUserTeams(
    @Payload() data: userClaimsInterface.MessageWithUserClaims,
  ) {
    try {
      this.logger.log(
        `Getting teams for user ${data.userClaims.id} - Requested by: ${data.userClaims.email} (${data.userClaims.id})`,
      );
      return await this.teamService.findUserTeams(data.userClaims.id);
    } catch (error) {
      throw toRpcException(error);
    }
  }

  @UseGuards(ElevatedAccessGuard)
  @MessagePattern(USER_SERVICE_PATTERNS.ADD_TEAM_MEMBER)
  @UsePipes(new ValidationPipe({ transform: true }))
  async addTeamMember(
    @Payload()
    data: AddMemberRequestDTO &
      userClaimsInterface.MessageWithUserClaims & { teamId: string },
  ) {
    try {
      this.logger.log(
        `Adding team member - Requested by: ${data.userClaims?.email ?? 'admin'} (${data.userClaims?.id ?? 'N/A'})`,
      );
      const { userClaims: _userClaims, teamId, ...addMemberDto } = data;
      const dto: AddMemberDto = {
        teamId: teamId,
        userId: addMemberDto.userId,
        role: addMemberDto.role,
        tokenLimit: addMemberDto.tokenLimit,
        isActive: addMemberDto.isActive,
        invitedByUserId: _userClaims?.id ?? '',
      };

      const isAdmin = (data as any).isAdmin === true;
      return await this.teamService.addMember(
        dto,
        _userClaims?.id ?? '',
        isAdmin,
      );
    } catch (error) {
      throw toRpcException(error);
    }
  }

  @UseGuards(ElevatedAccessGuard)
  @MessagePattern(USER_SERVICE_PATTERNS.UPDATE_TEAM_MEMBER)
  @UsePipes(
    new ValidationPipe({ transform: true, skipMissingProperties: true }),
  )
  async updateTeamMember(
    @Payload()
    data: UpdateMemberRequestDto &
      userClaimsInterface.MessageWithUserClaims & { teamId: string } & {
        userId: string;
      },
  ) {
    try {
      this.logger.log(
        `Updating team member - Requested by: ${data.userClaims?.email ?? 'admin'} (${data.userClaims?.id ?? 'N/A'})`,
      );
      const { userClaims: _userClaims, teamId, userId, ...addMemberDto } = data;
      const dto: UpdateMemberDto = {
        teamId: teamId,
        userId: userId,
        role: addMemberDto.role,
        tokenLimit: addMemberDto.tokenLimit,
        isActive: addMemberDto.isActive,
      };

      const isAdmin = (data as any).isAdmin === true;
      return await this.teamService.updateMember(
        dto,
        _userClaims?.id ?? '',
        isAdmin,
      );
    } catch (error) {
      throw toRpcException(error);
    }
  }

  @MessagePattern(USER_SERVICE_PATTERNS.DELETE_TEAM_MEMBER)
  @UsePipes(
    new ValidationPipe({ transform: true, skipMissingProperties: true }),
  )
  async removeTeamMember(
    @Payload()
    data: userClaimsInterface.MessageWithUserClaims & { teamId: string } & {
      userId: string;
    },
  ) {
    try {
      this.logger.log(
        `Removing user ${data.userId} from ${data.teamId} - Requested by: ${data.userClaims?.email ?? 'admin'} (${data.userClaims?.id ?? 'N/A'})`,
      );
      const isAdmin = (data as any).isAdmin === true;
      return await this.teamService.removeTeamMember(
        data.teamId,
        data.userId,
        data.userClaims?.id ?? '',
        isAdmin,
      );
    } catch (error) {
      throw toRpcException(error);
    }
  }

  @UseGuards(ElevatedAccessGuard)
  @MessagePattern(USER_SERVICE_PATTERNS.SEND_TEAM_SIGNUP_INVITE)
  @UsePipes(new ValidationPipe({ transform: true }))
  async sendTeamSignupInvite(
    @Payload()
    data: SendTeamSignupInviteRequestDto &
      userClaimsInterface.MessageWithUserClaims & { teamId: string },
  ) {
    try {
      this.logger.log(
        `Sending team signup invite - Requested by: ${data.userClaims.email} (${data.userClaims.id})`,
      );
      return await this.teamService.sendSignupInvite({
        teamId: data.teamId,
        email: data.email,
        requesterId: data.userClaims.id,
        inviterName: data.userClaims.name,
        signupUrl: data.signupUrl,
        role: data.role,
      });
    } catch (error) {
      throw toRpcException(error);
    }
  }

  @UseGuards(ElevatedAccessGuard)
  @MessagePattern(USER_SERVICE_PATTERNS.INVITE_TEAM_MEMBER)
  @UsePipes(new ValidationPipe({ transform: true }))
  async inviteTeamMember(
    @Payload()
    data: InviteMemberRequestDTO &
      userClaimsInterface.MessageWithUserClaims & { teamId: string },
  ) {
    try {
      this.logger.log(
        `Inviting team member - Requested by: ${data.userClaims.email} (${data.userClaims.id})`,
      );
      const { userClaims: _userClaims, teamId, ...inviteMemberDto } = data;
      const dto: AddMemberDto = {
        teamId,
        userId: inviteMemberDto.userId,
        role: inviteMemberDto.role,
        tokenLimit: inviteMemberDto.tokenLimit,
        invitedByUserId: _userClaims.id,
      };

      return await this.teamService.inviteMember(dto, {
        id: _userClaims.id,
        name: _userClaims.name,
      });
    } catch (error) {
      throw toRpcException(error);
    }
  }

  @MessagePattern(USER_SERVICE_PATTERNS.ACCEPT_TEAM_INVITE)
  @UsePipes(new ValidationPipe({ transform: true }))
  async acceptTeamInvite(
    @Payload()
    data: userClaimsInterface.MessageWithUserClaims & { teamId: string },
  ) {
    try {
      this.logger.log(
        `Accepting team invite - Requested by: ${data.userClaims.email} (${data.userClaims.id})`,
      );
      return await this.teamService.acceptInvite(
        data.teamId,
        data.userClaims.id,
      );
    } catch (error) {
      throw toRpcException(error);
    }
  }

  @MessagePattern(USER_SERVICE_PATTERNS.CLAIM_TEAM_SIGNUP_INVITE)
  @UsePipes(new ValidationPipe({ transform: true }))
  async claimTeamSignupInvite(
    @Payload()
    data: userClaimsInterface.MessageWithUserClaims & { teamId: string },
  ) {
    try {
      this.logger.log(
        `Claiming team signup invite - Requested by: ${data.userClaims.email} (${data.userClaims.id})`,
      );
      return await this.teamService.claimSignupInvite(
        data.teamId,
        data.userClaims.id,
      );
    } catch (error) {
      throw toRpcException(error);
    }
  }
}
