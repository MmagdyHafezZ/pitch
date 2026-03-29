import {
  Controller,
  Get,
  Post,
  Delete,
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
import { SIMULATION_SERVICE_PATTERNS } from '@pitch/shared-backend/interfaces/message-patterns.interface';
import { normalizeError } from '@pitch/shared-backend/helpers/exceptions';

@Controller({ path: 'admin/sessions', version: '1' })
@UseGuards(CheckSystemAdmin)
export class AdminSessionsController {
  constructor(
    @Inject('SIMULATION_SERVICE')
    private readonly simulationService: ClientProxy,
  ) {}

  @Get()
  listSessions(
    @Query('userId') userId?: string,
    @Query('orgId') orgId?: string,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.simulationService
      .send(SIMULATION_SERVICE_PATTERNS.LIST_SESSIONS, {
        userId,
        orgId,
        status,
        type,
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
                error.message ?? 'Failed to list sessions',
                error.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
              ),
          );
        }),
      );
  }

  @Get(':id')
  getSession(@Param('id') id: string) {
    return this.simulationService
      .send(SIMULATION_SERVICE_PATTERNS.GET_SESSION, { id })
      .pipe(
        timeout(5000),
        catchError((err: unknown) => {
          const error = normalizeError(err);
          return throwError(
            () =>
              new HttpException(
                error.message ?? 'Failed to get session',
                error.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
              ),
          );
        }),
      );
  }

  @Get(':id/events')
  getSessionEvents(
    @Param('id') id: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.simulationService
      .send(SIMULATION_SERVICE_PATTERNS.ADMIN_GET_SESSION_EVENTS, {
        iterationId: id,
        limit: limit ? parseInt(limit, 10) : 100,
        skip: offset ? parseInt(offset, 10) : 0,
      })
      .pipe(
        timeout(10000),
        catchError((err: unknown) => {
          const error = normalizeError(err);
          return throwError(
            () =>
              new HttpException(
                error.message ?? 'Failed to get session events',
                error.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
              ),
          );
        }),
      );
  }

  @Get(':id/transcript')
  getSessionTranscript(@Param('id') id: string) {
    return this.simulationService
      .send(SIMULATION_SERVICE_PATTERNS.ADMIN_GET_SESSION_TRANSCRIPT, {
        iterationId: id,
      })
      .pipe(
        timeout(10000),
        catchError((err: unknown) => {
          const error = normalizeError(err);
          return throwError(
            () =>
              new HttpException(
                error.message ?? 'Transcript not found',
                error.status ?? HttpStatus.NOT_FOUND,
              ),
          );
        }),
      );
  }

  @Get(':id/llm-calls')
  getSessionLlmCalls(
    @Param('id') id: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.simulationService
      .send(SIMULATION_SERVICE_PATTERNS.ADMIN_GET_SESSION_LLM_CALLS, {
        iterationId: id,
        limit: limit ? parseInt(limit, 10) : 50,
        skip: offset ? parseInt(offset, 10) : 0,
      })
      .pipe(
        timeout(10000),
        catchError((err: unknown) => {
          const error = normalizeError(err);
          return throwError(
            () =>
              new HttpException(
                error.message ?? 'Failed to get LLM calls',
                error.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
              ),
          );
        }),
      );
  }

  @Post(':id/force-end')
  forceEndSession(@Param('id') id: string) {
    return this.simulationService
      .send(SIMULATION_SERVICE_PATTERNS.END_SESSION, {
        sessionId: id,
        reason: 'force-ended by admin',
      })
      .pipe(
        timeout(5000),
        catchError((err: unknown) => {
          const error = normalizeError(err);
          return throwError(
            () =>
              new HttpException(
                error.message ?? 'Failed to force-end session',
                error.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
              ),
          );
        }),
      );
  }

  @Post(':id/recompute')
  recomputeAssessment(@Param('id') id: string) {
    return this.simulationService
      .send(SIMULATION_SERVICE_PATTERNS.ASSESSMENT_RUN, {
        sessionId: id,
        mode: 'final',
        forceRecalculate: true,
        requestedBy: 'admin',
      })
      .pipe(
        timeout(30000),
        catchError((err: unknown) => {
          const error = normalizeError(err);
          return throwError(
            () =>
              new HttpException(
                error.message ?? 'Failed to recompute assessment',
                error.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
              ),
          );
        }),
      );
  }

  @Delete(':id')
  deleteSession(@Param('id') id: string) {
    return this.simulationService
      .send(SIMULATION_SERVICE_PATTERNS.DELETE_SESSION, { id, isAdmin: true })
      .pipe(
        timeout(5000),
        catchError((err: unknown) => {
          const error = normalizeError(err);
          return throwError(
            () =>
              new HttpException(
                error.message ?? 'Failed to delete session',
                error.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
              ),
          );
        }),
      );
  }
}
