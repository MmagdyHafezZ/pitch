import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  Inject,
  HttpException,
  HttpStatus,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { catchError, timeout } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { SIMULATION_SERVICE_PATTERNS } from '@pitch/shared-backend/interfaces/message-patterns.interface';
import { GlobalJwtAuthGuard } from '../../guards/global-jwt-auth.guard';
import { UserClaimsInterceptor } from '../../interceptors/user-claims.interceptor';
import { UserClaims } from '../../decorators/user-claims.decorator';
import type { UserClaims as UserClaimsType } from '@pitch/shared-backend/interfaces/user-claims.interface';
import { normalizeError } from '@pitch/shared-backend/helpers/exceptions';

@ApiTags('challenges')
@Controller({ path: 'challenges', version: '1' })
@UseGuards(GlobalJwtAuthGuard)
@UseInterceptors(UserClaimsInterceptor)
@ApiBearerAuth('bearer')
export class ChallengesGatewayController {
  constructor(
    @Inject('SIMULATION_SERVICE') private simulationService: ClientProxy,
  ) {}

  /**
   * POST /v1/challenges/admin/generate
   * Manually trigger challenge generation for a period (dev/admin use)
   */
  @Post('admin/generate')
  @ApiOperation({ summary: 'Trigger challenge generation (admin/dev)' })
  @ApiResponse({ status: 201, description: 'Generation triggered' })
  triggerGenerate(
    @Body() body: { period: 'DAILY' | 'WEEKLY' | 'MONTHLY' },
    @UserClaims() userClaims: UserClaimsType,
  ) {
    return this.simulationService
      .send(SIMULATION_SERVICE_PATTERNS.CHALLENGE_TRIGGER_GENERATE, {
        period: body.period ?? 'DAILY',
        userClaims,
      })
      .pipe(
        timeout(60000),
        catchError((err: unknown) => {
          const error = normalizeError(err);
          return throwError(
            () =>
              new HttpException(
                error.message ?? 'Failed to trigger generation',
                error.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
              ),
          );
        }),
      );
  }

  /**
   * GET /v1/challenges
   * List active challenges with optional period/difficulty filters
   */
  @Get()
  @ApiOperation({ summary: 'List active public challenges' })
  @ApiQuery({
    name: 'period',
    required: false,
    enum: ['DAILY', 'WEEKLY', 'MONTHLY'],
  })
  @ApiQuery({
    name: 'difficulty',
    required: false,
    enum: ['BEGINNER', 'INTERMEDIATE', 'EXPERT', 'MASTER'],
  })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: 'Challenges retrieved successfully',
  })
  listChallenges(
    @Query() query: any,
    @UserClaims() userClaims: UserClaimsType,
  ) {
    return this.simulationService
      .send(SIMULATION_SERVICE_PATTERNS.CHALLENGE_LIST, {
        ...query,
        userClaims,
      })
      .pipe(
        timeout(5000),
        catchError((err: unknown) => {
          const error = normalizeError(err);
          return throwError(
            () =>
              new HttpException(
                error.message ?? 'Failed to list challenges',
                error.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
              ),
          );
        }),
      );
  }

  /**
   * GET /v1/challenges/leaderboard
   * Global leaderboard across all challenges
   */
  @Get('leaderboard')
  @ApiOperation({ summary: 'Get global leaderboard' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Global leaderboard retrieved' })
  globalLeaderboard(
    @Query('limit') limit: string | undefined,
    @UserClaims() userClaims: UserClaimsType,
  ) {
    return this.simulationService
      .send(SIMULATION_SERVICE_PATTERNS.CHALLENGE_LEADERBOARD, {
        limit: limit ? Number(limit) : 20,
        userClaims,
      })
      .pipe(
        timeout(5000),
        catchError((err: unknown) => {
          const error = normalizeError(err);
          return throwError(
            () =>
              new HttpException(
                error.message ?? 'Failed to fetch leaderboard',
                error.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
              ),
          );
        }),
      );
  }

  /**
   * GET /v1/challenges/:id
   * Get a single challenge with user participation status
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get a challenge by ID' })
  @ApiResponse({ status: 200, description: 'Challenge retrieved' })
  @ApiResponse({ status: 404, description: 'Challenge not found' })
  getChallenge(
    @Param('id') id: string,
    @UserClaims() userClaims: UserClaimsType,
  ) {
    return this.simulationService
      .send(SIMULATION_SERVICE_PATTERNS.CHALLENGE_GET, { id, userClaims })
      .pipe(
        timeout(5000),
        catchError((err: unknown) => {
          const error = normalizeError(err);
          return throwError(
            () =>
              new HttpException(
                error.message ?? 'Failed to get challenge',
                error.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
              ),
          );
        }),
      );
  }

  /**
   * POST /v1/challenges/:id/participate
   * Register the current user as a participant
   */
  @Post(':id/participate')
  @ApiOperation({ summary: 'Participate in a challenge' })
  @ApiResponse({ status: 201, description: 'Participation registered' })
  participate(
    @Param('id') challengeId: string,
    @UserClaims() userClaims: UserClaimsType,
  ) {
    return this.simulationService
      .send(SIMULATION_SERVICE_PATTERNS.CHALLENGE_PARTICIPATE, {
        challengeId,
        userClaims,
      })
      .pipe(
        timeout(5000),
        catchError((err: unknown) => {
          const error = normalizeError(err);
          return throwError(
            () =>
              new HttpException(
                error.message ?? 'Failed to participate',
                error.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
              ),
          );
        }),
      );
  }

  /**
   * PUT /v1/challenges/:id/score
   * Submit the final score for a completed session linked to a challenge
   */
  @Put(':id/score')
  @ApiOperation({ summary: 'Submit score for a challenge' })
  @ApiResponse({ status: 200, description: 'Score submitted' })
  submitScore(
    @Param('id') challengeId: string,
    @Body() body: { sessionId: string; score: number },
    @UserClaims() userClaims: UserClaimsType,
  ) {
    return this.simulationService
      .send(SIMULATION_SERVICE_PATTERNS.CHALLENGE_SUBMIT_SCORE, {
        challengeId,
        sessionId: body.sessionId,
        score: body.score,
        userClaims,
      })
      .pipe(
        timeout(5000),
        catchError((err: unknown) => {
          const error = normalizeError(err);
          return throwError(
            () =>
              new HttpException(
                error.message ?? 'Failed to submit score',
                error.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
              ),
          );
        }),
      );
  }

  /**
   * GET /v1/challenges/:id/leaderboard
   * Per-challenge leaderboard
   */
  @Get(':id/leaderboard')
  @ApiOperation({ summary: 'Get per-challenge leaderboard' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Leaderboard retrieved' })
  challengeLeaderboard(
    @Param('id') challengeId: string,
    @Query('limit') limit: string | undefined,
    @UserClaims() userClaims: UserClaimsType,
  ) {
    return this.simulationService
      .send(SIMULATION_SERVICE_PATTERNS.CHALLENGE_LEADERBOARD, {
        challengeId,
        limit: limit ? Number(limit) : 10,
        userClaims,
      })
      .pipe(
        timeout(5000),
        catchError((err: unknown) => {
          const error = normalizeError(err);
          return throwError(
            () =>
              new HttpException(
                error.message ?? 'Failed to fetch leaderboard',
                error.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
              ),
          );
        }),
      );
  }
}
