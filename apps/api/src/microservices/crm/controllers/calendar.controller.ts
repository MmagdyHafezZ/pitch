import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { CRM_SERVICE_PATTERNS } from '@pitch/shared-backend/interfaces/message-patterns.interface';
import { toRpcException } from '@pitch/shared-backend/helpers/exceptions';
import { GoogleCalendarIntegrationService } from '../services/google-calendar-integration.service';
import { MicrosoftCalendarIntegrationService } from '../services/microsoft-calendar-integration.service';
import { CalendarQueryService } from '../services/calendar-query.service';

@Controller()
export class CalendarController {
  private readonly logger = new Logger(CalendarController.name);

  constructor(
    private readonly googleCalendar: GoogleCalendarIntegrationService,
    private readonly microsoftCalendar: MicrosoftCalendarIntegrationService,
    private readonly calendarQuery: CalendarQueryService,
  ) {}

  @MessagePattern(CRM_SERVICE_PATTERNS.GOOGLE_CALENDAR_CONNECT)
  googleConnect(@Payload() data: { userId: string }) {
    try {
      this.logger.log(`Google Calendar connect for user ${data.userId}`);
      return this.googleCalendar.getConnectUrl(data.userId);
    } catch (error) {
      this.logger.error(
        `Google Calendar connect failed for user ${data.userId}`,
        error instanceof Error ? error.stack : JSON.stringify(error),
      );
      throw toRpcException(error);
    }
  }

  @MessagePattern(CRM_SERVICE_PATTERNS.GOOGLE_CALENDAR_CALLBACK)
  async googleCallback(@Payload() data: { code: string; state: string }) {
    try {
      this.logger.log(`Google Calendar callback for state ${data.state}`);
      return await this.googleCalendar.handleCallback(data.code, data.state);
    } catch (error) {
      this.logger.error(
        `Google Calendar callback failed for state ${data.state}`,
        error instanceof Error ? error.stack : JSON.stringify(error),
      );
      throw toRpcException(error);
    }
  }

  @MessagePattern(CRM_SERVICE_PATTERNS.GOOGLE_CALENDAR_STATUS)
  async googleStatus(@Payload() data: { userId: string }) {
    try {
      this.logger.log(`Google Calendar status for user ${data.userId}`);
      return await this.googleCalendar.getStatus(data.userId);
    } catch (error) {
      this.logger.error(
        `Google Calendar status failed for user ${data.userId}`,
        error instanceof Error ? error.stack : JSON.stringify(error),
      );
      throw toRpcException(error);
    }
  }

  @MessagePattern(CRM_SERVICE_PATTERNS.GOOGLE_CALENDAR_DISCONNECT)
  async googleDisconnect(@Payload() data: { userId: string }) {
    try {
      this.logger.log(`Google Calendar disconnect for user ${data.userId}`);
      return await this.googleCalendar.disconnect(data.userId);
    } catch (error) {
      this.logger.error(
        `Google Calendar disconnect failed for user ${data.userId}`,
        error instanceof Error ? error.stack : JSON.stringify(error),
      );
      throw toRpcException(error);
    }
  }

  @MessagePattern(CRM_SERVICE_PATTERNS.GOOGLE_CALENDAR_GET_EVENTS)
  async googleGetEvents(
    @Payload()
    data: {
      userId: string;
      from?: string;
      to?: string;
      maxResults?: number;
    },
  ) {
    try {
      this.logger.log(`Google Calendar events for user ${data.userId}`);
      return await this.googleCalendar.getEvents(data.userId, {
        from: data.from,
        to: data.to,
        maxResults: data.maxResults,
      });
    } catch (error) {
      this.logger.error(
        `Google Calendar events failed for user ${data.userId}`,
        error instanceof Error ? error.stack : JSON.stringify(error),
      );
      throw toRpcException(error);
    }
  }

