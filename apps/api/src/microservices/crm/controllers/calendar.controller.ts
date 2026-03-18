import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { CRM_SERVICE_PATTERNS } from '@pitch/shared-backend/interfaces/message-patterns.interface';
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
    this.logger.log(`Google Calendar connect for user ${data.userId}`);
    return this.googleCalendar.getConnectUrl(data.userId);
  }

  @MessagePattern(CRM_SERVICE_PATTERNS.GOOGLE_CALENDAR_CALLBACK)
  googleCallback(@Payload() data: { code: string; state: string }) {
    this.logger.log(`Google Calendar callback for state ${data.state}`);
    return this.googleCalendar.handleCallback(data.code, data.state);
  }

  @MessagePattern(CRM_SERVICE_PATTERNS.GOOGLE_CALENDAR_STATUS)
  googleStatus(@Payload() data: { userId: string }) {
    this.logger.log(`Google Calendar status for user ${data.userId}`);
    return this.googleCalendar.getStatus(data.userId);
  }

  @MessagePattern(CRM_SERVICE_PATTERNS.GOOGLE_CALENDAR_DISCONNECT)
  googleDisconnect(@Payload() data: { userId: string }) {
    this.logger.log(`Google Calendar disconnect for user ${data.userId}`);
    return this.googleCalendar.disconnect(data.userId);
  }

  @MessagePattern(CRM_SERVICE_PATTERNS.GOOGLE_CALENDAR_GET_EVENTS)
  googleGetEvents(
    @Payload()
    data: {
      userId: string;
      from?: string;
      to?: string;
      maxResults?: number;
    },
  ) {
    this.logger.log(`Google Calendar events for user ${data.userId}`);
    return this.googleCalendar.getEvents(data.userId, {
      from: data.from,
      to: data.to,
      maxResults: data.maxResults,
    });
  }

  @MessagePattern(CRM_SERVICE_PATTERNS.MICROSOFT_CALENDAR_CONNECT)
  microsoftConnect(@Payload() data: { userId: string }) {
    this.logger.log(`Microsoft Calendar connect for user ${data.userId}`);
    return this.microsoftCalendar.getConnectUrl(data.userId);
  }

  @MessagePattern(CRM_SERVICE_PATTERNS.MICROSOFT_CALENDAR_CALLBACK)
  microsoftCallback(@Payload() data: { code: string; state: string }) {
    this.logger.log(`Microsoft Calendar callback for state ${data.state}`);
    return this.microsoftCalendar.handleCallback(data.code, data.state);
  }

  @MessagePattern(CRM_SERVICE_PATTERNS.MICROSOFT_CALENDAR_STATUS)
  microsoftStatus(@Payload() data: { userId: string }) {
    this.logger.log(`Microsoft Calendar status for user ${data.userId}`);
    return this.microsoftCalendar.getStatus(data.userId);
  }

  @MessagePattern(CRM_SERVICE_PATTERNS.MICROSOFT_CALENDAR_DISCONNECT)
  microsoftDisconnect(@Payload() data: { userId: string }) {
    this.logger.log(`Microsoft Calendar disconnect for user ${data.userId}`);
    return this.microsoftCalendar.disconnect(data.userId);
  }

  @MessagePattern(CRM_SERVICE_PATTERNS.MICROSOFT_CALENDAR_GET_EVENTS)
  microsoftGetEvents(
    @Payload()
    data: {
      userId: string;
      from?: string;
      to?: string;
      maxResults?: number;
    },
  ) {
    this.logger.log(`Microsoft Calendar events for user ${data.userId}`);
    return this.microsoftCalendar.getEvents(data.userId, {
      from: data.from,
      to: data.to,
      maxResults: data.maxResults,
    });
  }

  @MessagePattern(CRM_SERVICE_PATTERNS.CALENDAR_GET_UPCOMING)
  getUpcoming(@Payload() data: { userId: string; lookAheadDays?: number }) {
    this.logger.log(`Calendar upcoming for user ${data.userId}`);
    return this.calendarQuery.getUpcomingForUser(
      data.userId,
      data.lookAheadDays,
    );
  }

  @MessagePattern(CRM_SERVICE_PATTERNS.CALENDAR_LIST_ALL_CONNECTED)
  listAllConnected() {
    this.logger.log('Listing all users with calendar connected');
    return this.calendarQuery.listAllConnectedUsers();
  }
}
