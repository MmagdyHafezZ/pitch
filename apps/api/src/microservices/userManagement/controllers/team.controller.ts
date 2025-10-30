import { Controller, Logger, UsePipes, ValidationPipe } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { TeamService } from '../services/team.service';
import { USER_SERVICE_PATTERNS } from '../../../common/interfaces/message-patterns.interface';
import * as userClaimsInterface from '../../../common/interfaces/user-claims.interface';
import { toRpcException } from 'src/common/helpers/exceptions';
import { CreateTeamRequestDto, UpdateTeamRequestDto } from '../dto/team.dto';
import {
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
      void _userClaims;

      const dto: CreateTeamDto = {
        name: createTeamDto.name,
        slug: createTeamDto.slug,
        isActive: true,
        billingEmail: createTeamDto.billingEmail,
        billingAddress:
          createTeamDto.billingAddress as unknown as Prisma.JsonValue,
      };

      return await this.teamService.create(dto);
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
    data: { id: string } & UpdateTeamRequestDto &
      userClaimsInterface.MessageWithUserClaims,
  ) {
    try {
      this.logger.log(
        `Updating team - Requested by: ${data.userClaims.email} (${data.userClaims.id})`,
      );
      const { userClaims: _userClaims, id, ...updateData } = data;
      void _userClaims;

      const dto: UpdateTeamDto = {
        name: updateData.name,
        slug: updateData.slug,
        isActive: updateData.isActive,
        billingEmail: updateData.billingEmail,
        billingAddress:
          updateData.billingAddress as unknown as Prisma.JsonValue,
      };

      return await this.teamService.update(id, dto);
    } catch (error) {
      throw toRpcException(error);
    }
  }

  @MessagePattern(USER_SERVICE_PATTERNS.DELETE_TEAM)
  async deleteTeam(
    @Payload() data: { id: string } & userClaimsInterface.MessageWithUserClaims,
  ) {
    try {
      this.logger.log(
        `Deleting team ${data.id} - Requested by: ${data.userClaims.email} (${data.userClaims.id})`,
      );
      return await this.teamService.remove(data.id);
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

  @MessagePattern(USER_SERVICE_PATTERNS.GET_TEAM)
  async getUser(
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
}
