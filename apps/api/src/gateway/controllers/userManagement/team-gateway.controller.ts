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
import { TEAM_SERVICE_PATTERNS } from '../../../common/interfaces/message-patterns.interface';
import type {
  CreateTeamDto,
  UpdateTeamDto,
} from '../../../common/interfaces/user.interface';
import { GlobalJwtAuthGuard } from '../../guards/global-jwt-auth.guard';
import { UserClaimsInterceptor } from '../../interceptors/user-claims.interceptor';
import { UserClaims } from '../../decorators/user-claims.decorator';
import type { UserClaims as UserClaimsType } from '../../../common/interfaces/user-claims.interface';
import type { ServiceError } from '../../../common/interfaces/error.interface';

@ApiTags('teams')
@Controller({ path: 'teams', version: '1' })
@UseGuards(GlobalJwtAuthGuard)
@UseInterceptors(UserClaimsInterceptor)
@ApiBearerAuth('bearer')
export class TeamGatewayController {
  constructor(@Inject('TEAM_SERVICE') private teamService: ClientProxy) {}

  @Get()
  @ApiOperation({ summary: 'Get all teams' })
  @ApiResponse({ status: 200, description: 'Teams retrieved successfully' })
  getTeams(@UserClaims() userClaims: UserClaimsType) {
    return this.teamService
      .send(TEAM_SERVICE_PATTERNS.GET_TEAMS, {
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
      .send(TEAM_SERVICE_PATTERNS.GET_TEAM, {
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

  @Post()
  @ApiOperation({ summary: 'Create new team' })
  @ApiResponse({ status: 201, description: 'Team created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  createTeam(
    @Body() CreateTeamDto: CreateTeamDto,
    @UserClaims() userClaims: UserClaimsType,
  ) {
    return this.teamService
      .send(TEAM_SERVICE_PATTERNS.CREATE_TEAM, {
        ...CreateTeamDto,
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
  @ApiOperation({ summary: 'Update team' })
  @ApiResponse({ status: 200, description: 'Team updated successfully' })
  @ApiResponse({ status: 404, description: 'Team not found' })
  updateTeam(
    @Param('id') id: string,
    @Body() UpdateTeamDto: UpdateTeamDto,
    @UserClaims() userClaims: UserClaimsType,
  ) {
    return this.teamService
      .send(TEAM_SERVICE_PATTERNS.UPDATE_TEAM, {
        id,
        ...UpdateTeamDto,
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
      .send(TEAM_SERVICE_PATTERNS.DELETE_TEAM, {
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
}
