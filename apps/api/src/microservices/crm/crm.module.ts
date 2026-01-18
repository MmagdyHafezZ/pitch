import { Module } from '@nestjs/common';
import { PrismaService } from './services/prisma.service';

// Controllers
import { ContactsController } from './controllers/contacts.controller';
import { AccountsController } from './controllers/accounts.controller';
import { OpportunitiesController } from './controllers/opportunities.controller';
import { PipelinesController } from './controllers/pipelines.controller';
import { ActivitiesController } from './controllers/activities.controller';
import { TasksController } from './controllers/tasks.controller';
import { NotesController } from './controllers/notes.controller';
import { TagsController } from './controllers/tags.controller';
import { EmailsController } from './controllers/emails.controller';
import { EmailTemplatesController } from './controllers/email-templates.controller';
import { ReportsController } from './controllers/reports.controller';
import { SalesGoalsController } from './controllers/sales-goals.controller';
import { WebhooksController } from './controllers/webhooks.controller';
import { CrmConnectionsController } from './controllers/crm-connections.controller';

// Services
import { CrmService } from './services/crm.service';
import { CrmSyncService } from './services/crm-sync.service';
import { CrmProviderService } from './services/crm-provider.service';
import { HubspotService } from './services/hubspot.service';
import { SalesforceService } from './services/salesforce.service';

// Repositories
import { CrmAccountRepository } from './repositories/crm-account.repository';
import { CrmConnectionRepository } from './repositories/crm-connection.repository';
import { CrmContactRepository } from './repositories/crm-contact.repository';

@Module({
  controllers: [
    // Core CRM entities
    ContactsController,
    AccountsController,
    OpportunitiesController,
    PipelinesController,

    // Activities & Tasks
    ActivitiesController,
    TasksController,
    NotesController,
    TagsController,

    // Communication
    EmailsController,
    EmailTemplatesController,

    // Analytics & Reporting
    ReportsController,
    SalesGoalsController,

    // Integration & System
    WebhooksController,
    CrmConnectionsController,
  ],
  providers: [
    // Database
    PrismaService,

    // Core Services
    CrmService,
    CrmSyncService,
    CrmProviderService,

    // External CRM Integrations
    HubspotService,
    SalesforceService,

    // Repositories
    CrmAccountRepository,
    CrmConnectionRepository,
    CrmContactRepository,
  ],
  exports: [PrismaService, CrmService, CrmSyncService],
})
export class CrmModule {}
