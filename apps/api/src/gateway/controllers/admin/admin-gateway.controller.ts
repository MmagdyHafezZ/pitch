import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Inject,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import type { ClientProxy } from '@nestjs/microservices';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  SIMULATION_SERVICE_PATTERNS,
  USER_SERVICE_PATTERNS,
} from '@pitch/shared-backend/interfaces/message-patterns.interface';
import type { UserClaims as UserClaimsType } from '@pitch/shared-backend/interfaces/user-claims.interface';
import { lastValueFrom, throwError } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';
import { SystemAdminOnly } from '../../decorators/system-admin.decorator';
import { UserClaims } from '../../decorators/user-claims.decorator';
import { normalizeError } from '@pitch/shared-backend/helpers/exceptions';

type SessionListQuery = {
  userId?: string;
  orgId?: string;
  type?: string;
  status?: string;
  scenarioId?: string;
  personaId?: string;
  limit?: string;
  offset?: string;
};

type SessionListResponse = {
  sessions?: unknown[];
  total?: number;
};

type OverviewSection<T> = {
  status: 'ok' | 'error';
  count: number;
  data: T;
  error?: string;
};

@ApiTags('admin')
@SystemAdminOnly()
@Controller({ path: 'admin', version: '1' })
export class AdminGatewayController {
  constructor(
    @Inject('USER_SERVICE') private readonly userService: ClientProxy,
    @Inject('SIMULATION_SERVICE')
    private readonly simulationService: ClientProxy,
  ) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current admin identity' })
  @ApiResponse({ status: 200, description: 'Admin identity returned' })
  getMe(@UserClaims() userClaims: UserClaimsType) {
    return {
      ...userClaims,
      isSystemAdmin: true,
    };
  }

  @Get('overview')
  @ApiOperation({ summary: 'Get admin overview metrics' })
  @ApiResponse({ status: 200, description: 'Admin overview returned' })
  async getOverview(@UserClaims() userClaims: UserClaimsType) {
    const [users, teams, plans, subscriptions, sessions] =
      await Promise.allSettled([
        this.sendUserRequest<unknown[]>(
          USER_SERVICE_PATTERNS.GET_USERS,
          { userClaims },
          'Failed to get users',
        ),
        this.sendUserRequest<unknown[]>(
          USER_SERVICE_PATTERNS.GET_TEAMS,
          { userClaims },
          'Failed to get teams',
        ),
        this.sendUserRequest<unknown[]>(
          USER_SERVICE_PATTERNS.GET_PLANS,
          { userClaims },
          'Failed to get plans',
        ),
        this.sendUserRequest<unknown[]>(
          USER_SERVICE_PATTERNS.GET_SUBSCRIPTIONS,
          { userClaims },
          'Failed to get subscriptions',
        ),
        this.sendSimulationRequest<SessionListResponse | unknown[]>(
          SIMULATION_SERVICE_PATTERNS.LIST_SESSIONS,
          { limit: 1000, offset: 0, userClaims },
          'Failed to list sessions',
          15000,
        ),
      ]);

    const usersSection = this.buildArraySection(users);
    const teamsSection = this.buildArraySection(teams);
    const plansSection = this.buildArraySection(plans);
    const subscriptionsSection = this.buildArraySection(subscriptions);
    const sessionsSection = this.buildSessionSection(sessions);

    const activeUsers = usersSection.data.filter((item) => {
      return !this.hasBoolean(item, 'isActive') || item.isActive !== false;
    }).length;
    const activeSessions = sessionsSection.data.filter((item) => {
      return this.getString(item, 'status')?.toLowerCase() === 'active';
    }).length;

    const warnings = [
      usersSection,
      teamsSection,
      plansSection,
      subscriptionsSection,
      sessionsSection,
    ]
      .filter((section) => section.status === 'error' && section.error)
      .map((section) => section.error as string);

    return {
      status: warnings.length === 0 ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
      totals: {
        users: usersSection.count,
        activeUsers,
        teams: teamsSection.count,
        plans: plansSection.count,
        subscriptions: subscriptionsSection.count,
        sessions: sessionsSection.count,
        activeSessions,
      },
      warnings,
    };
  }

  @Get('users')
  @ApiOperation({ summary: 'List users for admin console' })
  @ApiResponse({ status: 200, description: 'Users returned' })
  async getUsers(@UserClaims() userClaims: UserClaimsType) {
    return this.sendUserRequest(
      USER_SERVICE_PATTERNS.GET_USERS,
      { userClaims },
      'Failed to get users',
    );
  }

