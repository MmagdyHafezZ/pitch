import {
  Controller,
  Get,
  Put,
  Delete,
  Post,
  Body,
  Param,
  Query,
  Inject,
  HttpException,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { catchError, timeout } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { CheckSystemAdmin } from '../../guards/check-system-admin.guard';
import { USER_SERVICE_PATTERNS } from '@pitch/shared-backend/interfaces/message-patterns.interface';
import { normalizeError } from '@pitch/shared-backend/helpers/exceptions';

@Controller({ path: 'admin/teams', version: '1' })
@UseGuards(CheckSystemAdmin)
export class AdminTeamsController {
  constructor(
    @Inject('USER_SERVICE') private readonly userService: ClientProxy,
  ) {}

  @Get()
  listTeams(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('search') search?: string,
  ) {
    return this.userService
      .send(USER_SERVICE_PATTERNS.GET_TEAMS, {
        limit: limit ? parseInt(limit, 10) : 50,
        offset: offset ? parseInt(offset, 10) : 0,
        search,
        isAdmin: true,
      })
      .pipe(
        timeout(10000),
        catchError((err: unknown) => {
          const error = normalizeError(err);
          return throwError(
            () =>
              new HttpException(
                error.message ?? 'Failed to list teams',
                error.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
              ),
          );
        }),
      );
  }

  @Get(':id')
  getTeam(@Param('id') id: string) {
    return this.userService
      .send(USER_SERVICE_PATTERNS.GET_TEAM, { teamId: id, isAdmin: true })
      .pipe(
        timeout(5000),
        catchError((err: unknown) => {
          const error = normalizeError(err);
          return throwError(
            () =>
              new HttpException(
                error.message ?? 'Failed to get team',
                error.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
              ),
          );
        }),
      );
  }

  @Put(':id')
  updateTeam(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.userService
      .send(USER_SERVICE_PATTERNS.UPDATE_TEAM, {
        teamId: id,
        ...body,
        isAdmin: true,
      })
      .pipe(
        timeout(5000),
        catchError((err: unknown) => {
          const error = normalizeError(err);
          return throwError(
            () =>
              new HttpException(
                error.message ?? 'Failed to update team',
                error.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
              ),
          );
        }),
      );
  }

  @Delete(':id')
  deleteTeam(@Param('id') id: string) {
    return this.userService
      .send(USER_SERVICE_PATTERNS.DELETE_TEAM, { teamId: id, isAdmin: true })
      .pipe(
        timeout(5000),
        catchError((err: unknown) => {
          const error = normalizeError(err);
          return throwError(
            () =>
              new HttpException(
                error.message ?? 'Failed to delete team',
                error.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
              ),
          );
        }),
      );
  }

  @Get(':id/members')
  getTeamMembers(@Param('id') id: string) {
    return this.userService
      .send(USER_SERVICE_PATTERNS.GET_TEAM, {
        teamId: id,
        isAdmin: true,
        includeMembers: true,
      })
      .pipe(
        timeout(5000),
        catchError((err: unknown) => {
          const error = normalizeError(err);
          return throwError(
            () =>
              new HttpException(
                error.message ?? 'Failed to get team members',
                error.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
              ),
          );
        }),
      );
  }

  @Post(':id/transfer-owner')
  transferOwner(@Param('id') id: string, @Body() body: { newOwnerId: string }) {
    return this.userService
      .send(USER_SERVICE_PATTERNS.UPDATE_TEAM, {
        teamId: id,
        ownerId: body.newOwnerId,
        isAdmin: true,
      })
      .pipe(
        timeout(5000),
        catchError((err: unknown) => {
          const error = normalizeError(err);
          return throwError(
            () =>
              new HttpException(
                error.message ?? 'Failed to transfer team owner',
                error.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
              ),
          );
        }),
      );
  }
}
