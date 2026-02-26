import {
  Body,
  Controller,
  Get,
  Inject,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { catchError, timeout } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { SIMULATION_SERVICE_PATTERNS } from '@pitch/shared-backend/interfaces/message-patterns.interface';
import { GlobalJwtAuthGuard } from '../../guards/global-jwt-auth.guard';
import { UserClaimsInterceptor } from '../../interceptors/user-claims.interceptor';
import { UserClaims } from '../../decorators/user-claims.decorator';
import type { UserClaims as UserClaimsType } from '@pitch/shared-backend/interfaces/user-claims.interface';
import { normalizeError } from '@pitch/shared-backend/helpers/exceptions';

@ApiTags('simulation-assessments')
@Controller({ path: 'simulation', version: '1' })
@UseGuards(GlobalJwtAuthGuard)
@UseInterceptors(UserClaimsInterceptor)
@ApiBearerAuth('bearer')
export class AssessmentGatewayController {
  constructor(
    @Inject('SIMULATION_SERVICE') private simulationService: ClientProxy,
  ) {}

  @Post('assessments/run')
  @ApiOperation({ summary: 'Request an assessment run' })
  @ApiResponse({ status: 201, description: 'Assessment run requested' })
  runAssessment(
    @Body() payload: Record<string, unknown>,
    @UserClaims() userClaims: UserClaimsType,
  ) {
    return this.simulationService
      .send(SIMULATION_SERVICE_PATTERNS.ASSESSMENT_RUN, {
        ...payload,
        requestedBy: userClaims.id,
      })
      .pipe(
        timeout(10000),
        catchError((err: unknown) => {
          const error = normalizeError(err);
          const message = error.message ?? 'Failed to request assessment';
          const status = error.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
          return throwError(() => new HttpException(message, status));
        }),
      );
  }

  @Get('assessments/runs/:runId')
  @ApiOperation({ summary: 'Get assessment run status' })
  @ApiResponse({ status: 200, description: 'Assessment run status retrieved' })
  getRunStatus(@Param('runId') runId: string) {
    return this.simulationService
      .send(SIMULATION_SERVICE_PATTERNS.ASSESSMENT_STATUS, { runId })
      .pipe(
        timeout(10000),
        catchError((err: unknown) => {
          const error = normalizeError(err);
          const message = error.message ?? 'Failed to fetch assessment status';
          const status = error.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
          return throwError(() => new HttpException(message, status));
        }),
      );
  }

  @Get('sessions/:id/assessments/latest')
  @ApiOperation({ summary: 'Get latest completed assessment for a session' })
  @ApiQuery({ name: 'iterationId', required: false, type: String })
  @ApiQuery({ name: 'sessionMemberId', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Latest assessment retrieved' })
  getLatest(
    @Param('id') sessionId: string,
    @Query('iterationId') iterationId?: string,
    @Query('sessionMemberId') sessionMemberId?: string,
  ) {
    return this.simulationService
      .send(SIMULATION_SERVICE_PATTERNS.ASSESSMENT_LATEST, {
        sessionId,
        iterationId,
        sessionMemberId,
      })
      .pipe(
        timeout(10000),
        catchError((err: unknown) => {
          const error = normalizeError(err);
          const message = error.message ?? 'Failed to fetch latest assessment';
          const status = error.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
          return throwError(() => new HttpException(message, status));
        }),
      );
  }
}
