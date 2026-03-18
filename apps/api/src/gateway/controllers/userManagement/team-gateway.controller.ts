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
import { normalizeError } from '@pitch/shared-backend/helpers/exceptions';
import {
  CreateTeamRequestDto,
  InviteMemberRequestDTO,
  SendTeamSignupInviteRequestDto,
  UpdateTeamRequestDto,
  AddMemberRequestDTO,
  UpdateMemberRequestDto,
} from '@microservices/userManagement/team/dto/team.dto';

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
          const error = normalizeError(err);
          const message = error.message ?? 'Failed to create team';
          const status = error.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
          return throwError(() => new HttpException(message, status));
        }),
      );
  }

  @Put(':teamId')
  @ApiOperation({ summary: 'Update Team' })
  @ApiResponse({ status: 200, description: 'Team updated successfully' })
  @ApiResponse({ status: 404, description: 'Team not found' })
  updateTeam(
    @Param('teamId') teamId: string,
    @Body() updateTeamDto: UpdateTeamRequestDto,
    @UserClaims() userClaims: UserClaimsType,
  ) {
    return this.teamService
      .send(USER_SERVICE_PATTERNS.UPDATE_TEAM, {
        teamId: teamId,
        ...updateTeamDto,
        userClaims,
      })
      .pipe(
        timeout(5000),
        catchError((err: unknown) => {
          const error = normalizeError(err);
          const message = error.message ?? 'Failed to update team';
          const status = error.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
          return throwError(() => new HttpException(message, status));
        }),
      );
  }

  @Delete(':teamId')
  @ApiOperation({ summary: 'Delete team' })
  @ApiResponse({ status: 200, description: 'Team deleted successfully' })
  @ApiResponse({ status: 404, description: 'Team not found' })
  deleteTeam(
    @Param('teamId') teamId: string,
    @UserClaims() userClaims: UserClaimsType,
  ) {
    return this.teamService
      .send(USER_SERVICE_PATTERNS.DELETE_TEAM, {
        teamId: teamId,
        userClaims,
      })
      .pipe(
        timeout(5000),
        catchError((err: unknown) => {
          const error = normalizeError(err);
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
          const error = normalizeError(err);
          const message = error.message ?? 'Failed to get teams';
          const status = error.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
          return throwError(() => new HttpException(message, status));
        }),
      );
  }

  @Get('user-teams')
  @ApiOperation({ summary: 'Get all teams that a user is a part of' })
  @ApiResponse({ status: 200, description: 'Teams retrieved successfully' })
  getUserTeams(@UserClaims() userClaims: UserClaimsType) {
    return this.teamService
      .send(USER_SERVICE_PATTERNS.GET_USER_TEAMS, {
        userClaims,
      })
      .pipe(
        timeout(5000),
        catchError((err: unknown) => {
          const error = normalizeError(err);
          const message = error.message ?? 'Failed to get teams';
          const status = error.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
          return throwError(() => new HttpException(message, status));
        }),
      );
  }

  @Get(':teamId')
  @ApiOperation({ summary: 'Get team by ID' })
  @ApiResponse({ status: 200, description: 'Team retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Team not found' })
  getTeamById(
    @Param('teamId') teamId: string,
    @UserClaims() userClaims: UserClaimsType,
  ) {
    return this.teamService
      .send(USER_SERVICE_PATTERNS.GET_TEAM, {
        teamId: teamId,
        userClaims,
      })
      .pipe(
        timeout(5000),
        catchError((err: unknown) => {
          const error = normalizeError(err);
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
        teamId: teamId,
        ...addMemberDto,
        userClaims,
      })
      .pipe(
        timeout(5000),
        catchError((err: unknown) => {
          const error = normalizeError(err);
          const message = error.message ?? 'Failed to add Team Member';
          const status = error.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
          return throwError(() => new HttpException(message, status));
        }),
      );
  }

  @Post(':teamId/invitations')
  @ApiOperation({ summary: 'Invite a user to a team (pending until accepted)' })
  @ApiResponse({ status: 201, description: 'Team invitation created' })
  @ApiResponse({ status: 403, description: 'Not authorized to invite members' })
  inviteTeamMember(
    @Param('teamId') teamId: string,
    @Body() inviteDto: InviteMemberRequestDTO,
    @UserClaims() userClaims: UserClaimsType,
  ) {
    return this.teamService
      .send(USER_SERVICE_PATTERNS.INVITE_TEAM_MEMBER, {
        teamId,
        ...inviteDto,
        userClaims,
      })
      .pipe(
        timeout(5000),
        catchError((err: unknown) => {
          const error = normalizeError(err);
          const message = error.message ?? 'Failed to invite team member';
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
        teamId: teamId,
        userId: userId,
        ...updateMemberDto,
        userClaims,
      })
      .pipe(
        timeout(5000),
        catchError((err: unknown) => {
          const error = normalizeError(err);
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
        teamId: teamId,
        userId: userId,
        userClaims,
      })
      .pipe(
        timeout(5000),
        catchError((err: unknown) => {
          const error = normalizeError(err);
          const message = error.message ?? 'Failed to remove member from team';
          const status = error.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
          return throwError(() => new HttpException(message, status));
        }),
      );
  }

  @Post(':teamId/invitations/signup')
  @ApiOperation({ summary: 'Send signup invitation email for a team' })
  @ApiResponse({ status: 200, description: 'Signup invitation email sent' })
  @ApiResponse({ status: 403, description: 'Not authorized to invite users' })
  sendTeamSignupInvite(
    @Param('teamId') teamId: string,
    @Body() dto: SendTeamSignupInviteRequestDto,
    @UserClaims() userClaims: UserClaimsType,
  ) {
    return this.teamService
      .send(USER_SERVICE_PATTERNS.SEND_TEAM_SIGNUP_INVITE, {
        teamId,
        ...dto,
        userClaims,
      })
      .pipe(
        timeout(5000),
        catchError((err: unknown) => {
          const error = normalizeError(err);
          const message = error.message ?? 'Failed to send signup invite';
          const status = error.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
          return throwError(() => new HttpException(message, status));
        }),
      );
  }

  @Post(':teamId/invitations/accept')
  @ApiOperation({ summary: 'Accept a pending team invitation' })
  @ApiResponse({ status: 200, description: 'Team invitation accepted' })
  acceptTeamInvite(
    @Param('teamId') teamId: string,
    @UserClaims() userClaims: UserClaimsType,
  ) {
    return this.teamService
      .send(USER_SERVICE_PATTERNS.ACCEPT_TEAM_INVITE, {
        teamId,
        userClaims,
      })
      .pipe(
        timeout(5000),
        catchError((err: unknown) => {
          const error = normalizeError(err);
          const message = error.message ?? 'Failed to accept team invitation';
          const status = error.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
          return throwError(() => new HttpException(message, status));
        }),
      );
  }

  @Post(':teamId/invitations/claim')
  @ApiOperation({
    summary: 'Claim a pending email signup invite for the authenticated user',
  })
  @ApiResponse({ status: 200, description: 'Team signup invite claimed' })
  claimTeamSignupInvite(
    @Param('teamId') teamId: string,
    @UserClaims() userClaims: UserClaimsType,
  ) {
    return this.teamService
      .send(USER_SERVICE_PATTERNS.CLAIM_TEAM_SIGNUP_INVITE, {
        teamId,
        userClaims,
      })
      .pipe(
        timeout(5000),
        catchError((err: unknown) => {
          const error = normalizeError(err);
          const message = error.message ?? 'Failed to claim signup invite';
          const status = error.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
          return throwError(() => new HttpException(message, status));
        }),
      );
  }
}
