import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Inject,
  HttpException,
  HttpStatus,
  UseGuards,
  UseInterceptors,
  ValidationPipe,
  UsePipes,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { catchError, timeout } from 'rxjs/operators';
import { lastValueFrom, throwError } from 'rxjs';
import { USER_SERVICE_PATTERNS } from '@pitch/shared-backend/interfaces/message-patterns.interface';
import { GlobalJwtAuthGuard } from '../../guards/global-jwt-auth.guard';
import { UserClaimsInterceptor } from '../../interceptors/user-claims.interceptor';
import { UserClaims } from '../../decorators/user-claims.decorator';
import type { UserClaims as UserClaimsType } from '@pitch/shared-backend/interfaces/user-claims.interface';
import { normalizeError } from '@pitch/shared-backend/helpers/exceptions';
import {
  CreateSubscriptionRequestDTO,
  UpdateSubscriptionRequestDTO,
  UpgradeSubscriptionRequestDTO,
} from '@microservices/userManagement/subscription/dto/subscription.dto';

@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
@UseGuards(GlobalJwtAuthGuard)
@UseInterceptors(UserClaimsInterceptor)
@ApiBearerAuth('bearer')
@ApiTags('subscriptions')
@Controller({ path: 'subscriptions', version: '1' })
export class SubscriptionGatewayController {
  constructor(
    @Inject('USER_SERVICE') private readonly userService: ClientProxy,
  ) {}

  private isSystemAdmin(userClaims: UserClaimsType): boolean {
    const normalizedEmail = userClaims.email.trim().toLowerCase();
    return (process.env.SUPER_ADMIN_EMAILS ?? '')
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
      .includes(normalizedEmail);
  }

  private async provisionPersonalWorkspace(
    userClaims: UserClaimsType,
  ): Promise<string> {
    const user = await lastValueFrom(
      this.userService
        .send<{
          id: string;
          email: string;
          name: string;
          settings?: Record<string, unknown> | null;
        }>(USER_SERVICE_PATTERNS.GET_USER, {
          userId: userClaims.id,
          userClaims,
        })
        .pipe(
          timeout(5000),
          catchError((err: unknown) => {
            const error = normalizeError(err);
            const message = error.message ?? 'Failed to load account';
            const status = error.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
            return throwError(() => new HttpException(message, status));
          }),
        ),
    );

    const createdTeam = await lastValueFrom(
      this.userService
        .send<{ id: string }>(USER_SERVICE_PATTERNS.CREATE_TEAM, {
          name: `${(user.name || 'My').trim()}'s Workspace`,
          billingEmail: user.email,
          metadata: {
            notes:
              'Auto-provisioned personal workspace for subscription access.',
          },
          isSystemProvisioned: true,
          userClaims,
        })
        .pipe(
          timeout(5000),
          catchError((err: unknown) => {
            const error = normalizeError(err);
            const message =
              error.message ?? 'Failed to provision personal workspace';
            const status = error.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
            return throwError(() => new HttpException(message, status));
          }),
        ),
    );

    const currentSettings =
      user.settings &&
      typeof user.settings === 'object' &&
      !Array.isArray(user.settings)
        ? user.settings
        : {};
    const currentStudioAccess =
      currentSettings['studioAccess'] &&
      typeof currentSettings['studioAccess'] === 'object' &&
      !Array.isArray(currentSettings['studioAccess'])
        ? (currentSettings['studioAccess'] as Record<string, unknown>)
        : {};

    await lastValueFrom(
      this.userService
        .send(USER_SERVICE_PATTERNS.UPDATE_MY_SETTINGS, {
          settings: {
            ...currentSettings,
            studioAccess: {
              ...currentStudioAccess,
              teamId: createdTeam.id,
            },
          },
          userClaims,
        })
        .pipe(
          timeout(5000),
          catchError((err: unknown) => {
            const error = normalizeError(err);
            const message =
              error.message ?? 'Failed to update personal workspace settings';
            const status = error.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
            return throwError(() => new HttpException(message, status));
          }),
        ),
    );

    return createdTeam.id;
  }

