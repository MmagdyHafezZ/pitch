import { SessionCrmController } from '../controllers/session-crm.controller';
import type { SessionCrmService } from '../services/session-crm.service';

describe('SessionCrmController', () => {
  let controller: SessionCrmController;
  let mockService: jest.Mocked<SessionCrmService>;

  const mockContact = {
    id: 'contact-1',
    userId: 'user-1',
    orgId: 'org-1',
    integrationId: 'integration-1',
    externalId: '003XXXXX',
    provider: 'SALESFORCE' as const,
    sessionId: 'session-1',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    phone: '+1234567890',
    title: 'CEO',
    company: 'Acme Corp',
    customFields: {
      Id: '003XXXXX',
      FirstName: 'John',
      LastName: 'Doe',
      Email: 'john@example.com',
    },
    lastSyncedAt: new Date(),
    syncStatus: 'synced',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    mockService = {
      attachCrmDataToSession: jest.fn(),
      getSessionCrmData: jest.fn(),
      refreshSessionCrmData: jest.fn(),
      deleteSessionCrmData: jest.fn(),
    } as unknown as jest.Mocked<SessionCrmService>;

    controller = new SessionCrmController(mockService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('attachCrmDataToSession', () => {
    it('successfully attaches CRM data to session', async () => {
      const payload = {
        userId: 'user-1',
        sessionId: 'session-1',
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

      const mockResult = {
        success: true,
        message: 'CRM data attached to session successfully',
        contacts: [mockContact],
        accounts: [],
        opportunities: [],
        leads: [],
      };

      mockService.attachCrmDataToSession.mockResolvedValue(mockResult);

      const result = await controller.attachCrmDataToSession(payload);

      expect(result).toEqual(mockResult);
      expect(mockService.attachCrmDataToSession).toHaveBeenCalledWith(
        'user-1',
        'session-1',
        expect.objectContaining({
          orgId: 'org-1',
          contacts: payload.contacts,
          accounts: [],
          opportunities: [],
          leads: [],
        }),
      );
    });

    it('handles multiple entity types', async () => {
      const payload = {
        userId: 'user-1',
        sessionId: 'session-1',
        orgId: 'org-1',
        contacts: [{ Id: '003XXXXX', FirstName: 'John', LastName: 'Doe' }],
        accounts: [{ Id: '001XXXXX', Name: 'Acme Corp' }],
        opportunities: [{ Id: '006XXXXX', Name: 'Big Deal' }],
        leads: [{ Id: '00QXXXXX', FirstName: 'Jane', LastName: 'Smith' }],
      };

      const mockResult = {
        success: true,
        message: 'CRM data attached to session successfully',
        contacts: [mockContact],
        accounts: [{ id: 'account-1', name: 'Acme Corp' }],
        opportunities: [{ id: 'opp-1', name: 'Big Deal' }],
        leads: [{ id: 'lead-1', firstName: 'Jane' }],
      } as any;

      mockService.attachCrmDataToSession.mockResolvedValue(mockResult);

      const result = await controller.attachCrmDataToSession(payload);

      expect(result.contacts).toHaveLength(1);
      expect(result.accounts).toHaveLength(1);
      expect(result.opportunities).toHaveLength(1);
      expect(result.leads).toHaveLength(1);
    });

    it('rethrows service errors', async () => {
      const payload = {
        userId: 'user-1',
        sessionId: 'session-1',
        orgId: 'org-1',
        contacts: [],
        accounts: [],
        opportunities: [],
        leads: [],
      };

      const error = new Error('No CRM data provided');
      mockService.attachCrmDataToSession.mockRejectedValue(error);

      await expect(controller.attachCrmDataToSession(payload)).rejects.toThrow(
        error,
      );
    });
  });

  describe('getSessionCrmData', () => {
    it('returns all CRM data for a session', async () => {
      const mockResult = {
        sessionId: 'session-1',
        contacts: [mockContact],
        accounts: [],
        opportunities: [],
        leads: [],
      };

      mockService.getSessionCrmData.mockResolvedValue(mockResult);

      const result = await controller.getSessionCrmData({
        userId: 'user-1',
        sessionId: 'session-1',
      });

      expect(result).toEqual(mockResult);
      expect(mockService.getSessionCrmData).toHaveBeenCalledWith(
        'user-1',
        'session-1',
      );
    });

    it('returns empty data when no entities attached', async () => {
      const mockResult = {
        sessionId: 'session-1',
        contacts: [],
        accounts: [],
        opportunities: [],
        leads: [],
      };

      mockService.getSessionCrmData.mockResolvedValue(mockResult);

      const result = await controller.getSessionCrmData({
        userId: 'user-1',
        sessionId: 'session-1',
      });

      expect(result.contacts).toEqual([]);
      expect(result.accounts).toEqual([]);
    });
  });

  describe('refreshSessionCrmData', () => {
    it('refreshes all CRM data from Salesforce', async () => {
      const mockResult = {
        success: true,
        message: 'CRM data refreshed from Salesforce',
        refreshed: {
          contacts: 1,
          accounts: 0,
          opportunities: 0,
          leads: 0,
        },
      };

      mockService.refreshSessionCrmData.mockResolvedValue(mockResult);

      const result = await controller.refreshSessionCrmData({
        userId: 'user-1',
        sessionId: 'session-1',
      });

      expect(result).toEqual(mockResult);
      expect(mockService.refreshSessionCrmData).toHaveBeenCalledWith(
        'user-1',
        'session-1',
      );
    });

    it('handles refresh with multiple entity updates', async () => {
      const mockResult = {
        success: true,
        message: 'CRM data refreshed from Salesforce',
        refreshed: {
          contacts: 5,
          accounts: 3,
          opportunities: 2,
          leads: 1,
        },
      };

      mockService.refreshSessionCrmData.mockResolvedValue(mockResult);

      const result = await controller.refreshSessionCrmData({
        userId: 'user-1',
        sessionId: 'session-1',
      });

      expect(result.refreshed.contacts).toBe(5);
      expect(result.refreshed.accounts).toBe(3);
    });

    it('rethrows service errors', async () => {
      const error = new Error('No CRM data found for this session');
      mockService.refreshSessionCrmData.mockRejectedValue(error);

      await expect(
        controller.refreshSessionCrmData({
          userId: 'user-1',
          sessionId: 'session-1',
        }),
      ).rejects.toThrow(error);
    });
  });

  describe('deleteSessionCrmData', () => {
    it('deletes all CRM data from session', async () => {
      const mockResult = {
        success: true,
        message: 'CRM data removed from session session-1',
      };

      mockService.deleteSessionCrmData.mockResolvedValue(mockResult);

      const result = await controller.deleteSessionCrmData({
        userId: 'user-1',
        sessionId: 'session-1',
      });

      expect(result).toEqual(mockResult);
      expect(mockService.deleteSessionCrmData).toHaveBeenCalledWith(
        'user-1',
        'session-1',
      );
    });

    it('handles deletion when no data exists', async () => {
      const mockResult = {
        success: true,
        message: 'CRM data removed from session session-1',
      };

      mockService.deleteSessionCrmData.mockResolvedValue(mockResult);

      const result = await controller.deleteSessionCrmData({
        userId: 'user-1',
        sessionId: 'session-1',
      });

      expect(result.success).toBe(true);
    });

    it('rethrows service errors', async () => {
      const error = new Error('Database error');
      mockService.deleteSessionCrmData.mockRejectedValue(error);

      await expect(
        controller.deleteSessionCrmData({
          userId: 'user-1',
          sessionId: 'session-1',
        }),
      ).rejects.toThrow(error);
    });
  });
});
