import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Inject,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { catchError, timeout } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { CurrentUser } from '../../../microservices/userManagement/decorators/current-user.decorator';
import type { ServiceError } from '@pitch/shared-backend/interfaces/error.interface';

const CRM_SERVICE_PATTERNS = {
  SESSION_ATTACH_CRM_DATA: 'session.attachCrmData',
  SESSION_GET_CRM_DATA: 'session.getCrmData',
  SESSION_REFRESH_CRM_DATA: 'session.refreshCrmData',
  SESSION_DELETE_CRM_DATA: 'session.deleteCrmData',
} as const;

/**
 * Session CRM Gateway Controller
 *
 * Handles CRM data attached to AI simulation sessions.
 *
 * Flow:
 * 1. User creates session, sees live CRM data from Salesforce
 * 2. POST /sessions/:sessionId/crm - Attach selected CRM data to session
 * 3. GET /sessions/:sessionId/crm - Get attached CRM data
 * 4. PUT /sessions/:sessionId/crm - Refresh data from Salesforce
 * 5. DELETE /sessions/:sessionId/crm - Delete when session deleted
 */
@ApiTags('Session CRM Data')
@ApiBearerAuth('bearer')
@Controller({ path: 'sessions', version: '1' })
export class SessionCrmGatewayController {
  private readonly logger = new Logger(SessionCrmGatewayController.name);

  constructor(@Inject('CRM_SERVICE') private crmService: ClientProxy) {}

