import {
  Injectable,
  Logger,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from './prisma.service';
import type { Integration, IntegrationProvider } from '@prisma/crm-client';

const GOOGLE_CALENDAR = 'GOOGLE_CALENDAR' as unknown as IntegrationProvider;

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  attendees: { email: string; name?: string; self?: boolean }[];
  location?: string;
  meetingUrl?: string;
  provider: 'google' | 'microsoft';
  isAllDay: boolean;
  status: 'confirmed' | 'tentative' | 'cancelled';
  organizerEmail?: string;
  htmlLink?: string;
}

interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
}

interface GoogleCalendarEventAttendee {
  email: string;
  displayName?: string;
  self?: boolean;
}

interface GoogleConferenceEntryPoint {
  uri?: string;
  entryPointType?: string;
}

interface GoogleCalendarApiEvent {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  htmlLink?: string;
  status?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  organizer?: { email?: string };
  attendees?: GoogleCalendarEventAttendee[];
  conferenceData?: { entryPoints?: GoogleConferenceEntryPoint[] };
}

interface GoogleEventsListResponse {
  items?: GoogleCalendarApiEvent[];
}

@Injectable()
export class GoogleCalendarIntegrationService {
  private readonly logger = new Logger(GoogleCalendarIntegrationService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getIntegration(userId: string): Promise<Integration> {
    const integration = await this.prisma.client.integration.findUnique({
      where: { userId_provider: { userId, provider: GOOGLE_CALENDAR } },
    });

    if (!integration) {
      throw new UnauthorizedException('Google Calendar not connected');
    }
    if (integration.status === 'DISCONNECTED') {
      throw new UnauthorizedException('Google Calendar is disconnected');
    }
    if (integration.status === 'ERROR' || integration.status === 'EXPIRED') {
      throw new UnauthorizedException(
        'Google Calendar has errors. Please reconnect.',
      );
    }
    return integration;
  }

  async isConnected(userId: string): Promise<boolean> {
    const integration = await this.prisma.client.integration.findUnique({
      where: { userId_provider: { userId, provider: GOOGLE_CALENDAR } },
    });
    return integration?.status === 'CONNECTED';
  }

  private async refreshTokenIfNeeded(
    integration: Integration,
  ): Promise<string | null> {
    const now = new Date();
    if (
      integration.expiresAt &&
      integration.expiresAt <= new Date(now.getTime() + 5 * 60 * 1000)
    ) {
      this.logger.log(
        `Refreshing Google Calendar token for user ${integration.userId}`,
      );

      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: process.env.GOOGLE_CALENDAR_CLIENT_ID || '',
          client_secret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET || '',
          refresh_token: integration.refreshToken || '',
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        this.logger.error(`Failed to refresh Google token: ${error}`);
        await this.prisma.client.integration.update({
          where: { id: integration.id },
          data: { status: 'EXPIRED' },
        });
        throw new UnauthorizedException(
          'Failed to refresh Google token. Please reconnect.',
        );
      }

      const data = (await response.json()) as GoogleTokenResponse;
      await this.prisma.client.integration.update({
        where: { id: integration.id },
        data: {
          accessToken: data.access_token,
          expiresAt: new Date(Date.now() + (data.expires_in || 3600) * 1000),
          status: 'CONNECTED',
        },
      });
      return data.access_token;
    }

    return integration.accessToken ?? null;
  }

