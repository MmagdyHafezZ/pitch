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
  CreateTagDto,
  UpdateTagDto,
  TagResponseDto,
  TagListQueryDto,
} from '../dto/tag.dto';
import { NotImplementedResponse, notImplemented } from './common';

@ApiTags('CRM - Tags')
@ApiBearerAuth()
@Controller('crm/tags')
export class TagsController {
  @Get()
  @ApiOperation({
    summary: 'List all tags',
    description: 'Get all tags for the organization',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of tags',
    type: [TagResponseDto],
  })
  @ApiResponse({
    status: HttpStatus.NOT_IMPLEMENTED,
    description: 'Not implemented',
    type: NotImplementedResponse,
  })
  async listTags(@Query() query: TagListQueryDto) {
    return notImplemented('tags', 'List');
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get tag by ID',
    description: 'Retrieve a single tag by its ID',
  })
  @ApiParam({ name: 'id', description: 'Tag ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Tag details',
    type: TagResponseDto,
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Tag not found' })
  @ApiResponse({
    status: HttpStatus.NOT_IMPLEMENTED,
    description: 'Not implemented',
    type: NotImplementedResponse,
  })
  async getTag(@Param('id') id: string) {
    return notImplemented('tag', 'Get');
  }

  @Post()
  @ApiOperation({
    summary: 'Create a new tag',
    description: 'Create a new tag for categorizing contacts',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Tag created',
    type: TagResponseDto,
  })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input' })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Tag name already exists',
  })
  @ApiResponse({
    status: HttpStatus.NOT_IMPLEMENTED,
    description: 'Not implemented',
    type: NotImplementedResponse,
  })
  async createTag(@Body() dto: CreateTagDto) {
    return notImplemented('tag', 'Create');
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Update a tag',
    description: 'Update an existing tag',
  })
  @ApiParam({ name: 'id', description: 'Tag ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Tag updated',
    type: TagResponseDto,
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Tag not found' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input' })
  @ApiResponse({
    status: HttpStatus.NOT_IMPLEMENTED,
    description: 'Not implemented',
    type: NotImplementedResponse,
  })
  async updateTag(@Param('id') id: string, @Body() dto: UpdateTagDto) {
    return notImplemented('tag', 'Update');
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete a tag',
    description: 'Delete a tag (removes from all contacts)',
  })
  @ApiParam({ name: 'id', description: 'Tag ID' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT, description: 'Tag deleted' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Tag not found' })
  @ApiResponse({
    status: HttpStatus.NOT_IMPLEMENTED,
    description: 'Not implemented',
    type: NotImplementedResponse,
  })
  async deleteTag(@Param('id') id: string) {
    return notImplemented('tag', 'Delete');
  }

  @Get(':id/contacts')
  @ApiOperation({
    summary: 'Get contacts with tag',
    description: 'Get all contacts that have this tag',
  })
  @ApiParam({ name: 'id', description: 'Tag ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'List of contacts' })
  @ApiResponse({
    status: HttpStatus.NOT_IMPLEMENTED,
    description: 'Not implemented',
    type: NotImplementedResponse,
  })
  async getTagContacts(@Param('id') id: string) {
    return notImplemented('tag contacts', 'Get');
  }
}
