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
  Request,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { catchError, timeout } from 'rxjs/operators';
import { throwError, firstValueFrom } from 'rxjs';
import { CheckSystemAdmin } from '../../guards/check-system-admin.guard';
import {
  USER_SERVICE_PATTERNS,
  SIMULATION_SERVICE_PATTERNS,
} from '@pitch/shared-backend/interfaces/message-patterns.interface';
import { normalizeError } from '@pitch/shared-backend/helpers/exceptions';
import { AdminImpersonationService } from '../../services/admin/admin-impersonation.service';

@Controller({ path: 'admin/users', version: '1' })
@UseGuards(CheckSystemAdmin)
export class AdminUsersController {
  constructor(
    @Inject('USER_SERVICE') private readonly userService: ClientProxy,
    @Inject('SIMULATION_SERVICE')
    private readonly simulationService: ClientProxy,
    private readonly impersonationService: AdminImpersonationService,
  ) {}

  @Get()
  listUsers(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('search') search?: string,
  ) {
    return this.userService
      .send(USER_SERVICE_PATTERNS.GET_USERS, {
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
                error.message ?? 'Failed to list users',
                error.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
              ),
          );
        }),
      );
  }

  @Get(':id')
  getUser(@Param('id') id: string) {
    return this.userService
      .send(USER_SERVICE_PATTERNS.GET_USER, { userId: id, isAdmin: true })
      .pipe(
        timeout(5000),
        catchError((err: unknown) => {
          const error = normalizeError(err);
          return throwError(
            () =>
              new HttpException(
                error.message ?? 'Failed to get user',
                error.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
              ),
          );
        }),
      );
  }

  @Put(':id')
  updateUser(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.userService
      .send(USER_SERVICE_PATTERNS.UPDATE_USER, {
        userId: id,
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
                error.message ?? 'Failed to update user',
                error.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
              ),
          );
        }),
      );
  }

  @Delete(':id')
  deleteUser(@Param('id') id: string) {
    return this.userService
      .send(USER_SERVICE_PATTERNS.DELETE_USER, { userId: id, isAdmin: true })
      .pipe(
        timeout(5000),
        catchError((err: unknown) => {
          const error = normalizeError(err);
          return throwError(
            () =>
              new HttpException(
                error.message ?? 'Failed to delete user',
                error.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
              ),
          );
        }),
      );
  }

  @Get(':id/sessions')
  getUserSessions(
    @Param('id') id: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.simulationService
      .send(SIMULATION_SERVICE_PATTERNS.LIST_SESSIONS, {
        userId: id,
        limit: limit ? parseInt(limit, 10) : 50,
        offset: offset ? parseInt(offset, 10) : 0,
      })
      .pipe(
        timeout(10000),
        catchError((err: unknown) => {
          const error = normalizeError(err);
          return throwError(
            () =>
              new HttpException(
                error.message ?? 'Failed to get user sessions',
                error.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
              ),
          );
        }),
      );
  }

  @Post(':id/impersonate')
  async impersonateUser(
    @Param('id') id: string,
    @Request() req: { user?: { email?: string } },
  ) {
    const adminEmail = req.user?.email ?? 'unknown';

    // Fetch the target user first
    const user = await firstValueFrom(
      this.userService
        .send<{
          id: string;
          email: string;
          name: string;
        }>(USER_SERVICE_PATTERNS.GET_USER, { userId: id, isAdmin: true })
        .pipe(
          timeout(5000),
          catchError((err: unknown) => {
            const error = normalizeError(err);
            return throwError(
              () =>
                new HttpException(
                  error.message ?? 'User not found',
                  error.status ?? HttpStatus.NOT_FOUND,
                ),
            );
          }),
        ),
    );

    return this.impersonationService.impersonate(
      {
        id: (user as { id: string }).id,
        email: (user as { email: string }).email,
        name: (user as { name?: string }).name,
      },
      adminEmail,
    );
  }
}