  private async resolveAccessibleTeamId(
    userClaims: UserClaimsType,
    preferredTeamId?: string,
  ): Promise<string> {
    const teams = await lastValueFrom(
      this.userService
        .send<
          Array<{
            id: string;
            memberships?: Array<{ isActive?: boolean }>;
          }>
        >(USER_SERVICE_PATTERNS.GET_USER_TEAMS, {
          userClaims,
        })
        .pipe(
          timeout(5000),
          catchError((err: unknown) => {
            const error = normalizeError(err);
            const message = error.message ?? 'Failed to resolve user teams';
            const status = error.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
            return throwError(() => new HttpException(message, status));
          }),
        ),
    );

    const teamList = Array.isArray(teams) ? teams : [];
    if (teamList.length === 0) {
      return this.provisionPersonalWorkspace(userClaims);
    }

    const preferred = preferredTeamId
      ? teamList.find((team) => team.id === preferredTeamId)
      : null;
    if (preferred) {
      return preferred.id;
    }

    const personalWorkspace = teamList.find(
      (team) =>
        !team.memberships ||
        team.memberships.filter((membership) => membership.isActive !== false)
          .length <= 1,
    );

    return personalWorkspace?.id ?? teamList[0].id;
  }

  @Post()
  @ApiOperation({ summary: 'Create new subscription' })
  @ApiResponse({
    status: 201,
    description: 'Subscription created successfully',
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  async createSubscription(
    @Body() createSubscriptionDto: CreateSubscriptionRequestDTO,
    @UserClaims() userClaims: UserClaimsType,
  ) {
    const teamId = await this.resolveAccessibleTeamId(
      userClaims,
      createSubscriptionDto.teamId,
    );

    return lastValueFrom(
      this.userService
        .send(USER_SERVICE_PATTERNS.CREATE_SUBSCRIPTION, {
          ...createSubscriptionDto,
          teamId,
          userClaims,
        })
        .pipe(
          timeout(5000),
          catchError((err: unknown) => {
            const error = normalizeError(err);
            const message = error.message ?? 'Failed to create subscription';
            const status = error.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
            return throwError(() => new HttpException(message, status));
          }),
        ),
    );
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update subscription' })
  @ApiResponse({
    status: 200,
    description: 'Subscription updated successfully',
  })
  @ApiResponse({ status: 404, description: 'Subscription not found' })
  async updateSubscription(
    @Param('id') id: string,
    @Body() updateSubscriptionDto: UpdateSubscriptionRequestDTO,
    @UserClaims() userClaims: UserClaimsType,
  ) {
    const teamId = await this.resolveAccessibleTeamId(
      userClaims,
      updateSubscriptionDto.teamId,
    );

    return lastValueFrom(
      this.userService
        .send(USER_SERVICE_PATTERNS.UPDATE_SUBSCRIPTION, {
          id,
          ...updateSubscriptionDto,
          teamId,
          userClaims,
        })
        .pipe(
          timeout(5000),
          catchError((err: unknown) => {
            const error = normalizeError(err);
            const message = error.message ?? 'Failed to update subscription';
            const status = error.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
            return throwError(() => new HttpException(message, status));
          }),
        ),
    );
  }

  @Put(':id/upgrade')
  @ApiOperation({ summary: 'Request a plan change (pending admin approval)' })
  @ApiResponse({
    status: 200,
    description: 'Plan change request submitted successfully',
  })
  @ApiResponse({ status: 404, description: 'Subscription not found' })
  async upgradeSubscription(
    @Param('id') id: string,
    @Body() upgradeSubscriptionDto: UpgradeSubscriptionRequestDTO,
    @UserClaims() userClaims: UserClaimsType,
  ) {
    const teamId = await this.resolveAccessibleTeamId(
      userClaims,
      upgradeSubscriptionDto.teamId,
    );

    const isSystemAdmin = this.isSystemAdmin(userClaims);

    return lastValueFrom(
      this.userService
        .send(
          isSystemAdmin
            ? USER_SERVICE_PATTERNS.UPGRADE_SUBSCRIPTION
            : USER_SERVICE_PATTERNS.REQUEST_PLAN_CHANGE,
          {
            id,
            teamId,
            planId: upgradeSubscriptionDto.planId,
            interval: upgradeSubscriptionDto.interval,
            userClaims,
          },
        )
        .pipe(
          timeout(5000),
          catchError((err: unknown) => {
            const error = normalizeError(err);
            const message =
              error.message ??
              (isSystemAdmin
                ? 'Failed to upgrade subscription'
                : 'Failed to request plan change');
            const status = error.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
            return throwError(() => new HttpException(message, status));
          }),
        ),
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete subscription' })
  @ApiResponse({
    status: 200,
    description: 'Subscription deleted successfully',
  })
  @ApiResponse({ status: 404, description: 'Subscription not found' })
  deleteSubscription(
    @Param('id') id: string,
    @UserClaims() userClaims: UserClaimsType,
  ) {
    return this.userService
      .send(USER_SERVICE_PATTERNS.DELETE_SUBSCRIPTION, {
        id,
        userClaims,
      })
      .pipe(
        timeout(5000),
        catchError((err: unknown) => {
          const error = normalizeError(err);
          const message = error.message ?? 'Failed to delete subscription';
          const status = error.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
          return throwError(() => new HttpException(message, status));
        }),
      );
  }

  @Get()
  @ApiOperation({ summary: 'Get all subscriptions' })
  @ApiResponse({
    status: 200,
    description: 'Subscriptions retrieved successfully',
  })
  getSubscriptions(@UserClaims() userClaims: UserClaimsType) {
    return this.userService
      .send(USER_SERVICE_PATTERNS.GET_SUBSCRIPTIONS, {
        userClaims,
      })
      .pipe(
        timeout(5000),
        catchError((err: unknown) => {
          const error = normalizeError(err);
          const message = error.message ?? 'Failed to get subscriptions';
          const status = error.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
          return throwError(() => new HttpException(message, status));
        }),
      );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get subscription by ID' })
  @ApiResponse({
    status: 200,
    description: 'Subscription retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Subscription not found' })
  getSubscriptionById(
    @Param('id') id: string,
    @UserClaims() userClaims: UserClaimsType,
  ) {
    return this.userService
      .send(USER_SERVICE_PATTERNS.GET_SUBSCRIPTION, {
        id,
        userClaims,
      })
      .pipe(
        timeout(5000),
        catchError((err: unknown) => {
          const error = normalizeError(err);
          const message = error.message ?? 'Failed to get subscription';
          const status = error.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
          return throwError(() => new HttpException(message, status));
        }),
      );
  }

  @Get('teams/:teamId')
  @ApiOperation({ summary: 'Get subscription by teamId' })
  @ApiResponse({
    status: 200,
    description: 'Subscription retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Subscription not found' })
  async getSubscriptionByTeamId(
    @Param('teamId') teamId: string,
    @UserClaims() userClaims: UserClaimsType,
  ) {
    const resolvedTeamId = await this.resolveAccessibleTeamId(
      userClaims,
      teamId,
    );

    return lastValueFrom(
      this.userService
        .send(USER_SERVICE_PATTERNS.GET_TEAM_SUBSCRIPTION, {
          teamId: resolvedTeamId,
          userClaims,
        })
        .pipe(
          timeout(5000),
          catchError((err: unknown) => {
            const error = normalizeError(err);
            const message = error.message ?? 'Failed to get subscription';
            const status = error.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
            return throwError(() => new HttpException(message, status));
          }),
        ),
    );
  }
}
