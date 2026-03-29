import { Test, TestingModule } from '@nestjs/testing';
import { of, throwError, lastValueFrom } from 'rxjs';
import { HttpException, HttpStatus } from '@nestjs/common';
import type { ClientProxy } from '@nestjs/microservices';
import { SalesforceGatewayController } from '../salesforce-gateway.controller';

const createClientProxyMock = (): jest.Mocked<
  Pick<ClientProxy, 'send' | 'emit'>
> => ({
  send: jest.fn(),
  emit: jest.fn(),
});

// The CRM_SERVICE_PATTERNS constants are private to the controller module.
// We mirror them here to keep tests explicit and decoupled from internals.
const CRM_PATTERNS = {
  CONNECT: 'salesforce.connect',
  CALLBACK: 'salesforce.callback',
  GET_STATUS: 'salesforce.getStatus',
  GET_CONTACTS: 'salesforce.getContacts',
  GET_ACCOUNTS: 'salesforce.getAccounts',
  GET_OPPORTUNITIES: 'salesforce.getOpportunities',
  GET_LEADS: 'salesforce.getLeads',
  QUERY: 'salesforce.query',
  SEARCH: 'salesforce.search',
  DISCONNECT: 'salesforce.disconnect',
};

const userId = 'sf-user-1';

describe('SalesforceGatewayController', () => {
  let controller: SalesforceGatewayController;
  let crmService: ReturnType<typeof createClientProxyMock>;

  beforeEach(async () => {
    crmService = createClientProxyMock();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SalesforceGatewayController],
      providers: [{ provide: 'CRM_SERVICE', useValue: crmService }],
    }).compile();

    controller = module.get(SalesforceGatewayController);
  });

  afterEach(() => jest.clearAllMocks());

  // ── getConnectUrl ─────────────────────────────────────────────────────────

  describe('getConnectUrl()', () => {
    it('sends SALESFORCE_CONNECT with userId and optional state', async () => {
      const response = {
        authUrl: 'https://login.salesforce.com/...',
        message: 'Redirect',
      };
      crmService.send.mockReturnValue(of(response));

      const result = await lastValueFrom(
        controller.getConnectUrl(userId, 'my-state'),
      );

      expect(crmService.send).toHaveBeenCalledWith(CRM_PATTERNS.CONNECT, {
        userId,
        state: 'my-state',
      });
      expect(result).toEqual(response);
    });

    it('sends SALESFORCE_CONNECT without state when not provided', async () => {
      crmService.send.mockReturnValue(
        of({ authUrl: 'https://login.salesforce.com/...' }),
      );

      await lastValueFrom(controller.getConnectUrl(userId));

      expect(crmService.send).toHaveBeenCalledWith(CRM_PATTERNS.CONNECT, {
        userId,
        state: undefined,
      });
    });

    it('throws HttpException when crm service errors', async () => {
      crmService.send.mockReturnValue(
        throwError(() => ({
          message: 'connect failed',
          status: HttpStatus.INTERNAL_SERVER_ERROR,
        })),
      );

      await expect(
        lastValueFrom(controller.getConnectUrl(userId)),
      ).rejects.toThrow(HttpException);
    });
  });

  // ── handleCallback ────────────────────────────────────────────────────────

  describe('handleCallback()', () => {
    it('sends SALESFORCE_CALLBACK with code and state on success', async () => {
      const response = { connected: true, userId };
      crmService.send.mockReturnValue(of(response));

      const result = await lastValueFrom(
        controller.handleCallback('auth-code', userId, undefined, undefined),
      );

      expect(crmService.send).toHaveBeenCalledWith(CRM_PATTERNS.CALLBACK, {
        code: 'auth-code',
        state: userId,
      });
      expect(result).toEqual(response);
    });

    it('throws 400 HttpException immediately when error query param is present', async () => {
      expect(() =>
        controller.handleCallback(
          undefined,
          userId,
          'access_denied',
          'User denied access',
        ),
      ).toThrow(HttpException);

      expect(() =>
        controller.handleCallback(
          undefined,
          userId,
          'access_denied',
          'User denied access',
        ),
      ).toThrow('Salesforce OAuth error: User denied access');
    });

    it('throws 400 HttpException when error is present without description', () => {
      expect(() =>
        controller.handleCallback(undefined, userId, 'server_error', undefined),
      ).toThrow('Salesforce OAuth error: server_error');
    });

    it('throws 400 HttpException when code is missing', () => {
      expect(() =>
        controller.handleCallback(undefined, userId, undefined, undefined),
      ).toThrow('Missing OAuth callback parameters');
    });

    it('throws 400 HttpException when state is missing', () => {
      expect(() =>
        controller.handleCallback('auth-code', undefined, undefined, undefined),
      ).toThrow('Missing OAuth callback parameters');
    });

    it('throws HttpException on crm service error', async () => {
      crmService.send.mockReturnValue(
        throwError(() => ({
          message: 'token exchange failed',
          status: HttpStatus.BAD_REQUEST,
        })),
      );

      await expect(
        lastValueFrom(
          controller.handleCallback('auth-code', userId, undefined, undefined),
        ),
      ).rejects.toThrow(HttpException);
    });
  });

  // ── getStatus ─────────────────────────────────────────────────────────────

  describe('getStatus()', () => {
    it('sends SALESFORCE_GET_STATUS with userId and returns status', async () => {
      const status = {
        connected: true,
        status: 'CONNECTED',
        providerEmail: 'sf@example.com',
      };
      crmService.send.mockReturnValue(of(status));

      const result = await lastValueFrom(controller.getStatus(userId));

      expect(crmService.send).toHaveBeenCalledWith(CRM_PATTERNS.GET_STATUS, {
        userId,
      });
      expect(result).toEqual(status);
    });

    it('throws HttpException on error', async () => {
      crmService.send.mockReturnValue(
        throwError(() => new Error('status error')),
      );

      await expect(lastValueFrom(controller.getStatus(userId))).rejects.toThrow(
        HttpException,
      );
    });
  });

  // ── getContacts ───────────────────────────────────────────────────────────

  describe('getContacts()', () => {
    it('sends SALESFORCE_GET_CONTACTS with userId and default limit 100', async () => {
      const contacts = [{ Id: 'c1', Name: 'John' }];
      crmService.send.mockReturnValue(of(contacts));

      const result = await lastValueFrom(controller.getContacts(userId));

      expect(crmService.send).toHaveBeenCalledWith(CRM_PATTERNS.GET_CONTACTS, {
        userId,
        limit: 100,
      });
      expect(result).toEqual(contacts);
    });

    it('parses limit string to integer when provided', async () => {
      crmService.send.mockReturnValue(of([]));

      await lastValueFrom(controller.getContacts(userId, '25'));

      expect(crmService.send).toHaveBeenCalledWith(CRM_PATTERNS.GET_CONTACTS, {
        userId,
        limit: 25,
      });
    });

    it('throws HttpException on error', async () => {
      crmService.send.mockReturnValue(
        throwError(() => new Error('contacts error')),
      );

      await expect(
        lastValueFrom(controller.getContacts(userId)),
      ).rejects.toThrow(HttpException);
    });
  });

  // ── getAccounts ───────────────────────────────────────────────────────────

  describe('getAccounts()', () => {
    it('sends SALESFORCE_GET_ACCOUNTS with userId and default limit 100', async () => {
      const accounts = [{ Id: 'acc-1', Name: 'Acme Corp' }];
      crmService.send.mockReturnValue(of(accounts));

      const result = await lastValueFrom(controller.getAccounts(userId));

      expect(crmService.send).toHaveBeenCalledWith(CRM_PATTERNS.GET_ACCOUNTS, {
        userId,
        limit: 100,
      });
      expect(result).toEqual(accounts);
    });

    it('parses limit string to integer when provided', async () => {
      crmService.send.mockReturnValue(of([]));

      await lastValueFrom(controller.getAccounts(userId, '50'));

      expect(crmService.send).toHaveBeenCalledWith(CRM_PATTERNS.GET_ACCOUNTS, {
        userId,
        limit: 50,
      });
    });

    it('throws HttpException on error', async () => {
      crmService.send.mockReturnValue(
        throwError(() => new Error('accounts error')),
      );

      await expect(
        lastValueFrom(controller.getAccounts(userId)),
      ).rejects.toThrow(HttpException);
    });
  });

  // ── getOpportunities ──────────────────────────────────────────────────────

  describe('getOpportunities()', () => {
    it('sends SALESFORCE_GET_OPPORTUNITIES with userId and default limit 100', async () => {
      const opps = [{ Id: 'opp-1', Name: 'Big Deal' }];
      crmService.send.mockReturnValue(of(opps));

      const result = await lastValueFrom(controller.getOpportunities(userId));

      expect(crmService.send).toHaveBeenCalledWith(
        CRM_PATTERNS.GET_OPPORTUNITIES,
        {
          userId,
          limit: 100,
        },
      );
      expect(result).toEqual(opps);
    });

    it('parses limit string to integer when provided', async () => {
      crmService.send.mockReturnValue(of([]));

      await lastValueFrom(controller.getOpportunities(userId, '10'));

      expect(crmService.send).toHaveBeenCalledWith(
        CRM_PATTERNS.GET_OPPORTUNITIES,
        {
          userId,
          limit: 10,
        },
      );
    });

    it('throws HttpException on error', async () => {
      crmService.send.mockReturnValue(
        throwError(() => new Error('opportunities error')),
      );

      await expect(
        lastValueFrom(controller.getOpportunities(userId)),
      ).rejects.toThrow(HttpException);
    });
  });

  // ── getLeads ──────────────────────────────────────────────────────────────

  describe('getLeads()', () => {
    it('sends SALESFORCE_GET_LEADS with userId and default limit 100', async () => {
      const leads = [{ Id: 'lead-1', Name: 'Jane Prospect' }];
      crmService.send.mockReturnValue(of(leads));

      const result = await lastValueFrom(controller.getLeads(userId));

      expect(crmService.send).toHaveBeenCalledWith(CRM_PATTERNS.GET_LEADS, {
        userId,
        limit: 100,
      });
      expect(result).toEqual(leads);
    });

    it('parses limit string to integer when provided', async () => {
      crmService.send.mockReturnValue(of([]));

      await lastValueFrom(controller.getLeads(userId, '200'));

      expect(crmService.send).toHaveBeenCalledWith(CRM_PATTERNS.GET_LEADS, {
        userId,
        limit: 200,
      });
    });

    it('throws HttpException on error', async () => {
      crmService.send.mockReturnValue(
        throwError(() => new Error('leads error')),
      );

      await expect(lastValueFrom(controller.getLeads(userId))).rejects.toThrow(
        HttpException,
      );
    });
  });

  // ── query ─────────────────────────────────────────────────────────────────

  describe('query()', () => {
    it('sends SALESFORCE_QUERY with userId and soql string', async () => {
      const queryResult = { totalSize: 2, records: [] };
      crmService.send.mockReturnValue(of(queryResult));

      const result = await lastValueFrom(
        controller.query(userId, 'SELECT Id FROM Contact LIMIT 10'),
      );

      expect(crmService.send).toHaveBeenCalledWith(CRM_PATTERNS.QUERY, {
        userId,
        soql: 'SELECT Id FROM Contact LIMIT 10',
      });
      expect(result).toEqual(queryResult);
    });

    it('throws HttpException on error', async () => {
      crmService.send.mockReturnValue(
        throwError(() => new Error('query error')),
      );

      await expect(
        lastValueFrom(controller.query(userId, 'SELECT Id FROM Contact')),
      ).rejects.toThrow(HttpException);
    });
  });

  // ── search ────────────────────────────────────────────────────────────────

  describe('search()', () => {
    it('sends SALESFORCE_SEARCH with userId and query string', async () => {
      const searchResult = { searchRecords: [{ Id: 'c-1' }] };
      crmService.send.mockReturnValue(of(searchResult));

      const result = await lastValueFrom(controller.search(userId, 'Acme'));

      expect(crmService.send).toHaveBeenCalledWith(CRM_PATTERNS.SEARCH, {
        userId,
        query: 'Acme',
      });
      expect(result).toEqual(searchResult);
    });

    it('throws HttpException on error', async () => {
      crmService.send.mockReturnValue(
        throwError(() => new Error('search error')),
      );

      await expect(
        lastValueFrom(controller.search(userId, 'Acme')),
      ).rejects.toThrow(HttpException);
    });
  });

  // ── disconnect ────────────────────────────────────────────────────────────

  describe('disconnect()', () => {
    it('sends SALESFORCE_DISCONNECT with userId and returns result', async () => {
      const response = { disconnected: true };
      crmService.send.mockReturnValue(of(response));

      const result = await lastValueFrom(controller.disconnect(userId));

      expect(crmService.send).toHaveBeenCalledWith(CRM_PATTERNS.DISCONNECT, {
        userId,
      });
      expect(result).toEqual(response);
    });

    it('throws HttpException on error', async () => {
      crmService.send.mockReturnValue(
        throwError(() => new Error('disconnect error')),
      );

      await expect(
        lastValueFrom(controller.disconnect(userId)),
      ).rejects.toThrow(HttpException);
    });
  });
});
