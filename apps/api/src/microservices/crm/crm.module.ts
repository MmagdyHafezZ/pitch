import { Module } from '@nestjs/common';
import { PrismaService } from './services/prisma.service';
import { SalesforceController } from './controllers/salesforce.controller';
import { SalesforceIntegrationService } from './services/salesforce-integration.service';

/**
 * CRM Microservice Module
 *
 * Handles CRM-related functionality including Salesforce integration.
 * This module contains controllers with @MessagePattern decorators for RabbitMQ.
 */
@Module({
  controllers: [SalesforceController],
  providers: [PrismaService, SalesforceIntegrationService],
  exports: [PrismaService, SalesforceIntegrationService],
})
export class CrmModule {}
