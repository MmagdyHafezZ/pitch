import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { SIMULATION_SERVICE_PATTERNS } from '@pitch/shared-backend/interfaces/message-patterns.interface';
import { CalendarSessionService } from '../services/calendar-session.service';
import type { CreateSessionFromEventPayload } from '../services/calendar-session.service';
import { SessionRepository } from '../repositories/session.repository';

@Controller()
export class CalendarSessionController {
  private readonly logger = new Logger(CalendarSessionController.name);

  constructor(
    private readonly calendarSessionService: CalendarSessionService,
    private readonly sessionRepository: SessionRepository,
  ) {}

  @MessagePattern(SIMULATION_SERVICE_PATTERNS.SESSION_FIND_BY_CALENDAR_EVENT)
  findByCalendarEvent(
    @Payload() data: { calendarEventId: string; userId: string },
  ) {
    this.logger.log(
      `Find session by calendar event ${data.calendarEventId} for user ${data.userId}`,
    );
    return this.sessionRepository.findByCalendarEventId(
      data.calendarEventId,
      data.userId,
    );
  }

  @MessagePattern(SIMULATION_SERVICE_PATTERNS.CALENDAR_SESSION_SUGGESTIONS_LIST)
  listSuggestions(@Payload() data: { userId: string; orgId: string }) {
    this.logger.log(`List calendar suggestions for user ${data.userId}`);
    return this.calendarSessionService.getSuggestionsForUser(
      data.userId,
      data.orgId,
    );
  }

  @MessagePattern(
    SIMULATION_SERVICE_PATTERNS.CALENDAR_SESSION_SUGGESTIONS_ACCEPT,
  )
  acceptSuggestion(@Payload() data: { sessionId: string; userId: string }) {
    this.logger.log(`Accept suggestion ${data.sessionId}`);
    return this.calendarSessionService.acceptSuggestion(
      data.sessionId,
      data.userId,
    );
  }

  @MessagePattern(
    SIMULATION_SERVICE_PATTERNS.CALENDAR_SESSION_SUGGESTIONS_DISMISS,
  )
  dismissSuggestion(@Payload() data: { sessionId: string; userId: string }) {
    this.logger.log(`Dismiss suggestion ${data.sessionId}`);
    return this.calendarSessionService.dismissSuggestion(
      data.sessionId,
      data.userId,
    );
  }

  @MessagePattern('simulation.calendar.session.createFromEvent')
  createFromEvent(@Payload() data: CreateSessionFromEventPayload) {
    this.logger.log(
      `Create session from calendar event ${data.calendarEvent.id} for user ${data.userId}`,
    );
    return this.calendarSessionService.createSessionFromCalendarEvent(data);
  }
}
