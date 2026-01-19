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
import { OpportunitiesService } from '../services/opportunities.service';
import {
  CreateOpportunityDto,
  UpdateOpportunityDto,
  OpportunityResponseDto,
  OpportunityListQueryDto,
} from '../dto/opportunity.dto';

// TODO: Replace with actual user claims from JWT
const MOCK_ORG_ID = 'org_test_123';

@ApiTags('CRM - Opportunities')
@ApiBearerAuth()
@Controller('crm/opportunities')
export class OpportunitiesController {
  constructor(private readonly opportunitiesService: OpportunitiesService) {}

  @Get()
  @ApiOperation({
    summary: 'List all opportunities',
    description: 'Get a paginated list of opportunities with optional filters',
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'List of opportunities' })
  async listOpportunities(@Query() query: OpportunityListQueryDto) {
    return this.opportunitiesService.findAll(MOCK_ORG_ID, query);
  }

  @Get('pipeline')
  @ApiOperation({
    summary: 'Get pipeline summary',
    description: 'Get a summary of opportunities by stage',
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Pipeline summary' })
  async getPipelineSummary() {
    return this.opportunitiesService.getPipelineSummary(MOCK_ORG_ID);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get opportunity by ID' })
  @ApiParam({ name: 'id', description: 'Opportunity ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Opportunity details',
    type: OpportunityResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Opportunity not found',
  })
  async getOpportunity(@Param('id') id: string) {
    return this.opportunitiesService.findById(id, MOCK_ORG_ID);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new opportunity' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Opportunity created',
    type: OpportunityResponseDto,
  })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input' })
  async createOpportunity(@Body() dto: CreateOpportunityDto) {
    return this.opportunitiesService.create(MOCK_ORG_ID, dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update an opportunity' })
  @ApiParam({ name: 'id', description: 'Opportunity ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Opportunity updated',
    type: OpportunityResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Opportunity not found',
  })
  async updateOpportunity(
    @Param('id') id: string,
    @Body() dto: UpdateOpportunityDto,
  ) {
    return this.opportunitiesService.update(id, MOCK_ORG_ID, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete an opportunity' })
  @ApiParam({ name: 'id', description: 'Opportunity ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Opportunity deleted' })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Opportunity not found',
  })
  async deleteOpportunity(@Param('id') id: string) {
    return this.opportunitiesService.delete(id, MOCK_ORG_ID);
  }
}