  @Get('users/:userId')
  @ApiOperation({ summary: 'Get user by ID for admin console' })
  @ApiResponse({ status: 200, description: 'User returned' })
  async getUserById(
    @Param('userId') userId: string,
    @UserClaims() userClaims: UserClaimsType,
  ) {
    return this.sendUserRequest(
      USER_SERVICE_PATTERNS.GET_USER,
      { userId, userClaims },
      'Failed to get user',
    );
  }

  @Put('users/:userId')
  @ApiOperation({ summary: 'Update user from admin console' })
  @ApiResponse({ status: 200, description: 'User updated' })
  async updateUser(
    @Param('userId') userId: string,
    @Body() body: Record<string, unknown>,
    @UserClaims() userClaims: UserClaimsType,
  ) {
    return this.sendUserRequest(
      USER_SERVICE_PATTERNS.UPDATE_USER,
      { userId, ...body, userClaims },
      'Failed to update user',
    );
  }

  @Delete('users/:userId')
  @ApiOperation({ summary: 'Delete user from admin console' })
  @ApiResponse({ status: 200, description: 'User deleted' })
  async deleteUser(
    @Param('userId') userId: string,
    @UserClaims() userClaims: UserClaimsType,
  ) {
    return this.sendUserRequest(
      USER_SERVICE_PATTERNS.DELETE_USER,
      { userId, userClaims },
      'Failed to delete user',
    );
  }

  @Get('teams')
  @ApiOperation({ summary: 'List teams for admin console' })
  @ApiResponse({ status: 200, description: 'Teams returned' })
  async getTeams(@UserClaims() userClaims: UserClaimsType) {
    return this.sendUserRequest(
      USER_SERVICE_PATTERNS.GET_TEAMS,
      { userClaims },
      'Failed to get teams',
    );
  }

  @Get('teams/:teamId')
  @ApiOperation({ summary: 'Get team by ID for admin console' })
  @ApiResponse({ status: 200, description: 'Team returned' })
  async getTeamById(
    @Param('teamId') teamId: string,
    @UserClaims() userClaims: UserClaimsType,
  ) {
    return this.sendUserRequest(
      USER_SERVICE_PATTERNS.GET_TEAM,
      { teamId, userClaims },
      'Failed to get team',
    );
  }

  @Get('plans')
  @ApiOperation({ summary: 'List plans for admin console' })
  @ApiResponse({ status: 200, description: 'Plans returned' })
  async getPlans(@UserClaims() userClaims: UserClaimsType) {
    return this.sendUserRequest(
      USER_SERVICE_PATTERNS.GET_PLANS,
      { userClaims },
      'Failed to get plans',
    );
  }

  @Get('plans/:id')
  @ApiOperation({ summary: 'Get plan by ID for admin console' })
  @ApiResponse({ status: 200, description: 'Plan returned' })
  async getPlanById(
    @Param('id') id: string,
    @UserClaims() userClaims: UserClaimsType,
  ) {
    return this.sendUserRequest(
      USER_SERVICE_PATTERNS.GET_PLAN,
      { id, userClaims },
      'Failed to get plan',
    );
  }

  @Post('plans')
  @ApiOperation({ summary: 'Create plan from admin console' })
  @ApiResponse({ status: 201, description: 'Plan created' })
  async createPlan(
    @Body() body: Record<string, unknown>,
    @UserClaims() userClaims: UserClaimsType,
  ) {
    return this.sendUserRequest(
      USER_SERVICE_PATTERNS.CREATE_PLAN,
      { ...body, userClaims },
      'Failed to create plan',
    );
  }

  @Put('plans/:id')
  @ApiOperation({ summary: 'Update plan from admin console' })
  @ApiResponse({ status: 200, description: 'Plan updated' })
  async updatePlan(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @UserClaims() userClaims: UserClaimsType,
  ) {
    return this.sendUserRequest(
      USER_SERVICE_PATTERNS.UPDATE_PLAN,
      { id, ...body, userClaims },
      'Failed to update plan',
    );
  }

  @Delete('plans/:id')
  @ApiOperation({ summary: 'Delete plan from admin console' })
  @ApiResponse({ status: 200, description: 'Plan deleted' })
  async deletePlan(
    @Param('id') id: string,
    @UserClaims() userClaims: UserClaimsType,
  ) {
    return this.sendUserRequest(
      USER_SERVICE_PATTERNS.DELETE_PLAN,
      { id, userClaims },
      'Failed to delete plan',
    );
  }

