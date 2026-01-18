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
  CreatePipelineDto,
  UpdatePipelineDto,
  PipelineResponseDto,
  PipelineListQueryDto,
  CreateStageDto,
  UpdateStageDto,
  StageResponseDto,
  ReorderStagesDto,
} from '../dto/pipeline.dto';
import { NotImplementedResponse, notImplemented } from './common';

@ApiTags('CRM - Pipelines')
@ApiBearerAuth()
@Controller('crm/pipelines')
export class PipelinesController {
  @Get()
  @ApiOperation({
    summary: 'List all pipelines',
    description: 'Get all sales pipelines for the organization',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of pipelines',
    type: [PipelineResponseDto],
  })
  @ApiResponse({
    status: HttpStatus.NOT_IMPLEMENTED,
    description: 'Not implemented',
    type: NotImplementedResponse,
  })
  async listPipelines(@Query() query: PipelineListQueryDto) {
    return notImplemented('pipelines', 'List');
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get pipeline by ID',
    description: 'Retrieve a single pipeline with its stages',
  })
  @ApiParam({ name: 'id', description: 'Pipeline ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Pipeline details',
    type: PipelineResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Pipeline not found',
  })
  @ApiResponse({
    status: HttpStatus.NOT_IMPLEMENTED,
    description: 'Not implemented',
    type: NotImplementedResponse,
  })
  async getPipeline(@Param('id') id: string) {
    return notImplemented('pipeline', 'Get');
  }

  @Post()
  @ApiOperation({
    summary: 'Create a new pipeline',
    description: 'Create a new sales pipeline with optional initial stages',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Pipeline created',
    type: PipelineResponseDto,
  })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input' })
  @ApiResponse({
    status: HttpStatus.NOT_IMPLEMENTED,
    description: 'Not implemented',
    type: NotImplementedResponse,
  })
  async createPipeline(@Body() dto: CreatePipelineDto) {
    return notImplemented('pipeline', 'Create');
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Update a pipeline',
    description: 'Update an existing pipeline',
  })
  @ApiParam({ name: 'id', description: 'Pipeline ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Pipeline updated',
    type: PipelineResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Pipeline not found',
  })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input' })
  @ApiResponse({
    status: HttpStatus.NOT_IMPLEMENTED,
    description: 'Not implemented',
    type: NotImplementedResponse,
  })
  async updatePipeline(
    @Param('id') id: string,
    @Body() dto: UpdatePipelineDto,
  ) {
    return notImplemented('pipeline', 'Update');
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete a pipeline',
    description: 'Delete a pipeline (must not have active opportunities)',
  })
  @ApiParam({ name: 'id', description: 'Pipeline ID' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Pipeline deleted',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Pipeline not found',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Pipeline has active opportunities',
  })
  @ApiResponse({
    status: HttpStatus.NOT_IMPLEMENTED,
    description: 'Not implemented',
    type: NotImplementedResponse,
  })
  async deletePipeline(@Param('id') id: string) {
    return notImplemented('pipeline', 'Delete');
  }

  @Put(':id/default')
  @ApiOperation({
    summary: 'Set as default pipeline',
    description: 'Set this pipeline as the default for new opportunities',
  })
  @ApiParam({ name: 'id', description: 'Pipeline ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Default pipeline set',
    type: PipelineResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_IMPLEMENTED,
    description: 'Not implemented',
    type: NotImplementedResponse,
  })
  async setDefaultPipeline(@Param('id') id: string) {
    return notImplemented('default pipeline', 'Set');
  }

  // Stage endpoints
  @Get(':pipelineId/stages')
  @ApiOperation({
    summary: 'List pipeline stages',
    description: 'Get all stages in a pipeline',
  })
  @ApiParam({ name: 'pipelineId', description: 'Pipeline ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of stages',
    type: [StageResponseDto],
  })
  @ApiResponse({
    status: HttpStatus.NOT_IMPLEMENTED,
    description: 'Not implemented',
    type: NotImplementedResponse,
  })
  async listStages(@Param('pipelineId') pipelineId: string) {
    return notImplemented('stages', 'List');
  }

  @Post(':pipelineId/stages')
  @ApiOperation({
    summary: 'Create a stage',
    description: 'Add a new stage to the pipeline',
  })
  @ApiParam({ name: 'pipelineId', description: 'Pipeline ID' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Stage created',
    type: StageResponseDto,
  })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input' })
  @ApiResponse({
    status: HttpStatus.NOT_IMPLEMENTED,
    description: 'Not implemented',
    type: NotImplementedResponse,
  })
  async createStage(
    @Param('pipelineId') pipelineId: string,
    @Body() dto: CreateStageDto,
  ) {
    return notImplemented('stage', 'Create');
  }

  @Put(':pipelineId/stages/:stageId')
  @ApiOperation({
    summary: 'Update a stage',
    description: 'Update an existing stage',
  })
  @ApiParam({ name: 'pipelineId', description: 'Pipeline ID' })
  @ApiParam({ name: 'stageId', description: 'Stage ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Stage updated',
    type: StageResponseDto,
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Stage not found' })
  @ApiResponse({
    status: HttpStatus.NOT_IMPLEMENTED,
    description: 'Not implemented',
    type: NotImplementedResponse,
  })
  async updateStage(
    @Param('pipelineId') pipelineId: string,
    @Param('stageId') stageId: string,
    @Body() dto: UpdateStageDto,
  ) {
    return notImplemented('stage', 'Update');
  }

  @Delete(':pipelineId/stages/:stageId')
  @ApiOperation({
    summary: 'Delete a stage',
    description: 'Delete a stage (must not have opportunities)',
  })
  @ApiParam({ name: 'pipelineId', description: 'Pipeline ID' })
  @ApiParam({ name: 'stageId', description: 'Stage ID' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT, description: 'Stage deleted' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Stage not found' })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Stage has opportunities',
  })
  @ApiResponse({
    status: HttpStatus.NOT_IMPLEMENTED,
    description: 'Not implemented',
    type: NotImplementedResponse,
  })
  async deleteStage(
    @Param('pipelineId') pipelineId: string,
    @Param('stageId') stageId: string,
  ) {
    return notImplemented('stage', 'Delete');
  }

  @Put(':pipelineId/stages/reorder')
  @ApiOperation({
    summary: 'Reorder stages',
    description: 'Change the order of stages in a pipeline',
  })
  @ApiParam({ name: 'pipelineId', description: 'Pipeline ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Stages reordered',
    type: [StageResponseDto],
  })
  @ApiResponse({
    status: HttpStatus.NOT_IMPLEMENTED,
    description: 'Not implemented',
    type: NotImplementedResponse,
  })
  async reorderStages(
    @Param('pipelineId') pipelineId: string,
    @Body() dto: ReorderStagesDto,
  ) {
    return notImplemented('stages', 'Reorder');
  }
}
