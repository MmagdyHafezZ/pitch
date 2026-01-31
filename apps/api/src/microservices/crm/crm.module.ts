import { Module } from '@nestjs/common';
import { PrismaService } from './services/prisma.service';
import { SalesforceController } from './controllers/salesforce.controller';
import { SalesforceIntegrationService } from './services/salesforce-integration.service';
import { SessionCrmService } from './services/session-crm.service';
import { SessionCrmController } from './controllers/session-crm.controller';

/**
 * CRM Microservice Module
 *
 * Handles CRM-related functionality including:
 * - Salesforce integration (OAuth, real-time data fetching from Salesforce API)
 * - Session CRM data (Store CRM data selected by user and attached to AI sessions)
 *
 * Flow:
 * 1. User connects to Salesforce via OAuth
 * 2. User creates AI session and sees LIVE CRM data from Salesforce API
 * 3. User selects CRM data (contacts, accounts, etc.) to attach to session
 * 4. Selected data is saved to PostgreSQL with sessionId
 * 5. Data can be retrieved, refreshed, or deleted when session ends
 *
 * Uses PostgreSQL database via Prisma for storing:
 * - Integration tokens (OAuth)
 * - Session-attached CRM data (contacts, accounts, opportunities, leads)
 * - Activities and notes linked to sessions
 */
@Module({
  controllers: [SalesforceController, SessionCrmController],
  providers: [PrismaService, SalesforceIntegrationService, SessionCrmService],
  exports: [PrismaService, SalesforceIntegrationService, SessionCrmService],
})
export class CrmModule {}
