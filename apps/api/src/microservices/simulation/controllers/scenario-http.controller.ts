import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ScenarioService } from '../services/scenario.service';
import {
  GenerateScenarioRequestDto,
  ScenarioResponseDto,
  ScenarioListResponseDto,
  GenerateScenarioBatchRequestDto,
} from '../dto/scenario.dto';
import { HttpErrorResponseDto } from '../dto/http-error.dto';

@ApiTags('Simulation - Scenarios')
@Controller('simulation/scenarios')
export class ScenarioHttpController {
  constructor(private readonly scenarioService: ScenarioService) {}

  @Post('generate')
  @ApiOperation({ summary: 'Generate a scenario using configured LLMs' })
  @ApiCreatedResponse({ type: ScenarioResponseDto })
  @ApiBadRequestResponse({
    type: HttpErrorResponseDto,
    description: 'Invalid request payload.',
  })
  @ApiInternalServerErrorResponse({
    type: HttpErrorResponseDto,
    description: 'Unexpected error.',
  })
  async generateScenario(
    @Body() payload: GenerateScenarioRequestDto,
  ): Promise<ScenarioResponseDto> {
    return await this.scenarioService.generate(payload);
  }

  @Post('generate/batch')
  @ApiOperation({
    summary: 'Generate multiple scenarios using configured LLMs',
  })
  @ApiCreatedResponse({ type: ScenarioListResponseDto })
  @ApiBadRequestResponse({
    type: HttpErrorResponseDto,
    description: 'Invalid request payload.',
  })
  @ApiInternalServerErrorResponse({
    type: HttpErrorResponseDto,
    description: 'Unexpected error.',
  })
  async generateScenarioBatch(
    @Body() payload: GenerateScenarioBatchRequestDto,
  ): Promise<ScenarioListResponseDto> {
    return await this.scenarioService.generateBatch(payload);
  }

  @Get()
  @ApiOperation({ summary: 'List scenarios' })
  @ApiOkResponse({ type: ScenarioListResponseDto })
  async listScenarios(@Query('orgId') orgId?: string) {
    return await this.scenarioService.findAll(orgId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get scenario by ID' })
  @ApiOkResponse({ type: ScenarioResponseDto })
  @ApiNotFoundResponse({
    type: HttpErrorResponseDto,
    description: 'Scenario not found.',
  })
  async getScenario(@Param('id') id: string): Promise<ScenarioResponseDto> {
    return await this.scenarioService.findById(id);
  }
}
