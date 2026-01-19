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
  HttpCode,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ActivitiesService } from '../services/activities.service';
import {
  CreateActivityDto,
  UpdateActivityDto,
  ActivityResponseDto,
  ActivityListQueryDto,
  CompleteActivityDto,
} from '../dto/activity.dto';

// TODO: Replace with actual user claims from JWT
const MOCK_ORG_ID = 'org_test_123';
const MOCK_USER_ID = 'user_test_123';

@ApiTags('CRM - Activities')
@ApiBearerAuth()
@Controller('crm/activities')
export class ActivitiesController {
  constructor(private readonly activitiesService: ActivitiesService) {}

  @Get()
  @ApiOperation({
    summary: 'List all activities',
    description: 'Get a paginated list of activities (calls, emails, meetings)',
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'List of activities' })
  async listActivities(@Query() query: ActivityListQueryDto) {
    return this.activitiesService.findAll(MOCK_ORG_ID, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get activity by ID' })
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
  async getActivity(@Param('id') id: string) {
    return this.activitiesService.findById(id, MOCK_ORG_ID);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new activity' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Activity created',
    type: ActivityResponseDto,
  })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input' })
  async createActivity(@Body() dto: CreateActivityDto) {
    return this.activitiesService.create(MOCK_ORG_ID, MOCK_USER_ID, dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update an activity' })
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
  async updateActivity(
    @Param('id') id: string,
    @Body() dto: UpdateActivityDto,
  ) {
    return this.activitiesService.update(id, MOCK_ORG_ID, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete an activity' })
  @ApiParam({ name: 'id', description: 'Activity ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Activity deleted' })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Activity not found',
  })
  async deleteActivity(@Param('id') id: string) {
    return this.activitiesService.delete(id, MOCK_ORG_ID);
  }

  @Post(':id/complete')
  @ApiOperation({ summary: 'Mark activity as completed' })
  @ApiParam({ name: 'id', description: 'Activity ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Activity completed' })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Activity not found',
  })
  async completeActivity(
    @Param('id') id: string,
    @Body() dto: CompleteActivityDto,
  ) {
    return this.activitiesService.complete(id, MOCK_ORG_ID, dto.outcome);
  }
}
