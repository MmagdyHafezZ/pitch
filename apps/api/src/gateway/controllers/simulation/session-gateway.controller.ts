import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
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
  ApiQuery,
} from '@nestjs/swagger';
import { catchError, timeout } from 'rxjs/operators';
import { lastValueFrom, throwError } from 'rxjs';
import { SIMULATION_SERVICE_PATTERNS } from '@pitch/shared-backend/interfaces/message-patterns.interface';
import { GlobalJwtAuthGuard } from '../../guards/global-jwt-auth.guard';
import { Public } from '../../../microservices/userManagement/decorators/public.decorator';
import { UserClaimsInterceptor } from '../../interceptors/user-claims.interceptor';
import { UserClaims } from '../../decorators/user-claims.decorator';
import type { UserClaims as UserClaimsType } from '@pitch/shared-backend/interfaces/user-claims.interface';
import { normalizeError } from '@pitch/shared-backend/helpers/exceptions';
import { SessionService } from '@microservices/simulation/services/session.service';
import {
  RestartSessionDto,
  SessionResponseDto,
} from '@microservices/simulation/dto/session.dto';

/**
 * Session Gateway Controller
 *
 * HTTP Gateway controller that forwards session management requests
 * to the simulation microservice via RabbitMQ.
 *
 * Base path: /v1/simulation/sessions
 */
@ApiTags('simulation-sessions')
@Controller({ path: 'simulation/sessions', version: '1' })
@UseGuards(GlobalJwtAuthGuard)
@UseInterceptors(UserClaimsInterceptor)
@ApiBearerAuth('bearer')
export class SessionGatewayController {
  constructor(
    @Inject('SIMULATION_SERVICE') private simulationService: ClientProxy,
    private readonly sessionService: SessionService,
  ) {}

