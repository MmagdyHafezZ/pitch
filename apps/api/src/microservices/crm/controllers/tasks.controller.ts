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
  CreateTaskDto,
  UpdateTaskDto,
  TaskResponseDto,
  TaskListQueryDto,
} from '../dto/task.dto';
import { NotImplementedResponse, notImplemented } from './common';

@ApiTags('CRM - Tasks')
@ApiBearerAuth()
@Controller('crm/tasks')
export class TasksController {
  @Get()
  @ApiOperation({
    summary: 'List all tasks',
    description: 'Get a paginated list of tasks with optional filters',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of tasks',
    type: [TaskResponseDto],
  })
  @ApiResponse({
    status: HttpStatus.NOT_IMPLEMENTED,
    description: 'Not implemented',
    type: NotImplementedResponse,
  })
  async listTasks(@Query() query: TaskListQueryDto) {
    return notImplemented('tasks', 'List');
  }

  @Get('my-tasks')
  @ApiOperation({
    summary: 'Get my tasks',
    description: 'Get tasks assigned to the current user',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of my tasks',
    type: [TaskResponseDto],
  })
  @ApiResponse({
    status: HttpStatus.NOT_IMPLEMENTED,
    description: 'Not implemented',
    type: NotImplementedResponse,
  })
  async getMyTasks(@Query() query: TaskListQueryDto) {
    return notImplemented('my tasks', 'Get');
  }

  @Get('overdue')
  @ApiOperation({
    summary: 'Get overdue tasks',
    description: 'Get tasks past their due date',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of overdue tasks',
    type: [TaskResponseDto],
  })
  @ApiResponse({
    status: HttpStatus.NOT_IMPLEMENTED,
    description: 'Not implemented',
    type: NotImplementedResponse,
  })
  async getOverdueTasks(@Query() query: TaskListQueryDto) {
    return notImplemented('overdue tasks', 'Get');
  }

  @Get('due-today')
  @ApiOperation({
    summary: 'Get tasks due today',
    description: 'Get tasks with due date today',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of tasks due today',
    type: [TaskResponseDto],
  })
  @ApiResponse({
    status: HttpStatus.NOT_IMPLEMENTED,
    description: 'Not implemented',
    type: NotImplementedResponse,
  })
  async getTasksDueToday(@Query() query: TaskListQueryDto) {
    return notImplemented('tasks due today', 'Get');
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get task by ID',
    description: 'Retrieve a single task by its ID',
  })
  @ApiParam({ name: 'id', description: 'Task ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Task details',
    type: TaskResponseDto,
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Task not found' })
  @ApiResponse({
    status: HttpStatus.NOT_IMPLEMENTED,
    description: 'Not implemented',
    type: NotImplementedResponse,
  })
  async getTask(@Param('id') id: string) {
    return notImplemented('task', 'Get');
  }

  @Post()
  @ApiOperation({
    summary: 'Create a new task',
    description: 'Create a new task',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Task created',
    type: TaskResponseDto,
  })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input' })
  @ApiResponse({
    status: HttpStatus.NOT_IMPLEMENTED,
    description: 'Not implemented',
    type: NotImplementedResponse,
  })
  async createTask(@Body() dto: CreateTaskDto) {
    return notImplemented('task', 'Create');
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Update a task',
    description: 'Update an existing task',
  })
  @ApiParam({ name: 'id', description: 'Task ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Task updated',
    type: TaskResponseDto,
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Task not found' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input' })
  @ApiResponse({
    status: HttpStatus.NOT_IMPLEMENTED,
    description: 'Not implemented',
    type: NotImplementedResponse,
  })
  async updateTask(@Param('id') id: string, @Body() dto: UpdateTaskDto) {
    return notImplemented('task', 'Update');
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete a task',
    description: 'Delete a task record',
  })
  @ApiParam({ name: 'id', description: 'Task ID' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT, description: 'Task deleted' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Task not found' })
  @ApiResponse({
    status: HttpStatus.NOT_IMPLEMENTED,
    description: 'Not implemented',
    type: NotImplementedResponse,
  })
  async deleteTask(@Param('id') id: string) {
    return notImplemented('task', 'Delete');
  }

  @Put(':id/complete')
  @ApiOperation({
    summary: 'Complete a task',
    description: 'Mark a task as completed',
  })
  @ApiParam({ name: 'id', description: 'Task ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Task completed',
    type: TaskResponseDto,
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Task not found' })
  @ApiResponse({
    status: HttpStatus.NOT_IMPLEMENTED,
    description: 'Not implemented',
    type: NotImplementedResponse,
  })
  async completeTask(@Param('id') id: string) {
    return notImplemented('task', 'Complete');
  }

  @Put(':id/reopen')
  @ApiOperation({
    summary: 'Reopen a task',
    description: 'Reopen a completed task',
  })
  @ApiParam({ name: 'id', description: 'Task ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Task reopened',
    type: TaskResponseDto,
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Task not found' })
  @ApiResponse({
    status: HttpStatus.NOT_IMPLEMENTED,
    description: 'Not implemented',
    type: NotImplementedResponse,
  })
  async reopenTask(@Param('id') id: string) {
    return notImplemented('task', 'Reopen');
  }

  @Put(':id/assign')
  @ApiOperation({
    summary: 'Assign a task',
    description: 'Assign or reassign a task to a user',
  })
  @ApiParam({ name: 'id', description: 'Task ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Task assigned',
    type: TaskResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_IMPLEMENTED,
    description: 'Not implemented',
    type: NotImplementedResponse,
  })
  async assignTask(
    @Param('id') id: string,
    @Body() dto: { assignedToId: string },
  ) {
    return notImplemented('task', 'Assign');
  }
}
