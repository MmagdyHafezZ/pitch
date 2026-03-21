import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { of, throwError } from 'rxjs';
import { SessionCrmGatewayController } from '../session-crm-gateway.controller';

describe('SessionCrmGatewayController', () => {
  let controller: SessionCrmGatewayController;
  let mockCrmService: jest.Mocked<ClientProxy>;

  beforeEach(async () => {
    mockCrmService = {
      send: jest.fn(),
      emit: jest.fn(),
      close: jest.fn(),
      connect: jest.fn(),
    } as unknown as jest.Mocked<ClientProxy>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SessionCrmGatewayController],
      providers: [
        {
          provide: 'CRM_SERVICE',
          useValue: mockCrmService,
        },
      ],
    }).compile();

    controller = module.get<SessionCrmGatewayController>(
      SessionCrmGatewayController,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('attachCrmData', () => {
    it('successfully attaches CRM data to session', (done) => {
      const payload = {
        orgId: 'org-1',
        contacts: [
          {
            Id: '003XXXXX',
            FirstName: 'John',
            LastName: 'Doe',
            Email: 'john@example.com',
            attributes: {
              type: 'Contact',
              url: '/services/data/v58.0/sobjects/Contact/003XXXXX',
            },
          },
        ],
        accounts: [],
        opportunities: [],
        leads: [],
      };

      const mockResponse = {
        success: true,
        message: 'CRM data attached to session successfully',
        contacts: [
          {
            id: 'contact-1',
            externalId: '003XXXXX',
            firstName: 'John',
            lastName: 'Doe',
          },
        ],
        accounts: [],
        opportunities: [],
        leads: [],
      };

      mockCrmService.send.mockReturnValue(of(mockResponse));

      controller.attachCrmData('user-1', 'session-1', payload).subscribe({
        next: (result) => {
          expect(result).toEqual(mockResponse);
          expect(mockCrmService.send).toHaveBeenCalledWith(
            'session.attachCrmData',
            {
              userId: 'user-1',
              sessionId: 'session-1',
              ...payload,
            },
          );
          done();
        },
        error: done.fail,
      });
    });

    it('handles multiple entity types', (done) => {
      const payload = {
        orgId: 'org-1',
        contacts: [{ Id: '003XXXXX', FirstName: 'John', LastName: 'Doe' }],
        accounts: [{ Id: '001XXXXX', Name: 'Acme Corp' }],
        opportunities: [{ Id: '006XXXXX', Name: 'Big Deal' }],
        leads: [{ Id: '00QXXXXX', FirstName: 'Jane', LastName: 'Smith' }],
      };

      const mockResponse = {
        success: true,
        message: 'CRM data attached to session successfully',
        contacts: [{ id: 'contact-1' }],
        accounts: [{ id: 'account-1' }],
        opportunities: [{ id: 'opp-1' }],
        leads: [{ id: 'lead-1' }],
      } as any;

      mockCrmService.send.mockReturnValue(of(mockResponse));

      controller.attachCrmData('user-1', 'session-1', payload).subscribe({
        next: (result) => {
          expect(result.contacts).toHaveLength(1);
          expect(result.accounts).toHaveLength(1);
          expect(result.opportunities).toHaveLength(1);
          expect(result.leads).toHaveLength(1);
          done();
        },
        error: done.fail,
      });
    });

    it('throws HttpException on error', (done) => {
      const payload = {
        orgId: 'org-1',
        contacts: [],
        accounts: [],
        opportunities: [],
        leads: [],
      };

      const error = {
        status: HttpStatus.BAD_REQUEST,
        message: 'No CRM data provided',
      };

      mockCrmService.send.mockReturnValue(throwError(() => error));

      controller.attachCrmData('user-1', 'session-1', payload).subscribe({
        next: (): void => {
          done.fail('Should have thrown error');
        },
        error: (err: HttpException): void => {
          expect(err).toBeInstanceOf(HttpException);
          expect(err.getStatus()).toBe(HttpStatus.BAD_REQUEST);
          expect(err.message).toBe('No CRM data provided');
          done();
          return;
        },
      });
    });

    it('uses default error message on unknown error', (done) => {
      const payload = {
        orgId: 'org-1',
        contacts: [{ Id: '003XXXXX' }],
        accounts: [],
        opportunities: [],
        leads: [],
      };

      mockCrmService.send.mockReturnValue(
        throwError(() => new Error('Unknown error')),
      );

      controller.attachCrmData('user-1', 'session-1', payload).subscribe({
        next: (): void => {
          done.fail('Should have thrown error');
        },
        error: (err: HttpException): void => {
          expect(err).toBeInstanceOf(HttpException);
          expect(err.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
          done();
          return;
        },
      });
    });
  });

  describe('getSessionCrmData', () => {
    it('returns all CRM data for a session', (done) => {
      const mockResponse = {
        sessionId: 'session-1',
        contacts: [
          {
            id: 'contact-1',
            firstName: 'John',
            lastName: 'Doe',
            email: 'john@example.com',
          },
        ],
        accounts: [],
        opportunities: [],
        leads: [],
      };

      mockCrmService.send.mockReturnValue(of(mockResponse));

      controller.getSessionCrmData('user-1', 'session-1').subscribe({
        next: (result) => {
          expect(result).toEqual(mockResponse);
          expect(mockCrmService.send).toHaveBeenCalledWith(
            'session.getCrmData',
            { userId: 'user-1', sessionId: 'session-1' },
          );
          done();
        },
        error: done.fail,
      });
    });

    it('returns empty data when no entities attached', (done) => {
      const mockResponse = {
        sessionId: 'session-1',
        contacts: [],
        accounts: [],
        opportunities: [],
        leads: [],
      };

      mockCrmService.send.mockReturnValue(of(mockResponse));

      controller.getSessionCrmData('user-1', 'session-1').subscribe({
        next: (result) => {
          expect(result.contacts).toEqual([]);
          expect(result.accounts).toEqual([]);
          done();
        },
        error: done.fail,
      });
    });

    it('throws HttpException on error', (done) => {
      const error = {
        status: HttpStatus.NOT_FOUND,
        message: 'Session not found',
      };

      mockCrmService.send.mockReturnValue(throwError(() => error));

      controller.getSessionCrmData('user-1', 'session-1').subscribe({
        next: (): void => {
          done.fail('Should have thrown error');
        },
        error: (err: HttpException): void => {
          expect(err).toBeInstanceOf(HttpException);
          expect(err.getStatus()).toBe(HttpStatus.NOT_FOUND);
          done();
          return;
        },
      });
    });
  });

  describe('refreshSessionCrmData', () => {
    it('refreshes all CRM data from Salesforce', (done) => {
      const mockResponse = {
        success: true,
        message: 'CRM data refreshed from Salesforce',
        refreshed: {
          contacts: 1,
          accounts: 0,
          opportunities: 0,
          leads: 0,
        },
      };

      mockCrmService.send.mockReturnValue(of(mockResponse));

      controller.refreshSessionCrmData('user-1', 'session-1').subscribe({
        next: (result) => {
          expect(result).toEqual(mockResponse);
          expect(mockCrmService.send).toHaveBeenCalledWith(
            'session.refreshCrmData',
            { userId: 'user-1', sessionId: 'session-1' },
          );
          done();
        },
        error: done.fail,
      });
    });

    it('handles refresh with multiple entity updates', (done) => {
      const mockResponse = {
        success: true,
        message: 'CRM data refreshed from Salesforce',
        refreshed: {
          contacts: 5,
          accounts: 3,
          opportunities: 2,
          leads: 1,
        },
      };

      mockCrmService.send.mockReturnValue(of(mockResponse));

      controller.refreshSessionCrmData('user-1', 'session-1').subscribe({
        next: (result) => {
          expect(result.refreshed.contacts).toBe(5);
          expect(result.refreshed.accounts).toBe(3);
          expect(result.refreshed.opportunities).toBe(2);
          expect(result.refreshed.leads).toBe(1);
          done();
        },
        error: done.fail,
      });
    });

    it('throws HttpException on error', (done) => {
      const error = {
        status: HttpStatus.NOT_FOUND,
        message: 'No CRM data found for this session',
      };

      mockCrmService.send.mockReturnValue(throwError(() => error));

      controller.refreshSessionCrmData('user-1', 'session-1').subscribe({
        next: (): void => {
          done.fail('Should have thrown error');
        },
        error: (err: HttpException): void => {
          expect(err).toBeInstanceOf(HttpException);
          expect(err.getStatus()).toBe(HttpStatus.NOT_FOUND);
          done();
          return;
        },
      });
    });
  });

  describe('deleteSessionCrmData', () => {
    it('deletes all CRM data from session', (done) => {
      const mockResponse = {
        success: true,
        message: 'CRM data removed from session session-1',
      };

      mockCrmService.send.mockReturnValue(of(mockResponse));

      controller.deleteSessionCrmData('user-1', 'session-1').subscribe({
        next: (result) => {
          expect(result).toEqual(mockResponse);
          expect(mockCrmService.send).toHaveBeenCalledWith(
            'session.deleteCrmData',
            { userId: 'user-1', sessionId: 'session-1' },
          );
          done();
        },
        error: done.fail,
      });
    });

    it('handles deletion when no data exists', (done) => {
      const mockResponse = {
        success: true,
        message: 'CRM data removed from session session-1',
      };

      mockCrmService.send.mockReturnValue(of(mockResponse));

      controller.deleteSessionCrmData('user-1', 'session-1').subscribe({
        next: (result) => {
          expect(result.success).toBe(true);
          done();
        },
        error: done.fail,
      });
    });

    it('throws HttpException on error', (done) => {
      const error = {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Database error',
      };

      mockCrmService.send.mockReturnValue(throwError(() => error));

      controller.deleteSessionCrmData('user-1', 'session-1').subscribe({
        next: (): void => {
          done.fail('Should have thrown error');
        },
        error: (err: HttpException): void => {
          expect(err).toBeInstanceOf(HttpException);
          expect(err.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
          done();
          return;
        },
      });
    });
  });
});
