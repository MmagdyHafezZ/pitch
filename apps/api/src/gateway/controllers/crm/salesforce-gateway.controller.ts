import {
  Controller,
  Get,
  Post,
  Delete,
  Query,
  Body,
  Inject,
  HttpException,
  HttpStatus,
  Logger,
  HttpCode,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { catchError, timeout } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { Public } from '../../../microservices/userManagement/decorators/public.decorator';
import { CurrentUser } from '../../../microservices/userManagement/decorators/current-user.decorator';
import type { ServiceError } from '@pitch/shared-backend/interfaces/error.interface';

/**
 * CRM Service Message Patterns
 * These match the patterns defined in @pitch/shared-backend
 * Using local definition due to TypeScript module resolution issues
 */
const CRM_SERVICE_PATTERNS = {
  SALESFORCE_CONNECT: 'salesforce.connect',
  SALESFORCE_CALLBACK: 'salesforce.callback',
  SALESFORCE_GET_STATUS: 'salesforce.getStatus',
  SALESFORCE_GET_CONTACTS: 'salesforce.getContacts',
  SALESFORCE_GET_ACCOUNTS: 'salesforce.getAccounts',
  SALESFORCE_GET_OPPORTUNITIES: 'salesforce.getOpportunities',
  SALESFORCE_GET_LEADS: 'salesforce.getLeads',
  SALESFORCE_SYNC_CONTACTS: 'salesforce.syncContacts',
  SALESFORCE_QUERY: 'salesforce.query',
  SALESFORCE_SEARCH: 'salesforce.search',
  SALESFORCE_DISCONNECT: 'salesforce.disconnect',
} as const;

/**
 * Salesforce Gateway Controller
 *
 * Handles HTTP requests for Salesforce integration and forwards them to CRM microservice via RabbitMQ.
 * Pattern: HTTP Request → Gateway Controller → [RabbitMQ] → CRM Microservice
 *
 * This follows the same pattern as AuthGatewayController in userManagement.
 */
@ApiTags('Salesforce Integration')
@Controller({ path: 'integrations/salesforce', version: '1' })
export class SalesforceGatewayController {
  private readonly logger = new Logger(SalesforceGatewayController.name);

  constructor(@Inject('CRM_SERVICE') private crmService: ClientProxy) {}

  /**
   * Get Salesforce OAuth connect URL
   * This endpoint can be public or protected - currently requiring auth
   */
  @Get('connect')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Get Salesforce OAuth connect URL' })
  @ApiResponse({
    status: 200,
    description: 'OAuth URL generated successfully',
    schema: {
      example: {
        authUrl: 'https://login.salesforce.com/services/oauth2/authorize?...',
        message: 'Redirect user to this URL to connect Salesforce',
      },
    },
  })
  @ApiQuery({
    name: 'state',
    required: false,
    description: 'Optional state parameter',
  })
  getConnectUrl(
    @CurrentUser('id') userId: string,
    @Query('state') state?: string,
  ) {
    this.logger.log(`Salesforce connect request for user: ${userId}`);

    return this.crmService
      .send(CRM_SERVICE_PATTERNS.SALESFORCE_CONNECT, { userId, state })
      .pipe(
        timeout(10000),
        catchError((err: unknown) => {
          const error = err as ServiceError;
          const stack = error.stack ?? JSON.stringify(err);
          this.logger.error(
            `Salesforce connect failed for user ${userId}`,
            stack,
          );
          const status = error.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
          const message =
            error.message ?? 'Failed to generate Salesforce connect URL';
          return throwError(() => new HttpException(message, status));
        }),
      );
  }

  /**
   * Handle Salesforce OAuth callback
   * This endpoint must be public as Salesforce redirects here
   */
  @Get('callback')
  @Public()
  @ApiOperation({ summary: 'Handle Salesforce OAuth callback' })
  @ApiResponse({
    status: 200,
    description: 'Salesforce connected successfully',
  })
  @ApiResponse({ status: 400, description: 'Invalid callback parameters' })
  @ApiQuery({
    name: 'code',
    required: true,
    description: 'Authorization code from Salesforce',
  })
  @ApiQuery({
    name: 'state',
    required: true,
    description: 'State parameter (userId)',
  })
  handleCallback(@Query('code') code: string, @Query('state') state: string) {
    this.logger.log(`Salesforce callback received for state: ${state}`);

    return this.crmService
      .send(CRM_SERVICE_PATTERNS.SALESFORCE_CALLBACK, { code, state })
      .pipe(
        timeout(10000),
        catchError((err: unknown) => {
          const error = err as ServiceError;
          const stack = error.stack ?? JSON.stringify(err);
          this.logger.error('Salesforce callback failed', stack);
          const status = error.status ?? HttpStatus.BAD_REQUEST;
          const message = error.message ?? 'Failed to connect Salesforce';
          return throwError(() => new HttpException(message, status));
        }),
      );
  }

  /**
   * Get Salesforce integration status
   */
  @Get('status')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Get Salesforce integration status' })
  @ApiResponse({
    status: 200,
    description: 'Integration status retrieved',
    schema: {
      example: {
        connected: true,
        status: 'CONNECTED',
        providerEmail: 'user@example.com',
        lastSyncAt: '2024-01-23T12:00:00Z',
      },
    },
  })
  getStatus(@CurrentUser('id') userId: string) {
    this.logger.log(`Salesforce status request for user: ${userId}`);

    return this.crmService
      .send(CRM_SERVICE_PATTERNS.SALESFORCE_GET_STATUS, { userId })
      .pipe(
        timeout(10000),
        catchError((err: unknown) => {
          const error = err as ServiceError;
          const stack = error.stack ?? JSON.stringify(err);
          this.logger.error(
            `Salesforce status failed for user ${userId}`,
            stack,
          );
          const status = error.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
          const message = error.message ?? 'Failed to get Salesforce status';
          return throwError(() => new HttpException(message, status));
        }),
      );
  }

  /**
   * Get Salesforce contacts
   */
  @Get('contacts')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Get Salesforce contacts' })
  @ApiResponse({ status: 200, description: 'Contacts retrieved successfully' })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of contacts to retrieve (default: 100)',
  })
  getContacts(
    @CurrentUser('id') userId: string,
    @Query('limit') limit?: string,
  ) {
    this.logger.log(`Salesforce get contacts for user: ${userId}`);

    return this.crmService
      .send(CRM_SERVICE_PATTERNS.SALESFORCE_GET_CONTACTS, {
        userId,
        limit: limit ? parseInt(limit) : 100,
      })
      .pipe(
        timeout(15000),
        catchError((err: unknown) => {
          const error = err as ServiceError;
          const stack = error.stack ?? JSON.stringify(err);
          this.logger.error(
            `Salesforce get contacts failed for user ${userId}`,
            stack,
          );
          const status = error.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
          const message = error.message ?? 'Failed to get Salesforce contacts';
          return throwError(() => new HttpException(message, status));
        }),
      );
  }

  /**
   * Get Salesforce accounts
   */
  @Get('accounts')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Get Salesforce accounts' })
  @ApiResponse({ status: 200, description: 'Accounts retrieved successfully' })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of accounts to retrieve (default: 100)',
  })
  getAccounts(
    @CurrentUser('id') userId: string,
    @Query('limit') limit?: string,
  ) {
    this.logger.log(`Salesforce get accounts for user: ${userId}`);

    return this.crmService
      .send(CRM_SERVICE_PATTERNS.SALESFORCE_GET_ACCOUNTS, {
        userId,
        limit: limit ? parseInt(limit) : 100,
      })
      .pipe(
        timeout(15000),
        catchError((err: unknown) => {
          const error = err as ServiceError;
          const stack = error.stack ?? JSON.stringify(err);
          this.logger.error(
            `Salesforce get accounts failed for user ${userId}`,
            stack,
          );
          const status = error.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
          const message = error.message ?? 'Failed to get Salesforce accounts';
          return throwError(() => new HttpException(message, status));
        }),
      );
  }

  /**
   * Get Salesforce opportunities
   */
  @Get('opportunities')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Get Salesforce opportunities' })
  @ApiResponse({
    status: 200,
    description: 'Opportunities retrieved successfully',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of opportunities to retrieve (default: 100)',
  })
  getOpportunities(
    @CurrentUser('id') userId: string,
    @Query('limit') limit?: string,
  ) {
    this.logger.log(`Salesforce get opportunities for user: ${userId}`);

    return this.crmService
      .send(CRM_SERVICE_PATTERNS.SALESFORCE_GET_OPPORTUNITIES, {
        userId,
        limit: limit ? parseInt(limit) : 100,
      })
      .pipe(
        timeout(15000),
        catchError((err: unknown) => {
          const error = err as ServiceError;
          const stack = error.stack ?? JSON.stringify(err);
          this.logger.error(
            `Salesforce get opportunities failed for user ${userId}`,
            stack,
          );
          const status = error.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
          const message =
            error.message ?? 'Failed to get Salesforce opportunities';
          return throwError(() => new HttpException(message, status));
        }),
      );
  }

  /**
   * Get Salesforce leads
   */
  @Get('leads')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Get Salesforce leads' })
  @ApiResponse({ status: 200, description: 'Leads retrieved successfully' })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of leads to retrieve (default: 100)',
  })
  getLeads(@CurrentUser('id') userId: string, @Query('limit') limit?: string) {
    this.logger.log(`Salesforce get leads for user: ${userId}`);

    return this.crmService
      .send(CRM_SERVICE_PATTERNS.SALESFORCE_GET_LEADS, {
        userId,
        limit: limit ? parseInt(limit) : 100,
      })
      .pipe(
        timeout(15000),
        catchError((err: unknown) => {
          const error = err as ServiceError;
          const stack = error.stack ?? JSON.stringify(err);
          this.logger.error(
            `Salesforce get leads failed for user ${userId}`,
            stack,
          );
          const status = error.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
          const message = error.message ?? 'Failed to get Salesforce leads';
          return throwError(() => new HttpException(message, status));
        }),
      );
  }

  /**
   * Sync Salesforce contacts to local CRM
   */
  @Post('sync/contacts')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Sync Salesforce contacts to local CRM' })
  @ApiResponse({ status: 200, description: 'Contacts synced successfully' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        orgId: { type: 'string', description: 'Organization ID' },
      },
      required: ['orgId'],
    },
  })
  syncContacts(
    @CurrentUser('id') userId: string,
    @Body('orgId') orgId: string,
  ) {
    this.logger.log(`Salesforce sync contacts for user: ${userId}`);

    return this.crmService
      .send(CRM_SERVICE_PATTERNS.SALESFORCE_SYNC_CONTACTS, { userId, orgId })
      .pipe(
        timeout(30000), // Longer timeout for sync operation
        catchError((err: unknown) => {
          const error = err as ServiceError;
          const stack = error.stack ?? JSON.stringify(err);
          this.logger.error(
            `Salesforce sync contacts failed for user ${userId}`,
            stack,
          );
          const status = error.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
          const message = error.message ?? 'Failed to sync Salesforce contacts';
          return throwError(() => new HttpException(message, status));
        }),
      );
  }

  /**
   * Execute custom SOQL query
   */
  @Post('query')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Execute custom SOQL query' })
  @ApiResponse({ status: 200, description: 'Query executed successfully' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        soql: { type: 'string', description: 'SOQL query string' },
      },
      required: ['soql'],
    },
  })
  query(@CurrentUser('id') userId: string, @Body('soql') soql: string) {
    this.logger.log(`Salesforce query for user: ${userId}`);

    return this.crmService
      .send(CRM_SERVICE_PATTERNS.SALESFORCE_QUERY, { userId, soql })
      .pipe(
        timeout(15000),
        catchError((err: unknown) => {
          const error = err as ServiceError;
          const stack = error.stack ?? JSON.stringify(err);
          this.logger.error(
            `Salesforce query failed for user ${userId}`,
            stack,
          );
          const status = error.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
          const message = error.message ?? 'Failed to execute Salesforce query';
          return throwError(() => new HttpException(message, status));
        }),
      );
  }

  /**
   * Search Salesforce
   */
  @Post('search')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Search Salesforce using SOSL' })
  @ApiResponse({ status: 200, description: 'Search executed successfully' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query string' },
      },
      required: ['query'],
    },
  })
  search(@CurrentUser('id') userId: string, @Body('query') query: string) {
    this.logger.log(`Salesforce search for user: ${userId}`);

    return this.crmService
      .send(CRM_SERVICE_PATTERNS.SALESFORCE_SEARCH, { userId, query })
      .pipe(
        timeout(15000),
        catchError((err: unknown) => {
          const error = err as ServiceError;
          const stack = error.stack ?? JSON.stringify(err);
          this.logger.error(
            `Salesforce search failed for user ${userId}`,
            stack,
          );
          const status = error.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
          const message = error.message ?? 'Failed to search Salesforce';
          return throwError(() => new HttpException(message, status));
        }),
      );
  }

  /**
   * Disconnect Salesforce integration
   */
  @Delete('disconnect')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Disconnect Salesforce integration' })
  @ApiResponse({
    status: 200,
    description: 'Salesforce disconnected successfully',
  })
  disconnect(@CurrentUser('id') userId: string) {
    this.logger.log(`Salesforce disconnect for user: ${userId}`);

    return this.crmService
      .send(CRM_SERVICE_PATTERNS.SALESFORCE_DISCONNECT, { userId })
      .pipe(
        timeout(10000),
        catchError((err: unknown) => {
          const error = err as ServiceError;
          const stack = error.stack ?? JSON.stringify(err);
          this.logger.error(
            `Salesforce disconnect failed for user ${userId}`,
            stack,
          );
          const status = error.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
          const message = error.message ?? 'Failed to disconnect Salesforce';
          return throwError(() => new HttpException(message, status));
        }),
      );
  }
}