  getConnectUrl(userId: string) {
    const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID;
    const redirectUri =
      process.env.GOOGLE_CALENDAR_REDIRECT_URI ||
      'http://localhost:8000/api/calendar/google/callback';

    if (!clientId) {
      throw new BadRequestException('Google Calendar client ID not configured');
    }

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: 'https://www.googleapis.com/auth/calendar.readonly',
      access_type: 'offline',
      prompt: 'consent',
      state: userId,
    });

    return {
      authUrl: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
    };
  }

  async handleCallback(code: string, state: string) {
    if (!code) throw new BadRequestException('Authorization code is required');
    if (!state) throw new BadRequestException('State parameter is required');

    const userId = state;
    this.logger.log(`Google Calendar callback for user ${userId}`);

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: process.env.GOOGLE_CALENDAR_CLIENT_ID || '',
        client_secret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET || '',
        redirect_uri:
          process.env.GOOGLE_CALENDAR_REDIRECT_URI ||
          'http://localhost:8000/api/calendar/google/callback',
      }),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      this.logger.error(`Failed to exchange Google code: ${error}`);
      throw new BadRequestException('Failed to connect Google Calendar');
    }

    const tokenData = (await tokenResponse.json()) as GoogleTokenResponse;

    const userInfoResponse = await fetch(
      'https://www.googleapis.com/oauth2/v2/userinfo',
      {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      },
    );

    const userInfo = (await userInfoResponse.json()) as {
      id?: string;
      email?: string;
    };

    await this.prisma.client.integration.upsert({
      where: { userId_provider: { userId, provider: GOOGLE_CALENDAR } },
      create: {
        userId,
        provider: GOOGLE_CALENDAR,
        status: 'CONNECTED',
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt: new Date(Date.now() + (tokenData.expires_in ?? 3600) * 1000),
        providerId: userInfo.id,
        providerEmail: userInfo.email,
      },
      update: {
        status: 'CONNECTED',
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt: new Date(Date.now() + (tokenData.expires_in ?? 3600) * 1000),
        providerId: userInfo.id,
        providerEmail: userInfo.email,
      },
    });

    this.logger.log(`Google Calendar connected for user ${userId}`);
    return { success: true, userId };
  }

  async getStatus(userId: string) {
    const integration = await this.prisma.client.integration.findUnique({
      where: { userId_provider: { userId, provider: GOOGLE_CALENDAR } },
      select: {
        id: true,
        status: true,
        providerEmail: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!integration) {
      return { connected: false, status: 'NOT_CONNECTED', provider: 'google' };
    }

    return {
      ...integration,
      connected: integration.status === 'CONNECTED',
      provider: 'google' as const,
    };
  }

  async getEvents(
    userId: string,
    opts: { from?: string; to?: string; maxResults?: number } = {},
  ): Promise<CalendarEvent[]> {
    const integration = await this.getIntegration(userId);
    const accessToken = await this.refreshTokenIfNeeded(integration);
    if (!accessToken) {
      throw new UnauthorizedException('Google Calendar access token missing');
    }

    const from = opts.from ?? new Date().toISOString();
    const to =
      opts.to ??
      new Date(
        Date.now() + (opts.maxResults ? 30 : 7) * 86400_000,
      ).toISOString();

    const params = new URLSearchParams({
      timeMin: from,
      timeMax: to,
      maxResults: String(opts.maxResults ?? 50),
      singleEvents: 'true',
      orderBy: 'startTime',
    });

    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`Google Calendar API error: ${error}`);
      if (response.status === 401) {
        await this.prisma.client.integration.update({
          where: { id: integration.id },
          data: { status: 'EXPIRED' },
        });
        throw new UnauthorizedException(
          'Google Calendar token expired. Please reconnect.',
        );
      }
      throw new BadRequestException('Failed to fetch Google Calendar events');
    }

    const data = (await response.json()) as GoogleEventsListResponse;
    return (data.items ?? []).map((e) => this.normalizeEvent(e));
  }

  async disconnect(userId: string) {
    await this.prisma.client.integration.update({
      where: { userId_provider: { userId, provider: GOOGLE_CALENDAR } },
      data: {
        status: 'DISCONNECTED',
        accessToken: null,
        refreshToken: null,
        expiresAt: null,
      },
    });
    return { success: true, message: 'Google Calendar disconnected' };
  }

  private normalizeEvent(e: GoogleCalendarApiEvent): CalendarEvent {
    const startRaw = e.start?.dateTime ?? e.start?.date ?? '';
    const endRaw = e.end?.dateTime ?? e.end?.date ?? '';
    const isAllDay = !e.start?.dateTime;

    const meetingUrl = e.conferenceData?.entryPoints?.find(
      (ep) => ep.entryPointType === 'video' || ep.uri?.startsWith('https://'),
    )?.uri;

    return {
      id: e.id,
      title: e.summary ?? '(No title)',
      description: e.description,
      startTime: startRaw,
      endTime: endRaw,
      attendees: (e.attendees ?? []).map((a) => ({
        email: a.email,
        name: a.displayName,
        self: a.self,
      })),
      location: e.location,
      meetingUrl,
      provider: 'google',
      isAllDay,
      status: (e.status as CalendarEvent['status']) ?? 'confirmed',
      organizerEmail: e.organizer?.email,
      htmlLink: e.htmlLink,
    };
  }
}