  @MessagePattern(CRM_SERVICE_PATTERNS.MICROSOFT_CALENDAR_CONNECT)
  microsoftConnect(@Payload() data: { userId: string }) {
    try {
      this.logger.log(`Microsoft Calendar connect for user ${data.userId}`);
      return this.microsoftCalendar.getConnectUrl(data.userId);
    } catch (error) {
      this.logger.error(
        `Microsoft Calendar connect failed for user ${data.userId}`,
        error instanceof Error ? error.stack : JSON.stringify(error),
      );
      throw toRpcException(error);
    }
  }

  @MessagePattern(CRM_SERVICE_PATTERNS.MICROSOFT_CALENDAR_CALLBACK)
  async microsoftCallback(@Payload() data: { code: string; state: string }) {
    try {
      this.logger.log(`Microsoft Calendar callback for state ${data.state}`);
      return await this.microsoftCalendar.handleCallback(data.code, data.state);
    } catch (error) {
      this.logger.error(
        `Microsoft Calendar callback failed for state ${data.state}`,
        error instanceof Error ? error.stack : JSON.stringify(error),
      );
      throw toRpcException(error);
    }
  }

  @MessagePattern(CRM_SERVICE_PATTERNS.MICROSOFT_CALENDAR_STATUS)
  async microsoftStatus(@Payload() data: { userId: string }) {
    try {
      this.logger.log(`Microsoft Calendar status for user ${data.userId}`);
      return await this.microsoftCalendar.getStatus(data.userId);
    } catch (error) {
      this.logger.error(
        `Microsoft Calendar status failed for user ${data.userId}`,
        error instanceof Error ? error.stack : JSON.stringify(error),
      );
      throw toRpcException(error);
    }
  }

  @MessagePattern(CRM_SERVICE_PATTERNS.MICROSOFT_CALENDAR_DISCONNECT)
  async microsoftDisconnect(@Payload() data: { userId: string }) {
    try {
      this.logger.log(`Microsoft Calendar disconnect for user ${data.userId}`);
      return await this.microsoftCalendar.disconnect(data.userId);
    } catch (error) {
      this.logger.error(
        `Microsoft Calendar disconnect failed for user ${data.userId}`,
        error instanceof Error ? error.stack : JSON.stringify(error),
      );
      throw toRpcException(error);
    }
  }

  @MessagePattern(CRM_SERVICE_PATTERNS.MICROSOFT_CALENDAR_GET_EVENTS)
  async microsoftGetEvents(
    @Payload()
    data: {
      userId: string;
      from?: string;
      to?: string;
      maxResults?: number;
    },
  ) {
    try {
      this.logger.log(`Microsoft Calendar events for user ${data.userId}`);
      return await this.microsoftCalendar.getEvents(data.userId, {
        from: data.from,
        to: data.to,
        maxResults: data.maxResults,
      });
    } catch (error) {
      this.logger.error(
        `Microsoft Calendar events failed for user ${data.userId}`,
        error instanceof Error ? error.stack : JSON.stringify(error),
      );
      throw toRpcException(error);
    }
  }

  @MessagePattern(CRM_SERVICE_PATTERNS.CALENDAR_GET_UPCOMING)
  async getUpcoming(
    @Payload() data: { userId: string; lookAheadDays?: number },
  ) {
    try {
      this.logger.log(`Calendar upcoming for user ${data.userId}`);
      return await this.calendarQuery.getUpcomingForUser(
        data.userId,
        data.lookAheadDays,
      );
    } catch (error) {
      this.logger.error(
        `Calendar upcoming failed for user ${data.userId}`,
        error instanceof Error ? error.stack : JSON.stringify(error),
      );
      throw toRpcException(error);
    }
  }

  @MessagePattern(CRM_SERVICE_PATTERNS.CALENDAR_LIST_ALL_CONNECTED)
  async listAllConnected() {
    try {
      this.logger.log('Listing all users with calendar connected');
      return await this.calendarQuery.listAllConnectedUsers();
    } catch (error) {
      this.logger.error(
        'Listing connected calendar users failed',
        error instanceof Error ? error.stack : JSON.stringify(error),
      );
      throw toRpcException(error);
    }
  }
}