  /**
   * Attach CRM data to session
   * User has selected data from live Salesforce API, now save it to DB
   */
  @Post(':sessionId/crm')
  @ApiOperation({
    summary: 'Attach CRM data to session',
    description:
      'Save selected CRM data (from live Salesforce) to DB with sessionId',
  })
  @ApiParam({ name: 'sessionId', description: 'AI Simulation Session ID' })
  @ApiBody({
    description:
      'Raw Salesforce CRM data to attach to session. Pass exactly what you receive from Salesforce APIs.',
    schema: {
      example: {
        orgId: 'org-123',
        contacts: [
          {
            attributes: {
              type: 'Contact',
              url: '/services/data/v58.0/sobjects/Contact/003XXXXXXXXXXXXAAA',
            },
            Id: '003XXXXXXXXXXXXAAA',
            FirstName: 'John',
            LastName: 'Doe',
            Email: 'john@example.com',
            Phone: '+1234567890',
            Title: 'VP Sales',
            AccountId: '001XXXXXXXXXXXXAAA',
            Account: {
              attributes: {
                type: 'Account',
                url: '/services/data/v58.0/sobjects/Account/001XXXXXXXXXXXXAAA',
              },
              Name: 'Acme Corp',
            },
            CreatedDate: '2026-01-22T01:20:49.000+0000',
          },
        ],
        accounts: [
          {
            attributes: {
              type: 'Account',
              url: '/services/data/v58.0/sobjects/Account/001XXXXXXXXXXXXAAA',
            },
            Id: '001XXXXXXXXXXXXAAA',
            Name: 'Acme Corporation',
            Industry: 'Technology',
            Type: 'Customer - Direct',
            Phone: '(555) 123-4567',
            Website: 'https://acme.com',
            BillingCity: 'San Francisco',
            BillingState: 'CA',
            BillingCountry: 'United States',
            CreatedDate: '2026-01-22T01:20:49.000+0000',
          },
        ],
        opportunities: [
          {
            attributes: {
              type: 'Opportunity',
              url: '/services/data/v58.0/sobjects/Opportunity/006XXXXXXXXXXXXAAA',
            },
            Id: '006XXXXXXXXXXXXAAA',
            Name: 'Big Deal 2026',
            StageName: 'Negotiation/Review',
            Amount: 125000,
            CloseDate: '2026-03-31',
            Probability: 90,
            AccountId: '001XXXXXXXXXXXXAAA',
            Account: {
              attributes: {
                type: 'Account',
                url: '/services/data/v58.0/sobjects/Account/001XXXXXXXXXXXXAAA',
              },
              Name: 'Acme Corp',
            },
            CreatedDate: '2026-01-22T01:20:49.000+0000',
          },
        ],
        leads: [
          {
            attributes: {
              type: 'Lead',
              url: '/services/data/v58.0/sobjects/Lead/00QXXXXXXXXXXXXAAA',
            },
            Id: '00QXXXXXXXXXXXXAAA',
            FirstName: 'Jane',
            LastName: 'Smith',
            Company: 'Tech Startup Inc',
            Email: 'jane@techstartup.com',
            Phone: '(555) 987-6543',
            Status: 'Working - Contacted',
            LeadSource: 'Web',
            CreatedDate: '2026-01-22T01:20:49.000+0000',
          },
        ],
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'CRM data attached to session successfully',
  })
  attachCrmData(
    @CurrentUser('id') userId: string,
    @Param('sessionId') sessionId: string,
    @Body() data: any,
  ) {
    this.logger.log(`Attaching CRM data to session ${sessionId}`);

    return this.crmService
      .send(CRM_SERVICE_PATTERNS.SESSION_ATTACH_CRM_DATA, {
        userId,
        sessionId,
        ...data,
      })
      .pipe(
        timeout(30000),
        catchError((err: unknown) => {
          const error = err as ServiceError;
          this.logger.error(
            `Failed to attach CRM data to session ${sessionId}`,
            error,
          );
          return throwError(
            () =>
              new HttpException(
                error.message || 'Failed to attach CRM data',
                error.status || HttpStatus.INTERNAL_SERVER_ERROR,
              ),
          );
        }),
      );
  }

  /**
   * Get all CRM data attached to a session
   */
  @Get(':sessionId/crm')
  @ApiOperation({
    summary: 'Get CRM data for session',
    description: 'Retrieve all CRM data attached to this session from DB',
  })
  @ApiParam({ name: 'sessionId', description: 'AI Simulation Session ID' })
  @ApiResponse({
    status: 200,
    description: 'Session CRM data',
    schema: {
      example: {
        sessionId: 'session-123',
        contacts: [],
        accounts: [],
        opportunities: [],
        leads: [],
        notes: [],
        activities: [],
      },
    },
  })
  getSessionCrmData(
    @CurrentUser('id') userId: string,
    @Param('sessionId') sessionId: string,
  ) {
    this.logger.log(`Getting CRM data for session ${sessionId}`);

    return this.crmService
      .send(CRM_SERVICE_PATTERNS.SESSION_GET_CRM_DATA, { userId, sessionId })
      .pipe(
        timeout(10000),
        catchError((err: unknown) => {
          const error = err as ServiceError;
          this.logger.error(
            `Failed to get CRM data for session ${sessionId}`,
            error,
          );
          return throwError(
            () =>
              new HttpException(
                error.message || 'Failed to get session CRM data',
                error.status || HttpStatus.INTERNAL_SERVER_ERROR,
              ),
          );
        }),
      );
  }

  /**
   * Refresh session CRM data from Salesforce
   */
  @Put(':sessionId/crm/refresh')
  @ApiOperation({
    summary: 'Refresh session CRM data',
    description:
      'Fetch fresh data from Salesforce for all attached entities and update DB',
  })
  @ApiParam({ name: 'sessionId', description: 'AI Simulation Session ID' })
  @ApiResponse({
    status: 200,
    description: 'Session CRM data refreshed successfully',
  })
  refreshSessionCrmData(
    @CurrentUser('id') userId: string,
    @Param('sessionId') sessionId: string,
  ) {
    this.logger.log(`Refreshing CRM data for session ${sessionId}`);

    return this.crmService
      .send(CRM_SERVICE_PATTERNS.SESSION_REFRESH_CRM_DATA, {
        userId,
        sessionId,
      })
      .pipe(
        timeout(30000),
        catchError((err: unknown) => {
          const error = err as ServiceError;
          this.logger.error(
            `Failed to refresh CRM data for session ${sessionId}`,
            error,
          );
          return throwError(
            () =>
              new HttpException(
                error.message || 'Failed to refresh session CRM data',
                error.status || HttpStatus.INTERNAL_SERVER_ERROR,
              ),
          );
        }),
      );
  }

  /**
   * Delete session CRM data
   * Called when session is deleted
   */
  @Delete(':sessionId/crm')
  @ApiOperation({
    summary: 'Delete session CRM data',
    description:
      'Delete all CRM data attached to this session (called when session is deleted)',
  })
  @ApiParam({ name: 'sessionId', description: 'AI Simulation Session ID' })
  @ApiResponse({
    status: 200,
    description: 'Session CRM data deleted successfully',
  })
  deleteSessionCrmData(
    @CurrentUser('id') userId: string,
    @Param('sessionId') sessionId: string,
  ) {
    this.logger.log(`Deleting CRM data for session ${sessionId}`);

    return this.crmService
      .send(CRM_SERVICE_PATTERNS.SESSION_DELETE_CRM_DATA, {
        userId,
        sessionId,
      })
      .pipe(
        timeout(10000),
        catchError((err: unknown) => {
          const error = err as ServiceError;
          this.logger.error(
            `Failed to delete CRM data for session ${sessionId}`,
            error,
          );
          return throwError(
            () =>
              new HttpException(
                error.message || 'Failed to delete session CRM data',
                error.status || HttpStatus.INTERNAL_SERVER_ERROR,
              ),
          );
        }),
      );
  }
}
