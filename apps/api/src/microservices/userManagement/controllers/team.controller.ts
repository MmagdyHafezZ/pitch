import { Controller, Logger, UsePipes, ValidationPipe } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { TeamService } from '../services/team.service';
import { USER_SERVICE_PATTERNS } from '../../../common/interfaces/message-patterns.interface';
import * as userClaimsInterface from '../../../common/interfaces/user-claims.interface';
import { toRpcException } from 'src/common/helpers/exceptions';
import {
  AddMemberRequestDTO,
  CreateTeamRequestDto,
  UpdateMemberRequestDto,
  UpdateTeamRequestDto,
} from '../dto/team.dto';
import {
  AddMemberDto,
  UpdateMemberDto,
  CreateTeamDto,
  UpdateTeamDto,
} from 'src/common/interfaces/user.interface';
import { Prisma } from '@prisma/user-client';

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
      };

      return await this.teamService.createTeam(dto, _userClaims.id);
    } catch (error) {
      throw toRpcException(error);
    }
  }

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
        `Updating team - Requested by: ${data.userClaims.email} (${data.userClaims.id})`,
      );
      const { userClaims: _userClaims, teamId, ...updateData } = data;

      const dto: UpdateTeamDto = {
        name: updateData.name,
        slug: updateData.slug,
        isActive: updateData.isActive,
        billingEmail: updateData.billingEmail,
        billingAddress:
          updateData.billingAddress as unknown as Prisma.JsonValue,
      };

      return await this.teamService.updateTeam(teamId, dto, _userClaims.id);
    } catch (error) {
      throw toRpcException(error);
    }
  }

  @MessagePattern(USER_SERVICE_PATTERNS.DELETE_TEAM)
  async deleteTeam(
    @Payload()
    data: { teamId: string } & userClaimsInterface.MessageWithUserClaims,
  ) {
    try {
      this.logger.log(
        `Deleting team ${data.teamId} - Requested by: ${data.userClaims.email} (${data.userClaims.id})`,
      );
      return await this.teamService.removeTeam(data.teamId, data.userClaims.id);
    } catch (error) {
      throw toRpcException(error);
    }
  }

  @MessagePattern(USER_SERVICE_PATTERNS.GET_TEAM)
  async getTeam(
    @Payload() data: { id: string } & userClaimsInterface.MessageWithUserClaims,
  ) {
    try {
      this.logger.log(
        `Getting user ${data.id} - Requested by: ${data.userClaims.email} (${data.userClaims.id})`,
      );
      return await this.teamService.findOne(data.id);
    } catch (error) {
      throw toRpcException(error);
    }
  }

  @MessagePattern(USER_SERVICE_PATTERNS.GET_TEAMS)
  async getTeams(@Payload() data: userClaimsInterface.MessageWithUserClaims) {
    try {
      this.logger.log(
        `Getting teams - Requested by: ${data.userClaims.email} (${data.userClaims.id})`,
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

  @MessagePattern(USER_SERVICE_PATTERNS.ADD_TEAM_MEMBER)
  @UsePipes(new ValidationPipe({ transform: true }))
  async addTeamMember(
    @Payload()
    data: AddMemberRequestDTO &
      userClaimsInterface.MessageWithUserClaims & { teamId: string },
  ) {
    try {
      this.logger.log(
        `Adding team member - Requested by: ${data.userClaims.email} (${data.userClaims.id})`,
      );
      const { userClaims: _userClaims, teamId, ...addMemberDto } = data;
      const dto: AddMemberDto = {
        teamId: teamId,
        userId: addMemberDto.userId,
        role: addMemberDto.role,
        tokenLimit: addMemberDto.tokenLimit,
        isActive: addMemberDto.isActive,
        invitedByUserId: _userClaims.id,
      };

      return await this.teamService.addMember(dto, _userClaims.id);
    } catch (error) {
      throw toRpcException(error);
    }
  }

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
        `Updating team member - Requested by: ${data.userClaims.email} (${data.userClaims.id})`,
      );
      const { userClaims: _userClaims, teamId, userId, ...addMemberDto } = data;
      void _userClaims;
      const dto: UpdateMemberDto = {
        teamId: teamId,
        userId: userId,
        role: addMemberDto.role,
        tokenLimit: addMemberDto.tokenLimit,
        isActive: addMemberDto.isActive,
      };

      return await this.teamService.updateMember(dto, _userClaims.id);
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
        `Removing user ${data.userId} from ${data.teamId} - Requested by: ${data.userClaims.email} (${data.userClaims.id})`,
      );
      return await this.teamService.removeTeamMember(
        data.teamId,
        data.userId,
        data.userClaims.id,
      );
    } catch (error) {
      throw toRpcException(error);
    }
  }
}
