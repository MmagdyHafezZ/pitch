import {
  Controller,
  Get,
  Post,
  Param,
  Query,
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
  WebhookEventResponseDto,
  WebhookEventListQueryDto,
} from '../dto/webhook.dto';
import { NotImplementedResponse, notImplemented } from './common';

@ApiTags('CRM - Webhooks')
@ApiBearerAuth()
@Controller('crm/webhooks')
export class WebhooksController {
  @Get()
  @ApiOperation({
    summary: 'List webhook events',
    description:
      'Get a paginated list of webhook events (inbound and outbound)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of webhook events',
    type: [WebhookEventResponseDto],
  })
  @ApiResponse({
    status: HttpStatus.NOT_IMPLEMENTED,
    description: 'Not implemented',
    type: NotImplementedResponse,
  })
  async listWebhookEvents(@Query() query: WebhookEventListQueryDto) {
    return notImplemented('webhook events', 'List');
  }

  @Get('stats')
  @ApiOperation({
    summary: 'Get webhook stats',
    description: 'Get statistics on webhook delivery success/failure rates',
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Webhook statistics' })
  @ApiResponse({
    status: HttpStatus.NOT_IMPLEMENTED,
    description: 'Not implemented',
    type: NotImplementedResponse,
  })
  async getWebhookStats() {
    return notImplemented('webhook stats', 'Get');
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get webhook event',
    description: 'Get details of a specific webhook event',
  })
  @ApiParam({ name: 'id', description: 'Webhook Event ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Webhook event details',
    type: WebhookEventResponseDto,
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Event not found' })
  @ApiResponse({
    status: HttpStatus.NOT_IMPLEMENTED,
    description: 'Not implemented',
    type: NotImplementedResponse,
  })
  async getWebhookEvent(@Param('id') id: string) {
    return notImplemented('webhook event', 'Get');
  }

  @Post(':id/retry')
  @ApiOperation({
    summary: 'Retry webhook',
    description: 'Manually retry a failed webhook event',
  })
  @ApiParam({ name: 'id', description: 'Webhook Event ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Retry initiated',
    type: WebhookEventResponseDto,
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Event not found' })
  @ApiResponse({
    status: HttpStatus.NOT_IMPLEMENTED,
    description: 'Not implemented',
    type: NotImplementedResponse,
  })
  async retryWebhook(@Param('id') id: string) {
    return notImplemented('webhook', 'Retry');
  }
}
