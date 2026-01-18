import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import {
  ConnectCrmDto,
  DisconnectCrmDto,
  CrmProvider,
} from '../dto/connect-crm.dto';
import { NotImplementedResponse, notImplemented } from './common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class CrmConnectionResponseDto {
  @ApiProperty({ enum: CrmProvider })
  provider: CrmProvider;

  @ApiProperty({ example: true })
  isConnected: boolean;

  @ApiPropertyOptional({ example: 'john@example.com' })
  connectedAs?: string;

  @ApiPropertyOptional()
  connectedAt?: Date;

  @ApiPropertyOptional()
  lastSyncAt?: Date;

  @ApiPropertyOptional({ example: 'success' })
  lastSyncStatus?: string;
}

class SyncResultDto {
  @ApiProperty({ example: 'success' })
  status: string;

  @ApiProperty({ example: 150 })
  contactsSynced: number;

  @ApiProperty({ example: 45 })
  accountsSynced: number;

  @ApiProperty({ example: 23 })
  opportunitiesSynced: number;

  @ApiProperty()
  syncedAt: Date;

  @ApiPropertyOptional({ type: [String] })
  errors?: string[];
}

@ApiTags('CRM - External Connections')
@ApiBearerAuth()
@Controller('crm/connections')
export class CrmConnectionsController {
  @Get()
  @ApiOperation({
    summary: 'List CRM connections',
    description: 'Get status of all external CRM connections',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of CRM connections',
    type: [CrmConnectionResponseDto],
  })
  @ApiResponse({
    status: HttpStatus.NOT_IMPLEMENTED,
    description: 'Not implemented',
    type: NotImplementedResponse,
  })
  async listConnections() {
    return notImplemented('CRM connections', 'List');
  }

  @Get(':provider')
  @ApiOperation({
    summary: 'Get connection status',
    description: 'Get status of a specific CRM connection',
  })
  @ApiParam({
    name: 'provider',
    enum: CrmProvider,
    description: 'CRM provider',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Connection status',
    type: CrmConnectionResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_IMPLEMENTED,
    description: 'Not implemented',
    type: NotImplementedResponse,
  })
  async getConnectionStatus(@Param('provider') provider: CrmProvider) {
    return notImplemented('connection status', 'Get');
  }

  @Post('connect')
  @ApiOperation({
    summary: 'Connect to external CRM',
    description:
      'Establish connection to an external CRM (Salesforce, HubSpot, etc.)',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Connection established',
    type: CrmConnectionResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid credentials or connection failed',
  })
  @ApiResponse({
    status: HttpStatus.NOT_IMPLEMENTED,
    description: 'Not implemented',
    type: NotImplementedResponse,
  })
  async connect(@Body() dto: ConnectCrmDto) {
    return notImplemented('CRM connection', 'Establish');
  }

  @Post(':provider/oauth/authorize')
  @ApiOperation({
    summary: 'Initiate OAuth flow',
    description: 'Get OAuth authorization URL for CRM provider',
  })
  @ApiParam({
    name: 'provider',
    enum: CrmProvider,
    description: 'CRM provider',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'OAuth authorization URL',
  })
  @ApiResponse({
    status: HttpStatus.NOT_IMPLEMENTED,
    description: 'Not implemented',
    type: NotImplementedResponse,
  })
  async initiateOAuth(@Param('provider') provider: CrmProvider) {
    return notImplemented('OAuth flow', 'Initiate');
  }

  @Post(':provider/oauth/callback')
  @ApiOperation({
    summary: 'OAuth callback',
    description: 'Handle OAuth callback and complete connection',
  })
  @ApiParam({
    name: 'provider',
    enum: CrmProvider,
    description: 'CRM provider',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Connection completed',
    type: CrmConnectionResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_IMPLEMENTED,
    description: 'Not implemented',
    type: NotImplementedResponse,
  })
  async handleOAuthCallback(
    @Param('provider') provider: CrmProvider,
    @Body() dto: { code: string; state?: string },
  ) {
    return notImplemented('OAuth callback', 'Handle');
  }

  @Delete(':provider')
  @ApiOperation({
    summary: 'Disconnect from CRM',
    description: 'Disconnect from an external CRM provider',
  })
  @ApiParam({
    name: 'provider',
    enum: CrmProvider,
    description: 'CRM provider',
  })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Disconnected successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Connection not found',
  })
  @ApiResponse({
    status: HttpStatus.NOT_IMPLEMENTED,
    description: 'Not implemented',
    type: NotImplementedResponse,
  })
  async disconnect(@Param('provider') provider: CrmProvider) {
    return notImplemented('CRM connection', 'Disconnect');
  }

  @Post(':provider/sync')
  @ApiOperation({
    summary: 'Trigger sync',
    description: 'Manually trigger sync with external CRM',
  })
  @ApiParam({
    name: 'provider',
    enum: CrmProvider,
    description: 'CRM provider',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Sync completed',
    type: SyncResultDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Connection not found',
  })
  @ApiResponse({
    status: HttpStatus.NOT_IMPLEMENTED,
    description: 'Not implemented',
    type: NotImplementedResponse,
  })
  async triggerSync(@Param('provider') provider: CrmProvider) {
    return notImplemented('CRM sync', 'Trigger');
  }

  @Get(':provider/sync/status')
  @ApiOperation({
    summary: 'Get sync status',
    description: 'Get current sync status and history',
  })
  @ApiParam({
    name: 'provider',
    enum: CrmProvider,
    description: 'CRM provider',
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Sync status' })
  @ApiResponse({
    status: HttpStatus.NOT_IMPLEMENTED,
    description: 'Not implemented',
    type: NotImplementedResponse,
  })
  async getSyncStatus(@Param('provider') provider: CrmProvider) {
    return notImplemented('sync status', 'Get');
  }

  @Post(':provider/sync/contacts')
  @ApiOperation({
    summary: 'Sync contacts only',
    description: 'Sync only contacts from external CRM',
  })
  @ApiParam({
    name: 'provider',
    enum: CrmProvider,
    description: 'CRM provider',
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Contacts synced' })
  @ApiResponse({
    status: HttpStatus.NOT_IMPLEMENTED,
    description: 'Not implemented',
    type: NotImplementedResponse,
  })
  async syncContacts(@Param('provider') provider: CrmProvider) {
    return notImplemented('contacts sync', 'Trigger');
  }

  @Post(':provider/sync/accounts')
  @ApiOperation({
    summary: 'Sync accounts only',
    description: 'Sync only accounts from external CRM',
  })
  @ApiParam({
    name: 'provider',
    enum: CrmProvider,
    description: 'CRM provider',
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Accounts synced' })
  @ApiResponse({
    status: HttpStatus.NOT_IMPLEMENTED,
    description: 'Not implemented',
    type: NotImplementedResponse,
  })
  async syncAccounts(@Param('provider') provider: CrmProvider) {
    return notImplemented('accounts sync', 'Trigger');
  }

  @Post(':provider/sync/opportunities')
  @ApiOperation({
    summary: 'Sync opportunities only',
    description: 'Sync only opportunities/deals from external CRM',
  })
  @ApiParam({
    name: 'provider',
    enum: CrmProvider,
    description: 'CRM provider',
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Opportunities synced' })
  @ApiResponse({
    status: HttpStatus.NOT_IMPLEMENTED,
    description: 'Not implemented',
    type: NotImplementedResponse,
  })
  async syncOpportunities(@Param('provider') provider: CrmProvider) {
    return notImplemented('opportunities sync', 'Trigger');
  }
}
