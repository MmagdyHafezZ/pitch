import {
  Injectable,
  Logger,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from './prisma.service';
import * as crypto from 'crypto';
import type { Integration, Prisma } from '@prisma/crm-client';

type SalesforceRecord = Record<string, unknown>;

interface SalesforceTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  instance_url?: string;
}

interface SalesforceUserInfoResponse {
  user_id: string;
  email?: string;
  name?: string;
}

interface SalesforceQueryResult<
  TRecord extends SalesforceRecord = SalesforceRecord,
> {
  totalSize?: number;
  done?: boolean;
  records: TRecord[];
}

/**
 * Salesforce Integration Service
 *
 * Handles Salesforce API interactions using stored OAuth tokens.
 * Provides LIVE data from Salesforce API (not stored locally).
 * Automatically refreshes expired tokens.
 * Stores only OAuth tokens in PostgreSQL database via Prisma.
 *
 * This service is called by the CRM controller via RabbitMQ message patterns.
 */
@Injectable()
export class SalesforceIntegrationService {
  private readonly logger = new Logger(SalesforceIntegrationService.name);
  private readonly SALESFORCE_API_VERSION = 'v58.0';

  // Store code verifiers temporarily (in production, use Redis)
  private codeVerifiers = new Map<string, string>();

  constructor(private readonly prisma: PrismaService) {
    this.logger.log(
      'Salesforce Integration Service initialized with Prisma database',
    );
  }

  /**
   * Get Salesforce integration for a user
   */
  async getIntegration(userId: string): Promise<Integration> {
    const integration = await this.prisma.client.integration.findUnique({
      where: {
        userId_provider: {
          userId,
          provider: 'SALESFORCE',
        },
      },
    });

    if (!integration) {
      throw new UnauthorizedException('Salesforce integration not connected');
    }

    if (integration.status === 'DISCONNECTED') {
      throw new UnauthorizedException('Salesforce integration is disconnected');
    }

    if (integration.status === 'ERROR' || integration.status === 'EXPIRED') {
      throw new UnauthorizedException(
        'Salesforce integration has errors. Please reconnect.',
      );
    }

    return integration;
  }

  /**
   * Check if user has Salesforce connected
   */
  async isConnected(userId: string): Promise<boolean> {
    const integration = await this.prisma.client.integration.findUnique({
      where: {
        userId_provider: {
          userId,
          provider: 'SALESFORCE',
        },
      },
    });

    return integration?.status === 'CONNECTED';
  }

  /**
   * Refresh Salesforce access token if expired
   */
  private async refreshTokenIfNeeded(
    integration: Integration,
  ): Promise<string | null> {
    const now = new Date();

    // Check if token is expired or will expire in next 5 minutes
    if (
      integration.expiresAt &&
      integration.expiresAt <= new Date(now.getTime() + 5 * 60 * 1000)
    ) {
      this.logger.log(
        `Refreshing Salesforce token for user ${integration.userId}`,
      );

      try {
        const response = await fetch(
          'https://login.salesforce.com/services/oauth2/token',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              grant_type: 'refresh_token',
              client_id: process.env.SALESFORCE_CLIENT_ID || '',
              client_secret: process.env.SALESFORCE_CLIENT_SECRET || '',
              refresh_token: integration.refreshToken || '',
            }),
          },
        );

        if (!response.ok) {
          const error = await response.text();
          this.logger.error(`Failed to refresh Salesforce token: ${error}`);

          // Mark integration as expired
          await this.prisma.client.integration.update({
            where: { id: integration.id },
            data: { status: 'EXPIRED' },
          });

          throw new UnauthorizedException(
            'Failed to refresh Salesforce token. Please reconnect.',
          );
        }

        const data = (await response.json()) as SalesforceTokenResponse;

        // Update token in database
        await this.prisma.client.integration.update({
          where: { id: integration.id },
          data: {
            accessToken: data.access_token,
            expiresAt: new Date(Date.now() + (data.expires_in || 3600) * 1000),
            status: 'CONNECTED',
          },
        });

