import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Inject,
  HttpException,
  HttpStatus,
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

@ApiTags('simulation-hints')
@Controller({ path: 'simulation/hints', version: '1' })
@UseGuards(GlobalJwtAuthGuard)
@UseInterceptors(UserClaimsInterceptor)
@ApiBearerAuth('bearer')
export class HintsGatewayController {
  constructor(
    @Inject('SIMULATION_SERVICE') private simulationService: ClientProxy,
  ) {}

  private getSessionId(payload: { sessionId?: unknown }): string | undefined {
    return typeof payload.sessionId === 'string'
      ? payload.sessionId
      : undefined;
  }

  @Get('history')
  @ApiOperation({ summary: 'Get hint history for a session' })
  @ApiQuery({ name: 'sessionId', required: true, type: String })
  @ApiQuery({ name: 'iterationId', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'type', required: false, type: String })
  @ApiResponse({
    status: 200,
    description: 'Hint history retrieved successfully',
  })
  getHistory(
    @Query('sessionId') sessionId: string,
    @Query('iterationId') iterationId: string | undefined,
    @Query('limit') limit: string | undefined,
    @Query('type') type: string | undefined,
    @UserClaims() userClaims: UserClaimsType,
  ) {
    return this.simulationService
      .send(SIMULATION_SERVICE_PATTERNS.HINTS_HISTORY, {
        payload: {
          sessionId,
          iterationId,
          limit: limit ? Number(limit) : undefined,
          type,
          userId: userClaims.id,
        },
        userId: userClaims.id,
        sessionId,
        requestId: `hint-history-${Date.now()}`,
      })
      .pipe(
        timeout(10000),
        catchError((err: unknown) => {
          const error = normalizeError(err);
          const message = error.message ?? 'Failed to fetch hints';
          const status = error.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
          return throwError(() => new HttpException(message, status));
        }),
      );
  }

  @Post('generate')
  @ApiOperation({ summary: 'Generate hints for a session' })
  @ApiResponse({ status: 201, description: 'Hints generated successfully' })
  generateHints(
    @Body() payload: Record<string, unknown>,
    @UserClaims() userClaims: UserClaimsType,
  ) {
    const sessionId = this.getSessionId(payload);
    return this.simulationService
      .send(SIMULATION_SERVICE_PATTERNS.HINTS_GENERATE, {
        payload: {
          ...payload,
          userId: userClaims.id,
        },
        userId: userClaims.id,
        sessionId,
        requestId: `hint-generate-${Date.now()}`,
      })
      .pipe(
        timeout(15000),
        catchError((err: unknown) => {
          const error = normalizeError(err);
          const message = error.message ?? 'Failed to generate hints';
          const status = error.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
          return throwError(() => new HttpException(message, status));
        }),
      );
  }
}
