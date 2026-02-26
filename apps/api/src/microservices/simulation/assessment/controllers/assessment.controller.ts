import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiInternalServerErrorResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { AssessmentService } from '../assessment.service';
import {
  AssessmentRunRequestDto,
  AssessmentRunResponseDto,
  AssessmentRunStatusResponseDto,
  AssessmentReportResponseDto,
  AssessmentLatestResponseDto,
} from '../dto/assessment.dto';
import { HttpErrorResponseDto } from '../../dto/http-error.dto';

@ApiTags('Assessments')
@Controller()
export class AssessmentController {
  private readonly logger = new Logger(AssessmentController.name);

  constructor(private readonly assessmentService: AssessmentService) {}

  @Post('assessments/run')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Request an assessment run' })
  @ApiCreatedResponse({ type: AssessmentRunResponseDto })
  @ApiBadRequestResponse({
    type: HttpErrorResponseDto,
    description: 'Invalid request payload.',
  })
  @ApiInternalServerErrorResponse({
    type: HttpErrorResponseDto,
    description: 'Unexpected error.',
  })
  async runAssessment(
    @Body() payload: AssessmentRunRequestDto,
  ): Promise<AssessmentRunResponseDto> {
    this.logger.log(`HTTP assessment run request`);
    return await this.assessmentService.requestRun(payload);
  }

  @Get('assessments/runs/:runId')
  @ApiOperation({ summary: 'Get assessment run status and summary' })
  @ApiOkResponse({ type: AssessmentRunStatusResponseDto })
  @ApiNotFoundResponse({
    type: HttpErrorResponseDto,
    description: 'Assessment run not found.',
  })
  async getRunStatus(
    @Param('runId') runId: string,
  ): Promise<AssessmentRunStatusResponseDto> {
    return await this.assessmentService.getRunStatus(runId);
  }

  @Get('assessments/runs/:runId/report')
  @ApiOperation({ summary: 'Get assessment report artifact' })
  @ApiOkResponse({ type: AssessmentReportResponseDto })
  @ApiNotFoundResponse({
    type: HttpErrorResponseDto,
    description: 'Assessment report not found.',
  })
  async getReport(
    @Param('runId') runId: string,
  ): Promise<AssessmentReportResponseDto> {
    return await this.assessmentService.getReport(runId);
  }

  @Get('sessions/:id/assessments/latest')
  @ApiOperation({ summary: 'Get latest completed assessment for a session' })
  @ApiQuery({ name: 'iterationId', required: false, type: String })
  @ApiQuery({ name: 'sessionMemberId', required: false, type: String })
  @ApiOkResponse({ type: AssessmentLatestResponseDto })
  @ApiNotFoundResponse({
    type: HttpErrorResponseDto,
    description: 'No completed assessments found.',
  })
  async getLatestForSession(
    @Param('id') sessionId: string,
    @Query('iterationId') iterationId?: string,
    @Query('sessionMemberId') sessionMemberId?: string,
  ): Promise<AssessmentLatestResponseDto> {
    return await this.assessmentService.getLatest(
      sessionId,
      iterationId,
      sessionMemberId,
    );
  }
}
