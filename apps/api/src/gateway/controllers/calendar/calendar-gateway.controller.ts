import {
  Controller,
  Get,
  Post,
  Delete,
  Query,
  Param,
  Body,
  Inject,
  HttpException,
  HttpStatus,
  Logger,
  HttpCode,
  VERSION_NEUTRAL,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { ClientProxy } from '@nestjs/microservices';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { catchError, timeout } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { Public } from '../../../microservices/userManagement/decorators/public.decorator';
import { CurrentUser } from '../../../microservices/userManagement/decorators/current-user.decorator';
import type { ServiceError } from '@pitch/shared-backend/interfaces/error.interface';

const CRM_SERVICE_PATTERNS = {
  GOOGLE_CALENDAR_CONNECT: 'calendar.google.connect',
  GOOGLE_CALENDAR_CALLBACK: 'calendar.google.callback',
  GOOGLE_CALENDAR_STATUS: 'calendar.google.status',
  GOOGLE_CALENDAR_DISCONNECT: 'calendar.google.disconnect',
  GOOGLE_CALENDAR_GET_EVENTS: 'calendar.google.getEvents',

  MICROSOFT_CALENDAR_CONNECT: 'calendar.microsoft.connect',
  MICROSOFT_CALENDAR_CALLBACK: 'calendar.microsoft.callback',
  MICROSOFT_CALENDAR_STATUS: 'calendar.microsoft.status',
  MICROSOFT_CALENDAR_DISCONNECT: 'calendar.microsoft.disconnect',
  MICROSOFT_CALENDAR_GET_EVENTS: 'calendar.microsoft.getEvents',

  CALENDAR_GET_UPCOMING: 'calendar.getUpcoming',
} as const;

const SIMULATION_SERVICE_PATTERNS = {
  CALENDAR_SESSION_SUGGESTIONS_LIST: 'simulation.calendar.suggestions.list',
  CALENDAR_SESSION_SUGGESTIONS_ACCEPT: 'simulation.calendar.suggestions.accept',
  CALENDAR_SESSION_SUGGESTIONS_DISMISS:
    'simulation.calendar.suggestions.dismiss',
} as const;

@ApiTags('Calendar Integration')
@Controller({ path: 'calendar', version: VERSION_NEUTRAL })
export class CalendarGatewayController {
  private readonly logger = new Logger(CalendarGatewayController.name);

  constructor(
    @Inject('CRM_SERVICE') private readonly crmService: ClientProxy,
    @Inject('SIMULATION_SERVICE')
    private readonly simulationService: ClientProxy,
  ) {}

  @Get('google/connect')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Get Google Calendar OAuth connect URL' })
  @ApiResponse({ status: 200, description: 'OAuth URL generated' })
  getGoogleConnectUrl(@CurrentUser('id') userId: string) {
    this.logger.log(`Google Calendar connect for user ${userId}`);
    return this.crmService
      .send(CRM_SERVICE_PATTERNS.GOOGLE_CALENDAR_CONNECT, { userId })
      .pipe(
        timeout(10000),
        catchError((err: unknown) => {
          const error = err as ServiceError;
          this.logger.error(
            `Google connect failed for user ${userId}`,
            error.stack ?? JSON.stringify(err),
          );
          return throwError(
            () =>
              new HttpException(
                error.message ?? 'Failed to get Google Calendar connect URL',
                error.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
              ),
          );
        }),
      );
  }

  @Get('google/callback')
  @Public()
  @ApiOperation({ summary: 'Handle Google Calendar OAuth callback' })
  @ApiQuery({ name: 'code', required: true })
  @ApiQuery({ name: 'state', required: true })
  async handleGoogleCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Res() res: Response,
  ) {
    this.logger.log(`Google Calendar callback for state ${state}`);

    if (error) {
      return res.redirect(
        `/studio/calendar?error=google_${encodeURIComponent(error)}`,
      );
    }

    if (!code || !state) {
      return res.redirect('/studio/calendar?error=missing_params');
    }

    try {
      await this.crmService
        .send(CRM_SERVICE_PATTERNS.GOOGLE_CALENDAR_CALLBACK, { code, state })
        .pipe(timeout(15000))
        .toPromise();

      return res.redirect('/studio/calendar?connected=google');
    } catch {
      return res.redirect('/studio/calendar?error=google_callback_failed');
    }
  }

  @Get('google/status')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Get Google Calendar connection status' })
  getGoogleStatus(@CurrentUser('id') userId: string) {
    return this.crmService
      .send(CRM_SERVICE_PATTERNS.GOOGLE_CALENDAR_STATUS, { userId })
      .pipe(
        timeout(10000),
        catchError((err: unknown) => {
          const error = err as ServiceError;
          return throwError(
            () =>
              new HttpException(
                error.message ?? 'Failed to get Google Calendar status',
                error.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
              ),
          );
        }),
      );
  }

  @Delete('google/disconnect')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Disconnect Google Calendar' })
  disconnectGoogle(@CurrentUser('id') userId: string) {
    return this.crmService
      .send(CRM_SERVICE_PATTERNS.GOOGLE_CALENDAR_DISCONNECT, { userId })
      .pipe(
        timeout(10000),
        catchError((err: unknown) => {
          const error = err as ServiceError;
          return throwError(
            () =>
              new HttpException(
                error.message ?? 'Failed to disconnect Google Calendar',
                error.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
              ),
          );
        }),
      );
  }

  @Get('google/events')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Get Google Calendar events' })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'maxResults', required: false })
  getGoogleEvents(
    @CurrentUser('id') userId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('maxResults') maxResults?: string,
  ) {
    return this.crmService
      .send(CRM_SERVICE_PATTERNS.GOOGLE_CALENDAR_GET_EVENTS, {
        userId,
        from,
        to,
        maxResults: maxResults ? parseInt(maxResults) : undefined,
      })
      .pipe(
        timeout(15000),
        catchError((err: unknown) => {
          const error = err as ServiceError;
          return throwError(
            () =>
              new HttpException(
                error.message ?? 'Failed to get Google Calendar events',
                error.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
              ),
          );
        }),
      );
  }

  @Get('microsoft/connect')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Get Microsoft Calendar OAuth connect URL' })
  getMicrosoftConnectUrl(@CurrentUser('id') userId: string) {
    this.logger.log(`Microsoft Calendar connect for user ${userId}`);
    return this.crmService
      .send(CRM_SERVICE_PATTERNS.MICROSOFT_CALENDAR_CONNECT, { userId })
      .pipe(
        timeout(10000),
        catchError((err: unknown) => {
          const error = err as ServiceError;
          return throwError(
            () =>
              new HttpException(
                error.message ?? 'Failed to get Microsoft Calendar connect URL',
                error.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
              ),
          );
        }),
      );
  }

  @Get('microsoft/callback')
  @Public()
  @ApiOperation({ summary: 'Handle Microsoft Calendar OAuth callback' })
  @ApiQuery({ name: 'code', required: true })
  @ApiQuery({ name: 'state', required: true })
  async handleMicrosoftCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Res() res: Response,
  ) {
    this.logger.log(`Microsoft Calendar callback for state ${state}`);

    if (error) {
      return res.redirect(
        `/studio/calendar?error=microsoft_${encodeURIComponent(error)}`,
      );
    }

    if (!code || !state) {
      return res.redirect('/studio/calendar?error=missing_params');
    }

    try {
      await this.crmService
        .send(CRM_SERVICE_PATTERNS.MICROSOFT_CALENDAR_CALLBACK, {
          code,
          state,
        })
        .pipe(timeout(15000))
        .toPromise();

      return res.redirect('/studio/calendar?connected=microsoft');
    } catch {
      return res.redirect('/studio/calendar?error=microsoft_callback_failed');
    }
  }

  @Get('microsoft/status')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Get Microsoft Calendar connection status' })
  getMicrosoftStatus(@CurrentUser('id') userId: string) {
    return this.crmService
      .send(CRM_SERVICE_PATTERNS.MICROSOFT_CALENDAR_STATUS, { userId })
      .pipe(
        timeout(10000),
        catchError((err: unknown) => {
          const error = err as ServiceError;
          return throwError(
            () =>
              new HttpException(
                error.message ?? 'Failed to get Microsoft Calendar status',
                error.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
              ),
          );
        }),
      );
  }

  @Delete('microsoft/disconnect')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Disconnect Microsoft Calendar' })
  disconnectMicrosoft(@CurrentUser('id') userId: string) {
    return this.crmService
      .send(CRM_SERVICE_PATTERNS.MICROSOFT_CALENDAR_DISCONNECT, { userId })
      .pipe(
        timeout(10000),
        catchError((err: unknown) => {
          const error = err as ServiceError;
          return throwError(
            () =>
              new HttpException(
                error.message ?? 'Failed to disconnect Microsoft Calendar',
                error.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
              ),
          );
        }),
      );
  }

  @Get('microsoft/events')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Get Microsoft Calendar events' })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'maxResults', required: false })
  getMicrosoftEvents(
    @CurrentUser('id') userId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('maxResults') maxResults?: string,
  ) {
    return this.crmService
      .send(CRM_SERVICE_PATTERNS.MICROSOFT_CALENDAR_GET_EVENTS, {
        userId,
        from,
        to,
        maxResults: maxResults ? parseInt(maxResults) : undefined,
      })
      .pipe(
        timeout(15000),
        catchError((err: unknown) => {
          const error = err as ServiceError;
          return throwError(
            () =>
              new HttpException(
                error.message ?? 'Failed to get Microsoft Calendar events',
                error.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
              ),
          );
        }),
      );
  }

  @Get('upcoming')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Get upcoming events from all connected calendars' })
  @ApiQuery({ name: 'lookAheadDays', required: false })
  getUpcoming(
    @CurrentUser('id') userId: string,
    @Query('lookAheadDays') lookAheadDays?: string,
  ) {
    return this.crmService
      .send(CRM_SERVICE_PATTERNS.CALENDAR_GET_UPCOMING, {
        userId,
        lookAheadDays: lookAheadDays ? parseInt(lookAheadDays) : undefined,
      })
      .pipe(
        timeout(15000),
        catchError((err: unknown) => {
          const error = err as ServiceError;
          return throwError(
            () =>
              new HttpException(
                error.message ?? 'Failed to get upcoming events',
                error.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
              ),
          );
        }),
      );
  }

  @Get('suggestions')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'List calendar session suggestions' })
  getSuggestions(
    @CurrentUser('id') userId: string,
    @CurrentUser('orgId') orgId: string,
  ) {
    return this.simulationService
      .send(SIMULATION_SERVICE_PATTERNS.CALENDAR_SESSION_SUGGESTIONS_LIST, {
        userId,
        orgId,
      })
      .pipe(
        timeout(10000),
        catchError((err: unknown) => {
          const error = err as ServiceError;
          return throwError(
            () =>
              new HttpException(
                error.message ?? 'Failed to list suggestions',
                error.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
              ),
          );
        }),
      );
  }

  @Post('suggestions/:sessionId/accept')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Accept a calendar session suggestion' })
  acceptSuggestion(
    @CurrentUser('id') userId: string,
    @Param('sessionId') sessionId: string,
  ) {
    return this.simulationService
      .send(SIMULATION_SERVICE_PATTERNS.CALENDAR_SESSION_SUGGESTIONS_ACCEPT, {
        userId,
        sessionId,
      })
      .pipe(
        timeout(10000),
        catchError((err: unknown) => {
          const error = err as ServiceError;
          return throwError(
            () =>
              new HttpException(
                error.message ?? 'Failed to accept suggestion',
                error.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
              ),
          );
        }),
      );
  }

  @Delete('suggestions/:sessionId')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Dismiss a calendar session suggestion' })
  dismissSuggestion(
    @CurrentUser('id') userId: string,
    @Param('sessionId') sessionId: string,
  ) {
    return this.simulationService
      .send(SIMULATION_SERVICE_PATTERNS.CALENDAR_SESSION_SUGGESTIONS_DISMISS, {
        userId,
        sessionId,
      })
      .pipe(
        timeout(10000),
        catchError((err: unknown) => {
          const error = err as ServiceError;
          return throwError(
            () =>
              new HttpException(
                error.message ?? 'Failed to dismiss suggestion',
                error.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
              ),
          );
        }),
      );
  }
}
