import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
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
import { TagsService } from '../services/tags.service';
import { CreateTagDto, UpdateTagDto, TagResponseDto } from '../dto/tag.dto';

// TODO: Replace with actual user claims from JWT
const MOCK_ORG_ID = 'org_test_123';

@ApiTags('CRM - Tags')
@ApiBearerAuth()
@Controller('crm/tags')
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}

  @Get()
  @ApiOperation({ summary: 'List all tags' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of tags',
    type: [TagResponseDto],
  })
  async listTags() {
    return this.tagsService.findAll(MOCK_ORG_ID);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get tag by ID' })
  @ApiParam({ name: 'id', description: 'Tag ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Tag details',
    type: TagResponseDto,
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Tag not found' })
  async getTag(@Param('id') id: string) {
    return this.tagsService.findById(id, MOCK_ORG_ID);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new tag' })
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
  async createTag(@Body() dto: CreateTagDto) {
    return this.tagsService.create(MOCK_ORG_ID, dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a tag' })
  @ApiParam({ name: 'id', description: 'Tag ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Tag updated',
    type: TagResponseDto,
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Tag not found' })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Tag name already exists',
  })
  async updateTag(@Param('id') id: string, @Body() dto: UpdateTagDto) {
    return this.tagsService.update(id, MOCK_ORG_ID, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a tag' })
  @ApiParam({ name: 'id', description: 'Tag ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Tag deleted' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Tag not found' })
  async deleteTag(@Param('id') id: string) {
    return this.tagsService.delete(id, MOCK_ORG_ID);
  }
}
