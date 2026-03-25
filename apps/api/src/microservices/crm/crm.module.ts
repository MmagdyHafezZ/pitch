import { Module } from '@nestjs/common';
import { PrismaService } from './services/prisma.service';
import { SalesforceController } from './controllers/salesforce.controller';
import { CalendarController } from './controllers/calendar.controller';
import { SalesforceIntegrationService } from './services/salesforce-integration.service';
import { GoogleCalendarIntegrationService } from './services/google-calendar-integration.service';
import { MicrosoftCalendarIntegrationService } from './services/microsoft-calendar-integration.service';
import { CalendarQueryService } from './services/calendar-query.service';

@Module({
  controllers: [SalesforceController, CalendarController],
  providers: [
    PrismaService,
    SalesforceIntegrationService,
    GoogleCalendarIntegrationService,
    MicrosoftCalendarIntegrationService,
    CalendarQueryService,
  ],
  exports: [
    PrismaService,
    SalesforceIntegrationService,
    GoogleCalendarIntegrationService,
    MicrosoftCalendarIntegrationService,
    CalendarQueryService,
  ],
})
export class CrmModule {}
