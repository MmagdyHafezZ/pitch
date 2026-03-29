import { SalesforceController } from '../controllers/salesforce.controller';
import { SalesforceIntegrationService } from '../services/salesforce-integration.service';

describe('SalesforceController', () => {
  let controller: SalesforceController;
  let salesforceService: jest.Mocked<SalesforceIntegrationService>;

  beforeEach(() => {
    salesforceService = {
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
    } as unknown as jest.Mocked<SalesforceIntegrationService>;

    controller = new SalesforceController(salesforceService);
  });

  describe('health', () => {
    it('should return ok status with crm service name', () => {
      expect(controller.health()).toEqual({ status: 'ok', service: 'crm' });
    });
  });

  describe('getConnectUrl', () => {
    it('should delegate to service and return result', () => {
      const result = {
        authUrl: 'https://sf.com/oauth',
        message: 'Redirect user to this URL to connect Salesforce',
      };
      salesforceService.getConnectUrl.mockReturnValue(result);

      expect(controller.getConnectUrl({ userId: 'u1', state: 's1' })).toEqual(
        result,
      );
      expect(salesforceService.getConnectUrl).toHaveBeenCalledWith('u1', 's1');
    });

    it('should pass undefined state when not provided', () => {
      const result = { authUrl: 'https://sf.com/oauth', message: 'Redirect' };
      salesforceService.getConnectUrl.mockReturnValue(result);

      controller.getConnectUrl({ userId: 'u1' });
      expect(salesforceService.getConnectUrl).toHaveBeenCalledWith(
        'u1',
        undefined,
      );
    });

    it('should re-throw when service throws', () => {
      const err = new Error('config missing');
      salesforceService.getConnectUrl.mockImplementation(() => {
        throw err;
      });

      expect(() => controller.getConnectUrl({ userId: 'u1' })).toThrow(err);
    });
  });

  describe('handleCallback', () => {
    it('should delegate to service and return result', async () => {
      const result = {
        success: true,
        message: 'connected',
        user: { email: 'a@b.com', name: 'A' },
      };
      salesforceService.handleCallback.mockResolvedValue(result);

      await expect(
        controller.handleCallback({ code: 'c1', state: 's1' }),
      ).resolves.toEqual(result);
      expect(salesforceService.handleCallback).toHaveBeenCalledWith('c1', 's1');
    });

    it('should re-throw when service rejects', async () => {
      const err = new Error('callback fail');
      salesforceService.handleCallback.mockRejectedValue(err);

      await expect(
        controller.handleCallback({ code: 'c1', state: 's1' }),
      ).rejects.toThrow(err);
    });
  });

  describe('getStatus', () => {
    it('should delegate to service and return result', async () => {
      const result = { connected: true, status: 'CONNECTED' };
      salesforceService.getStatus.mockResolvedValue(result);

      await expect(controller.getStatus({ userId: 'u1' })).resolves.toEqual(
        result,
      );
      expect(salesforceService.getStatus).toHaveBeenCalledWith('u1');
    });

    it('should re-throw when service rejects', async () => {
      const err = new Error('status fail');
      salesforceService.getStatus.mockRejectedValue(err);

      await expect(controller.getStatus({ userId: 'u1' })).rejects.toThrow(err);
    });
  });

  describe('getContacts', () => {
    it('should return contacts with count', async () => {
      const contacts = [{ Id: 'c1' }, { Id: 'c2' }];
      salesforceService.getContacts.mockResolvedValue(contacts);

      const result = await controller.getContacts({ userId: 'u1', limit: 10 });
      expect(result).toEqual({ success: true, count: 2, contacts });
      expect(salesforceService.getContacts).toHaveBeenCalledWith('u1', 10);
    });

    it('should pass undefined limit when not provided', async () => {
      salesforceService.getContacts.mockResolvedValue([]);

      await controller.getContacts({ userId: 'u1' });
      expect(salesforceService.getContacts).toHaveBeenCalledWith(
        'u1',
        undefined,
      );
    });

    it('should re-throw when service rejects', async () => {
      const err = new Error('contacts fail');
      salesforceService.getContacts.mockRejectedValue(err);

      await expect(controller.getContacts({ userId: 'u1' })).rejects.toThrow(
        err,
      );
    });
  });

  describe('getAccounts', () => {
    it('should return accounts with count', async () => {
      const accounts = [{ Id: 'a1' }];
      salesforceService.getAccounts.mockResolvedValue(accounts);

      const result = await controller.getAccounts({ userId: 'u1', limit: 5 });
      expect(result).toEqual({ success: true, count: 1, accounts });
      expect(salesforceService.getAccounts).toHaveBeenCalledWith('u1', 5);
    });

    it('should re-throw when service rejects', async () => {
      const err = new Error('accounts fail');
      salesforceService.getAccounts.mockRejectedValue(err);

      await expect(controller.getAccounts({ userId: 'u1' })).rejects.toThrow(
        err,
      );
    });
  });

  describe('getOpportunities', () => {
    it('should return opportunities with count', async () => {
      const opportunities = [{ Id: 'o1' }, { Id: 'o2' }, { Id: 'o3' }];
      salesforceService.getOpportunities.mockResolvedValue(opportunities);

      const result = await controller.getOpportunities({ userId: 'u1' });
      expect(result).toEqual({ success: true, count: 3, opportunities });
    });

    it('should re-throw when service rejects', async () => {
      const err = new Error('opportunities fail');
      salesforceService.getOpportunities.mockRejectedValue(err);

      await expect(
        controller.getOpportunities({ userId: 'u1' }),
      ).rejects.toThrow(err);
    });
  });

  describe('getLeads', () => {
    it('should return leads with count', async () => {
      const leads = [{ Id: 'l1' }];
      salesforceService.getLeads.mockResolvedValue(leads);

      const result = await controller.getLeads({ userId: 'u1', limit: 50 });
      expect(result).toEqual({ success: true, count: 1, leads });
      expect(salesforceService.getLeads).toHaveBeenCalledWith('u1', 50);
    });

    it('should re-throw when service rejects', async () => {
      const err = new Error('leads fail');
      salesforceService.getLeads.mockRejectedValue(err);

      await expect(controller.getLeads({ userId: 'u1' })).rejects.toThrow(err);
    });
  });

  describe('query', () => {
    it('should return query result with success flag', async () => {
      const queryResult = { totalSize: 1, done: true, records: [{ Id: 'r1' }] };
      salesforceService.query.mockResolvedValue(queryResult);

      const result = await controller.query({
        userId: 'u1',
        soql: 'SELECT Id FROM Account',
      });
      expect(result).toEqual({ success: true, ...queryResult });
      expect(salesforceService.query).toHaveBeenCalledWith(
        'u1',
        'SELECT Id FROM Account',
      );
    });

    it('should re-throw when service rejects', async () => {
      const err = new Error('query fail');
      salesforceService.query.mockRejectedValue(err);

      await expect(
        controller.query({ userId: 'u1', soql: 'bad soql' }),
      ).rejects.toThrow(err);
    });
  });

  describe('search', () => {
    it('should return search result with success flag', async () => {
      const searchResult = [{ Id: 's1' }];
      salesforceService.search.mockResolvedValue(searchResult);

      const result = await controller.search({
        userId: 'u1',
        query: 'FIND {test}',
      });
      expect(result).toEqual({ success: true, ...searchResult });
      expect(salesforceService.search).toHaveBeenCalledWith(
        'u1',
        'FIND {test}',
      );
    });

    it('should re-throw when service rejects', async () => {
      const err = new Error('search fail');
      salesforceService.search.mockRejectedValue(err);

      await expect(
        controller.search({ userId: 'u1', query: 'bad' }),
      ).rejects.toThrow(err);
    });
  });

  describe('disconnect', () => {
    it('should delegate to service and return result', async () => {
      const result = {
        success: true,
        message: 'Salesforce disconnected successfully',
      };
      salesforceService.disconnect.mockResolvedValue(result);

      await expect(controller.disconnect({ userId: 'u1' })).resolves.toEqual(
        result,
      );
      expect(salesforceService.disconnect).toHaveBeenCalledWith('u1');
    });

    it('should re-throw when service rejects', async () => {
      const err = new Error('disconnect fail');
      salesforceService.disconnect.mockRejectedValue(err);

      await expect(controller.disconnect({ userId: 'u1' })).rejects.toThrow(
        err,
      );
    });
  });
});
