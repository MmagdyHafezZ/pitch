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

type GatewayServiceError = ServiceError & {
  statusCode?: unknown;
};

@ApiTags('Calendar Integration')
@Controller({ path: 'calendar', version: VERSION_NEUTRAL })
export class CalendarGatewayController {
  private readonly logger = new Logger(CalendarGatewayController.name);
  private readonly pitchAppUrl =
    process.env.PITCH_APP_URL ??
    process.env.NEXT_PUBLIC_FRONTEND_URL ??
    process.env.FRONTEND_URL ??
    'http://localhost:3000';

  constructor(
    @Inject('CRM_SERVICE') private readonly crmService: ClientProxy,
    @Inject('SIMULATION_SERVICE')
    private readonly simulationService: ClientProxy,
  ) {}

  private getCalendarRedirectUrl(params?: Record<string, string>): string {
    const redirectUrl = new URL('/studio/calendar', this.pitchAppUrl);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        redirectUrl.searchParams.set(key, value);
      }
    }
    return redirectUrl.toString();
  }

  private getErrorStatus(
    error: GatewayServiceError,
    fallback: HttpStatus = HttpStatus.INTERNAL_SERVER_ERROR,
  ): number {
    if (typeof error.status === 'number') {
      return error.status;
    }

    if (typeof error.statusCode === 'number') {
      return error.statusCode;
    }

    return fallback;
  }

  private toHttpException(
    err: unknown,
    fallbackMessage: string,
    fallbackStatus: HttpStatus = HttpStatus.INTERNAL_SERVER_ERROR,
  ): HttpException {
    const error = err as GatewayServiceError;
    const status = this.getErrorStatus(error, fallbackStatus);
    const message =
      typeof error.message === 'string' ? error.message : fallbackMessage;

    return new HttpException(message, status);
  }

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
          return throwError(() =>
            this.toHttpException(
              err,
              'Failed to get Google Calendar connect URL',
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
        this.getCalendarRedirectUrl({
          error: `google_${error}`,
        }),
      );
    }

    if (!code || !state) {
      return res.redirect(
        this.getCalendarRedirectUrl({ error: 'missing_params' }),
      );
    }

    try {
      await this.crmService
        .send(CRM_SERVICE_PATTERNS.GOOGLE_CALENDAR_CALLBACK, { code, state })
        .pipe(timeout(15000))
        .toPromise();

      return res.redirect(this.getCalendarRedirectUrl({ connected: 'google' }));
    } catch {
      return res.redirect(
        this.getCalendarRedirectUrl({ error: 'google_callback_failed' }),
      );
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
          return throwError(() =>
            this.toHttpException(err, 'Failed to get Google Calendar status'),
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
          return throwError(() =>
            this.toHttpException(err, 'Failed to disconnect Google Calendar'),
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
          return throwError(() =>
            this.toHttpException(err, 'Failed to get Google Calendar events'),
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
          return throwError(() =>
            this.toHttpException(
              err,
              'Failed to get Microsoft Calendar connect URL',
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
        this.getCalendarRedirectUrl({
          error: `microsoft_${error}`,
        }),
      );
    }

    if (!code || !state) {
      return res.redirect(
        this.getCalendarRedirectUrl({ error: 'missing_params' }),
      );
    }

    try {
      await this.crmService
        .send(CRM_SERVICE_PATTERNS.MICROSOFT_CALENDAR_CALLBACK, {
          code,
          state,
        })
        .pipe(timeout(15000))
        .toPromise();

      return res.redirect(
        this.getCalendarRedirectUrl({ connected: 'microsoft' }),
      );
    } catch {
      return res.redirect(
        this.getCalendarRedirectUrl({ error: 'microsoft_callback_failed' }),
      );
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
          return throwError(() =>
            this.toHttpException(
              err,
              'Failed to get Microsoft Calendar status',
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
          return throwError(() =>
            this.toHttpException(
              err,
              'Failed to disconnect Microsoft Calendar',
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
          return throwError(() =>
            this.toHttpException(
              err,
              'Failed to get Microsoft Calendar events',
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
          return throwError(() =>
            this.toHttpException(err, 'Failed to get upcoming events'),
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
          return throwError(() =>
            this.toHttpException(err, 'Failed to list suggestions'),
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
          return throwError(() =>
            this.toHttpException(err, 'Failed to accept suggestion'),
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
          return throwError(() =>
            this.toHttpException(err, 'Failed to dismiss suggestion'),
          );
        }),
      );
  }
}
