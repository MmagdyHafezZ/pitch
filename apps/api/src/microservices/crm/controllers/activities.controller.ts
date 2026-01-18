import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
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
  CreateActivityDto,
  UpdateActivityDto,
  ActivityResponseDto,
  ActivityListQueryDto,
  CompleteActivityDto,
} from '../dto/activity.dto';
import { NotImplementedResponse, notImplemented } from './common';

@ApiTags('CRM - Activities')
@ApiBearerAuth()
@Controller('crm/activities')
export class ActivitiesController {
  @Get()
  @ApiOperation({
    summary: 'List all activities',
    description: 'Get a paginated list of activities (calls, emails, meetings)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of activities',
    type: [ActivityResponseDto],
  })
  @ApiResponse({
    status: HttpStatus.NOT_IMPLEMENTED,
    description: 'Not implemented',
    type: NotImplementedResponse,
  })
  async listActivities(@Query() query: ActivityListQueryDto) {
    return notImplemented('activities', 'List');
  }

  @Get('upcoming')
  @ApiOperation({
    summary: 'Get upcoming activities',
    description: 'Get activities scheduled for the future',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of upcoming activities',
    type: [ActivityResponseDto],
  })
  @ApiResponse({
    status: HttpStatus.NOT_IMPLEMENTED,
    description: 'Not implemented',
    type: NotImplementedResponse,
  })
  async getUpcomingActivities(@Query() query: ActivityListQueryDto) {
    return notImplemented('upcoming activities', 'Get');
  }

  @Get('overdue')
  @ApiOperation({
    summary: 'Get overdue activities',
    description: 'Get activities past their due date',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of overdue activities',
    type: [ActivityResponseDto],
  })
  @ApiResponse({
    status: HttpStatus.NOT_IMPLEMENTED,
    description: 'Not implemented',
    type: NotImplementedResponse,
  })
  async getOverdueActivities(@Query() query: ActivityListQueryDto) {
    return notImplemented('overdue activities', 'Get');
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get activity by ID',
    description: 'Retrieve a single activity by its ID',
  })
  @ApiParam({ name: 'id', description: 'Activity ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Activity details',
    type: ActivityResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Activity not found',
  })
  @ApiResponse({
    status: HttpStatus.NOT_IMPLEMENTED,
    description: 'Not implemented',
    type: NotImplementedResponse,
  })
  async getActivity(@Param('id') id: string) {
    return notImplemented('activity', 'Get');
  }

  @Post()
  @ApiOperation({
    summary: 'Create a new activity',
    description: 'Create a new activity (call, email, meeting, note)',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Activity created',
    type: ActivityResponseDto,
  })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input' })
  @ApiResponse({
    status: HttpStatus.NOT_IMPLEMENTED,
    description: 'Not implemented',
    type: NotImplementedResponse,
  })
  async createActivity(@Body() dto: CreateActivityDto) {
    return notImplemented('activity', 'Create');
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Update an activity',
    description: 'Update an existing activity',
  })
  @ApiParam({ name: 'id', description: 'Activity ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Activity updated',
    type: ActivityResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Activity not found',
  })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input' })
  @ApiResponse({
    status: HttpStatus.NOT_IMPLEMENTED,
    description: 'Not implemented',
    type: NotImplementedResponse,
  })
  async updateActivity(
    @Param('id') id: string,
    @Body() dto: UpdateActivityDto,
  ) {
    return notImplemented('activity', 'Update');
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete an activity',
    description: 'Delete an activity record',
  })
  @ApiParam({ name: 'id', description: 'Activity ID' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Activity deleted',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Activity not found',
  })
  @ApiResponse({
    status: HttpStatus.NOT_IMPLEMENTED,
    description: 'Not implemented',
    type: NotImplementedResponse,
  })
  async deleteActivity(@Param('id') id: string) {
    return notImplemented('activity', 'Delete');
  }

  @Put(':id/complete')
  @ApiOperation({
    summary: 'Complete an activity',
    description: 'Mark an activity as completed with outcome',
  })
  @ApiParam({ name: 'id', description: 'Activity ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Activity completed',
    type: ActivityResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Activity not found',
  })
  @ApiResponse({
    status: HttpStatus.NOT_IMPLEMENTED,
    description: 'Not implemented',
    type: NotImplementedResponse,
  })
  async completeActivity(
    @Param('id') id: string,
    @Body() dto: CompleteActivityDto,
  ) {
    return notImplemented('activity', 'Complete');
  }

  @Put(':id/cancel')
  @ApiOperation({
    summary: 'Cancel an activity',
    description: 'Cancel a scheduled activity',
  })
  @ApiParam({ name: 'id', description: 'Activity ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Activity cancelled',
    type: ActivityResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Activity not found',
  })
  @ApiResponse({
    status: HttpStatus.NOT_IMPLEMENTED,
    description: 'Not implemented',
    type: NotImplementedResponse,
  })
  async cancelActivity(@Param('id') id: string) {
    return notImplemented('activity', 'Cancel');
  }

  @Put(':id/reschedule')
  @ApiOperation({
    summary: 'Reschedule an activity',
    description: 'Change the due date of an activity',
  })
  @ApiParam({ name: 'id', description: 'Activity ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Activity rescheduled',
    type: ActivityResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_IMPLEMENTED,
    description: 'Not implemented',
    type: NotImplementedResponse,
  })
  async rescheduleActivity(
    @Param('id') id: string,
    @Body() dto: { dueDate: string },
  ) {
    return notImplemented('activity', 'Reschedule');
  }
}