  @Get('subscriptions')
  @ApiOperation({ summary: 'List subscriptions for admin console' })
  @ApiResponse({ status: 200, description: 'Subscriptions returned' })
  async getSubscriptions(@UserClaims() userClaims: UserClaimsType) {
    return this.sendUserRequest(
      USER_SERVICE_PATTERNS.GET_SUBSCRIPTIONS,
      { userClaims },
      'Failed to get subscriptions',
    );
  }

  @Get('subscriptions/teams/:teamId')
  @ApiOperation({ summary: 'Get team subscription for admin console' })
  @ApiResponse({ status: 200, description: 'Team subscription returned' })
  async getTeamSubscription(
    @Param('teamId') teamId: string,
    @UserClaims() userClaims: UserClaimsType,
  ) {
    return this.sendUserRequest(
      USER_SERVICE_PATTERNS.GET_TEAM_SUBSCRIPTION,
      { teamId, userClaims },
      'Failed to get team subscription',
    );
  }

  @Get('subscriptions/:id')
  @ApiOperation({ summary: 'Get subscription by ID for admin console' })
  @ApiResponse({ status: 200, description: 'Subscription returned' })
  async getSubscriptionById(
    @Param('id') id: string,
    @UserClaims() userClaims: UserClaimsType,
  ) {
    return this.sendUserRequest(
      USER_SERVICE_PATTERNS.GET_SUBSCRIPTION,
      { id, userClaims },
      'Failed to get subscription',
    );
  }

  @Post('subscriptions')
  @ApiOperation({ summary: 'Create subscription from admin console' })
  @ApiResponse({ status: 201, description: 'Subscription created' })
  async createSubscription(
    @Body() body: Record<string, unknown>,
    @UserClaims() userClaims: UserClaimsType,
  ) {
    return this.sendUserRequest(
      USER_SERVICE_PATTERNS.CREATE_SUBSCRIPTION,
      { ...body, userClaims },
      'Failed to create subscription',
    );
  }

  @Put('subscriptions/:id')
  @ApiOperation({ summary: 'Update subscription from admin console' })
  @ApiResponse({ status: 200, description: 'Subscription updated' })
  async updateSubscription(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @UserClaims() userClaims: UserClaimsType,
  ) {
    return this.sendUserRequest(
      USER_SERVICE_PATTERNS.UPDATE_SUBSCRIPTION,
      { id, ...body, userClaims },
      'Failed to update subscription',
    );
  }

  @Put('subscriptions/:id/upgrade')
  @ApiOperation({ summary: 'Upgrade subscription from admin console' })
  @ApiResponse({ status: 200, description: 'Subscription upgraded' })
  async upgradeSubscription(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @UserClaims() userClaims: UserClaimsType,
  ) {
    return this.sendUserRequest(
      USER_SERVICE_PATTERNS.UPGRADE_SUBSCRIPTION,
      { id, ...body, userClaims },
      'Failed to upgrade subscription',
    );
  }

  @Delete('subscriptions/:id')
  @ApiOperation({ summary: 'Delete subscription from admin console' })
  @ApiResponse({ status: 200, description: 'Subscription deleted' })
  async deleteSubscription(
    @Param('id') id: string,
    @UserClaims() userClaims: UserClaimsType,
  ) {
    return this.sendUserRequest(
      USER_SERVICE_PATTERNS.DELETE_SUBSCRIPTION,
      { id, userClaims },
      'Failed to delete subscription',
    );
  }

