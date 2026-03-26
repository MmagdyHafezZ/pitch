import {
  Injectable,
  Logger,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from './prisma.service';
import type { Integration, IntegrationProvider } from '@prisma/crm-client';
import type { CalendarEvent } from './google-calendar-integration.service';

const MICROSOFT_CALENDAR =
  'MICROSOFT_CALENDAR' as unknown as IntegrationProvider;

interface MicrosoftTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
}

interface MicrosoftCalendarAttendee {
  emailAddress?: { address?: string; name?: string };
}

interface MicrosoftOnlineMeeting {
  joinUrl?: string;
}

interface MicrosoftCalendarApiEvent {
  id: string;
  subject?: string;
  body?: { content?: string; contentType?: string };
  location?: { displayName?: string };
  webLink?: string;
  showAs?: string;
  start?: { dateTime?: string; timeZone?: string };
  end?: { dateTime?: string; timeZone?: string };
  isAllDay?: boolean;
  organizer?: { emailAddress?: { address?: string } };
  attendees?: MicrosoftCalendarAttendee[];
  onlineMeeting?: MicrosoftOnlineMeeting;
}

interface MicrosoftEventsListResponse {
  value?: MicrosoftCalendarApiEvent[];
}

@Injectable()
export class MicrosoftCalendarIntegrationService {
  private readonly logger = new Logger(
    MicrosoftCalendarIntegrationService.name,
  );

  constructor(private readonly prisma: PrismaService) {}

  private get tenantId() {
    return process.env.MICROSOFT_CALENDAR_TENANT_ID || 'common';
  }

  async getIntegration(userId: string): Promise<Integration> {
    const integration = await this.prisma.client.integration.findUnique({
      where: { userId_provider: { userId, provider: MICROSOFT_CALENDAR } },
    });

    if (!integration) {
      throw new UnauthorizedException('Microsoft Calendar not connected');
    }
    if (integration.status === 'DISCONNECTED') {
      throw new UnauthorizedException('Microsoft Calendar is disconnected');
    }
    if (integration.status === 'ERROR' || integration.status === 'EXPIRED') {
      throw new UnauthorizedException(
        'Microsoft Calendar has errors. Please reconnect.',
      );
    }
    return integration;
  }

