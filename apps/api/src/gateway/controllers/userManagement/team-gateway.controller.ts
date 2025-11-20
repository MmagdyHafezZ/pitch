import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Inject,
  HttpException,
  HttpStatus,
  UseGuards,
  UseInterceptors,
  ValidationPipe,
  UsePipes,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { catchError, timeout } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { USER_SERVICE_PATTERNS } from '@pitch/shared-backend/interfaces/message-patterns.interface';
import { GlobalJwtAuthGuard } from '../../guards/global-jwt-auth.guard';
import { UserClaimsInterceptor } from '../../interceptors/user-claims.interceptor';
import { UserClaims } from '../../decorators/user-claims.decorator';
import type { UserClaims as UserClaimsType } from '@pitch/shared-backend/interfaces/user-claims.interface';
import type { ServiceError } from '@pitch/shared-backend/interfaces/error.interface';
import {
  CreateTeamRequestDto,
  UpdateTeamRequestDto,
  AddMemberRequestDTO,
  UpdateMemberRequestDto,
} from '@microservices/userManagement/dto/team.dto';

@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
@UseGuards(GlobalJwtAuthGuard)
@UseInterceptors(UserClaimsInterceptor)
@ApiBearerAuth('bearer')
@ApiTags('teams')
@Controller({ path: 'teams', version: '1' })
export class TeamGatewayController {
  constructor(@Inject('USER_SERVICE') private teamService: ClientProxy) {}