  @Get('sessions')
  @ApiOperation({ summary: 'List sessions for admin console' })
  @ApiResponse({ status: 200, description: 'Sessions returned' })
  @ApiQuery({ name: 'userId', required: false, type: String })
  @ApiQuery({ name: 'orgId', required: false, type: String })
  @ApiQuery({ name: 'type', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'scenarioId', required: false, type: String })
  @ApiQuery({ name: 'personaId', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  async listSessions(
    @Query() query: SessionListQuery,
    @UserClaims() userClaims: UserClaimsType,
  ) {
    return this.sendSimulationRequest(
      SIMULATION_SERVICE_PATTERNS.LIST_SESSIONS,
      {
        ...query,
        limit: this.parseNumber(query.limit),
        offset: this.parseNumber(query.offset),
        userClaims,
      },
      'Failed to list sessions',
      15000,
    );
  }

  @Get('sessions/:id/members')
  @ApiOperation({ summary: 'List session members for admin console' })
  @ApiResponse({ status: 200, description: 'Session members returned' })
  async listSessionMembers(
    @Param('id') id: string,
    @UserClaims() userClaims: UserClaimsType,
  ) {
    return this.sendSimulationRequest(
      SIMULATION_SERVICE_PATTERNS.LIST_SESSION_MEMBERS,
      { sessionId: id, userClaims },
      'Failed to list session members',
    );
  }

  @Get('sessions/:id/timeline')
  @ApiOperation({ summary: 'Get session timeline for admin console' })
  @ApiResponse({ status: 200, description: 'Session timeline returned' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getSessionTimeline(
    @Param('id') id: string,
    @Query('limit') limit: string | undefined,
    @UserClaims() userClaims: UserClaimsType,
  ) {
    return this.sendSimulationRequest(
      SIMULATION_SERVICE_PATTERNS.SESSION_TIMELINE,
      {
        sessionId: id,
        limit: this.parseNumber(limit),
        userClaims,
      },
      'Failed to fetch timeline',
    );
  }

  @Get('sessions/:id')
  @ApiOperation({ summary: 'Get session by ID for admin console' })
  @ApiResponse({ status: 200, description: 'Session returned' })
  async getSessionById(
    @Param('id') id: string,
    @UserClaims() userClaims: UserClaimsType,
  ) {
    return this.sendSimulationRequest(
      SIMULATION_SERVICE_PATTERNS.GET_SESSION,
      { id, userClaims },
      'Failed to get session',
    );
  }

  private async sendUserRequest<T>(
    pattern: string,
    payload: unknown,
    fallbackMessage: string,
    timeoutMs = 10000,
  ): Promise<T> {
    return this.sendRequest<T>(
      this.userService,
      pattern,
      payload,
      fallbackMessage,
      timeoutMs,
    );
  }

  private async sendSimulationRequest<T>(
    pattern: string,
    payload: unknown,
    fallbackMessage: string,
    timeoutMs = 10000,
  ): Promise<T> {
    return this.sendRequest<T>(
      this.simulationService,
      pattern,
      payload,
      fallbackMessage,
      timeoutMs,
    );
  }

  private async sendRequest<T>(
    client: ClientProxy,
    pattern: string,
    payload: unknown,
    fallbackMessage: string,
    timeoutMs: number,
  ): Promise<T> {
    return lastValueFrom(
      client.send<T>(pattern, payload).pipe(
        timeout(timeoutMs),
        catchError((err: unknown) => {
          const error = normalizeError(err);
          const message = error.message ?? fallbackMessage;
          const status = error.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
          return throwError(() => new HttpException(message, status));
        }),
      ),
    );
  }

  private buildArraySection(
    result: PromiseSettledResult<unknown>,
  ): OverviewSection<Array<Record<string, unknown>>> {
    if (result.status === 'rejected') {
      return {
        status: 'error',
        count: 0,
        data: [],
        error: this.errorMessage(result.reason),
      };
    }

    const data = Array.isArray(result.value)
      ? (result.value.filter(this.isRecord) as Array<Record<string, unknown>>)
      : [];
    return {
      status: 'ok',
      count: data.length,
      data,
    };
  }

  private buildSessionSection(
    result: PromiseSettledResult<unknown>,
  ): OverviewSection<Array<Record<string, unknown>>> {
    if (result.status === 'rejected') {
      return {
        status: 'error',
        count: 0,
        data: [],
        error: this.errorMessage(result.reason),
      };
    }

    const data = this.extractSessionItems(result.value);
    return {
      status: 'ok',
      count: data.length,
      data,
    };
  }

  private extractSessionItems(value: unknown): Array<Record<string, unknown>> {
    if (Array.isArray(value)) {
      return value.filter(this.isRecord) as Array<Record<string, unknown>>;
    }
    if (this.isRecord(value) && Array.isArray(value.sessions)) {
      return value.sessions.filter(this.isRecord) as Array<
        Record<string, unknown>
      >;
    }
    return [];
  }

  private parseNumber(value: string | undefined): number | undefined {
    if (!value) return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  private errorMessage(reason: unknown): string {
    if (reason instanceof HttpException) {
      return reason.message;
    }
    if (reason instanceof Error) {
      return reason.message;
    }
    return 'Request failed';
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }

  private hasBoolean(value: Record<string, unknown>, key: string): boolean {
    return typeof value[key] === 'boolean';
  }

  private getString(
    value: Record<string, unknown>,
    key: string,
  ): string | undefined {
    return typeof value[key] === 'string' ? value[key] : undefined;
  }
}
