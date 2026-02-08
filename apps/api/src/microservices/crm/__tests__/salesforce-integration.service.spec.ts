import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { SalesforceIntegrationService } from '../services/salesforce-integration.service';
import type { PrismaService } from '../services/prisma.service';

describe('SalesforceIntegrationService', () => {
  let service: SalesforceIntegrationService;
  let mockPrisma: jest.Mocked<PrismaService>;

  const mockIntegration = {
    id: 'integration-1',
    userId: 'user-1',
    provider: 'SALESFORCE' as const,
    status: 'CONNECTED' as const,
    accessToken: 'access-token-123',
    refreshToken: 'refresh-token-123',
    expiresAt: new Date(Date.now() + 3600000), // 1 hour from now
    instanceUrl: 'https://example.my.salesforce.com',
    providerId: 'sf-user-id',
    providerEmail: 'user@company.com',
    providerData: {},
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockContact = {
    Id: '003XXXXX',
    FirstName: 'John',
    LastName: 'Doe',
    Email: 'john@example.com',
    Phone: '+1234567890',
    Title: 'CEO',
    AccountId: '001XXXXX',
    Account: {
      attributes: {
        type: 'Account',
        url: '/services/data/v58.0/sobjects/Account/001XXXXX',
      },
      Name: 'Acme Corp',
    },
    CreatedDate: '2026-01-22T01:20:49.000+0000',
    attributes: {
      type: 'Contact',
      url: '/services/data/v58.0/sobjects/Contact/003XXXXX',
    },
  };

  beforeEach(() => {
    // Mock Prisma client
    mockPrisma = {
      client: {
        integration: {
          findUnique: jest.fn(),
          update: jest.fn(),
          upsert: jest.fn(),
        },
      },
    } as unknown as jest.Mocked<PrismaService>;

    service = new SalesforceIntegrationService(mockPrisma);

    // Mock fetch globally
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getIntegration', () => {
    it('returns integration when found and connected', async () => {
      mockPrisma.client.integration.findUnique.mockResolvedValue(
        mockIntegration,
      );

      const result = await service.getIntegration('user-1');

      expect(result).toEqual(mockIntegration);
      expect(mockPrisma.client.integration.findUnique).toHaveBeenCalledWith({
        where: {
          userId_provider: {
            userId: 'user-1',
            provider: 'SALESFORCE',
          },
        },
      });
    });

    it('throws UnauthorizedException when integration not found', async () => {
      mockPrisma.client.integration.findUnique.mockResolvedValue(null);

      await expect(service.getIntegration('user-1')).rejects.toThrow(
        new UnauthorizedException('Salesforce integration not connected'),
      );
    });

    it('throws UnauthorizedException when integration is disconnected', async () => {
      mockPrisma.client.integration.findUnique.mockResolvedValue({
        ...mockIntegration,
        status: 'DISCONNECTED',
      });

      await expect(service.getIntegration('user-1')).rejects.toThrow(
        new UnauthorizedException('Salesforce integration is disconnected'),
      );
    });

    it('throws UnauthorizedException when integration has errors', async () => {
      mockPrisma.client.integration.findUnique.mockResolvedValue({
        ...mockIntegration,
        status: 'ERROR',
      });

      await expect(service.getIntegration('user-1')).rejects.toThrow(
        new UnauthorizedException(
          'Salesforce integration has errors. Please reconnect.',
        ),
      );
    });
  });

  describe('isConnected', () => {
    it('returns true when integration is connected', async () => {
      mockPrisma.client.integration.findUnique.mockResolvedValue(
        mockIntegration,
      );

      const result = await service.isConnected('user-1');

      expect(result).toBe(true);
    });

    it('returns false when integration not found', async () => {
      mockPrisma.client.integration.findUnique.mockResolvedValue(null);

      const result = await service.isConnected('user-1');

      expect(result).toBe(false);
    });

    it('returns false when integration is not connected', async () => {
      mockPrisma.client.integration.findUnique.mockResolvedValue({
        ...mockIntegration,
        status: 'DISCONNECTED',
      });

      const result = await service.isConnected('user-1');

      expect(result).toBe(false);
    });
  });

  describe('getConnectUrl', () => {
    it('returns Salesforce OAuth URL with userId as state', () => {
      process.env.SALESFORCE_CLIENT_ID = 'test-client-id';
      process.env.SALESFORCE_REDIRECT_URI =
        'http://localhost:8000/api/crm/salesforce/callback';

      const result = service.getConnectUrl('user-1');

      expect(result).toHaveProperty('authUrl');
      expect(result.authUrl).toContain(
        'https://login.salesforce.com/services/oauth2/authorize',
      );
      expect(result.authUrl).toContain('client_id=test-client-id');
      expect(result.authUrl).toContain('state=user-1');
      expect(result.message).toBe(
        'Redirect user to this URL to connect Salesforce',
      );
    });

    it('throws BadRequestException when client ID not configured', () => {
      delete process.env.SALESFORCE_CLIENT_ID;

      expect(() => service.getConnectUrl('user-1')).toThrow(
        new BadRequestException('Salesforce client ID not configured'),
      );
    });
  });

  describe('handleCallback', () => {
    it('successfully exchanges code for tokens and stores integration', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

      // Mock token exchange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: 'new-access-token',
            refresh_token: 'new-refresh-token',
            expires_in: 3600,
            instance_url: 'https://example.my.salesforce.com',
          }),
      } as Response);

      // Mock user info fetch
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            user_id: 'sf-user-id',
            email: 'user@company.com',
            name: 'Test User',
          }),
      } as Response);

      mockPrisma.client.integration.upsert.mockResolvedValue(mockIntegration);

      const result = await service.handleCallback('auth-code', 'user-1');

      expect(result.success).toBe(true);
      expect(result.message).toBe('Salesforce connected successfully');
      expect(mockPrisma.client.integration.upsert).toHaveBeenCalled();
    });

    it('throws BadRequestException when code is missing', async () => {
      await expect(service.handleCallback('', 'user-1')).rejects.toThrow(
        new BadRequestException('Authorization code is required'),
      );
    });

    it('throws BadRequestException when state is missing', async () => {
      await expect(service.handleCallback('auth-code', '')).rejects.toThrow(
        new BadRequestException('State parameter is required'),
      );
    });

    it('throws BadRequestException when token exchange fails', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: () => Promise.resolve('Invalid authorization code'),
      } as Response);

      await expect(
        service.handleCallback('invalid-code', 'user-1'),
      ).rejects.toThrow(
        new BadRequestException('Failed to connect Salesforce'),
      );
    });
  });

  describe('getStatus', () => {
    it('returns integration status when found', async () => {
      mockPrisma.client.integration.findUnique.mockResolvedValue(
        mockIntegration,
      );

      const result = await service.getStatus('user-1');

      expect(result.connected).toBe(true);
      expect(result.status).toBe('CONNECTED');
      expect(result.providerEmail).toBe('user@company.com');
    });

    it('returns not connected when integration not found', async () => {
      mockPrisma.client.integration.findUnique.mockResolvedValue(null);

      const result = await service.getStatus('user-1');

      expect(result.connected).toBe(false);
      expect(result.status).toBe('NOT_CONNECTED');
    });
  });

  describe('getContacts', () => {
    it('returns contacts from Salesforce', async () => {
      mockPrisma.client.integration.findUnique.mockResolvedValue(
        mockIntegration,
      );

      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            records: [mockContact],
          }),
      } as Response);

      const result = await service.getContacts('user-1', 100);

      expect(result).toEqual([mockContact]);
      expect(mockFetch).toHaveBeenCalled();
    });

    it('throws UnauthorizedException when user not connected', async () => {
      mockPrisma.client.integration.findUnique.mockResolvedValue(null);

      await expect(service.getContacts('user-1')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('getAccounts', () => {
    it('returns accounts from Salesforce', async () => {
      mockPrisma.client.integration.findUnique.mockResolvedValue(
        mockIntegration,
      );

      const mockAccount = {
        Id: '001XXXXX',
        Name: 'Acme Corp',
        Industry: 'Technology',
        Type: 'Customer - Direct',
      };

      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            records: [mockAccount],
          }),
      } as Response);

      const result = await service.getAccounts('user-1', 100);

      expect(result).toEqual([mockAccount]);
    });
  });

  describe('getOpportunities', () => {
    it('returns opportunities from Salesforce', async () => {
      mockPrisma.client.integration.findUnique.mockResolvedValue(
        mockIntegration,
      );

      const mockOpportunity = {
        Id: '006XXXXX',
        Name: 'Big Deal',
        StageName: 'Negotiation/Review',
        Amount: 125000,
      };

      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            records: [mockOpportunity],
          }),
      } as Response);

      const result = await service.getOpportunities('user-1', 100);

      expect(result).toEqual([mockOpportunity]);
    });
  });

  describe('getLeads', () => {
    it('returns leads from Salesforce', async () => {
      mockPrisma.client.integration.findUnique.mockResolvedValue(
        mockIntegration,
      );

      const mockLead = {
        Id: '00QXXXXX',
        FirstName: 'Jane',
        LastName: 'Smith',
        Company: 'Tech Startup',
        Status: 'Working - Contacted',
      };

      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            records: [mockLead],
          }),
      } as Response);

      const result = await service.getLeads('user-1', 100);

      expect(result).toEqual([mockLead]);
    });
  });

  describe('query', () => {
    it('executes SOQL query successfully', async () => {
      mockPrisma.client.integration.findUnique.mockResolvedValue(
        mockIntegration,
      );

      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            records: [mockContact],
          }),
      } as Response);

      const result = await service.query(
        'user-1',
        'SELECT Id FROM Contact LIMIT 1',
      );

      expect(result).toHaveProperty('records');
      expect(mockFetch).toHaveBeenCalled();
    });
  });

  describe('search', () => {
    it('executes SOSL search successfully', async () => {
      mockPrisma.client.integration.findUnique.mockResolvedValue(
        mockIntegration,
      );

      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            searchRecords: [mockContact],
          }),
      } as Response);

      const result = await service.search(
        'user-1',
        'FIND {John*} IN NAME FIELDS',
      );

      expect(result).toHaveProperty('searchRecords');
    });
  });

  describe('disconnect', () => {
    it('disconnects Salesforce integration', async () => {
      mockPrisma.client.integration.update.mockResolvedValue({
        ...mockIntegration,
        status: 'DISCONNECTED',
        accessToken: null,
        refreshToken: null,
      });

      const result = await service.disconnect('user-1');

      expect(result.success).toBe(true);
      expect(result.message).toBe('Salesforce disconnected successfully');
      expect(mockPrisma.client.integration.update).toHaveBeenCalledWith({
        where: {
          userId_provider: {
            userId: 'user-1',
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
    });
  });
});
