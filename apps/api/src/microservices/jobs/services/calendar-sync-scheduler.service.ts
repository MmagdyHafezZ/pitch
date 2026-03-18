import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ClientProxy } from '@nestjs/microservices';
import {
  CRM_SERVICE_PATTERNS,
  SIMULATION_SERVICE_PATTERNS,
  USER_SERVICE_PATTERNS,
} from '@pitch/shared-backend/interfaces/message-patterns.interface';
import { firstValueFrom, timeout } from 'rxjs';
import type { ConnectedCalendarUser } from '@microservices/crm/services/calendar-query.service';
import type { CalendarEvent } from '@microservices/crm/services/google-calendar-integration.service';
import type { UserSettings } from '@pitch/shared-backend/interfaces/user.interface';

interface UserSettingsResponse {
  settings?: UserSettings;
}

@Injectable()
export class CalendarSyncSchedulerService {
  private readonly logger = new Logger(CalendarSyncSchedulerService.name);

  constructor(
    @Inject('CRM_SERVICE') private readonly crmClient: ClientProxy,
    @Inject('SIMULATION_SERVICE')
    private readonly simulationClient: ClientProxy,
    @Inject('USER_SERVICE') private readonly userClient: ClientProxy,
  ) {}

  /** Sync calendar events every 15 minutes */
  @Cron('*/15 * * * *', { name: 'sync-calendar-events' })
  async syncCalendarEvents() {
    this.logger.log('Starting calendar sync for all connected users');

    let connectedUsers: ConnectedCalendarUser[] = [];
    try {
      connectedUsers = await firstValueFrom<ConnectedCalendarUser[]>(
        this.crmClient
          .send<
            ConnectedCalendarUser[]
          >(CRM_SERVICE_PATTERNS.CALENDAR_LIST_ALL_CONNECTED, {})
          .pipe(timeout(15000)),
      );
    } catch (err) {
      this.logger.warn(
        `Failed to list connected calendar users: ${(err as Error)?.message}`,
      );
      return;
    }

    this.logger.log(
      `Found ${connectedUsers.length} users with connected calendars`,
    );

    for (const user of connectedUsers) {
      this.crmClient.emit('calendar.sync.user', {
        userId: user.userId,
        providers: user.providers,
      });
    }
  }

  /** Handle per-user calendar sync (triggered by syncCalendarEvents) */
  async syncUserCalendar(data: {
    userId: string;
    providers: ('google' | 'microsoft')[];
  }) {
    const { userId } = data;

    let settings: UserSettings | undefined;
    try {
      const response = await firstValueFrom<UserSettingsResponse>(
        this.userClient
          .send<UserSettingsResponse>(USER_SERVICE_PATTERNS.GET_MY_SETTINGS, {
            userId,
          })
          .pipe(timeout(8000)),
      );
      settings = response?.settings;
    } catch {
      this.logger.warn(`Failed to fetch settings for user ${userId}`);
    }

    const mode = settings?.calendar?.mode ?? 'suggest';
    if (mode === 'off') {
      this.logger.log(`Calendar sync disabled for user ${userId}`);
      return;
    }

    const lookAheadDays = settings?.calendar?.lookAheadDays ?? 7;
    const sessionType = settings?.calendar?.defaultSessionType ?? 'text';

    let events: CalendarEvent[] = [];
    try {
      events = await firstValueFrom<CalendarEvent[]>(
        this.crmClient
          .send<CalendarEvent[]>(CRM_SERVICE_PATTERNS.CALENDAR_GET_UPCOMING, {
            userId,
            lookAheadDays,
          })
          .pipe(timeout(15000)),
      );
    } catch (err) {
      this.logger.warn(
        `Failed to fetch calendar events for user ${userId}: ${(err as Error)?.message}`,
      );
      return;
    }

    this.logger.log(
      `Processing ${events.length} events for user ${userId} (mode: ${mode})`,
    );

    for (const event of events) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const existing: any = await firstValueFrom(
          this.simulationClient
            .send(SIMULATION_SERVICE_PATTERNS.SESSION_FIND_BY_CALENDAR_EVENT, {
              calendarEventId: event.id,
              userId,
            })
            .pipe(timeout(5000)),
        );

        if (existing) {
          continue;
        }

        this.simulationClient.emit(
          'simulation.calendar.session.createFromEvent',
          {
            userId,
            orgId: '',
            calendarEvent: event,
            mode,
            sessionType,
          },
        );
      } catch (err) {
        this.logger.warn(
          `Failed to process event ${event.id} for user ${userId}: ${(err as Error)?.message}`,
        );
      }
    }
  }
}
