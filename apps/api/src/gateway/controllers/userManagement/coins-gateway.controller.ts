import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Query,
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
import { lastValueFrom, throwError } from 'rxjs';
import {
  USER_SERVICE_COIN_PATTERNS,
  SIMULATION_SERVICE_PATTERNS,
} from '@pitch/shared-backend/interfaces/message-patterns.interface';
import { GlobalJwtAuthGuard } from '../../guards/global-jwt-auth.guard';
import { CheckSystemAdmin } from '../../guards/check-system-admin.guard';
import { UserClaimsInterceptor } from '../../interceptors/user-claims.interceptor';
import { UserClaims } from '../../decorators/user-claims.decorator';
import type { UserClaims as UserClaimsType } from '@pitch/shared-backend/interfaces/user-claims.interface';
import { normalizeError } from '@pitch/shared-backend/helpers/exceptions';

type SessionEstimateResponse = {
  estimatedCoins: number;
  estimatedCostUsd: number;
  coinPriceUsd: number;
  markupMultiplier: number;
  model: string;
  provider?: string;
  durationMinutes?: number;
};

@ApiTags('coins')
@Controller({ path: 'coins', version: '1' })
@UseGuards(GlobalJwtAuthGuard)
@UseInterceptors(UserClaimsInterceptor)
@ApiBearerAuth('bearer')
export class CoinsGatewayController {
  constructor(
    @Inject('USER_SERVICE') private readonly userService: ClientProxy,
    @Inject('SIMULATION_SERVICE')
    private readonly simulationService: ClientProxy,
  ) {}

  @Get('balance')
  @ApiOperation({ summary: "Get the active team's current coin balance" })
  @ApiQuery({ name: 'teamId', required: true, type: String })
  async getBalance(@Query('teamId') teamId: string) {
    return lastValueFrom(
      this.userService
        .send<
          | { ok: false; reason: 'NO_ACTIVE_SUBSCRIPTION' }
          | {
              ok: true;
              teamId: string;
              periodKey: string;
              allowance: number;
              remaining: number;
            }
        >(USER_SERVICE_COIN_PATTERNS.COIN_BALANCE_GET, { teamId })
        .pipe(
          timeout(5000),
          catchError((err) => throwError(() => normalizeError(err))),
        ),
    );
  }

  @Get('my-balance')
  @ApiOperation({ summary: "Get the current user's personal coin balance" })
  async getMyBalance(@UserClaims() claims: UserClaimsType) {
    return lastValueFrom(
      this.userService
        .send<{
          ok: true;
          userId: string;
          periodKey: string;
          allowance: number;
          remaining: number;
        }>(USER_SERVICE_COIN_PATTERNS.COIN_USER_BALANCE_GET, {
          userId: claims.id,
        })
        .pipe(
          timeout(5000),
          catchError((err) => throwError(() => normalizeError(err))),
        ),
    );
  }

  // ─── Refill request endpoints ──────────────────────────────────────────

  @Post('refill/request')
  @ApiOperation({ summary: 'Submit a credit refill request' })
  async requestRefill(
    @UserClaims() claims: UserClaimsType,
    @Body() body: { requestedCoins: number; teamId: string },
  ) {
    return lastValueFrom(
      this.userService
        .send(USER_SERVICE_COIN_PATTERNS.COIN_REFILL_REQUEST, {
          userId: claims.id,
          teamId: body.teamId,
          requestedCoins: body.requestedCoins,
        })
        .pipe(
          timeout(5000),
          catchError((err) => throwError(() => normalizeError(err))),
        ),
    );
  }

  @Get('refill/my-request')
  @ApiOperation({ summary: 'Get own pending refill request' })
  async getMyRefillRequest(@UserClaims() claims: UserClaimsType) {
    return lastValueFrom(
      this.userService
        .send(USER_SERVICE_COIN_PATTERNS.COIN_REFILL_MY_REQUEST, {
          userId: claims.id,
        })
        .pipe(
          timeout(5000),
          catchError((err) => throwError(() => normalizeError(err))),
        ),
    );
  }

  @Get('refill/requests')
  @UseGuards(CheckSystemAdmin)
  @ApiOperation({ summary: '[Admin] List all pending refill requests' })
  async listRefillRequests() {
    return lastValueFrom(
      this.userService
        .send(USER_SERVICE_COIN_PATTERNS.COIN_REFILL_REQUEST_LIST, {})
        .pipe(
          timeout(10000),
          catchError((err) => throwError(() => normalizeError(err))),
        ),
    );
  }

