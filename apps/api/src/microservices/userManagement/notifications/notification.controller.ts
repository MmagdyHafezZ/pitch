import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  BatchCreateResponseDto,
  CreateNotificationBatchDto,
  CreateNotificationDto,
  ListNotificationsQueryDto,
  ListNotificationsResponseDto,
  MarkReadDto,
  MarkReadResponseDto,
  NotificationDto,
  UnreadCountResponseDto,
} from './notification.dto';
import { NotificationService } from './notification.service';

@ApiTags('notifications')
@Controller({ path: 'notifications', version: '1' })
export class NotificationController {
  constructor(private readonly notifications: NotificationService) {}

  @Post()
  @ApiOperation({ summary: 'Create a single notification' })
  @ApiResponse({
    status: 201,
    description: 'Notification created successfully',
    type: NotificationDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid notification payload' })
  async createOne(
    @Body() dto: CreateNotificationDto,
  ): Promise<NotificationDto> {
    return this.notifications.createOne(dto);
  }

  @Post('batch')
  @ApiOperation({ summary: 'Create notifications for multiple users' })
  @ApiResponse({
    status: 201,
    description: 'Batch notifications created successfully',
    type: BatchCreateResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid batch payload' })
  async createBatch(
    @Body() dto: CreateNotificationBatchDto,
  ): Promise<BatchCreateResponseDto> {
    return this.notifications.createBatch(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List notifications' })
  @ApiQuery({ name: 'recipientUserId', required: false })
  @ApiQuery({ name: 'unreadOnly', required: false })
  @ApiQuery({ name: 'type', required: false })
  @ApiQuery({ name: 'skip', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiResponse({
    status: 200,
    description: 'Notification list retrieved successfully',
    type: ListNotificationsResponseDto,
  })
  async list(
    @Query() query: ListNotificationsQueryDto,
  ): Promise<ListNotificationsResponseDto> {
    return this.notifications.list(query);
  }

  @Get('unread-count/:userId')
  @ApiOperation({ summary: 'Get unread notification count' })
  @ApiParam({ name: 'userId', example: 'user_123' })
  @ApiResponse({
    status: 200,
    description: 'Unread count retrieved successfully',
    type: UnreadCountResponseDto,
  })
  async unreadCount(
    @Param('userId') userId: string,
  ): Promise<UnreadCountResponseDto> {
    const count = await this.notifications.unreadCount(userId);
    return { count };
  }

  @Patch('mark-read')
  @ApiOperation({ summary: 'Mark one or more notifications as read' })
  @ApiResponse({
    status: 200,
    description: 'Notifications marked as read',
    type: MarkReadResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid notification IDs' })
  async markRead(@Body() dto: MarkReadDto): Promise<MarkReadResponseDto> {
    return this.notifications.markRead(dto);
  }

  @Patch('mark-all-read/:userId')
  @ApiOperation({ summary: 'Mark all notifications as read for a user' })
  @ApiParam({ name: 'userId', example: 'user_123' })
  @ApiResponse({
    status: 200,
    description: 'All notifications marked as read',
    type: MarkReadResponseDto,
  })
  async markAllRead(
    @Param('userId') userId: string,
  ): Promise<MarkReadResponseDto> {
    return this.notifications.markAllRead(userId);
  }
}
