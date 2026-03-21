import { SalesforceController } from '../controllers/salesforce.controller';
import type { SalesforceIntegrationService } from '../services/salesforce-integration.service';

describe('SalesforceController', () => {
  let controller: SalesforceController;
  let mockService: jest.Mocked<SalesforceIntegrationService>;

  const mockContact = {
    Id: '003XXXXX',
    FirstName: 'John',
    LastName: 'Doe',
    Email: 'john@example.com',
  };

  beforeEach(() => {
    mockService = {
      getConnectUrl: jest.fn(),
      handleCallback: jest.fn(),
      getStatus: jest.fn(),
      getContacts: jest.fn(),
      getAccounts: jest.fn(),
      getOpportunities: jest.fn(),
      getLeads: jest.fn(),
      query: jest.fn(),
      search: jest.fn(),
      disconnect: jest.fn(),
      getIntegration: jest.fn(),
      isConnected: jest.fn(),
    } as unknown as jest.Mocked<SalesforceIntegrationService>;

    controller = new SalesforceController(mockService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getConnectUrl', () => {
    it('returns OAuth connect URL', () => {
      const mockResult = {
        authUrl: 'https://login.salesforce.com/services/oauth2/authorize?...',
        message: 'Redirect user to this URL to connect Salesforce',
      };

      mockService.getConnectUrl.mockReturnValue(mockResult);

      const result = controller.getConnectUrl({ userId: 'user-1' });

      expect(result).toEqual(mockResult);
      expect(mockService.getConnectUrl).toHaveBeenCalledWith(
        'user-1',
        undefined,
      );
    });

    it('passes custom state parameter', () => {
      const mockResult = {
        authUrl: 'https://login.salesforce.com/services/oauth2/authorize?...',
        message: 'Redirect user to this URL to connect Salesforce',
      };

      mockService.getConnectUrl.mockReturnValue(mockResult);

      controller.getConnectUrl({
        userId: 'user-1',
        state: 'custom-state',
      });

      expect(mockService.getConnectUrl).toHaveBeenCalledWith(
        'user-1',
        'custom-state',
      );
    });

    it('rethrows service errors', async () => {
      const error = new Error('Client ID not configured');
      mockService.getConnectUrl.mockRejectedValue(error);

      await expect(
        controller.getConnectUrl({ userId: 'user-1' }),
      ).rejects.toThrow(error);
    });
  });

  describe('handleCallback', () => {
    it('successfully handles OAuth callback', async () => {
      const mockResult = {
        success: true,
        message: 'Salesforce connected successfully',
        user: {
          email: 'user@company.com',
          name: 'Test User',
        },
      };

      mockService.handleCallback.mockResolvedValue(mockResult);

      const result = await controller.handleCallback({
        code: 'auth-code',
        state: 'user-1',
      });

      expect(result).toEqual(mockResult);
      expect(mockService.handleCallback).toHaveBeenCalledWith(
        'auth-code',
        'user-1',
      );
    });

    it('rethrows service errors', async () => {
      const error = new Error('Invalid authorization code');
      mockService.handleCallback.mockRejectedValue(error);

      await expect(
        controller.handleCallback({ code: 'invalid', state: 'user-1' }),
      ).rejects.toThrow(error);
    });
  });

  describe('getStatus', () => {
    it('returns connection status', async () => {
      const mockStatus = {
        connected: true,
        status: 'CONNECTED' as const,
        providerEmail: 'user@company.com',
        instanceUrl: 'https://example.my.salesforce.com',
      };

      mockService.getStatus.mockResolvedValue(mockStatus);

      const result = await controller.getStatus({ userId: 'user-1' });

      expect(result).toEqual(mockStatus);
      expect(mockService.getStatus).toHaveBeenCalledWith('user-1');
    });

    it('returns not connected status', async () => {
      const mockStatus = {
        connected: false,
        status: 'NOT_CONNECTED' as const,
      };

      mockService.getStatus.mockResolvedValue(mockStatus);

      const result = await controller.getStatus({ userId: 'user-1' });

      expect(result.connected).toBe(false);
    });
  });

  describe('getContacts', () => {
    it('returns contacts from Salesforce', async () => {
      const mockContacts = [mockContact];
      mockService.getContacts.mockResolvedValue(mockContacts);

      const result = await controller.getContacts({
        userId: 'user-1',
        limit: 50,
      });

      expect(result).toEqual({
        success: true,
        count: 1,
        contacts: mockContacts,
      });
      expect(mockService.getContacts).toHaveBeenCalledWith('user-1', 50);
    });

    it('uses default limit of 100 from service', async () => {
      mockService.getContacts.mockResolvedValue([]);

      await controller.getContacts({ userId: 'user-1' });

      expect(mockService.getContacts).toHaveBeenCalledWith('user-1', undefined);
    });
  });

  describe('getAccounts', () => {
    it('returns accounts from Salesforce', async () => {
      const mockAccounts = [
        { Id: '001XXXXX', Name: 'Acme Corp', Industry: 'Technology' },
      ];
      mockService.getAccounts.mockResolvedValue(mockAccounts);

      const result = await controller.getAccounts({
        userId: 'user-1',
        limit: 50,
      });

      expect(result).toEqual({
        success: true,
        count: 1,
        accounts: mockAccounts,
      });
    });
  });

  describe('getOpportunities', () => {
    it('returns opportunities from Salesforce', async () => {
      const mockOpportunities = [
        { Id: '006XXXXX', Name: 'Big Deal', StageName: 'Negotiation/Review' },
      ];
      mockService.getOpportunities.mockResolvedValue(mockOpportunities);

      const result = await controller.getOpportunities({
        userId: 'user-1',
        limit: 50,
      });

      expect(result).toEqual({
        success: true,
        count: 1,
        opportunities: mockOpportunities,
      });
    });
  });

  describe('getLeads', () => {
    it('returns leads from Salesforce', async () => {
      const mockLeads = [
        { Id: '00QXXXXX', FirstName: 'Jane', LastName: 'Smith' },
      ];
      mockService.getLeads.mockResolvedValue(mockLeads);

      const result = await controller.getLeads({
        userId: 'user-1',
        limit: 50,
      });

      expect(result).toEqual({
        success: true,
        count: 1,
        leads: mockLeads,
      });
    });
  });

  describe('query', () => {
    it('executes SOQL query', async () => {
      const mockResult = { records: [mockContact] };
      mockService.query.mockResolvedValue(mockResult);

      const result = await controller.query({
        userId: 'user-1',
        soql: 'SELECT Id FROM Contact LIMIT 1',
      });

      expect(result).toEqual({ success: true, ...mockResult });
      expect(mockService.query).toHaveBeenCalledWith(
        'user-1',
        'SELECT Id FROM Contact LIMIT 1',
      );
    });
  });

  describe('search', () => {
    it('executes SOSL search', async () => {
      const mockResult = { searchRecords: [mockContact] };
      mockService.search.mockResolvedValue(mockResult);

      const result = await controller.search({
        userId: 'user-1',
        query: 'FIND {John*} IN NAME FIELDS',
      });

      expect(result).toEqual({ success: true, ...mockResult });
      expect(mockService.search).toHaveBeenCalledWith(
        'user-1',
        'FIND {John*} IN NAME FIELDS',
      );
    });
  });

  describe('disconnect', () => {
    it('disconnects Salesforce integration', async () => {
      const mockResult = {
        success: true,
        message: 'Salesforce disconnected successfully',
      };

      mockService.disconnect.mockResolvedValue(mockResult);

      const result = await controller.disconnect({ userId: 'user-1' });

      expect(result).toEqual(mockResult);
      expect(mockService.disconnect).toHaveBeenCalledWith('user-1');
    });
  });
});
