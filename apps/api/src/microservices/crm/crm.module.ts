import { Module } from '@nestjs/common';

// Database
import { PrismaService } from './services/prisma.service';

// Controllers
import { ContactsController } from './controllers/contacts.controller';
import { AccountsController } from './controllers/accounts.controller';
import { OpportunitiesController } from './controllers/opportunities.controller';
import { ActivitiesController } from './controllers/activities.controller';
import { NotesController } from './controllers/notes.controller';
import { TagsController } from './controllers/tags.controller';

// Services
import { ContactsService } from './services/contacts.service';
import { AccountsService } from './services/accounts.service';
import { OpportunitiesService } from './services/opportunities.service';
import { ActivitiesService } from './services/activities.service';
import { NotesService } from './services/notes.service';
import { TagsService } from './services/tags.service';

@Module({
  controllers: [
    ContactsController,
    AccountsController,
    OpportunitiesController,
    ActivitiesController,
    NotesController,
    TagsController,
  ],
  providers: [
    // Database
    PrismaService,

    // Services
    ContactsService,
    AccountsService,
    OpportunitiesService,
    ActivitiesService,
    NotesService,
    TagsService,
  ],
  exports: [
    PrismaService,
    ContactsService,
    AccountsService,
    OpportunitiesService,
  ],
})
export class CrmModule {}
