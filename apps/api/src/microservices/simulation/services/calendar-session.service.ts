import { Injectable, Logger } from '@nestjs/common';
import { SessionRepository } from '../repositories/session.repository';
import { SessionService } from './session.service';
import type { CalendarEvent } from '@microservices/crm/services/google-calendar-integration.service';
import { SessionType } from '../dto/session.dto';

export interface CreateSessionFromEventPayload {
  userId: string;
  orgId: string;
  calendarEvent: CalendarEvent;
  mode: 'auto' | 'suggest';
  sessionType?: SessionType;
}

@Injectable()
export class CalendarSessionService {
  private readonly logger = new Logger(CalendarSessionService.name);

  constructor(
    private readonly sessionRepository: SessionRepository,
    private readonly sessionService: SessionService,
  ) {}

  async createSessionFromCalendarEvent(payload: CreateSessionFromEventPayload) {
    const { userId, orgId, calendarEvent, mode, sessionType } = payload;

    const existing = await this.sessionRepository.findByCalendarEventId(
      calendarEvent.id,
      userId,
    );
    if (existing) {
      this.logger.log(
        `Session already exists for calendar event ${calendarEvent.id} — skipping`,
      );
      return existing;
    }

    const isSuggestion = mode === 'suggest';
    const attendeeNames = calendarEvent.attendees
      .filter((a) => !a.self)
      .map((a) => a.name ?? a.email)
      .slice(0, 3)
      .join(', ');

    const sessionName = attendeeNames
      ? `${calendarEvent.title} (with ${attendeeNames})`
      : calendarEvent.title;

    const session = await this.sessionService.create({
      userId,
      orgId,
      name: sessionName.slice(0, 200),
      type: sessionType ?? SessionType.text,
      tags: ['calendar-generated'],
      sessionConfig: {
        calendarEventId: calendarEvent.id,
        calendarProvider: calendarEvent.provider,
        isSuggestion,
        eventStartTime: calendarEvent.startTime,
        eventEndTime: calendarEvent.endTime,
        meetingUrl: calendarEvent.meetingUrl,
        attendees: calendarEvent.attendees,
      },
    });

    this.logger.log(
      `Created ${isSuggestion ? 'suggestion' : 'session'} for calendar event ${calendarEvent.id}`,
    );
    return session;
  }

  async getSuggestionsForUser(userId: string, orgId: string) {
    return this.sessionRepository.findSuggestionsForUser(userId, orgId);
  }

  async acceptSuggestion(sessionId: string, userId: string) {
    const session = await this.sessionRepository.findById(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const config = (session.sessionConfig ?? {}) as Record<string, unknown>;
    const updated = await this.sessionRepository.update(sessionId, {
      sessionConfig: { ...config, isSuggestion: false },
    });

    this.logger.log(`Accepted suggestion ${sessionId} for user ${userId}`);
    return updated;
  }

  async dismissSuggestion(sessionId: string, userId: string) {
    this.logger.log(`Dismissing suggestion ${sessionId} for user ${userId}`);
    await this.sessionRepository.delete(sessionId);
    return { success: true };
  }
}
