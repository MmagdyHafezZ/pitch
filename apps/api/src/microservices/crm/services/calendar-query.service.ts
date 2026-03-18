import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { GoogleCalendarIntegrationService } from './google-calendar-integration.service';
import { MicrosoftCalendarIntegrationService } from './microsoft-calendar-integration.service';
import type { CalendarEvent } from './google-calendar-integration.service';
import type { IntegrationProvider } from '@prisma/crm-client';

const GOOGLE_CALENDAR = 'GOOGLE_CALENDAR' as unknown as IntegrationProvider;
const MICROSOFT_CALENDAR =
  'MICROSOFT_CALENDAR' as unknown as IntegrationProvider;

export interface ConnectedCalendarUser {
  userId: string;
  providers: ('google' | 'microsoft')[];
}

@Injectable()
export class CalendarQueryService {
  private readonly logger = new Logger(CalendarQueryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly googleCalendar: GoogleCalendarIntegrationService,
    private readonly microsoftCalendar: MicrosoftCalendarIntegrationService,
  ) {}

  /**
   * Fetch upcoming events from all connected providers for a user, merged and sorted.
   */
  async getUpcomingForUser(
    userId: string,
    lookAheadDays: number = 7,
  ): Promise<CalendarEvent[]> {
    const to = new Date(Date.now() + lookAheadDays * 86400_000).toISOString();
    const from = new Date().toISOString();

    const [googleConnected, microsoftConnected] = await Promise.all([
      this.googleCalendar.isConnected(userId),
      this.microsoftCalendar.isConnected(userId),
    ]);

    const fetches: Promise<CalendarEvent[]>[] = [];

    if (googleConnected) {
      fetches.push(
        this.googleCalendar
          .getEvents(userId, { from, to })
          .catch((err: unknown) => {
            this.logger.warn(
              `Google Calendar fetch failed for user ${userId}: ${(err as Error)?.message}`,
            );
            return [];
          }),
      );
    }

    if (microsoftConnected) {
      fetches.push(
        this.microsoftCalendar
          .getEvents(userId, { from, to })
          .catch((err: unknown) => {
            this.logger.warn(
              `Microsoft Calendar fetch failed for user ${userId}: ${(err as Error)?.message}`,
            );
            return [];
          }),
      );
    }

    if (fetches.length === 0) {
      return [];
    }

    const results = await Promise.all(fetches);
    const allEvents = results.flat();

    allEvents.sort((a, b) => {
      const aTime = new Date(a.startTime).getTime();
      const bTime = new Date(b.startTime).getTime();
      return aTime - bTime;
    });

    return allEvents;
  }

  /**
   * Return all users who have at least one calendar provider connected.
   * Used by the background sync job.
   */
  async listAllConnectedUsers(): Promise<ConnectedCalendarUser[]> {
    const integrations = await this.prisma.client.integration.findMany({
      where: {
        provider: { in: [GOOGLE_CALENDAR, MICROSOFT_CALENDAR] },
        status: 'CONNECTED',
      },
      select: { userId: true, provider: true },
    });

    const byUser = new Map<string, Set<'google' | 'microsoft'>>();
    for (const row of integrations) {
      if (!byUser.has(row.userId)) {
        byUser.set(row.userId, new Set());
      }
      byUser
        .get(row.userId)!
        .add(
          (row.provider as unknown as string) === 'GOOGLE_CALENDAR'
            ? 'google'
            : 'microsoft',
        );
    }

    return Array.from(byUser.entries()).map(([userId, providersSet]) => ({
      userId,
      providers: Array.from(providersSet),
    }));
  }
}
