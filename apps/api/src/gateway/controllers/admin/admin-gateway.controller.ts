import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Inject,
  Param,
  Patch,
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
import { AdminGatewayService } from './admin-gateway.service';

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
    private readonly adminService: AdminGatewayService,
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

  @Get('health/dependencies')
  @ApiOperation({ summary: 'Get dependency health for the admin console' })
  @ApiResponse({ status: 200, description: 'Dependency health returned' })
  async getDependenciesHealth() {
    return this.adminService.getDependenciesHealth();
  }

  @Get('version')
  @ApiOperation({ summary: 'Get API build and version metadata' })
  @ApiResponse({ status: 200, description: 'Version information returned' })
  async getVersion() {
    return this.adminService.getVersion();
  }

  @Get('runtime-config')
  @ApiOperation({ summary: 'Get safe runtime configuration values' })
  @ApiResponse({ status: 200, description: 'Runtime configuration returned' })
  async getRuntimeConfig() {
    return this.adminService.getRuntimeConfig();
  }

  @Get('feature-flags')
  @ApiOperation({ summary: 'List admin feature flags' })
  @ApiResponse({ status: 200, description: 'Feature flags returned' })
  async getFeatureFlags() {
    return this.adminService.getFeatureFlags();
  }

  @Patch('feature-flags/:key')
  @ApiOperation({ summary: 'Update an admin feature flag override' })
  @ApiResponse({ status: 200, description: 'Feature flag updated' })
  async patchFeatureFlag(
    @Param('key') key: string,
    @Body() body: Record<string, unknown>,
    @UserClaims() userClaims: UserClaimsType,
  ) {
    return this.adminService.updateFeatureFlag(key, body, userClaims);
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

  @Get('users/:userId/activity')
  @ApiOperation({ summary: 'Get user activity for admin console' })
  @ApiResponse({ status: 200, description: 'User activity returned' })
  async getUserActivity(@Param('userId') userId: string) {
    return this.adminService.getUserActivity(userId);
  }

  @Get('users/:userId/sessions')
  @ApiOperation({ summary: 'List user sessions for admin console' })
  @ApiResponse({ status: 200, description: 'User sessions returned' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'type', required: false, type: String })
  async getUserSessions(
    @Param('userId') userId: string,
    @Query() query: Record<string, string | undefined>,
  ) {
    return this.adminService.getUserSessions(userId, {
      limit: this.parseNumber(query.limit),
      offset: this.parseNumber(query.offset),
      status: query.status,
      type: query.type,
    });
  }

  @Post('users/:userId/impersonate')
  @ApiOperation({ summary: 'Create an impersonation access token for a user' })
  @ApiResponse({ status: 201, description: 'Impersonation token created' })
  async impersonateUser(
    @Param('userId') userId: string,
    @UserClaims() userClaims: UserClaimsType,
  ) {
    return this.adminService.impersonateUser(userId, userClaims);
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

  @Get('teams/:teamId/usage')
  @ApiOperation({ summary: 'Get team usage for admin console' })
  @ApiResponse({ status: 200, description: 'Team usage returned' })
  async getTeamUsage(@Param('teamId') teamId: string) {
    return this.adminService.getTeamUsage(teamId);
  }

  @Post('teams/:teamId/transfer-owner')
  @ApiOperation({ summary: 'Transfer team ownership from the admin console' })
  @ApiResponse({ status: 200, description: 'Team ownership transferred' })
  async transferTeamOwner(
    @Param('teamId') teamId: string,
    @Body() body: Record<string, unknown>,
    @UserClaims() userClaims: UserClaimsType,
  ) {
    return this.adminService.transferTeamOwner(teamId, body, userClaims);
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

  @Get('subscriptions/audit')
  @ApiOperation({ summary: 'Get subscription audit metadata' })
  @ApiResponse({ status: 200, description: 'Subscription audit returned' })
  @ApiQuery({ name: 'teamId', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getSubscriptionAudit(
    @Query() query: Record<string, string | undefined>,
  ) {
    return this.adminService.getSubscriptionAudit({
      teamId: query.teamId,
      limit: this.parseNumber(query.limit),
    });
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

  @Get('sessions/:id/events')
  @ApiOperation({ summary: 'Get session events for admin console' })
  @ApiResponse({ status: 200, description: 'Session events returned' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getSessionEvents(
    @Param('id') id: string,
    @Query('limit') limit: string | undefined,
  ) {
    return this.adminService.getSessionEvents(id, this.parseNumber(limit));
  }

  @Get('sessions/:id/transcript')
  @ApiOperation({ summary: 'Get session transcripts for admin console' })
  @ApiResponse({ status: 200, description: 'Session transcripts returned' })
  async getSessionTranscript(@Param('id') id: string) {
    return this.adminService.getSessionTranscript(id);
  }

  @Get('sessions/:id/llm-calls')
  @ApiOperation({ summary: 'Get session LLM calls for admin console' })
  @ApiResponse({ status: 200, description: 'Session LLM calls returned' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getSessionLlmCalls(
    @Param('id') id: string,
    @Query('limit') limit: string | undefined,
  ) {
    return this.adminService.getSessionLlmCalls(id, this.parseNumber(limit));
  }

  @Post('sessions/:id/force-end')
  @ApiOperation({ summary: 'Force-end a session from the admin console' })
  @ApiResponse({ status: 200, description: 'Session force-ended' })
  async forceEndSession(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @UserClaims() userClaims: UserClaimsType,
  ) {
    return this.adminService.forceEndSession(id, body, userClaims);
  }

  @Post('sessions/:id/recompute-assessment')
  @ApiOperation({ summary: 'Recompute assessments for a session' })
  @ApiResponse({ status: 200, description: 'Assessment recompute triggered' })
  async recomputeAssessment(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @UserClaims() userClaims: UserClaimsType,
  ) {
    return this.adminService.recomputeAssessment(id, body, userClaims);
  }

  @Post('sessions/:id/replay')
  @ApiOperation({ summary: 'Replay a session from the admin console' })
  @ApiResponse({ status: 200, description: 'Session replay started' })
  async replaySession(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @UserClaims() userClaims: UserClaimsType,
  ) {
    return this.adminService.replaySession(id, body, userClaims);
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

  @Get('assessments/runs')
  @ApiOperation({ summary: 'List assessment runs for admin console' })
  @ApiResponse({ status: 200, description: 'Assessment runs returned' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'sessionId', required: false, type: String })
  @ApiQuery({ name: 'iterationId', required: false, type: String })
  @ApiQuery({ name: 'sessionMemberId', required: false, type: String })
  async listAssessmentRuns(@Query() query: Record<string, string | undefined>) {
    return this.adminService.listAssessmentRuns({
      limit: this.parseNumber(query.limit),
      offset: this.parseNumber(query.offset),
      status: query.status,
      sessionId: query.sessionId,
      iterationId: query.iterationId,
      sessionMemberId: query.sessionMemberId,
    });
  }

  @Get('llm/requests')
  @ApiOperation({ summary: 'List LLM requests for admin console' })
  @ApiResponse({ status: 200, description: 'LLM requests returned' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'provider', required: false, type: String })
  @ApiQuery({ name: 'orgId', required: false, type: String })
  @ApiQuery({ name: 'userId', required: false, type: String })
  @ApiQuery({ name: 'sessionId', required: false, type: String })
  async getLlmRequests(@Query() query: Record<string, string | undefined>) {
    return this.adminService.getLlmRequests({
      limit: this.parseNumber(query.limit),
      provider: query.provider,
      orgId: query.orgId,
      userId: query.userId,
      sessionId: query.sessionId,
    });
  }

  @Get('llm/usage')
  @ApiOperation({ summary: 'Get LLM usage metrics for admin console' })
  @ApiResponse({ status: 200, description: 'LLM usage returned' })
  @ApiQuery({ name: 'provider', required: false, type: String })
  @ApiQuery({ name: 'orgId', required: false, type: String })
  @ApiQuery({ name: 'userId', required: false, type: String })
  @ApiQuery({ name: 'sessionId', required: false, type: String })
  @ApiQuery({ name: 'hours', required: false, type: Number })
  async getLlmUsage(@Query() query: Record<string, string | undefined>) {
    return this.adminService.getLlmUsage({
      provider: query.provider,
      orgId: query.orgId,
      userId: query.userId,
      sessionId: query.sessionId,
      hours: this.parseNumber(query.hours),
    });
  }

  @Get('llm/routing')
  @ApiOperation({ summary: 'Get LLM routing state for admin console' })
  @ApiResponse({ status: 200, description: 'LLM routing returned' })
  @ApiQuery({ name: 'scope', required: false, type: String })
  @ApiQuery({ name: 'orgId', required: false, type: String })
  @ApiQuery({ name: 'userId', required: false, type: String })
  async getLlmRouting(@Query() query: Record<string, string | undefined>) {
    return this.adminService.getLlmRouting({
      scope: query.scope as 'global' | 'org' | 'user' | undefined,
      orgId: query.orgId,
      userId: query.userId,
    });
  }

  @Patch('llm/routing')
  @ApiOperation({ summary: 'Update LLM routing from admin console' })
  @ApiResponse({ status: 200, description: 'LLM routing updated' })
  async patchLlmRouting(
    @Body() body: Record<string, unknown>,
    @UserClaims() userClaims: UserClaimsType,
  ) {
    return this.adminService.updateLlmRouting(body, userClaims);
  }

  @Post('llm/routing/reload')
  @ApiOperation({ summary: 'Reload LLM routing cache' })
  @ApiResponse({ status: 200, description: 'LLM routing cache reloaded' })
  async reloadLlmRouting(
    @Body() body: Record<string, unknown>,
    @UserClaims() userClaims: UserClaimsType,
  ) {
    return this.adminService.reloadLlmRouting(body, userClaims);
  }

  @Get('phone-calls')
  @ApiOperation({ summary: 'List phone calls for admin console' })
  @ApiResponse({ status: 200, description: 'Phone calls returned' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, type: String })
  async listPhoneCalls(@Query() query: Record<string, string | undefined>) {
    return this.adminService.listPhoneCalls({
      limit: this.parseNumber(query.limit),
      offset: this.parseNumber(query.offset),
      status: query.status,
    });
  }

  @Get('phone-calls/:callId')
  @ApiOperation({ summary: 'Get phone call details for admin console' })
  @ApiResponse({ status: 200, description: 'Phone call returned' })
  async getPhoneCall(@Param('callId') callId: string) {
    return this.adminService.getPhoneCall(callId);
  }

  @Get('phone-calls/:callId/events')
  @ApiOperation({ summary: 'Get phone call events for admin console' })
  @ApiResponse({ status: 200, description: 'Phone call events returned' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getPhoneCallEvents(
    @Param('callId') callId: string,
    @Query('limit') limit: string | undefined,
  ) {
    return this.adminService.getPhoneCallEvents(
      callId,
      this.parseNumber(limit),
    );
  }

  @Post('phone-calls/:callId/redial')
  @ApiOperation({ summary: 'Redial a phone call from admin console' })
  @ApiResponse({ status: 200, description: 'Phone call redialed' })
  async redialPhoneCall(
    @Param('callId') callId: string,
    @Body() body: Record<string, unknown>,
    @UserClaims() userClaims: UserClaimsType,
  ) {
    return this.adminService.redialPhoneCall(callId, body, userClaims);
  }

  @Get('jobs')
  @ApiOperation({ summary: 'List admin jobs' })
  @ApiResponse({ status: 200, description: 'Admin jobs returned' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async listJobs(@Query() query: Record<string, string | undefined>) {
    return this.adminService.listJobs({
      limit: this.parseNumber(query.limit),
    });
  }

  @Get('jobs/:jobId')
  @ApiOperation({ summary: 'Get an admin job definition or run' })
  @ApiResponse({ status: 200, description: 'Admin job returned' })
  getJob(@Param('jobId') jobId: string) {
    return this.adminService.getJob(jobId);
  }

  @Post('jobs/:jobName/run')
  @ApiOperation({ summary: 'Run an admin job immediately' })
  @ApiResponse({ status: 201, description: 'Admin job started' })
  async runJob(
    @Param('jobName') jobName: string,
    @UserClaims() userClaims: UserClaimsType,
  ) {
    return this.adminService.runJob(jobName, userClaims);
  }

  @Get('queues')
  @ApiOperation({ summary: 'List queue status for admin console' })
  @ApiResponse({ status: 200, description: 'Queue status returned' })
  async listQueues() {
    return this.adminService.listQueues();
  }

  @Post('queues/:queueName/retry-dead-letters')
  @ApiOperation({ summary: 'Retry dead-lettered queue messages' })
  @ApiResponse({ status: 200, description: 'Dead-letter retry finished' })
  async retryDeadLetters(
    @Param('queueName') queueName: string,
    @Body() body: Record<string, unknown>,
    @UserClaims() userClaims: UserClaimsType,
  ) {
    return this.adminService.retryDeadLetters(queueName, body, userClaims);
  }

  @Get('webhooks')
  @ApiOperation({ summary: 'List webhook providers for admin console' })
  @ApiResponse({ status: 200, description: 'Webhook providers returned' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  listWebhooks(@Query() query: Record<string, string | undefined>) {
    return this.adminService.listWebhooks({
      limit: this.parseNumber(query.limit),
    });
  }

  @Get('webhooks/:provider/events')
  @ApiOperation({ summary: 'List webhook events for a provider' })
  @ApiResponse({ status: 200, description: 'Webhook events returned' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getWebhookEvents(
    @Param('provider') provider: string,
    @Query() query: Record<string, string | undefined>,
  ) {
    return this.adminService.getWebhookEvents(provider, {
      limit: this.parseNumber(query.limit),
    });
  }

  @Post('webhooks/:provider/events/:id/replay')
  @ApiOperation({ summary: 'Replay a webhook event' })
  @ApiResponse({ status: 201, description: 'Webhook replay completed' })
  async replayWebhookEvent(
    @Param('provider') provider: string,
    @Param('id') id: string,
  ) {
    return this.adminService.replayWebhookEvent(provider, id);
  }

  @Get('audit-logs')
  @ApiOperation({ summary: 'List admin audit logs' })
  @ApiResponse({ status: 200, description: 'Audit logs returned' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  listAuditLogs(@Query() query: Record<string, string | undefined>) {
    return this.adminService.listAuditLogs({
      limit: this.parseNumber(query.limit),
    });
  }

  @Get('errors')
  @ApiOperation({ summary: 'List recent admin-observed errors' })
  @ApiResponse({ status: 200, description: 'Recent errors returned' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  listErrors(@Query() query: Record<string, string | undefined>) {
    return this.adminService.listErrors({
      limit: this.parseNumber(query.limit),
    });
  }

  @Get('request-logs')
  @ApiOperation({ summary: 'List recent HTTP request logs' })
  @ApiResponse({ status: 200, description: 'Request logs returned' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  listRequestLogs(@Query() query: Record<string, string | undefined>) {
    return this.adminService.listRequestLogs({
      limit: this.parseNumber(query.limit),
    });
  }

  @Post('cache/invalidate')
  @ApiOperation({ summary: 'Invalidate admin-managed caches' })
  @ApiResponse({ status: 200, description: 'Cache invalidation completed' })
  async invalidateCache(
    @Body() body: Record<string, unknown>,
    @UserClaims() userClaims: UserClaimsType,
  ) {
    return this.adminService.invalidateCache(body, userClaims);
  }

  @Post('data-fixes/:name/preview')
  @ApiOperation({ summary: 'Preview a data fix' })
  @ApiResponse({ status: 200, description: 'Data fix preview returned' })
  async previewDataFix(@Param('name') name: string) {
    return this.adminService.previewDataFix(name);
  }

  @Post('data-fixes/:name/apply')
  @ApiOperation({ summary: 'Apply a data fix' })
  @ApiResponse({ status: 200, description: 'Data fix applied' })
  async applyDataFix(
    @Param('name') name: string,
    @UserClaims() userClaims: UserClaimsType,
  ) {
    return this.adminService.applyDataFix(name, userClaims);
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
      ? result.value.filter((item): item is Record<string, unknown> =>
          this.isRecord(item),
        )
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
      return value.filter((item): item is Record<string, unknown> =>
        this.isRecord(item),
      );
    }
    if (this.isRecord(value) && Array.isArray(value.sessions)) {
      return value.sessions.filter((item): item is Record<string, unknown> =>
        this.isRecord(item),
      );
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
