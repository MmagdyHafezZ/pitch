import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { SalesforceIntegrationService } from '../services/salesforce-integration.service';

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

function buildPrisma() {
  return {
    client: {
      integration: {
        findUnique: jest.fn(),
        update: jest.fn(),
        upsert: jest.fn(),
      },
    },
  };
}

function buildIntegration(overrides: Record<string, unknown> = {}) {
  return {
    id: 'int-1',
    userId: 'u1',
    provider: 'SALESFORCE',
    status: 'CONNECTED',
    accessToken: 'access-tok',
    refreshToken: 'refresh-tok',
    expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1h from now
    instanceUrl: 'https://my.salesforce.com',
    providerId: 'sf-user-1',
    providerEmail: 'user@sf.com',
    providerData: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200, statusText = 'OK') {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    json: jest.fn().mockResolvedValue(body),
    text: jest.fn().mockResolvedValue(JSON.stringify(body)),
  };
}

describe('SalesforceIntegrationService', () => {
  let service: SalesforceIntegrationService;
  let prisma: ReturnType<typeof buildPrisma>;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = buildPrisma();
    service = new SalesforceIntegrationService(prisma as any);

    process.env.SALESFORCE_CLIENT_ID = 'test-client-id';
    process.env.SALESFORCE_CLIENT_SECRET = 'test-client-secret';
    process.env.SALESFORCE_REDIRECT_URI =
      'http://localhost:8000/api/crm/salesforce/callback';
  });

  afterEach(() => {
    delete process.env.SALESFORCE_CLIENT_ID;
    delete process.env.SALESFORCE_CLIENT_SECRET;
    delete process.env.SALESFORCE_REDIRECT_URI;
  });

  // ───────────────────────────── getIntegration ─────────────────────────────

  describe('getIntegration', () => {
    it('should return integration when connected', async () => {
      const integration = buildIntegration();
      prisma.client.integration.findUnique.mockResolvedValue(integration);

      const result = await service.getIntegration('u1');
      expect(result).toEqual(integration);
    });

    it('should throw UnauthorizedException when not found', async () => {
      prisma.client.integration.findUnique.mockResolvedValue(null);

      await expect(service.getIntegration('u1')).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.getIntegration('u1')).rejects.toThrow(
        'Salesforce integration not connected',
      );
    });

    it('should throw when status is DISCONNECTED', async () => {
      prisma.client.integration.findUnique.mockResolvedValue(
        buildIntegration({ status: 'DISCONNECTED' }),
      );

      await expect(service.getIntegration('u1')).rejects.toThrow(
        'Salesforce integration is disconnected',
      );
    });

    it('should throw when status is ERROR', async () => {
      prisma.client.integration.findUnique.mockResolvedValue(
        buildIntegration({ status: 'ERROR' }),
      );

      await expect(service.getIntegration('u1')).rejects.toThrow(
        'Please reconnect',
      );
    });

    it('should throw when status is EXPIRED', async () => {
      prisma.client.integration.findUnique.mockResolvedValue(
        buildIntegration({ status: 'EXPIRED' }),
      );

      await expect(service.getIntegration('u1')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  // ────────────────────────────── isConnected ──────────────────────────────

  describe('isConnected', () => {
    it('should return true when connected', async () => {
      prisma.client.integration.findUnique.mockResolvedValue(
        buildIntegration({ status: 'CONNECTED' }),
      );

      await expect(service.isConnected('u1')).resolves.toBe(true);
    });

    it('should return false when disconnected', async () => {
      prisma.client.integration.findUnique.mockResolvedValue(
        buildIntegration({ status: 'DISCONNECTED' }),
      );

      await expect(service.isConnected('u1')).resolves.toBe(false);
    });

    it('should return false when no integration exists', async () => {
      prisma.client.integration.findUnique.mockResolvedValue(null);

      await expect(service.isConnected('u1')).resolves.toBe(false);
    });
  });

  // ────────────────────────────── getConnectUrl ──────────────────────────────

  describe('getConnectUrl', () => {
    it('should return OAuth URL with correct params', () => {
      const result = service.getConnectUrl('u1', 'custom-state');

      expect(result.authUrl).toContain(
        'https://login.salesforce.com/services/oauth2/authorize',
      );
      expect(result.authUrl).toContain('client_id=test-client-id');
      expect(result.authUrl).toContain('state=custom-state');
      expect(result.authUrl).toContain('response_type=code');
      expect(result.message).toBeDefined();
    });

    it('should default state to userId when not provided', () => {
      const result = service.getConnectUrl('u1');

      expect(result.authUrl).toContain('state=u1');
    });

    it('should throw BadRequestException when client ID not configured', () => {
      delete process.env.SALESFORCE_CLIENT_ID;

      expect(() => service.getConnectUrl('u1')).toThrow(BadRequestException);
      expect(() => service.getConnectUrl('u1')).toThrow(
        'Salesforce client ID not configured',
      );
    });

    it('should use default redirect URI when env var not set', () => {
      delete process.env.SALESFORCE_REDIRECT_URI;

      const result = service.getConnectUrl('u1');
      expect(result.authUrl).toContain(
        encodeURIComponent('http://localhost:8000/api/crm/salesforce/callback'),
      );
    });
  });

  // ───────────────────────────── handleCallback ─────────────────────────────

  describe('handleCallback', () => {
    it('should exchange code for tokens and store integration', async () => {
      const tokenData = {
        access_token: 'new-access',
        refresh_token: 'new-refresh',
        expires_in: 7200,
        instance_url: 'https://my.salesforce.com',
      };
      const userInfo = {
        user_id: 'sf-123',
        email: 'user@sf.com',
        name: 'Test User',
      };

      mockFetch
        .mockResolvedValueOnce(jsonResponse(tokenData))
        .mockResolvedValueOnce(jsonResponse(userInfo));

      prisma.client.integration.upsert.mockResolvedValue(buildIntegration());

      const result = await service.handleCallback('auth-code', 'u1');

      expect(result.success).toBe(true);
      expect(result.user.email).toBe('user@sf.com');
      expect(result.user.name).toBe('Test User');

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(prisma.client.integration.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId_provider: { userId: 'u1', provider: 'SALESFORCE' } },
          create: expect.objectContaining({
            userId: 'u1',
            provider: 'SALESFORCE',
            status: 'CONNECTED',
            accessToken: 'new-access',
            refreshToken: 'new-refresh',
            instanceUrl: 'https://my.salesforce.com',
            providerId: 'sf-123',
            providerEmail: 'user@sf.com',
          }),
          update: expect.objectContaining({
            status: 'CONNECTED',
            accessToken: 'new-access',
          }),
        }),
      );
    });

    it('should throw BadRequestException when code is empty', async () => {
      await expect(service.handleCallback('', 'u1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when state is empty', async () => {
      await expect(service.handleCallback('code', '')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when token exchange fails', async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ error: 'invalid_grant' }, 400, 'Bad Request'),
      );

      await expect(service.handleCallback('bad-code', 'u1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should use default expires_in when not provided in token response', async () => {
      const tokenData = {
        access_token: 'tok',
        instance_url: 'https://sf.com',
      };
      const userInfo = { user_id: 'sf-1', email: 'a@b.com', name: 'N' };

      mockFetch
        .mockResolvedValueOnce(jsonResponse(tokenData))
        .mockResolvedValueOnce(jsonResponse(userInfo));
      prisma.client.integration.upsert.mockResolvedValue(buildIntegration());

      await service.handleCallback('code', 'u1');

      const upsertCall = prisma.client.integration.upsert.mock.calls[0][0];
      const createExpiry = upsertCall.create.expiresAt as Date;
      // Default 3600s = 1 hour — should be within ~2s of now+3600s
      expect(createExpiry.getTime()).toBeGreaterThan(Date.now() + 3500 * 1000);
      expect(createExpiry.getTime()).toBeLessThan(Date.now() + 3700 * 1000);
    });
  });

  // ─────────────────────────────── getStatus ───────────────────────────────

  describe('getStatus', () => {
    it('should return connected status with integration info', async () => {
      prisma.client.integration.findUnique.mockResolvedValue({
        id: 'int-1',
        status: 'CONNECTED',
        providerEmail: 'a@b.com',
        instanceUrl: 'https://sf.com',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.getStatus('u1');
      expect(result.connected).toBe(true);
      expect(result.status).toBe('CONNECTED');
      expect(result.providerEmail).toBe('a@b.com');
    });

    it('should return not connected when no integration found', async () => {
      prisma.client.integration.findUnique.mockResolvedValue(null);

      const result = await service.getStatus('u1');
      expect(result).toEqual({ connected: false, status: 'NOT_CONNECTED' });
    });

    it('should return connected false when status is EXPIRED', async () => {
      prisma.client.integration.findUnique.mockResolvedValue({
        id: 'int-1',
        status: 'EXPIRED',
        providerEmail: 'a@b.com',
        instanceUrl: 'https://sf.com',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.getStatus('u1');
      expect(result.connected).toBe(false);
    });
  });

  // ──────────────────────────────── query ────────────────────────────────

  describe('query', () => {
    it('should execute SOQL query via Salesforce API', async () => {
      const integration = buildIntegration();
      prisma.client.integration.findUnique.mockResolvedValue(integration);

      const queryResult = { totalSize: 1, done: true, records: [{ Id: 'r1' }] };
      mockFetch.mockResolvedValueOnce(jsonResponse(queryResult));

      const result = await service.query('u1', 'SELECT Id FROM Account');

      expect(result).toEqual(queryResult);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/services/data/v58.0/query?q='),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer access-tok',
          }),
        }),
      );
    });

    it('should encode SOQL query in URL', async () => {
      prisma.client.integration.findUnique.mockResolvedValue(
        buildIntegration(),
      );
      mockFetch.mockResolvedValueOnce(jsonResponse({ records: [] }));

      await service.query('u1', "SELECT Id FROM Account WHERE Name = 'Test'");

      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain(
        encodeURIComponent("SELECT Id FROM Account WHERE Name = 'Test'"),
      );
    });

    it('should throw UnauthorizedException when not connected', async () => {
      prisma.client.integration.findUnique.mockResolvedValue(null);

      await expect(
        service.query('u1', 'SELECT Id FROM Account'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  // ──────────────────────────── getAccounts ─────────────────────────────

  describe('getAccounts', () => {
    it('should return account records with default limit', async () => {
      prisma.client.integration.findUnique.mockResolvedValue(
        buildIntegration(),
      );
      const records = [{ Id: 'a1', Name: 'Acme' }];
      mockFetch.mockResolvedValueOnce(jsonResponse({ records }));

      const result = await service.getAccounts('u1');
      expect(result).toEqual(records);

      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain('LIMIT%20100');
    });

    it('should use custom limit', async () => {
      prisma.client.integration.findUnique.mockResolvedValue(
        buildIntegration(),
      );
      mockFetch.mockResolvedValueOnce(jsonResponse({ records: [] }));

      await service.getAccounts('u1', 10);

      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain('LIMIT%2010');
    });
  });

  // ──────────────────────────── getContacts ─────────────────────────────

  describe('getContacts', () => {
    it('should return contact records', async () => {
      prisma.client.integration.findUnique.mockResolvedValue(
        buildIntegration(),
      );
      const records = [{ Id: 'c1', FirstName: 'John' }];
      mockFetch.mockResolvedValueOnce(jsonResponse({ records }));

      const result = await service.getContacts('u1', 50);
      expect(result).toEqual(records);

      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain('Contact');
      expect(url).toContain('LIMIT%2050');
    });
  });

  // ─────────────────────────── getOpportunities ──────────────────────────

  describe('getOpportunities', () => {
    it('should return opportunity records', async () => {
      prisma.client.integration.findUnique.mockResolvedValue(
        buildIntegration(),
      );
      const records = [{ Id: 'o1', Name: 'Deal' }];
      mockFetch.mockResolvedValueOnce(jsonResponse({ records }));

      const result = await service.getOpportunities('u1');
      expect(result).toEqual(records);

      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain('Opportunity');
    });
  });

  // ──────────────────────────── getLeads ────────────────────────────────

  describe('getLeads', () => {
    it('should return lead records', async () => {
      prisma.client.integration.findUnique.mockResolvedValue(
        buildIntegration(),
      );
      const records = [{ Id: 'l1', Company: 'Co' }];
      mockFetch.mockResolvedValueOnce(jsonResponse({ records }));

      const result = await service.getLeads('u1', 25);
      expect(result).toEqual(records);

      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain('Lead');
      expect(url).toContain('LIMIT%2025');
    });
  });

  // ──────────────────────────── search ──────────────────────────────────

  describe('search', () => {
    it('should execute SOSL search via Salesforce API', async () => {
      prisma.client.integration.findUnique.mockResolvedValue(
        buildIntegration(),
      );
      const results = [{ Id: 's1' }];
      mockFetch.mockResolvedValueOnce(jsonResponse(results));

      const result = await service.search('u1', 'FIND {test}');
      expect(result).toEqual(results);

      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain('/services/data/v58.0/search');
    });

    it('should encode search query', async () => {
      prisma.client.integration.findUnique.mockResolvedValue(
        buildIntegration(),
      );
      mockFetch.mockResolvedValueOnce(jsonResponse([]));

      await service.search('u1', 'FIND {hello world}');

      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain(encodeURIComponent('FIND {hello world}'));
    });
  });

  // ─────────────────────────── disconnect ───────────────────────────────

  describe('disconnect', () => {
    it('should update integration to disconnected and clear tokens', async () => {
      prisma.client.integration.update.mockResolvedValue(
        buildIntegration({ status: 'DISCONNECTED' }),
      );

      const result = await service.disconnect('u1');

      expect(result).toEqual({
        success: true,
        message: 'Salesforce disconnected successfully',
      });
      expect(prisma.client.integration.update).toHaveBeenCalledWith({
        where: { userId_provider: { userId: 'u1', provider: 'SALESFORCE' } },
        data: {
          status: 'DISCONNECTED',
          accessToken: null,
          refreshToken: null,
          expiresAt: null,
        },
      });
    });
  });

  // ───────────────────── refreshTokenIfNeeded (private, tested via makeRequest) ──────

  describe('token refresh (via query)', () => {
    it('should refresh token when expired and use new token', async () => {
      const expiredIntegration = buildIntegration({
        expiresAt: new Date(Date.now() - 60_000), // expired 1 min ago
      });
      prisma.client.integration.findUnique.mockResolvedValue(
        expiredIntegration,
      );

      const refreshResponse = {
        access_token: 'refreshed-tok',
        expires_in: 3600,
      };
      const queryResult = { records: [{ Id: 'r1' }] };

      mockFetch
        .mockResolvedValueOnce(jsonResponse(refreshResponse)) // token refresh
        .mockResolvedValueOnce(jsonResponse(queryResult)); // actual query

      prisma.client.integration.update.mockResolvedValue(
        buildIntegration({ accessToken: 'refreshed-tok' }),
      );

      const result = await service.query('u1', 'SELECT Id FROM Account');
      expect(result).toEqual(queryResult);

      // First fetch = token refresh, second = actual query
      expect(mockFetch).toHaveBeenCalledTimes(2);
      const queryFetchCall = mockFetch.mock.calls[1];
      expect(queryFetchCall[1].headers.Authorization).toBe(
        'Bearer refreshed-tok',
      );
    });

    it('should refresh token when about to expire within 5 minutes', async () => {
      const soonExpiring = buildIntegration({
        expiresAt: new Date(Date.now() + 2 * 60 * 1000), // 2 min from now
      });
      prisma.client.integration.findUnique.mockResolvedValue(soonExpiring);

      mockFetch
        .mockResolvedValueOnce(
          jsonResponse({ access_token: 'new-tok', expires_in: 3600 }),
        )
        .mockResolvedValueOnce(jsonResponse({ records: [] }));

      prisma.client.integration.update.mockResolvedValue(buildIntegration());

      await service.query('u1', 'SELECT Id FROM Account');

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should not refresh when token is still valid', async () => {
      const validIntegration = buildIntegration({
        expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 min from now
      });
      prisma.client.integration.findUnique.mockResolvedValue(validIntegration);
      mockFetch.mockResolvedValueOnce(jsonResponse({ records: [] }));

      await service.query('u1', 'SELECT Id FROM Account');

      expect(mockFetch).toHaveBeenCalledTimes(1); // only the query, no refresh
    });

    it('should mark integration as EXPIRED when refresh fails', async () => {
      const expiredIntegration = buildIntegration({
        expiresAt: new Date(Date.now() - 60_000),
      });
      prisma.client.integration.findUnique.mockResolvedValue(
        expiredIntegration,
      );

      mockFetch.mockResolvedValueOnce(
        jsonResponse({ error: 'invalid_grant' }, 400, 'Bad Request'),
      );
      prisma.client.integration.update.mockResolvedValue(
        buildIntegration({ status: 'EXPIRED' }),
      );

      await expect(
        service.query('u1', 'SELECT Id FROM Account'),
      ).rejects.toThrow(UnauthorizedException);
      expect(prisma.client.integration.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: 'EXPIRED' },
        }),
      );
    });

    it('should throw when accessToken is null and token is not expired', async () => {
      const noTokenIntegration = buildIntegration({
        accessToken: null,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      });
      prisma.client.integration.findUnique.mockResolvedValue(
        noTokenIntegration,
      );

      await expect(
        service.query('u1', 'SELECT Id FROM Account'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  // ───────────────────── makeRequest error handling (via query) ─────────────────

  describe('makeRequest error handling (via query)', () => {
    it('should mark as EXPIRED and throw on 401 response', async () => {
      prisma.client.integration.findUnique.mockResolvedValue(
        buildIntegration(),
      );
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ error: 'Unauthorized' }, 401, 'Unauthorized'),
      );
      prisma.client.integration.update.mockResolvedValue(
        buildIntegration({ status: 'EXPIRED' }),
      );

      await expect(
        service.query('u1', 'SELECT Id FROM Account'),
      ).rejects.toThrow(UnauthorizedException);
      expect(prisma.client.integration.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: 'EXPIRED' },
        }),
      );
    });

    it('should throw BadRequestException on non-401 error response', async () => {
      prisma.client.integration.findUnique.mockResolvedValue(
        buildIntegration(),
      );
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ error: 'bad' }, 500, 'Internal Server Error'),
      );

      await expect(
        service.query('u1', 'SELECT Id FROM Account'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should use default instance URL when not set on integration', async () => {
      prisma.client.integration.findUnique.mockResolvedValue(
        buildIntegration({ instanceUrl: null }),
      );
      mockFetch.mockResolvedValueOnce(jsonResponse({ records: [] }));

      await service.query('u1', 'SELECT Id FROM Account');

      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain('https://login.salesforce.com');
    });
  });

  // ────────────────────── refreshTokenIfNeeded with null expiresAt ────────────────

  describe('token with null expiresAt', () => {
    it('should skip refresh and return accessToken when expiresAt is null', async () => {
      const integration = buildIntegration({ expiresAt: null });
      prisma.client.integration.findUnique.mockResolvedValue(integration);
      mockFetch.mockResolvedValueOnce(jsonResponse({ records: [] }));

      await service.query('u1', 'SELECT Id FROM Account');

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  // ──────────────── additional branch coverage: env var & nullish fallbacks ───────

  describe('token refresh edge cases', () => {
    it('should use fallback when refresh response has no expires_in', async () => {
      const expired = buildIntegration({
        expiresAt: new Date(Date.now() - 60_000),
      });
      prisma.client.integration.findUnique.mockResolvedValue(expired);

      mockFetch
        .mockResolvedValueOnce(jsonResponse({ access_token: 'new-tok' }))
        .mockResolvedValueOnce(jsonResponse({ records: [] }));
      prisma.client.integration.update.mockResolvedValue(buildIntegration());

      await service.query('u1', 'SELECT Id FROM Account');

      const updateCall = prisma.client.integration.update.mock.calls[0][0];
      const expiresAt = updateCall.data.expiresAt as Date;
      expect(expiresAt.getTime()).toBeGreaterThan(Date.now() + 3500 * 1000);
      expect(expiresAt.getTime()).toBeLessThan(Date.now() + 3700 * 1000);
    });

    it('should handle null refreshToken in integration during refresh', async () => {
      const expired = buildIntegration({
        expiresAt: new Date(Date.now() - 60_000),
        refreshToken: null,
      });
      prisma.client.integration.findUnique.mockResolvedValue(expired);

      mockFetch
        .mockResolvedValueOnce(jsonResponse({ access_token: 'new' }))
        .mockResolvedValueOnce(jsonResponse({ records: [] }));
      prisma.client.integration.update.mockResolvedValue(buildIntegration());

      await service.query('u1', 'SELECT Id FROM Account');

      const refreshCall = mockFetch.mock.calls[0];
      const body = refreshCall[1].body as URLSearchParams;
      expect(body.get('refresh_token')).toBe('');
    });

    it('should throw when fetch itself throws during refresh', async () => {
      const expired = buildIntegration({
        expiresAt: new Date(Date.now() - 60_000),
      });
      prisma.client.integration.findUnique.mockResolvedValue(expired);

      mockFetch.mockRejectedValueOnce(new Error('network error'));

      await expect(
        service.query('u1', 'SELECT Id FROM Account'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('handleCallback env var fallbacks', () => {
    it('should use empty strings when env vars are unset', async () => {
      delete process.env.SALESFORCE_CLIENT_ID;
      delete process.env.SALESFORCE_CLIENT_SECRET;
      delete process.env.SALESFORCE_REDIRECT_URI;

      const tokenData = {
        access_token: 'tok',
        refresh_token: 'ref',
        instance_url: 'https://sf.com',
      };
      const userInfo = { user_id: 'sf-1', email: 'a@b.com', name: 'N' };

      mockFetch
        .mockResolvedValueOnce(jsonResponse(tokenData))
        .mockResolvedValueOnce(jsonResponse(userInfo));
      prisma.client.integration.upsert.mockResolvedValue(buildIntegration());

      const result = await service.handleCallback('code', 'u1');
      expect(result.success).toBe(true);

      const tokenCall = mockFetch.mock.calls[0];
      const body = tokenCall[1].body as URLSearchParams;
      expect(body.get('client_id')).toBe('');
      expect(body.get('client_secret')).toBe('');
      expect(body.get('redirect_uri')).toBe(
        'http://localhost:8000/api/crm/salesforce/callback',
      );
    });

    it('should handle missing instance_url in token response', async () => {
      const tokenData = { access_token: 'tok' };
      const userInfo = { user_id: 'sf-1' };

      mockFetch
        .mockResolvedValueOnce(jsonResponse(tokenData))
        .mockResolvedValueOnce(jsonResponse(userInfo));
      prisma.client.integration.upsert.mockResolvedValue(buildIntegration());

      const result = await service.handleCallback('code', 'u1');
      expect(result.success).toBe(true);

      const upsertCall = prisma.client.integration.upsert.mock.calls[0][0];
      expect(upsertCall.create.instanceUrl).toBeUndefined();
      expect(upsertCall.create.refreshToken).toBeUndefined();
    });
  });

  describe('refreshTokenIfNeeded env var fallbacks', () => {
    it('should use empty strings when env vars are unset during refresh', async () => {
      delete process.env.SALESFORCE_CLIENT_ID;
      delete process.env.SALESFORCE_CLIENT_SECRET;

      const expired = buildIntegration({
        expiresAt: new Date(Date.now() - 60_000),
      });
      prisma.client.integration.findUnique.mockResolvedValue(expired);

      mockFetch
        .mockResolvedValueOnce(
          jsonResponse({ access_token: 'new', expires_in: 3600 }),
        )
        .mockResolvedValueOnce(jsonResponse({ records: [] }));
      prisma.client.integration.update.mockResolvedValue(buildIntegration());

      await service.query('u1', 'SELECT Id FROM Account');

      const refreshCall = mockFetch.mock.calls[0];
      const body = refreshCall[1].body as URLSearchParams;
      expect(body.get('client_id')).toBe('');
      expect(body.get('client_secret')).toBe('');
    });
  });
});