  @Post('refill/requests/:userId/approve')
  @UseGuards(CheckSystemAdmin)
  @ApiOperation({ summary: '[Admin] Approve a refill request' })
  async approveRefillRequest(
    @Param('userId') userId: string,
    @Body() body: { approvedCoins: number },
    @UserClaims() claims: UserClaimsType,
  ) {
    return lastValueFrom(
      this.userService
        .send(USER_SERVICE_COIN_PATTERNS.COIN_REFILL_REQUEST_APPROVE, {
          userId,
          approvedCoins: body.approvedCoins,
          reviewer: claims.email,
        })
        .pipe(
          timeout(10000),
          catchError((err) => throwError(() => normalizeError(err))),
        ),
    );
  }

  @Post('refill/requests/:userId/deny')
  @UseGuards(CheckSystemAdmin)
  @ApiOperation({ summary: '[Admin] Deny a refill request' })
  async denyRefillRequest(
    @Param('userId') userId: string,
    @UserClaims() claims: UserClaimsType,
  ) {
    return lastValueFrom(
      this.userService
        .send(USER_SERVICE_COIN_PATTERNS.COIN_REFILL_REQUEST_DENY, {
          userId,
          reviewer: claims.email,
        })
        .pipe(
          timeout(5000),
          catchError((err) => throwError(() => normalizeError(err))),
        ),
    );
  }

  @Get('usage/admin')
  @UseGuards(CheckSystemAdmin)
  @ApiOperation({ summary: '[Admin] Get all-teams coin usage summary' })
  async getAdminUsage() {
    return lastValueFrom(
      this.userService
        .send(USER_SERVICE_COIN_PATTERNS.COIN_USAGE_ADMIN, {})
        .pipe(
          timeout(15000),
          catchError((err) => throwError(() => normalizeError(err))),
        ),
    );
  }

  @Get('ledger/history')
  @ApiOperation({ summary: 'Get coin ledger history for a team' })
  @ApiQuery({ name: 'teamId', required: true })
  @ApiQuery({ name: 'periodKey', required: false })
  async getLedgerHistory(
    @Query('teamId') teamId: string,
    @Query('periodKey') periodKey?: string,
  ) {
    return lastValueFrom(
      this.userService
        .send(USER_SERVICE_COIN_PATTERNS.COIN_LEDGER_HISTORY, {
          teamId,
          periodKey,
        })
        .pipe(
          timeout(8000),
          catchError((err) => throwError(() => normalizeError(err))),
        ),
    );
  }

  @Get('session-estimate')
  @ApiOperation({
    summary: 'Estimate coin cost for a session before starting',
    description:
      'Returns the number of coins that will be reserved when this session starts, based on the model, session type, and expected duration.',
  })
  @ApiQuery({ name: 'model', required: false })
  @ApiQuery({ name: 'provider', required: false })
  @ApiQuery({ name: 'sessionType', required: true })
  @ApiQuery({ name: 'durationMinutes', required: false, type: Number })
  @ApiResponse({
    status: 200,
    schema: {
      properties: {
        estimatedCoins: { type: 'number' },
        estimatedCostUsd: { type: 'number' },
        coinPriceUsd: { type: 'number' },
        markupMultiplier: { type: 'number' },
        model: { type: 'string' },
        provider: { type: 'string' },
        durationMinutes: { type: 'number' },
      },
    },
  })
  async getSessionEstimate(
    @Query('model') model?: string,
    @Query('provider') provider?: string,
    @Query('sessionType') sessionType: string = 'text',
    @Query('durationMinutes') durationMinutes?: string,
  ) {
    return lastValueFrom(
      this.simulationService
        .send<SessionEstimateResponse>(
          SIMULATION_SERVICE_PATTERNS.COIN_SESSION_ESTIMATE,
          {
            model,
            provider,
            sessionType,
            durationMinutes: durationMinutes
              ? Number(durationMinutes)
              : undefined,
          },
        )
        .pipe(
          timeout(8000),
          catchError((err) => throwError(() => normalizeError(err))),
        ),
    );
  }
}
