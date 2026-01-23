import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { CRM_SERVICE_PATTERNS } from '@pitch/shared-backend/interfaces/message-patterns.interface';
import { SalesforceIntegrationService } from '../services/salesforce-integration.service';

/**
 * Salesforce Controller (CRM Microservice)
 *
 * Handles Salesforce integration message patterns from the gateway via RabbitMQ.
 * This controller is THIN - it only receives messages, validates, and delegates to the service.
 *
 * Pattern: Gateway → [RabbitMQ] → Controller → Service
 */
@Controller()
export class SalesforceController {
  private readonly logger = new Logger(SalesforceController.name);

  constructor(
    private readonly salesforceService: SalesforceIntegrationService,
  ) {}

  /**
   * Get Salesforce OAuth connect URL
   * Pattern: salesforce.connect
   */
  @MessagePattern(CRM_SERVICE_PATTERNS.SALESFORCE_CONNECT)
  async getConnectUrl(@Payload() data: { userId: string; state?: string }) {
    try {
      this.logger.log(`Salesforce connect request for user: ${data.userId}`);
      return await this.salesforceService.getConnectUrl(
        data.userId,
        data.state,
      );
    } catch (error) {
      this.logger.error(
        `Salesforce connect failed for user ${data.userId}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Handle Salesforce OAuth callback
   * Pattern: salesforce.callback
   */
  @MessagePattern(CRM_SERVICE_PATTERNS.SALESFORCE_CALLBACK)
  async handleCallback(@Payload() data: { code: string; state: string }) {
    try {
      this.logger.log(`Salesforce callback for state: ${data.state}`);
      return await this.salesforceService.handleCallback(data.code, data.state);
    } catch (error) {
      this.logger.error('Salesforce callback failed', error);
      throw error;
    }
  }

  /**
   * Get Salesforce integration status
   * Pattern: salesforce.getStatus
   */
  @MessagePattern(CRM_SERVICE_PATTERNS.SALESFORCE_GET_STATUS)
  async getStatus(@Payload() data: { userId: string }) {
    try {
      this.logger.log(`Salesforce status request for user: ${data.userId}`);
      return await this.salesforceService.getStatus(data.userId);
    } catch (error) {
      this.logger.error(
        `Salesforce status failed for user ${data.userId}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get Salesforce contacts
   * Pattern: salesforce.getContacts
   */
  @MessagePattern(CRM_SERVICE_PATTERNS.SALESFORCE_GET_CONTACTS)
  async getContacts(@Payload() data: { userId: string; limit?: number }) {
    try {
      this.logger.log(`Salesforce get contacts for user: ${data.userId}`);
      const contacts = await this.salesforceService.getContacts(
        data.userId,
        data.limit,
      );
      return {
        success: true,
        count: contacts.length,
        contacts,
      };
    } catch (error) {
      this.logger.error(
        `Salesforce get contacts failed for user ${data.userId}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get Salesforce accounts
   * Pattern: salesforce.getAccounts
   */
  @MessagePattern(CRM_SERVICE_PATTERNS.SALESFORCE_GET_ACCOUNTS)
  async getAccounts(@Payload() data: { userId: string; limit?: number }) {
    try {
      this.logger.log(`Salesforce get accounts for user: ${data.userId}`);
      const accounts = await this.salesforceService.getAccounts(
        data.userId,
        data.limit,
      );
      return {
        success: true,
        count: accounts.length,
        accounts,
      };
    } catch (error) {
      this.logger.error(
        `Salesforce get accounts failed for user ${data.userId}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get Salesforce opportunities
   * Pattern: salesforce.getOpportunities
   */
  @MessagePattern(CRM_SERVICE_PATTERNS.SALESFORCE_GET_OPPORTUNITIES)
  async getOpportunities(@Payload() data: { userId: string; limit?: number }) {
    try {
      this.logger.log(`Salesforce get opportunities for user: ${data.userId}`);
      const opportunities = await this.salesforceService.getOpportunities(
        data.userId,
        data.limit,
      );
      return {
        success: true,
        count: opportunities.length,
        opportunities,
      };
    } catch (error) {
      this.logger.error(
        `Salesforce get opportunities failed for user ${data.userId}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get Salesforce leads
   * Pattern: salesforce.getLeads
   */
  @MessagePattern(CRM_SERVICE_PATTERNS.SALESFORCE_GET_LEADS)
  async getLeads(@Payload() data: { userId: string; limit?: number }) {
    try {
      this.logger.log(`Salesforce get leads for user: ${data.userId}`);
      const leads = await this.salesforceService.getLeads(
        data.userId,
        data.limit,
      );
      return {
        success: true,
        count: leads.length,
        leads,
      };
    } catch (error) {
      this.logger.error(
        `Salesforce get leads failed for user ${data.userId}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Sync Salesforce contacts to local CRM
   * Pattern: salesforce.syncContacts
   */
  @MessagePattern(CRM_SERVICE_PATTERNS.SALESFORCE_SYNC_CONTACTS)
  async syncContacts(@Payload() data: { userId: string; orgId: string }) {
    try {
      this.logger.log(`Salesforce sync contacts for user: ${data.userId}`);
      return await this.salesforceService.syncContacts(data.userId, data.orgId);
    } catch (error) {
      this.logger.error(
        `Salesforce sync contacts failed for user ${data.userId}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Execute custom SOQL query
   * Pattern: salesforce.query
   */
  @MessagePattern(CRM_SERVICE_PATTERNS.SALESFORCE_QUERY)
  async query(@Payload() data: { userId: string; soql: string }) {
    try {
      this.logger.log(`Salesforce query for user: ${data.userId}`);
      const result = await this.salesforceService.query(data.userId, data.soql);
      return {
        success: true,
        ...result,
      };
    } catch (error) {
      this.logger.error(
        `Salesforce query failed for user ${data.userId}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Search Salesforce
   * Pattern: salesforce.search
   */
  @MessagePattern(CRM_SERVICE_PATTERNS.SALESFORCE_SEARCH)
  async search(@Payload() data: { userId: string; query: string }) {
    try {
      this.logger.log(`Salesforce search for user: ${data.userId}`);
      const result = await this.salesforceService.search(
        data.userId,
        data.query,
      );
      return {
        success: true,
        ...result,
      };
    } catch (error) {
      this.logger.error(
        `Salesforce search failed for user ${data.userId}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Disconnect Salesforce integration
   * Pattern: salesforce.disconnect
   */
  @MessagePattern(CRM_SERVICE_PATTERNS.SALESFORCE_DISCONNECT)
  async disconnect(@Payload() data: { userId: string }) {
    try {
      this.logger.log(`Salesforce disconnect for user: ${data.userId}`);
      return await this.salesforceService.disconnect(data.userId);
    } catch (error) {
      this.logger.error(
        `Salesforce disconnect failed for user ${data.userId}`,
        error,
      );
      throw error;
    }
  }
}
