import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { of, throwError } from 'rxjs';
import { SalesforceGatewayController } from '../salesforce-gateway.controller';

describe('SalesforceGatewayController', () => {
  let controller: SalesforceGatewayController;
  let mockCrmService: jest.Mocked<ClientProxy>;

  beforeEach(async () => {
    mockCrmService = {
      send: jest.fn(),
      emit: jest.fn(),
      close: jest.fn(),
      connect: jest.fn(),
    } as unknown as jest.Mocked<ClientProxy>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SalesforceGatewayController],
      providers: [
        {
          provide: 'CRM_SERVICE',
          useValue: mockCrmService,
        },
      ],
    }).compile();

    controller = module.get<SalesforceGatewayController>(
      SalesforceGatewayController,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getConnectUrl', () => {
    it('returns OAuth connect URL', (done) => {
      const mockResponse = {
        authUrl: 'https://login.salesforce.com/services/oauth2/authorize?...',
        message: 'Redirect user to this URL to connect Salesforce',
      };

      mockCrmService.send.mockReturnValue(of(mockResponse));

      controller.getConnectUrl('user-1').subscribe({
        next: (result) => {
          expect(result).toEqual(mockResponse);
          expect(mockCrmService.send).toHaveBeenCalledWith(
            'salesforce.connect',
            { userId: 'user-1', state: undefined },
          );
          done();
        },
        error: done.fail,
      });
    });

    it('passes custom state parameter', (done) => {
      const mockResponse = {
        authUrl: 'https://login.salesforce.com/services/oauth2/authorize?...',
        message: 'Redirect user to this URL to connect Salesforce',
      };

      mockCrmService.send.mockReturnValue(of(mockResponse));

      controller.getConnectUrl('user-1', 'custom-state').subscribe({
        next: () => {
          expect(mockCrmService.send).toHaveBeenCalledWith(
            'salesforce.connect',
            { userId: 'user-1', state: 'custom-state' },
          );
          done();
        },
        error: done.fail,
      });
    });

    it('throws HttpException on error', (done) => {
      const error = {
        status: HttpStatus.BAD_REQUEST,
        message: 'Client ID not configured',
      };

      mockCrmService.send.mockReturnValue(throwError(() => error));

      controller.getConnectUrl('user-1').subscribe({
        next: () => done.fail('Should have thrown error'),
        error: (err: HttpException) => {
          expect(err).toBeInstanceOf(HttpException);
          expect(err.getStatus()).toBe(HttpStatus.BAD_REQUEST);
          expect(err.message).toBe('Client ID not configured');
          done();
        },
      });
    });

    it('uses default error status on unknown error', (done) => {
      mockCrmService.send.mockReturnValue(
        throwError(() => new Error('Unknown error')),
      );

      controller.getConnectUrl('user-1').subscribe({
        next: () => done.fail('Should have thrown error'),
        error: (err: HttpException) => {
          expect(err).toBeInstanceOf(HttpException);
          expect(err.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
          done();
        },
      });
    });
  });

  describe('handleCallback', () => {
    it('successfully handles OAuth callback', (done) => {
      const mockResponse = {
        success: true,
        message: 'Salesforce connected successfully',
      };

      mockCrmService.send.mockReturnValue(of(mockResponse));

      controller.handleCallback('auth-code', 'user-1').subscribe({
        next: (result) => {
          expect(result).toEqual(mockResponse);
          expect(mockCrmService.send).toHaveBeenCalledWith(
            'salesforce.callback',
            { code: 'auth-code', state: 'user-1' },
          );
          done();
        },
        error: done.fail,
      });
    });

    it('throws HttpException on callback error', (done) => {
      const error = {
        status: HttpStatus.BAD_REQUEST,
        message: 'Invalid authorization code',
      };

      mockCrmService.send.mockReturnValue(throwError(() => error));

      controller.handleCallback('invalid', 'user-1').subscribe({
        next: () => done.fail('Should have thrown error'),
        error: (err: HttpException) => {
          expect(err).toBeInstanceOf(HttpException);
          expect(err.getStatus()).toBe(HttpStatus.BAD_REQUEST);
          done();
        },
      });
    });
  });

  describe('getStatus', () => {
    it('returns integration status', (done) => {
      const mockStatus = {
        connected: true,
        status: 'CONNECTED',
        providerEmail: 'user@company.com',
      };

      mockCrmService.send.mockReturnValue(of(mockStatus));

      controller.getStatus('user-1').subscribe({
        next: (result) => {
          expect(result).toEqual(mockStatus);
          expect(mockCrmService.send).toHaveBeenCalledWith(
            'salesforce.getStatus',
            { userId: 'user-1' },
          );
          done();
        },
        error: done.fail,
      });
    });
  });

  describe('getContacts', () => {
    it('returns contacts from Salesforce', (done) => {
      const mockContacts = {
        success: true,
        count: 1,
        contacts: [{ Id: '003XXXXX', FirstName: 'John', LastName: 'Doe' }],
      };

      mockCrmService.send.mockReturnValue(of(mockContacts));

      controller.getContacts('user-1', '50').subscribe({
        next: (result) => {
          expect(result).toEqual(mockContacts);
          expect(mockCrmService.send).toHaveBeenCalledWith(
            'salesforce.getContacts',
            { userId: 'user-1', limit: 50 },
          );
          done();
        },
        error: done.fail,
      });
    });

    it('uses default limit of 100 when not specified', (done) => {
      mockCrmService.send.mockReturnValue(of({ success: true, contacts: [] }));

      controller.getContacts('user-1').subscribe({
        next: () => {
          expect(mockCrmService.send).toHaveBeenCalledWith(
            'salesforce.getContacts',
            { userId: 'user-1', limit: 100 },
          );
          done();
        },
        error: done.fail,
      });
    });
  });

  describe('getAccounts', () => {
    it('returns accounts from Salesforce', (done) => {
      const mockAccounts = {
        success: true,
        count: 1,
        accounts: [{ Id: '001XXXXX', Name: 'Acme Corp' }],
      };

      mockCrmService.send.mockReturnValue(of(mockAccounts));

      controller.getAccounts('user-1', '50').subscribe({
        next: (result) => {
          expect(result).toEqual(mockAccounts);
          expect(mockCrmService.send).toHaveBeenCalledWith(
            'salesforce.getAccounts',
            { userId: 'user-1', limit: 50 },
          );
          done();
        },
        error: done.fail,
      });
    });
  });

  describe('getOpportunities', () => {
    it('returns opportunities from Salesforce', (done) => {
      const mockOpportunities = {
        success: true,
        count: 1,
        opportunities: [{ Id: '006XXXXX', Name: 'Big Deal' }],
      };

      mockCrmService.send.mockReturnValue(of(mockOpportunities));

      controller.getOpportunities('user-1', '50').subscribe({
        next: (result) => {
          expect(result).toEqual(mockOpportunities);
          expect(mockCrmService.send).toHaveBeenCalledWith(
            'salesforce.getOpportunities',
            { userId: 'user-1', limit: 50 },
          );
          done();
        },
        error: done.fail,
      });
    });
  });

  describe('getLeads', () => {
    it('returns leads from Salesforce', (done) => {
      const mockLeads = {
        success: true,
        count: 1,
        leads: [{ Id: '00QXXXXX', FirstName: 'Jane', LastName: 'Smith' }],
      };

      mockCrmService.send.mockReturnValue(of(mockLeads));

      controller.getLeads('user-1', '50').subscribe({
        next: (result) => {
          expect(result).toEqual(mockLeads);
          expect(mockCrmService.send).toHaveBeenCalledWith(
            'salesforce.getLeads',
            { userId: 'user-1', limit: 50 },
          );
          done();
        },
        error: done.fail,
      });
    });
  });

  describe('query', () => {
    it('executes SOQL query', (done) => {
      const mockResult = { records: [{ Id: '003XXXXX' }] };
      const soql = 'SELECT Id FROM Contact LIMIT 1';

      mockCrmService.send.mockReturnValue(of(mockResult));

      controller.query('user-1', soql).subscribe({
        next: (result) => {
          expect(result).toEqual(mockResult);
          expect(mockCrmService.send).toHaveBeenCalledWith('salesforce.query', {
            userId: 'user-1',
            soql,
          });
          done();
        },
        error: done.fail,
      });
    });
  });

  describe('search', () => {
    it('executes SOSL search', (done) => {
      const mockResult = { searchRecords: [{ Id: '003XXXXX' }] };
      const query = 'FIND {John*} IN NAME FIELDS';

      mockCrmService.send.mockReturnValue(of(mockResult));

      controller.search('user-1', query).subscribe({
        next: (result) => {
          expect(result).toEqual(mockResult);
          expect(mockCrmService.send).toHaveBeenCalledWith(
            'salesforce.search',
            { userId: 'user-1', query },
          );
          done();
        },
        error: done.fail,
      });
    });
  });

  describe('disconnect', () => {
    it('disconnects Salesforce integration', (done) => {
      const mockResult = {
        success: true,
        message: 'Salesforce disconnected successfully',
      };

      mockCrmService.send.mockReturnValue(of(mockResult));

      controller.disconnect('user-1').subscribe({
        next: (result) => {
          expect(result).toEqual(mockResult);
          expect(mockCrmService.send).toHaveBeenCalledWith(
            'salesforce.disconnect',
            { userId: 'user-1' },
          );
          done();
        },
        error: done.fail,
      });
    });
  });
});
