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
  CreateSalesGoalDto,
  UpdateSalesGoalDto,
  SalesGoalResponseDto,
  SalesGoalListQueryDto,
} from '../dto/sales-goal.dto';
import { NotImplementedResponse, notImplemented } from './common';

@ApiTags('CRM - Sales Goals')
@ApiBearerAuth()
@Controller('crm/sales-goals')
export class SalesGoalsController {
  @Get()
  @ApiOperation({
    summary: 'List all sales goals',
    description: 'Get a paginated list of sales goals and quotas',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of sales goals',
    type: [SalesGoalResponseDto],
  })
  @ApiResponse({
    status: HttpStatus.NOT_IMPLEMENTED,
    description: 'Not implemented',
    type: NotImplementedResponse,
  })
  async listSalesGoals(@Query() query: SalesGoalListQueryDto) {
    return notImplemented('sales goals', 'List');
  }

  @Get('my-goals')
  @ApiOperation({
    summary: 'Get my sales goals',
    description: 'Get sales goals for the current user',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'My sales goals',
    type: [SalesGoalResponseDto],
  })
  @ApiResponse({
    status: HttpStatus.NOT_IMPLEMENTED,
    description: 'Not implemented',
    type: NotImplementedResponse,
  })
  async getMyGoals(@Query() query: SalesGoalListQueryDto) {
    return notImplemented('my sales goals', 'Get');
  }

  @Get('team-progress')
  @ApiOperation({
    summary: 'Get team progress',
    description: 'Get progress of all team members towards their goals',
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Team progress' })
  @ApiResponse({
    status: HttpStatus.NOT_IMPLEMENTED,
    description: 'Not implemented',
    type: NotImplementedResponse,
  })
  async getTeamProgress() {
    return notImplemented('team progress', 'Get');
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get sales goal by ID',
    description: 'Retrieve a single sales goal by its ID',
  })
  @ApiParam({ name: 'id', description: 'Sales Goal ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Sales goal details',
    type: SalesGoalResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Sales goal not found',
  })
  @ApiResponse({
    status: HttpStatus.NOT_IMPLEMENTED,
    description: 'Not implemented',
    type: NotImplementedResponse,
  })
  async getSalesGoal(@Param('id') id: string) {
    return notImplemented('sales goal', 'Get');
  }

  @Post()
  @ApiOperation({
    summary: 'Create a new sales goal',
    description: 'Create a new sales goal or quota',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Sales goal created',
    type: SalesGoalResponseDto,
  })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input' })
  @ApiResponse({
    status: HttpStatus.NOT_IMPLEMENTED,
    description: 'Not implemented',
    type: NotImplementedResponse,
  })
  async createSalesGoal(@Body() dto: CreateSalesGoalDto) {
    return notImplemented('sales goal', 'Create');
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Update a sales goal',
    description: 'Update an existing sales goal',
  })
  @ApiParam({ name: 'id', description: 'Sales Goal ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Sales goal updated',
    type: SalesGoalResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Sales goal not found',
  })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input' })
  @ApiResponse({
    status: HttpStatus.NOT_IMPLEMENTED,
    description: 'Not implemented',
    type: NotImplementedResponse,
  })
  async updateSalesGoal(
    @Param('id') id: string,
    @Body() dto: UpdateSalesGoalDto,
  ) {
    return notImplemented('sales goal', 'Update');
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete a sales goal',
    description: 'Delete a sales goal',
  })
  @ApiParam({ name: 'id', description: 'Sales Goal ID' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Sales goal deleted',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Sales goal not found',
  })
  @ApiResponse({
    status: HttpStatus.NOT_IMPLEMENTED,
    description: 'Not implemented',
    type: NotImplementedResponse,
  })
  async deleteSalesGoal(@Param('id') id: string) {
    return notImplemented('sales goal', 'Delete');
  }

  @Get(':id/progress')
  @ApiOperation({
    summary: 'Get goal progress',
    description: 'Get detailed progress towards a specific goal',
  })
  @ApiParam({ name: 'id', description: 'Sales Goal ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Goal progress details' })
  @ApiResponse({
    status: HttpStatus.NOT_IMPLEMENTED,
    description: 'Not implemented',
    type: NotImplementedResponse,
  })
  async getGoalProgress(@Param('id') id: string) {
    return notImplemented('goal progress', 'Get');
  }

  @Put(':id/actual')
  @ApiOperation({
    summary: 'Update actual amount',
    description: 'Manually update the actual amount achieved',
  })
  @ApiParam({ name: 'id', description: 'Sales Goal ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Actual amount updated',
    type: SalesGoalResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_IMPLEMENTED,
    description: 'Not implemented',
    type: NotImplementedResponse,
  })
  async updateActualAmount(
    @Param('id') id: string,
    @Body() dto: { actualAmount: number },
  ) {
    return notImplemented('actual amount', 'Update');
  }
}