        return data.access_token;
      } catch (error) {
        this.logger.error('Error refreshing Salesforce token:', error);
        throw new UnauthorizedException('Failed to refresh Salesforce token');
      }
    }

    return integration.accessToken ?? null;
  }

  /**
   * Make authenticated request to Salesforce API
   */
  private async makeRequest<TResponse>(
    userId: string,
    endpoint: string,
    options: RequestInit = {},
  ): Promise<TResponse> {
    const integration = await this.getIntegration(userId);
    const accessToken = await this.refreshTokenIfNeeded(integration);
    if (!accessToken) {
      throw new UnauthorizedException('Salesforce access token is missing');
    }

    const instanceUrl =
      integration.instanceUrl || 'https://login.salesforce.com';
    const url = `${instanceUrl}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`Salesforce API error: ${error}`);

      if (response.status === 401) {
        // Mark as expired and throw
        await this.prisma.client.integration.update({
          where: { id: integration.id },
          data: { status: 'EXPIRED' },
        });
        throw new UnauthorizedException(
          'Salesforce token expired. Please reconnect.',
        );
      }

      throw new BadRequestException(
        `Salesforce API error: ${response.status} ${response.statusText}`,
      );
    }

    const data = (await response.json()) as TResponse;
    return data;
  }

  /**
   * Generate code verifier and challenge for PKCE
   */
  private generatePKCE() {
    // Generate random code verifier (43-128 characters)
    const codeVerifier = crypto.randomBytes(32).toString('base64url');

    // Generate code challenge (SHA256 hash of verifier)
    const codeChallenge = crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');

    return { codeVerifier, codeChallenge };
  }

  /**
   * Generate OAuth URL for connecting Salesforce
   */
  getConnectUrl(userId: string, state?: string) {
    const clientId = process.env.SALESFORCE_CLIENT_ID;
    const redirectUri =
      process.env.SALESFORCE_REDIRECT_URI ||
      'http://localhost:8000/api/crm/salesforce/callback';

    if (!clientId) {
      throw new BadRequestException('Salesforce client ID not configured');
    }

    const stateParam = state || userId;

    // Build Salesforce OAuth URL (without PKCE for now)
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: 'api refresh_token openid id',
      state: stateParam, // Pass userId in state to retrieve after callback
    });

    const authUrl = `https://login.salesforce.com/services/oauth2/authorize?${params.toString()}`;

    return {
      authUrl,
      message: 'Redirect user to this URL to connect Salesforce',
    };
  }

  /**
   * Handle OAuth callback and store tokens
   */
  async handleCallback(code: string, state: string) {
    if (!code) {
      throw new BadRequestException('Authorization code is required');
    }

    if (!state) {
      throw new BadRequestException('State parameter is required');
    }

    const userId = state; // userId was passed in state
    this.logger.log(`Salesforce callback for user ${userId}`);

    try {
      // Exchange code for tokens (standard OAuth flow without PKCE)
      const tokenParams: Record<string, string> = {
        grant_type: 'authorization_code',
        code,
        client_id: process.env.SALESFORCE_CLIENT_ID || '',
        client_secret: process.env.SALESFORCE_CLIENT_SECRET || '',
        redirect_uri:
          process.env.SALESFORCE_REDIRECT_URI ||
          'http://localhost:8000/api/crm/salesforce/callback',
      };

      const tokenResponse = await fetch(
        'https://login.salesforce.com/services/oauth2/token',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams(tokenParams),
        },
      );

      if (!tokenResponse.ok) {
        const error = await tokenResponse.text();
        this.logger.error(`Failed to exchange code for token: ${error}`);
        throw new BadRequestException('Failed to connect to Salesforce');
      }

      const tokenData = (await tokenResponse.json()) as SalesforceTokenResponse;

      // Get user info from Salesforce
      const userInfoResponse = await fetch(
        `${tokenData.instance_url}/services/oauth2/userinfo`,
        {
          headers: {
            Authorization: `Bearer ${tokenData.access_token}`,
          },
        },
      );

      const userInfo =
        (await userInfoResponse.json()) as SalesforceUserInfoResponse;
      const providerData = userInfo as unknown as Prisma.InputJsonValue;

      // Store integration in database
      await this.prisma.client.integration.upsert({
        where: {
          userId_provider: {
            userId,
            provider: 'SALESFORCE',
          },
        },
        create: {
          userId,
          provider: 'SALESFORCE',
          status: 'CONNECTED',
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token,
          expiresAt: new Date(
            Date.now() + (tokenData.expires_in ?? 3600) * 1000,
          ),
          instanceUrl: tokenData.instance_url,
          providerId: userInfo.user_id,
          providerEmail: userInfo.email,
          providerData,
        },
        update: {
          status: 'CONNECTED',
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token,
          expiresAt: new Date(
            Date.now() + (tokenData.expires_in ?? 3600) * 1000,
          ),
          instanceUrl: tokenData.instance_url,
          providerId: userInfo.user_id,
          providerEmail: userInfo.email,
          providerData,
        },
      });

      this.logger.log(`Salesforce connected successfully for user ${userId}`);

      return {
        success: true,
        message: 'Salesforce connected successfully',
        user: {
          email: userInfo.email,
          name: userInfo.name,
        },
      };
    } catch (error) {
      this.logger.error('Error in Salesforce callback:', error);
      throw new BadRequestException('Failed to connect Salesforce');
    }
  }

  /**
   * Get integration status
   */
  async getStatus(userId: string) {
    const integration = await this.prisma.client.integration.findUnique({
      where: {
        userId_provider: {
          userId,
          provider: 'SALESFORCE',
        },
      },
      select: {
        id: true,
        status: true,
        providerEmail: true,
        instanceUrl: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!integration) {
      return {
        connected: false,
        status: 'NOT_CONNECTED',
      };
    }

    return {
      connected: integration.status === 'CONNECTED',
      ...integration,
    };
  }

  /**
   * Query Salesforce using SOQL
   */
  async query(userId: string, soql: string): Promise<SalesforceQueryResult> {
    this.logger.log(`Executing SOQL query for user ${userId}`);

    const encodedQuery = encodeURIComponent(soql);
    const endpoint = `/services/data/${this.SALESFORCE_API_VERSION}/query?q=${encodedQuery}`;

    return this.makeRequest<SalesforceQueryResult>(userId, endpoint);
  }

  /**
   * Get Salesforce Accounts (Companies)
   */
  async getAccounts(
    userId: string,
    limit: number = 100,
  ): Promise<SalesforceRecord[]> {
    const soql = `SELECT Id, Name, Industry, Type, Phone, Website, BillingCity, BillingState, BillingCountry, CreatedDate FROM Account ORDER BY CreatedDate DESC LIMIT ${limit}`;
    const result = await this.query(userId, soql);
    return result.records;
  }

  /**
   * Get Salesforce Contacts
   */
  async getContacts(
    userId: string,
    limit: number = 100,
  ): Promise<SalesforceRecord[]> {
    const soql = `SELECT Id, FirstName, LastName, Email, Phone, Title, AccountId, Account.Name, CreatedDate FROM Contact ORDER BY CreatedDate DESC LIMIT ${limit}`;
    const result = await this.query(userId, soql);
    return result.records;
  }

  /**
   * Get Salesforce Opportunities
   */
  async getOpportunities(
    userId: string,
    limit: number = 100,
  ): Promise<SalesforceRecord[]> {
    const soql = `SELECT Id, Name, StageName, Amount, CloseDate, Probability, AccountId, Account.Name, CreatedDate FROM Opportunity ORDER BY CreatedDate DESC LIMIT ${limit}`;
    const result = await this.query(userId, soql);
    return result.records;
  }

  /**
   * Get Salesforce Leads
   */
  async getLeads(
    userId: string,
    limit: number = 100,
  ): Promise<SalesforceRecord[]> {
    const soql = `SELECT Id, FirstName, LastName, Company, Email, Phone, Status, LeadSource, CreatedDate FROM Lead ORDER BY CreatedDate DESC LIMIT ${limit}`;
    const result = await this.query(userId, soql);
    return result.records;
  }

  /**
   * Search Salesforce using SOSL
   */
  async search(
    userId: string,
    searchQuery: string,
  ): Promise<SalesforceRecord[]> {
    this.logger.log(`Executing SOSL search for user ${userId}: ${searchQuery}`);

    const encodedQuery = encodeURIComponent(searchQuery);
    const endpoint = `/services/data/${this.SALESFORCE_API_VERSION}/search?q=${encodedQuery}`;

    return this.makeRequest<SalesforceRecord[]>(userId, endpoint);
  }

  /**
   * Disconnect Salesforce integration
   */
  async disconnect(userId: string) {
    this.logger.log(`Disconnecting Salesforce for user ${userId}`);

    await this.prisma.client.integration.update({
      where: {
        userId_provider: {
          userId,
          provider: 'SALESFORCE',
        },
      },
      data: {
        status: 'DISCONNECTED',
        accessToken: null,
        refreshToken: null,
        expiresAt: null,
      },
    });

    return { success: true, message: 'Salesforce disconnected successfully' };
  }
}
