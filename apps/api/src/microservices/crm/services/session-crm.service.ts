import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { SalesforceIntegrationService } from './salesforce-integration.service';

/**
 * Session CRM Service
 *
 * Handles CRM data attached to sessions:
 * 1. User sees live CRM data from Salesforce API
 * 2. User selects data to attach to a session
 * 3. Save selected data to DB with sessionId
 * 4. Get/Refresh/Delete session CRM data
 *
 * Flow:
 * - Live data: Use SalesforceIntegrationService (already works)
 * - Attach to session: Save to DB with sessionId
 * - Get session data: Query by sessionId
 * - Refresh: Fetch fresh from Salesforce, update DB
 * - Delete: When session deleted, cascade delete
 */
@Injectable()
export class SessionCrmService {
  private readonly logger = new Logger(SessionCrmService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => SalesforceIntegrationService))
    private readonly salesforceService: SalesforceIntegrationService,
  ) {
    this.logger.log('Session CRM Service initialized');
  }

  /**
   * Attach CRM data to a session
   * User has selected data from live Salesforce API, now save it to DB
   * Accepts raw Salesforce data format (exactly as returned from SF APIs)
   */
  async attachCrmDataToSession(
    userId: string,
    sessionId: string,
    data: {
      orgId?: string;
      contacts?: Array<any>; // Raw Salesforce Contact objects
      accounts?: Array<any>; // Raw Salesforce Account objects
      opportunities?: Array<any>; // Raw Salesforce Opportunity objects
      leads?: Array<any>; // Raw Salesforce Lead objects
    },
  ) {
    this.logger.log(
      `Attaching CRM data to session ${sessionId} for user ${userId}`,
    );

    const integration = await this.prisma.client.integration.findUnique({
      where: {
        userId_provider: {
          userId,
          provider: 'SALESFORCE',
        },
      },
    });

    if (!integration) {
      throw new NotFoundException('Salesforce integration not connected');
    }

    const results = {
      contacts: [],
      accounts: [],
      opportunities: [],
      leads: [],
    };

    // Attach contacts (raw Salesforce format)
    if (data.contacts && data.contacts.length > 0) {
      for (const sfContact of data.contacts) {
        if (!sfContact.Id) {
          this.logger.warn('Skipping contact without Id');
          continue;
        }

        const saved = await this.prisma.client.contact.upsert({
          where: {
            userId_externalId_provider: {
              userId,
              externalId: sfContact.Id,
              provider: 'SALESFORCE',
            },
          },
          create: {
            userId,
            orgId: data.orgId,
            integrationId: integration.id,
            externalId: sfContact.Id,
            provider: 'SALESFORCE',
            firstName: sfContact.FirstName || '',
            lastName: sfContact.LastName || '',
            email: sfContact.Email,
            phone: sfContact.Phone,
            title: sfContact.Title,
            company: sfContact.Account?.Name,
            street: sfContact.MailingStreet,
            city: sfContact.MailingCity,
            state: sfContact.MailingState,
            postalCode: sfContact.MailingPostalCode,
            country: sfContact.MailingCountry,
            description: sfContact.Description,
            customFields: sfContact, // Store entire raw Salesforce object
            lastSyncedAt: new Date(),
            syncStatus: 'synced',
            sessionId, // Link directly to session
          },
          update: {
            firstName: sfContact.FirstName || '',
            lastName: sfContact.LastName || '',
            email: sfContact.Email,
            phone: sfContact.Phone,
            title: sfContact.Title,
            company: sfContact.Account?.Name,
            customFields: sfContact, // Store entire raw Salesforce object
            lastSyncedAt: new Date(),
            sessionId, // Update session link
            updatedAt: new Date(),
          },
        });

        // Create activity to link contact to session
        await this.prisma.client.activity.create({
          data: {
            userId,
            orgId: data.orgId,
            type: 'Session',
            subject: 'AI Simulation Session',
            description: `Contact attached to session ${sessionId}`,
            status: 'Completed',
            sessionId,
            contactId: saved.id,
          },
        });

        results.contacts.push(saved);
      }
    }

    // Attach accounts (raw Salesforce format)
    if (data.accounts && data.accounts.length > 0) {
      for (const sfAccount of data.accounts) {
        if (!sfAccount.Id) {
          this.logger.warn('Skipping account without Id');
          continue;
        }

        const saved = await this.prisma.client.account.upsert({
          where: {
            userId_externalId_provider: {
              userId,
              externalId: sfAccount.Id,
              provider: 'SALESFORCE',
            },
          },
          create: {
            userId,
            orgId: data.orgId,
            integrationId: integration.id,
            externalId: sfAccount.Id,
            provider: 'SALESFORCE',
            name: sfAccount.Name,
            website: sfAccount.Website,
            phone: sfAccount.Phone,
            industry: sfAccount.Industry,
            employees: sfAccount.NumberOfEmployees,
            annualRevenue: sfAccount.AnnualRevenue
              ? parseFloat(sfAccount.AnnualRevenue.toString())
              : undefined,
            street: sfAccount.BillingStreet,
            city: sfAccount.BillingCity,
            state: sfAccount.BillingState,
            postalCode: sfAccount.BillingPostalCode,
            country: sfAccount.BillingCountry,
            description: sfAccount.Description,
            type: sfAccount.Type,
            customFields: sfAccount, // Store entire raw Salesforce object
            lastSyncedAt: new Date(),
            syncStatus: 'synced',
            sessionId, // Link directly to session
          },
          update: {
            name: sfAccount.Name,
            website: sfAccount.Website,
            phone: sfAccount.Phone,
            industry: sfAccount.Industry,
            customFields: sfAccount, // Store entire raw Salesforce object
            lastSyncedAt: new Date(),
            sessionId, // Update session link
            updatedAt: new Date(),
          },
        });

        // Create activity to link account to session
        await this.prisma.client.activity.create({
          data: {
            userId,
            orgId: data.orgId,
            type: 'Session',
            subject: 'AI Simulation Session',
            description: `Account attached to session ${sessionId}`,
            status: 'Completed',
            sessionId,
            accountId: saved.id,
          },
        });

        results.accounts.push(saved);
      }
    }

    // Attach opportunities (raw Salesforce format)
    if (data.opportunities && data.opportunities.length > 0) {
      for (const sfOpp of data.opportunities) {
        if (!sfOpp.Id) {
          this.logger.warn('Skipping opportunity without Id');
          continue;
        }

        const saved = await this.prisma.client.opportunity.upsert({
          where: {
            userId_externalId_provider: {
              userId,
              externalId: sfOpp.Id,
              provider: 'SALESFORCE',
            },
          },
          create: {
            userId,
            orgId: data.orgId,
            integrationId: integration.id,
            externalId: sfOpp.Id,
            provider: 'SALESFORCE',
            name: sfOpp.Name,
            amount: sfOpp.Amount
              ? parseFloat(sfOpp.Amount.toString())
              : undefined,
            stage: sfOpp.StageName,
            probability: sfOpp.Probability,
            closeDate: sfOpp.CloseDate ? new Date(sfOpp.CloseDate) : undefined,
            description: sfOpp.Description,
            nextStep: sfOpp.NextStep,
            type: sfOpp.Type,
            leadSource: sfOpp.LeadSource,
            isClosed: sfOpp.IsClosed,
            isWon: sfOpp.IsWon,
            customFields: sfOpp, // Store entire raw Salesforce object
            lastSyncedAt: new Date(),
            syncStatus: 'synced',
            sessionId, // Link directly to session
          },
          update: {
            name: sfOpp.Name,
            stage: sfOpp.StageName,
            amount: sfOpp.Amount
              ? parseFloat(sfOpp.Amount.toString())
              : undefined,
            customFields: sfOpp, // Store entire raw Salesforce object
            lastSyncedAt: new Date(),
            sessionId, // Update session link
            updatedAt: new Date(),
          },
        });

        // Create activity to link opportunity to session
        await this.prisma.client.activity.create({
          data: {
            userId,
            orgId: data.orgId,
            type: 'Session',
            subject: 'AI Simulation Session',
            description: `Opportunity attached to session ${sessionId}`,
            status: 'Completed',
            sessionId,
            opportunityId: saved.id,
          },
        });

        results.opportunities.push(saved);
      }
    }

    // Attach leads (raw Salesforce format)
    if (data.leads && data.leads.length > 0) {
      for (const sfLead of data.leads) {
        if (!sfLead.Id) {
          this.logger.warn('Skipping lead without Id');
          continue;
        }

        const saved = await this.prisma.client.lead.upsert({
          where: {
            userId_externalId_provider: {
              userId,
              externalId: sfLead.Id,
              provider: 'SALESFORCE',
            },
          },
          create: {
            userId,
            orgId: data.orgId,
            integrationId: integration.id,
            externalId: sfLead.Id,
            provider: 'SALESFORCE',
            firstName: sfLead.FirstName || '',
            lastName: sfLead.LastName,
            email: sfLead.Email,
            phone: sfLead.Phone,
            company: sfLead.Company,
            title: sfLead.Title,
            status: sfLead.Status,
            rating: sfLead.Rating,
            leadSource: sfLead.LeadSource,
            street: sfLead.Street,
            city: sfLead.City,
            state: sfLead.State,
            postalCode: sfLead.PostalCode,
            country: sfLead.Country,
            description: sfLead.Description,
            website: sfLead.Website,
            isConverted: sfLead.IsConverted,
            customFields: sfLead, // Store entire raw Salesforce object
            lastSyncedAt: new Date(),
            syncStatus: 'synced',
            sessionId, // Link directly to session
          },
          update: {
            firstName: sfLead.FirstName || '',
            lastName: sfLead.LastName,
            email: sfLead.Email,
            status: sfLead.Status,
            customFields: sfLead, // Store entire raw Salesforce object
            lastSyncedAt: new Date(),
            sessionId, // Update session link
            updatedAt: new Date(),
          },
        });

        // Create activity to link lead to session
        await this.prisma.client.activity.create({
          data: {
            userId,
            orgId: data.orgId,
            type: 'Session',
            subject: 'AI Simulation Session',
            description: `Lead attached to session ${sessionId}`,
            status: 'Completed',
            sessionId,
            leadId: saved.id,
          },
        });

        results.leads.push(saved);
      }
    }

    return {
      success: true,
      message: 'CRM data attached to session successfully',
      sessionId,
      data: results,
    };
  }

  /**
   * Get all CRM data attached to a session
   */
  async getSessionCrmData(userId: string, sessionId: string) {
    this.logger.log(`Getting CRM data for session ${sessionId}`);

    // Get all activities for this session (these link entities to session)
    const activities = await this.prisma.client.activity.findMany({
      where: {
        userId,
        sessionId,
      },
      include: {
        contact: {
          include: {
            account: true,
          },
        },
        account: true,
        opportunity: {
          include: {
            account: true,
            contact: true,
          },
        },
        lead: true,
      },
    });

    // Extract unique entities
    const contacts = activities
      .filter((a) => a.contact)
      .map((a) => a.contact)
      .filter((c, i, arr) => arr.findIndex((x) => x.id === c.id) === i);

    const accounts = activities
      .filter((a) => a.account)
      .map((a) => a.account)
      .filter((a, i, arr) => arr.findIndex((x) => x.id === a.id) === i);

    const opportunities = activities
      .filter((a) => a.opportunity)
      .map((a) => a.opportunity)
      .filter((o, i, arr) => arr.findIndex((x) => x.id === o.id) === i);

    const leads = activities
      .filter((a) => a.lead)
      .map((a) => a.lead)
      .filter((l, i, arr) => arr.findIndex((x) => x.id === l.id) === i);

    // Get notes for this session
    const notes = await this.prisma.client.note.findMany({
      where: {
        userId,
        sessionId,
      },
      include: {
        contact: true,
        account: true,
        opportunity: true,
        lead: true,
      },
    });

    return {
      sessionId,
      contacts,
      accounts,
      opportunities,
      leads,
      notes,
      activities: activities.map((a) => ({
        id: a.id,
        type: a.type,
        subject: a.subject,
        description: a.description,
        status: a.status,
        createdAt: a.createdAt,
      })),
    };
  }

  /**
   * Refresh session CRM data
   * Fetch fresh data from Salesforce and update DB
   */
  async refreshSessionCrmData(userId: string, sessionId: string) {
    this.logger.log(`Refreshing CRM data for session ${sessionId}`);

    // Get current session data
    const currentData = await this.getSessionCrmData(userId, sessionId);

    // Refresh contacts from Salesforce
    for (const contact of currentData.contacts) {
      if (contact.externalId) {
        try {
          const freshData = await this.salesforceService.query(
            userId,
            `SELECT Id, FirstName, LastName, Email, Phone, Title, Account.Name, MailingStreet, MailingCity, MailingState, MailingPostalCode, MailingCountry FROM Contact WHERE Id = '${contact.externalId}'`,
          );

          if (freshData.records && freshData.records.length > 0) {
            const fresh = freshData.records[0];
            await this.prisma.client.contact.update({
              where: { id: contact.id },
              data: {
                firstName: fresh.FirstName || '',
                lastName: fresh.LastName || '',
                email: fresh.Email,
                phone: fresh.Phone,
                title: fresh.Title,
                company: fresh.Account?.Name,
                customFields: fresh,
                lastSyncedAt: new Date(),
                updatedAt: new Date(),
              },
            });
          }
        } catch (error) {
          this.logger.error(`Failed to refresh contact ${contact.id}`, error);
        }
      }
    }

    // Refresh accounts
    for (const account of currentData.accounts) {
      if (account.externalId) {
        try {
          const freshData = await this.salesforceService.query(
            userId,
            `SELECT Id, Name, Website, Phone, Industry, NumberOfEmployees, AnnualRevenue FROM Account WHERE Id = '${account.externalId}'`,
          );

          if (freshData.records && freshData.records.length > 0) {
            const fresh = freshData.records[0];
            await this.prisma.client.account.update({
              where: { id: account.id },
              data: {
                name: fresh.Name,
                website: fresh.Website,
                phone: fresh.Phone,
                industry: fresh.Industry,
                customFields: fresh,
                lastSyncedAt: new Date(),
                updatedAt: new Date(),
              },
            });
          }
        } catch (error) {
          this.logger.error(`Failed to refresh account ${account.id}`, error);
        }
      }
    }

    // Refresh opportunities
    for (const opp of currentData.opportunities) {
      if (opp.externalId) {
        try {
          const freshData = await this.salesforceService.query(
            userId,
            `SELECT Id, Name, Amount, StageName, Probability, CloseDate FROM Opportunity WHERE Id = '${opp.externalId}'`,
          );

          if (freshData.records && freshData.records.length > 0) {
            const fresh = freshData.records[0];
            await this.prisma.client.opportunity.update({
              where: { id: opp.id },
              data: {
                name: fresh.Name,
                amount: fresh.Amount
                  ? parseFloat(fresh.Amount.toString())
                  : undefined,
                stage: fresh.StageName,
                probability: fresh.Probability,
                customFields: fresh,
                lastSyncedAt: new Date(),
                updatedAt: new Date(),
              },
            });
          }
        } catch (error) {
          this.logger.error(`Failed to refresh opportunity ${opp.id}`, error);
        }
      }
    }

    return {
      success: true,
      message: 'Session CRM data refreshed successfully',
      sessionId,
    };
  }

  /**
   * Delete all CRM data for a session
   * Called when session is deleted
   */
  async deleteSessionCrmData(userId: string, sessionId: string) {
    this.logger.log(`Deleting CRM data for session ${sessionId}`);

    // Delete activities (cascade will handle)
    await this.prisma.client.activity.deleteMany({
      where: {
        userId,
        sessionId,
      },
    });

    // Delete notes
    await this.prisma.client.note.deleteMany({
      where: {
        userId,
        sessionId,
      },
    });

    return {
      success: true,
      message: 'Session CRM data deleted successfully',
      sessionId,
    };
  }
}