  /**
   * Create a new session
   *
   * POST /v1/simulation/sessions
   */
  @Post()
  @ApiOperation({ summary: 'Create a new simulation session' })
  @ApiResponse({ status: 201, description: 'Session created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  createSession(
    @Body() createSessionDto: any,
    @UserClaims() userClaims: UserClaimsType,
  ) {
    return this.simulationService
      .send(SIMULATION_SERVICE_PATTERNS.CREATE_SESSION, {
        ...createSessionDto,
        userClaims,
      })
      .pipe(
        timeout(10000),
        catchError((err: unknown) => {
          const error = normalizeError(err);
          const message = error.message ?? 'Failed to create session';
          const status = error.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
          return throwError(() => new HttpException(message, status));
        }),
      );
  }

  /**
   * Liveness probe — no auth required
   *
   * GET /v1/simulation/sessions/health
   */
  @Get('health')
  @Public()
  @ApiOperation({ summary: 'Health check for simulation sessions service' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  health() {
    return {
      status: 'ok',
      service: 'simulation-sessions',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get a session by ID
   *
   * GET /v1/simulation/sessions/:id
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get a session by ID' })
  @ApiResponse({ status: 200, description: 'Session retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getSession(
    @Param('id') id: string,
    @UserClaims() userClaims: UserClaimsType,
  ) {
    return this.simulationService
      .send(SIMULATION_SERVICE_PATTERNS.GET_SESSION, {
        id,
        userClaims,
      })
      .pipe(
        timeout(5000),
        catchError((err: unknown) => {
          const error = normalizeError(err);
          const message = error.message ?? 'Failed to get session';
          const status = error.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
          return throwError(() => new HttpException(message, status));
        }),
      );
  }

  /**
   * Get session timeline
   *
   * GET /v1/simulation/sessions/:id/timeline
   */
  @Get(':id/timeline')
  @ApiOperation({ summary: 'Get session timeline' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Timeline retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getTimeline(
    @Param('id') id: string,
    @Query('limit') limit: string | undefined,
    @UserClaims() userClaims: UserClaimsType,
  ) {
    const numericLimit = limit ? Number(limit) : undefined;
    return this.simulationService
      .send(SIMULATION_SERVICE_PATTERNS.SESSION_TIMELINE, {
        sessionId: id,
        limit: numericLimit,
        userClaims,
      })
      .pipe(
        timeout(10000),
        catchError((err: unknown) => {
          const error = normalizeError(err);
          const message = error.message ?? 'Failed to fetch timeline';
          const status = error.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
          return throwError(() => new HttpException(message, status));
        }),
      );
  }

  /**
   * List sessions with optional filters
   *
   * GET /v1/simulation/sessions
   */
  @Get()
  @ApiOperation({ summary: 'List sessions with optional filters' })
  @ApiResponse({ status: 200, description: 'Sessions retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiQuery({ name: 'userId', required: false, type: String })
  @ApiQuery({ name: 'orgId', required: false, type: String })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: ['text', 'voice', 'video', 'phone'],
  })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'scenarioId', required: false, type: String })
  @ApiQuery({ name: 'personaId', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  listSessions(@Query() query: any, @UserClaims() userClaims: UserClaimsType) {
    return this.simulationService
      .send(SIMULATION_SERVICE_PATTERNS.LIST_SESSIONS, {
        ...query,
        userClaims,
      })
      .pipe(
        timeout(10000),
        catchError((err: unknown) => {
          const error = normalizeError(err);
          const message = error.message ?? 'Failed to list sessions';
          const status = error.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
          return throwError(() => new HttpException(message, status));
        }),
      );
  }

  /**
   * Update a session
   *
   * PUT /v1/simulation/sessions/:id
   */
  @Put(':id')
  @ApiOperation({ summary: 'Update a session' })
  @ApiResponse({ status: 200, description: 'Session updated successfully' })
  @ApiResponse({
    status: 400,
    description: 'Invalid input data or session already ended',
  })
  @ApiResponse({ status: 404, description: 'Session not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  updateSession(
    @Param('id') id: string,
    @Body() updateSessionDto: any,
    @UserClaims() userClaims: UserClaimsType,
  ) {
    return this.simulationService
      .send(SIMULATION_SERVICE_PATTERNS.UPDATE_SESSION, {
        id,
        ...updateSessionDto,
        userClaims,
      })
      .pipe(
        timeout(5000),
        catchError((err: unknown) => {
          const error = normalizeError(err);
          const message = error.message ?? 'Failed to update session';
          const status = error.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
          return throwError(() => new HttpException(message, status));
        }),
      );
  }

  /**
   * End a session
   *
   * POST /v1/simulation/sessions/:id/end
   */
  @Post(':id/end')
  @ApiOperation({ summary: 'End a session' })
  @ApiResponse({ status: 200, description: 'Session ended successfully' })
  @ApiResponse({ status: 400, description: 'Session already ended' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  endSession(
    @Param('id') id: string,
    @Body() endSessionDto: any,
    @UserClaims() userClaims: UserClaimsType,
  ) {
    return this.simulationService
      .send(SIMULATION_SERVICE_PATTERNS.END_SESSION, {
        id,
        ...endSessionDto,
        userClaims,
      })
      .pipe(
        timeout(5000),
        catchError((err: unknown) => {
          const error = normalizeError(err);
          const message = error.message ?? 'Failed to end session';
          const status = error.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
          return throwError(() => new HttpException(message, status));
        }),
      );
  }

  /**
   * Restart a session by creating a new iteration on the same session record
   *
   * POST /v1/simulation/sessions/:id/restart
   */
  @Post(':id/restart')
  @ApiOperation({ summary: 'Restart a session with a fresh iteration' })
  @ApiResponse({ status: 200, description: 'Session restarted successfully' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async restartSession(
    @Param('id') id: string,
    @Body() restartSessionDto: RestartSessionDto,
    @UserClaims() userClaims: UserClaimsType,
  ): Promise<SessionResponseDto> {
    try {
      return await lastValueFrom(
        this.simulationService
          .send<SessionResponseDto>(
            SIMULATION_SERVICE_PATTERNS.RESTART_SESSION,
            {
              id,
              ...restartSessionDto,
              userClaims,
            },
          )
          .pipe(timeout(5000)),
      );
    } catch (err: unknown) {
      const error = normalizeError(err);

      if (this.isMissingHandlerError(error.message)) {
        try {
          return await this.sessionService.restart(
            id,
            restartSessionDto,
            userClaims?.id,
          );
        } catch (fallbackErr: unknown) {
          const normalizedFallback = normalizeError(fallbackErr);
          const message =
            normalizedFallback.message ?? 'Failed to restart session';
          const status =
            normalizedFallback.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
          throw new HttpException(message, status);
        }
      }

      const message = error.message ?? 'Failed to restart session';
      const status = error.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
      throw new HttpException(message, status);
    }
  }

  private isMissingHandlerError(message: string | undefined): boolean {
    return (
      typeof message === 'string' &&
      message.includes(
        'There is no matching message handler defined in the remote service',
      )
    );
  }

  /**
   * Delete a session
   *
   * DELETE /v1/simulation/sessions/:id
   */
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a session' })
  @ApiResponse({ status: 200, description: 'Session deleted successfully' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  deleteSession(
    @Param('id') id: string,
    @UserClaims() userClaims: UserClaimsType,
  ) {
    return this.simulationService
      .send(SIMULATION_SERVICE_PATTERNS.DELETE_SESSION, {
        id,
        userClaims,
      })
      .pipe(
        timeout(5000),
        catchError((err: unknown) => {
          const error = normalizeError(err);
          const message = error.message ?? 'Failed to delete session';
          const status = error.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
          return throwError(() => new HttpException(message, status));
        }),
      );
  }

  /**
   * Add members to a session
   *
   * POST /v1/simulation/sessions/:id/members
   */
  @Post(':id/members')
  @ApiOperation({ summary: 'Add members to a session' })
  @ApiResponse({ status: 201, description: 'Members added successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  addMembers(
    @Param('id') id: string,
    @Body() payload: any,
    @UserClaims() userClaims: UserClaimsType,
  ) {
    return this.simulationService
      .send(SIMULATION_SERVICE_PATTERNS.ADD_SESSION_MEMBERS, {
        sessionId: id,
        ...payload,
        userClaims,
      })
      .pipe(
        timeout(5000),
        catchError((err: unknown) => {
          const error = normalizeError(err);
          const message = error.message ?? 'Failed to add session members';
          const status = error.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
          return throwError(() => new HttpException(message, status));
        }),
      );
  }

  /**
   * List members of a session
   *
   * GET /v1/simulation/sessions/:id/members
   */
  @Get(':id/members')
  @ApiOperation({ summary: 'List session members' })
  @ApiResponse({ status: 200, description: 'Members retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  listMembers(
    @Param('id') id: string,
    @UserClaims() userClaims: UserClaimsType,
  ) {
    return this.simulationService
      .send(SIMULATION_SERVICE_PATTERNS.LIST_SESSION_MEMBERS, {
        sessionId: id,
        userClaims,
      })
      .pipe(
        timeout(5000),
        catchError((err: unknown) => {
          const error = normalizeError(err);
          const message = error.message ?? 'Failed to list session members';
          const status = error.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
          return throwError(() => new HttpException(message, status));
        }),
      );
  }

  /**
   * Remove a member from a session
   *
   * DELETE /v1/simulation/sessions/:id/members/:userId
   */
  @Delete(':id/members/:userId')
  @ApiOperation({ summary: 'Remove a member from a session' })
  @ApiResponse({ status: 200, description: 'Member removed successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  removeMember(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @UserClaims() userClaims: UserClaimsType,
  ) {
    return this.simulationService
      .send(SIMULATION_SERVICE_PATTERNS.REMOVE_SESSION_MEMBER, {
        sessionId: id,
        userId,
        userClaims,
      })
      .pipe(
        timeout(5000),
        catchError((err: unknown) => {
          const error = normalizeError(err);
          const message = error.message ?? 'Failed to remove session member';
          const status = error.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
          return throwError(() => new HttpException(message, status));
        }),
      );
  }
}
