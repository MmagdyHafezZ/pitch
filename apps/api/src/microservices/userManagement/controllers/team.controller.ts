import { Controller, ValidationPipe, UsePipes, Logger } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { TeamService } from '../services/team.service';
import { TEAM_SERVICE_PATTERNS } from '../../../common/interfaces/message-patterns.interface';
import * as userInterface from '../../../common/interfaces/user.interface';
import * as userClaimsInterface from '../../../common/interfaces/user-claims.interface';
import { toRpcException } from 'src/common/helpers/exceptions';

@Controller()
export class TeamController {
  private readonly logger = new Logger(TeamController.name);

  constructor(private readonly teamService: TeamService) {}

  @MessagePattern(TEAM_SERVICE_PATTERNS.GET_TEAMS)
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

  @MessagePattern(TEAM_SERVICE_PATTERNS.GET_TEAM)
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

  @MessagePattern(TEAM_SERVICE_PATTERNS.CREATE_TEAM)
  @UsePipes(new ValidationPipe({ transform: true }))
  async createTeam(
    @Payload()
    data: userInterface.CreateTeamDto &
      userClaimsInterface.MessageWithUserClaims,
  ) {
    try {
      this.logger.log(
        `Creating team - Requested by: ${data.userClaims.email} (${data.userClaims.id})`,
      );
      const { userClaims: _userClaims, ...createTeamDto } = data;
      void _userClaims;
      return await this.teamService.create(createTeamDto);
    } catch (error) {
      throw toRpcException(error);
    }
  }

  @MessagePattern(TEAM_SERVICE_PATTERNS.UPDATE_TEAM)
  @UsePipes(
    new ValidationPipe({ transform: true, skipMissingProperties: true }),
  )
  async updateTeam(
    @Payload()
    data: { id: string } & userInterface.UpdateTeamDto &
      userClaimsInterface.MessageWithUserClaims,
  ) {
    try {
      this.logger.log(
        `Updating team ${data.id} - Requested by: ${data.userClaims.email} (${data.userClaims.id})`,
      );
      const { userClaims: _userClaims, id, ...updateData } = data;
      void _userClaims;
      return await this.teamService.update(id, updateData);
    } catch (error) {
      throw toRpcException(error);
    }
  }

  @MessagePattern(TEAM_SERVICE_PATTERNS.DELETE_TEAM)
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
}
