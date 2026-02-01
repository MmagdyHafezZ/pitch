import { NotFoundException, BadRequestException } from '@nestjs/common';
import { SessionCrmService } from '../services/session-crm.service';
import type { PrismaService } from '../services/prisma.service';
import type { SalesforceIntegrationService } from '../services/salesforce-integration.service';

describe('SessionCrmService', () => {
  let service: SessionCrmService;
  let mockPrisma: jest.Mocked<PrismaService>;
  let mockSalesforceService: jest.Mocked<SalesforceIntegrationService>;

  const mockIntegration = {
    id: 'integration-1',
    userId: 'user-1',
    provider: 'SALESFORCE' as const,
    status: 'CONNECTED' as const,
    accessToken: 'access-token-123',
    refreshToken: 'refresh-token-123',
    expiresAt: new Date(Date.now() + 3600000),
    instanceUrl: 'https://example.my.salesforce.com',
    providerId: 'sf-user-id',
    providerEmail: 'user@company.com',
    providerData: {},
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  };

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
    street: null,
    city: null,
    state: null,
    postalCode: null,
    country: null,
    description: null,
    website: null,
    linkedIn: null,
    twitter: null,
    customFields: {
      Id: '003XXXXX',
      FirstName: 'John',
      LastName: 'Doe',
      Email: 'john@example.com',
      attributes: {
        type: 'Contact',
        url: '/services/data/v58.0/sobjects/Contact/003XXXXX',
      },
    },
    lastSyncedAt: new Date(),
    syncStatus: 'synced',
    createdAt: new Date(),
    updatedAt: new Date(),
    accountId: null,
  };

  const mockActivity = {
    id: 'activity-1',
    userId: 'user-1',
    orgId: 'org-1',
    integrationId: 'integration-1',
    externalId: null,
    provider: 'SALESFORCE' as const,
    activityType: 'CRM_SYNC',
    subject: 'Attached CRM data to session',
    description: 'Contact: John Doe (john@example.com)',
    status: 'COMPLETED',
    priority: null,
    dueDate: null,
    completedAt: new Date(),
    customFields: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    contactId: 'contact-1',
    accountId: null,
    opportunityId: null,
    leadId: null,
  };

  beforeEach(() => {
    mockPrisma = {
      client: {
        integration: {
          findUnique: jest.fn(),
        },
        contact: {
          upsert: jest.fn(),
          findMany: jest.fn(),
          updateMany: jest.fn(),
          deleteMany: jest.fn(),
        },
        account: {
          upsert: jest.fn(),
          findMany: jest.fn(),
          updateMany: jest.fn(),
          deleteMany: jest.fn(),
        },
        opportunity: {
          upsert: jest.fn(),
          findMany: jest.fn(),
          updateMany: jest.fn(),
          deleteMany: jest.fn(),
        },
        lead: {
          upsert: jest.fn(),
          findMany: jest.fn(),
          updateMany: jest.fn(),
          deleteMany: jest.fn(),
        },
        activity: {
          create: jest.fn(),
          findMany: jest.fn(),
          deleteMany: jest.fn(),
        },
        note: {
          findMany: jest.fn(),
          deleteMany: jest.fn(),
        },
      },
    } as unknown as jest.Mocked<PrismaService>;

    mockSalesforceService = {
      getIntegration: jest.fn(),
      getContacts: jest.fn(),
      getAccounts: jest.fn(),
      getOpportunities: jest.fn(),
      getLeads: jest.fn(),
    } as unknown as jest.Mocked<SalesforceIntegrationService>;

    service = new SessionCrmService(mockPrisma, mockSalesforceService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('attachCrmDataToSession', () => {
    it('successfully attaches contacts to session', async () => {
      const rawContact = {
        Id: '003XXXXX',
        FirstName: 'John',
        LastName: 'Doe',
        Email: 'john@example.com',
        Phone: '+1234567890',
        Title: 'CEO',
        Account: { Name: 'Acme Corp' },
        attributes: {
          type: 'Contact',
          url: '/services/data/v58.0/sobjects/Contact/003XXXXX',
        },
      };

      mockPrisma.client.integration.findUnique.mockResolvedValue(
        mockIntegration,
      );
      mockPrisma.client.contact.upsert.mockResolvedValue(mockContact);
      mockPrisma.client.activity.create.mockResolvedValue(mockActivity);

      const result = await service.attachCrmDataToSession(
        'user-1',
        'session-1',
        {
          orgId: 'org-1',
          contacts: [rawContact],
          accounts: [],
          opportunities: [],
          leads: [],
        },
      );

      expect(result.success).toBe(true);
      expect(result.data.contacts).toHaveLength(1);
      expect(result.data.contacts[0]).toEqual(mockContact);
      expect(mockPrisma.client.contact.upsert).toHaveBeenCalledWith({
        where: {
          userId_externalId_provider: {
            userId: 'user-1',
            externalId: '003XXXXX',
            provider: 'SALESFORCE',
          },
        },
        create: expect.objectContaining({
          userId: 'user-1',
          externalId: '003XXXXX',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          sessionId: 'session-1',
          customFields: rawContact,
        }),
        update: expect.objectContaining({
          firstName: 'John',
          lastName: 'Doe',
          sessionId: 'session-1',
          customFields: rawContact,
        }),
      });
    });

    it('attaches multiple entity types in single request', async () => {
      const rawContact = {
        Id: '003XXXXX',
        FirstName: 'John',
        LastName: 'Doe',
        Email: 'john@example.com',
      };

      const rawAccount = {
        Id: '001XXXXX',
        Name: 'Acme Corp',
        Industry: 'Technology',
      };

      mockPrisma.client.integration.findUnique.mockResolvedValue(
        mockIntegration,
      );
      mockPrisma.client.contact.upsert.mockResolvedValue(mockContact);
      mockPrisma.client.account.upsert.mockResolvedValue({
        id: 'account-1',
        externalId: '001XXXXX',
        name: 'Acme Corp',
      } as any);
      mockPrisma.client.activity.create.mockResolvedValue(mockActivity);

      const result = await service.attachCrmDataToSession(
        'user-1',
        'session-1',
        {
          orgId: 'org-1',
          contacts: [rawContact],
          accounts: [rawAccount],
          opportunities: [],
          leads: [],
        },
      );

      expect(result.success).toBe(true);
      expect(result.data.contacts).toHaveLength(1);
      expect(result.data.accounts).toHaveLength(1);
    });

    it('throws NotFoundException when integration not found', async () => {
      mockPrisma.client.integration.findUnique.mockResolvedValue(null);

      await expect(
        service.attachCrmDataToSession('user-1', 'session-1', {
          orgId: 'org-1',
          contacts: [],
          accounts: [],
          opportunities: [],
          leads: [],
        }),
      ).rejects.toThrow(
        new NotFoundException('Salesforce integration not connected'),
      );
    });

    it('returns success with empty arrays when no data provided', async () => {
      mockPrisma.client.integration.findUnique.mockResolvedValue(
        mockIntegration,
      );

      const result = await service.attachCrmDataToSession(
        'user-1',
        'session-1',
        {
          orgId: 'org-1',
          contacts: [],
          accounts: [],
          opportunities: [],
          leads: [],
        },
      );

      expect(result.success).toBe(true);
      expect(result.data.contacts).toEqual([]);
      expect(result.data.accounts).toEqual([]);
    });

    it('throws error during upsert failure', async () => {
      const rawContact1 = {
        Id: '003XXXXX1',
        FirstName: 'John',
        LastName: 'Doe',
      };

      mockPrisma.client.integration.findUnique.mockResolvedValue(
        mockIntegration,
      );
      mockPrisma.client.contact.upsert.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(
        service.attachCrmDataToSession('user-1', 'session-1', {
          orgId: 'org-1',
          contacts: [rawContact1],
          accounts: [],
          opportunities: [],
          leads: [],
        }),
      ).rejects.toThrow('Database error');
    });
  });

  describe('getSessionCrmData', () => {
    it('returns all CRM data for a session', async () => {
      const mockAccount = {
        id: 'account-1',
        externalId: '001XXXXX',
        name: 'Acme Corp',
      };

      const mockActivitiesWithRelations = [
        {
          ...mockActivity,
          contact: mockContact,
          account: null,
          opportunity: null,
          lead: null,
        },
      ];

      mockPrisma.client.activity.findMany.mockResolvedValue(
        mockActivitiesWithRelations as any,
      );
      mockPrisma.client.note.findMany.mockResolvedValue([]);

      const result = await service.getSessionCrmData('user-1', 'session-1');

      expect(result.sessionId).toBe('session-1');
      expect(result.contacts).toHaveLength(1);
      expect(result.contacts[0].id).toBe('contact-1');
    });

    it('returns empty arrays when no data found', async () => {
      mockPrisma.client.activity.findMany.mockResolvedValue([]);
      mockPrisma.client.note.findMany.mockResolvedValue([]);

      const result = await service.getSessionCrmData('user-1', 'session-1');

      expect(result.contacts).toEqual([]);
      expect(result.accounts).toEqual([]);
    });
  });

  describe('refreshSessionCrmData', () => {
    it('refreshes all entities from Salesforce', async () => {
      const mockSalesforceContact = {
        Id: '003XXXXX',
        FirstName: 'John Updated',
        LastName: 'Doe',
        Email: 'john.new@example.com',
      };

      const mockActivitiesWithRelations = [
        {
          ...mockActivity,
          contact: mockContact,
          account: null,
          opportunity: null,
          lead: null,
        },
      ];

      mockPrisma.client.activity.findMany.mockResolvedValue(
        mockActivitiesWithRelations as any,
      );
      mockPrisma.client.note.findMany.mockResolvedValue([]);
      mockSalesforceService.getIntegration.mockResolvedValue(mockIntegration);

      const mockFetch = jest.fn();
      global.fetch = mockFetch as any;
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockSalesforceContact,
      } as Response);

      mockPrisma.client.contact.upsert.mockResolvedValue({
        ...mockContact,
        firstName: 'John Updated',
        email: 'john.new@example.com',
      });

      const result = await service.refreshSessionCrmData('user-1', 'session-1');

      expect(result.success).toBe(true);
    });

    it('returns success even when no session data exists', async () => {
      mockPrisma.client.activity.findMany.mockResolvedValue([]);
      mockPrisma.client.note.findMany.mockResolvedValue([]);

      const result = await service.refreshSessionCrmData('user-1', 'session-1');

      expect(result.success).toBe(true);
      expect(result.message).toBe('Session CRM data refreshed successfully');
    });
  });

  describe('deleteSessionCrmData', () => {
    it('deletes all CRM data associated with session', async () => {
      mockPrisma.client.activity.deleteMany.mockResolvedValue({ count: 5 });
      mockPrisma.client.note.deleteMany.mockResolvedValue({ count: 3 });
      mockPrisma.client.contact.updateMany.mockResolvedValue({ count: 2 });
      mockPrisma.client.account.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.client.opportunity.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.client.lead.updateMany.mockResolvedValue({ count: 0 });

      const result = await service.deleteSessionCrmData('user-1', 'session-1');

      expect(result.success).toBe(true);
      expect(result.message).toBe('Session CRM data deleted successfully');
      expect(mockPrisma.client.activity.deleteMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          sessionId: 'session-1',
        },
      });
      expect(mockPrisma.client.note.deleteMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          sessionId: 'session-1',
        },
      });
    });

    it('returns success even when no data to delete', async () => {
      mockPrisma.client.activity.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.client.note.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.client.contact.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.client.account.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.client.opportunity.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.client.lead.updateMany.mockResolvedValue({ count: 0 });

      const result = await service.deleteSessionCrmData('user-1', 'session-1');

      expect(result.success).toBe(true);
    });
  });
});