  @Post()
  @ApiOperation({ summary: 'Create new team' })
  @ApiResponse({ status: 201, description: 'Team created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  createTeam(
    @Body() createTeamDto: CreateTeamRequestDto,
    @UserClaims() userClaims: UserClaimsType,
  ) {
    return this.teamService
      .send(USER_SERVICE_PATTERNS.CREATE_TEAM, {
        ...createTeamDto,
        ownerId: userClaims.id,
        createdBy: userClaims.id,
        userClaims,
      })
      .pipe(
        timeout(5000),
        catchError((err: unknown) => {
          const error = err as ServiceError;
          const message = error.message ?? 'Failed to create team';
          const status = error.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
          return throwError(() => new HttpException(message, status));
        }),
      );
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update Team' })
  @ApiResponse({ status: 200, description: 'Team updated successfully' })
  @ApiResponse({ status: 404, description: 'Team not found' })
  updateTeam(
    @Param('id') id: string,
    @Body() updateTeamDto: UpdateTeamRequestDto,
    @UserClaims() userClaims: UserClaimsType,
  ) {
    return this.teamService
      .send(USER_SERVICE_PATTERNS.UPDATE_TEAM, {
        id,
        ...updateTeamDto,
        userClaims,
      })
      .pipe(
        timeout(5000),
        catchError((err: unknown) => {
          const error = err as ServiceError;
          const message = error.message ?? 'Failed to update team';
          const status = error.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
          return throwError(() => new HttpException(message, status));
        }),
      );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete team' })
  @ApiResponse({ status: 200, description: 'Team deleted successfully' })
  @ApiResponse({ status: 404, description: 'Team not found' })
  deleteTeam(
    @Param('id') id: string,
    @UserClaims() userClaims: UserClaimsType,
  ) {
    return this.teamService
      .send(USER_SERVICE_PATTERNS.DELETE_TEAM, {
        id,
        userClaims,
      })
      .pipe(
        timeout(5000),
        catchError((err: unknown) => {
          const error = err as ServiceError;
          const message = error.message ?? 'Failed to delete team';
          const status = error.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
          return throwError(() => new HttpException(message, status));
        }),
      );
  }

  @Get()
  @ApiOperation({ summary: 'Get all teams' })
  @ApiResponse({ status: 200, description: 'Teams retrieved successfully' })
  getTeams(@UserClaims() userClaims: UserClaimsType) {
    return this.teamService
      .send(USER_SERVICE_PATTERNS.GET_TEAMS, {
        userClaims,
      })
      .pipe(
        timeout(5000),
        catchError((err: unknown) => {
          const error = err as ServiceError;
          const message = error.message ?? 'Failed to get teams';
          const status = error.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
          return throwError(() => new HttpException(message, status));
        }),
      );
  }

  @Get('user-teams')
  @ApiOperation({ summary: 'Get all teams' })
  @ApiResponse({ status: 200, description: 'Teams retrieved successfully' })
  getUserTeams(@UserClaims() userClaims: UserClaimsType) {
    return this.teamService
      .send(USER_SERVICE_PATTERNS.GET_USER_TEAMS, {
        userClaims,
      })
      .pipe(
        timeout(5000),
        catchError((err: unknown) => {
          const error = err as ServiceError;
          const message = error.message ?? 'Failed to get teams';
          const status = error.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
          return throwError(() => new HttpException(message, status));
        }),
      );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get team by ID' })
  @ApiResponse({ status: 200, description: 'Team retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Team not found' })
  getTeamById(
    @Param('id') id: string,
    @UserClaims() userClaims: UserClaimsType,
  ) {
    return this.teamService
      .send(USER_SERVICE_PATTERNS.GET_TEAM, {
        id,
        userClaims,
      })
      .pipe(
        timeout(5000),
        catchError((err: unknown) => {
          const error = err as ServiceError;
          const message = error.message ?? 'Failed to get team';
          const status = error.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
          return throwError(() => new HttpException(message, status));
        }),
      );
  }

  @Post(':teamId/members')
  @ApiOperation({ summary: 'Add a new member to a team' })
  @ApiResponse({ status: 201, description: 'Team member added' })
  @ApiResponse({ status: 403, description: 'Not authorized to add members' })
  @ApiResponse({ status: 404, description: 'Team or user not found' })
  @ApiResponse({ status: 409, description: 'Member already exists' })
  addTeamMember(
    @Param('teamId') teamId: string,
    @Body() addMemberDto: AddMemberRequestDTO,
    @UserClaims() userClaims: UserClaimsType,
  ) {
    return this.teamService
      .send(USER_SERVICE_PATTERNS.ADD_TEAM_MEMBER, {
        teamId,
        ...addMemberDto,
        userClaims,
      })
      .pipe(
        timeout(5000),
        catchError((err: unknown) => {
          const error = err as ServiceError;
          const message = error.message ?? 'Failed to add Team Member';
          const status = error.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
          return throwError(() => new HttpException(message, status));
        }),
      );
  }

  @Put(':teamId/members/:userId')
  @ApiOperation({ summary: 'Update a member in a team' })
  @ApiResponse({ status: 200, description: 'Team member updated' })
  @ApiResponse({ status: 403, description: 'Not authorized to update members' })
  @ApiResponse({ status: 404, description: 'Membership not found' })
  updateTeamMember(
    @Param('teamId') teamId: string,
    @Param('userId') userId: string,
    @Body() updateMemberDto: UpdateMemberRequestDto,
    @UserClaims() userClaims: UserClaimsType,
  ) {
    return this.teamService
      .send(USER_SERVICE_PATTERNS.ADD_TEAM_MEMBER, {
        teamId,
        userId,
        ...updateMemberDto,
        userClaims,
      })
      .pipe(
        timeout(5000),
        catchError((err: unknown) => {
          const error = err as ServiceError;
          const message = error.message ?? 'Failed to update Team Member';
          const status = error.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
          return throwError(() => new HttpException(message, status));
        }),
      );
  }

  @Delete(':teamId/members/:userId')
  @ApiOperation({ summary: 'Remove a user from a team' })
  @ApiResponse({ status: 200, description: 'User removed successfully' })
  @ApiResponse({ status: 403, description: 'Not authorized to remove members' })
  @ApiResponse({ status: 404, description: 'User not found in team' })
  removeTeamMember(
    @Param('teamId') teamId: string,
    @Param('userId') userId: string,
    @UserClaims() userClaims: UserClaimsType,
  ) {
    return this.teamService
      .send(USER_SERVICE_PATTERNS.DELETE_TEAM_MEMBER, {
        teamId,
        userId,
        userClaims,
      })
      .pipe(
        timeout(5000),
        catchError((err: unknown) => {
          const error = err as ServiceError;
          const message = error.message ?? 'Failed to delete team';
          const status = error.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
          return throwError(() => new HttpException(message, status));
        }),
      );
  }
}