  async isConnected(userId: string): Promise<boolean> {
    const integration = await this.prisma.client.integration.findUnique({
      where: { userId_provider: { userId, provider: MICROSOFT_CALENDAR } },
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
        `Refreshing Microsoft Calendar token for user ${integration.userId}`,
      );

      const response = await fetch(
        `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/token`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'refresh_token',
            client_id: process.env.MICROSOFT_CALENDAR_CLIENT_ID || '',
            client_secret: process.env.MICROSOFT_CALENDAR_CLIENT_SECRET || '',
            refresh_token: integration.refreshToken || '',
            scope: 'Calendars.Read User.Read offline_access',
          }),
        },
      );

      if (!response.ok) {
        const error = await response.text();
        this.logger.error(`Failed to refresh Microsoft token: ${error}`);
        await this.prisma.client.integration.update({
          where: { id: integration.id },
          data: { status: 'EXPIRED' },
        });
        throw new UnauthorizedException(
          'Failed to refresh Microsoft token. Please reconnect.',
        );
      }

      const data = (await response.json()) as MicrosoftTokenResponse;
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
    const clientId = process.env.MICROSOFT_CALENDAR_CLIENT_ID;
    const redirectUri =
      process.env.MICROSOFT_CALENDAR_REDIRECT_URI ||
      'http://localhost:8000/api/calendar/microsoft/callback';

    if (!clientId) {
      throw new BadRequestException(
        'Microsoft Calendar client ID not configured',
      );
    }

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: 'Calendars.Read User.Read offline_access',
      prompt: 'select_account',
      response_mode: 'query',
      state: userId,
    });

    return {
      authUrl: `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/authorize?${params.toString()}`,
    };
  }

  async handleCallback(code: string, state: string) {
    if (!code) throw new BadRequestException('Authorization code is required');
    if (!state) throw new BadRequestException('State parameter is required');

    const userId = state;
    this.logger.log(`Microsoft Calendar callback for user ${userId}`);

    const tokenResponse = await fetch(
      `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          client_id: process.env.MICROSOFT_CALENDAR_CLIENT_ID || '',
          client_secret: process.env.MICROSOFT_CALENDAR_CLIENT_SECRET || '',
          redirect_uri:
            process.env.MICROSOFT_CALENDAR_REDIRECT_URI ||
            'http://localhost:8000/api/calendar/microsoft/callback',
          scope: 'Calendars.Read User.Read offline_access',
        }),
      },
    );

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      this.logger.error(`Failed to exchange Microsoft code: ${error}`);
      throw new BadRequestException('Failed to connect Microsoft Calendar');
    }

    const tokenData = (await tokenResponse.json()) as MicrosoftTokenResponse;

    const userInfoResponse = await fetch(
      'https://graph.microsoft.com/v1.0/me',
      {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      },
    );

    const userInfo = (await userInfoResponse.json()) as {
      id?: string;
      mail?: string;
      userPrincipalName?: string;
    };

    await this.prisma.client.integration.upsert({
      where: { userId_provider: { userId, provider: MICROSOFT_CALENDAR } },
      create: {
        userId,
        provider: MICROSOFT_CALENDAR,
        status: 'CONNECTED',
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt: new Date(Date.now() + (tokenData.expires_in ?? 3600) * 1000),
        providerId: userInfo.id,
        providerEmail: userInfo.mail ?? userInfo.userPrincipalName,
      },
      update: {
        status: 'CONNECTED',
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt: new Date(Date.now() + (tokenData.expires_in ?? 3600) * 1000),
        providerId: userInfo.id,
        providerEmail: userInfo.mail ?? userInfo.userPrincipalName,
      },
    });

    this.logger.log(`Microsoft Calendar connected for user ${userId}`);
    return { success: true, userId };
  }

  async getStatus(userId: string) {
    const integration = await this.prisma.client.integration.findUnique({
      where: { userId_provider: { userId, provider: MICROSOFT_CALENDAR } },
      select: {
        id: true,
        status: true,
        providerEmail: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!integration) {
      return {
        connected: false,
        status: 'NOT_CONNECTED',
        provider: 'microsoft',
      };
    }

    return {
      ...integration,
      connected: integration.status === 'CONNECTED',
      provider: 'microsoft' as const,
    };
  }

  async getEvents(
    userId: string,
    opts: { from?: string; to?: string; maxResults?: number } = {},
  ): Promise<CalendarEvent[]> {
    const integration = await this.getIntegration(userId);
    const accessToken = await this.refreshTokenIfNeeded(integration);
    if (!accessToken) {
      throw new UnauthorizedException(
        'Microsoft Calendar access token missing',
      );
    }

    const from = opts.from ?? new Date().toISOString();
    const to = opts.to ?? new Date(Date.now() + 7 * 86400_000).toISOString();

    const params = new URLSearchParams({
      startDateTime: from,
      endDateTime: to,
      $top: String(opts.maxResults ?? 50),
      $orderby: 'start/dateTime asc',
    });

    const response = await fetch(
      `https://graph.microsoft.com/v1.0/me/calendarView?${params.toString()}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`Microsoft Graph API error: ${error}`);
      if (response.status === 401) {
        await this.prisma.client.integration.update({
          where: { id: integration.id },
          data: { status: 'EXPIRED' },
        });
        throw new UnauthorizedException(
          'Microsoft Calendar token expired. Please reconnect.',
        );
      }
      throw new BadRequestException(
        'Failed to fetch Microsoft Calendar events',
      );
    }

    const data = (await response.json()) as MicrosoftEventsListResponse;
    return (data.value ?? []).map((e) => this.normalizeEvent(e));
  }

  async disconnect(userId: string) {
    await this.prisma.client.integration.update({
      where: { userId_provider: { userId, provider: MICROSOFT_CALENDAR } },
      data: {
        status: 'DISCONNECTED',
        accessToken: null,
        refreshToken: null,
        expiresAt: null,
      },
    });
    return { success: true, message: 'Microsoft Calendar disconnected' };
  }

  private normalizeEvent(e: MicrosoftCalendarApiEvent): CalendarEvent {
    const startRaw = e.start?.dateTime
      ? new Date(e.start.dateTime).toISOString()
      : '';
    const endRaw = e.end?.dateTime
      ? new Date(e.end.dateTime).toISOString()
      : '';

    const statusMap: Record<string, CalendarEvent['status']> = {
      free: 'confirmed',
      busy: 'confirmed',
      tentative: 'tentative',
      oof: 'confirmed',
      workingElsewhere: 'confirmed',
    };

    return {
      id: e.id,
      title: e.subject ?? '(No title)',
      description: e.body?.content,
      startTime: startRaw,
      endTime: endRaw,
      attendees: (e.attendees ?? []).map((a) => ({
        email: a.emailAddress?.address ?? '',
        name: a.emailAddress?.name,
      })),
      location: e.location?.displayName,
      meetingUrl: e.onlineMeeting?.joinUrl,
      provider: 'microsoft',
      isAllDay: e.isAllDay ?? false,
      status: statusMap[e.showAs ?? ''] ?? 'confirmed',
      organizerEmail: e.organizer?.emailAddress?.address,
      htmlLink: e.webLink,
    };
  }
}
