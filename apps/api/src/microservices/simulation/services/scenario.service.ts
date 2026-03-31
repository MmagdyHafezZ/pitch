import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { ClientProxy } from '@nestjs/microservices';
import {
  Prisma,
  Scenario,
  ScenarioVisibility,
} from '@prisma/simulation-client';
import { firstValueFrom, timeout } from 'rxjs';
import { USER_SERVICE_PATTERNS } from '@pitch/shared-backend/interfaces/message-patterns.interface';
import type {
  Role,
  Team,
  TeamMembership,
} from '@pitch/shared-backend/interfaces/user.interface';
import { ScenarioRepository } from '../repositories/scenario.repository';
import { SimulationPrismaService } from '../prisma/simulation-prisma.service';
import { SimulationRedisService } from './redis/redis.service';
import {
  CreateScenarioDto,
  GenerateScenarioBatchRequestDto,
  GenerateScenarioRequestDto,
  ScenarioDraftDto,
  ScenarioDraftListResponseDto,
  ScenarioListQueryDto,
  ScenarioListResponseDto,
  ScenarioListScopeDto,
  ScenarioPermissionsDto,
  ScenarioResponseDto,
  ScenarioVisibilityDto,
  UpdateScenarioDto,
} from '../dto/scenario.dto';
import { LLMService } from './llm/llm.service';
import { LLMRoutingConfigService } from './llm/llm-routing-config.service';
import { LLMRequestDto } from '../dto/llm.dto';
import { buildScenarioSystemPrompt } from '../prompts/scenario.prompt';
import type { UserClaims } from '../../../gateway/decorators/user-claims.decorator';

type JsonRecord = Record<string, unknown>;

interface ScenarioAccessContext {
  teamIds: Set<string>;
  teamRoles: Map<string, Role>;
}

interface ParsedScenarioDraft {
  name?: string;
  description?: string;
  config?: Record<string, unknown>;
}

const COUNTERPART_ROLE_PATTERN =
  /client|customer|buyer|prospect|stakeholder|procurement|decision maker|decision-maker|economic buyer|cto|cfo|cio|vp/i;
const PITCHER_ROLE_PATTERN =
  /sales|seller|pitch|account executive|account manager|sales rep|representative|bdr|sdr|business development|founder|consultant/i;

const DEFAULT_STAGE_LABELS = [
  ['Opening', 'Set the agenda and establish context'],
  ['Discovery', 'Surface priorities, blockers, and decision criteria'],
  ['Discussion', 'Advance the conversation with a concrete point of tension'],
  ['Close', 'Drive toward a clear next step or decision'],
] as const;

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const pickString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined;

const normalizeRole = (value: string | undefined): string | undefined =>
  value ? value.trim().replace(/\s+/g, ' ').toLowerCase() : undefined;

const uniqueStrings = (values: unknown, fallback: string[] = []): string[] => {
  const source = Array.isArray(values) ? values : fallback;
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const value of source) {
    const next = pickString(value);
    if (!next) continue;
    const key = next.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(next);
  }
  return normalized;
};

const clampMinutes = (value: unknown, fallback = 20): number => {
  const numeric =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number.parseInt(value, 10)
        : NaN;
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(120, Math.max(5, Math.round(numeric)));
};

const normalizeDifficulty = (value: unknown): 'easy' | 'medium' | 'hard' => {
  const raw = pickString(value)?.toLowerCase();
  if (!raw) return 'medium';
  if (['1', '2', '3', '4', 'easy', 'warm-up'].includes(raw)) return 'easy';
  if (['8', '9', '10', 'hard', 'challenging', 'elite', 'expert'].includes(raw))
    return 'hard';
  return 'medium';
};

const pickCounterpartRole = (
  candidates: Array<string | undefined>,
): string | undefined =>
  candidates.find((candidate) => {
    const role = pickString(candidate);
    return !!role && COUNTERPART_ROLE_PATTERN.test(role.toLowerCase());
  });

const pickPitcherRole = (
  candidates: Array<string | undefined>,
): string | undefined =>
  candidates.find((candidate) => {
    const role = pickString(candidate);
    return !!role && PITCHER_ROLE_PATTERN.test(role.toLowerCase());
  });

const pickFirstDifferentRole = (
  candidates: Array<string | undefined>,
  exclude?: string,
): string | undefined => {
  const normalizedExclude = normalizeRole(exclude);
  return candidates.find((candidate) => {
    const role = pickString(candidate);
    return !!role && normalizeRole(role) !== normalizedExclude;
  });
};

const alignPitchRolePair = (
  aiRole?: string,
  userRole?: string,
): { assistant?: string; user?: string } => {
  let resolvedAssistant = pickString(aiRole);
  let resolvedUser = pickString(userRole);

  if (
    resolvedAssistant &&
    resolvedUser &&
    PITCHER_ROLE_PATTERN.test(resolvedAssistant.toLowerCase()) &&
    COUNTERPART_ROLE_PATTERN.test(resolvedUser.toLowerCase())
  ) {
    const previousAssistant = resolvedAssistant;
    resolvedAssistant = resolvedUser;
    resolvedUser = previousAssistant;
  }

  if (
    resolvedAssistant &&
    resolvedUser &&
    normalizeRole(resolvedAssistant) === normalizeRole(resolvedUser)
  ) {
    resolvedAssistant = undefined;
  }

  return {
    assistant: resolvedAssistant,
    user: resolvedUser,
  };
};

const summarizeWorkspaceType = (
  orgId: string,
  userId: string,
  access: ScenarioAccessContext,
): 'personal' | 'team' | 'unknown' => {
  if (orgId === userId) return 'personal';
  if (access.teamIds.has(orgId)) return 'team';
  return 'unknown';
};

@Injectable()
export class ScenarioService {
  private readonly logger = new Logger(ScenarioService.name);

  constructor(
    private readonly scenarioRepository: ScenarioRepository,
    private readonly llmService: LLMService,
    private readonly routingConfigService: LLMRoutingConfigService,
    private readonly prisma: SimulationPrismaService,
    private readonly redis: SimulationRedisService,
    @Inject('USER_SERVICE') private readonly userClient: ClientProxy,
  ) {}

  async generate(
    request: GenerateScenarioRequestDto,
    userClaims: UserClaims,
  ): Promise<ScenarioDraftDto> {
    return await this.generateOne(request, userClaims, 0, 1);
  }

  async generateBatch(
    request: GenerateScenarioBatchRequestDto,
    userClaims: UserClaims,
  ): Promise<ScenarioDraftListResponseDto> {
    const count = Math.max(1, Math.min(5, request.count ?? 3));
    const scenarios: ScenarioDraftDto[] = [];

    for (let index = 0; index < count; index += 1) {
      const scenario = await this.generateOne(
        request,
        userClaims,
        index,
        count,
      );
      scenarios.push(scenario);
    }

    return {
      scenarios,
      total: scenarios.length,
    };
  }

  async create(
    payload: CreateScenarioDto,
    userClaims: UserClaims,
  ): Promise<ScenarioResponseDto> {
    const access = await this.getScenarioAccessContext(userClaims);
    this.assertWorkspaceAccess(payload.orgId, userClaims, access);
    this.assertVisibilityAllowed(
      payload.visibility,
      payload.orgId,
      userClaims,
      access,
    );

    const scenario = await this.scenarioRepository.create({
      orgId: payload.orgId,
      createdByUserId: userClaims.id,
      visibility: payload.visibility as unknown as ScenarioVisibility,
      name: this.normalizeTitle(payload.name),
      description: pickString(payload.description),
      config: this.normalizeConfig(
        payload.config ?? {},
      ) as Prisma.InputJsonValue,
    });

    return this.mapToResponseDto(scenario, access, userClaims.id);
  }

  async update(
    id: string,
    payload: UpdateScenarioDto,
    userClaims: UserClaims,
  ): Promise<ScenarioResponseDto> {
    const access = await this.getScenarioAccessContext(userClaims);
    const scenario = await this.requireReadableScenario(id, userClaims, access);

    if (this.isReadonlyLegacy(scenario)) {
      throw new ForbiddenException(
        'Legacy scenarios are read-only. Use Save as new to create an editable copy.',
      );
    }
    if (!this.canEditScenario(scenario, userClaims.id, access)) {
      throw new ForbiddenException(
        'You do not have permission to edit this scenario.',
      );
    }

    const nextVisibility =
      payload.visibility !== undefined
        ? (payload.visibility as unknown as ScenarioVisibility)
        : scenario.visibility;

    this.assertVisibilityAllowed(
      nextVisibility as unknown as ScenarioVisibilityDto,
      scenario.orgId,
      userClaims,
      access,
    );

    const updated = await this.scenarioRepository.update(id, {
      visibility: nextVisibility,
      name: payload.name ? this.normalizeTitle(payload.name) : undefined,
      description:
        payload.description !== undefined
          ? (pickString(payload.description) ?? null)
          : undefined,
      config:
        payload.config !== undefined
          ? (this.normalizeConfig(payload.config) as Prisma.InputJsonValue)
          : undefined,
    });
    await this.invalidateSessionFullCachesForScenario(id);

    return this.mapToResponseDto(updated, access, userClaims.id);
  }

  async remove(id: string, userClaims: UserClaims): Promise<void> {
    const access = await this.getScenarioAccessContext(userClaims);
    const scenario = await this.requireReadableScenario(id, userClaims, access);

    if (this.isReadonlyLegacy(scenario)) {
      throw new ForbiddenException('Legacy scenarios cannot be deleted.');
    }
    if (!this.canDeleteScenario(scenario, userClaims.id, access)) {
      throw new ForbiddenException(
        'You do not have permission to delete this scenario.',
      );
    }

    await this.scenarioRepository.delete(id);
    await this.invalidateSessionFullCachesForScenario(id);
  }

  private async invalidateSessionFullCachesForScenario(
    scenarioId: string,
  ): Promise<void> {
    try {
      const sessions = await this.prisma.client.session.findMany({
        where: { scenarioId },
        select: { id: true },
      });

      if (sessions.length === 0) {
        return;
      }

      await Promise.all(
        sessions.map((session) => this.redis.deleteSessionFull(session.id)),
      );
    } catch (error) {
      this.logger.warn(
        `Failed to invalidate session full cache for scenario ${scenarioId}: ${
          (error as Error)?.message ?? error
        }`,
      );
    }
  }

  async findAll(
    query: ScenarioListQueryDto,
    userClaims: UserClaims,
  ): Promise<ScenarioListResponseDto> {
    const access = await this.getScenarioAccessContext(userClaims);
    const scope = query.scope ?? ScenarioListScopeDto.mine;
    const orgId = pickString(query.orgId);
    const where = this.buildListWhere(scope, orgId, userClaims, access);

    if (!where) {
      return { scenarios: [], total: 0 };
    }

    const scenarios = await this.scenarioRepository.findMany({ where });
    const filtered = this.filterBySearch(scenarios, query.query);

    return {
      scenarios: filtered.map((scenario) =>
        this.mapToResponseDto(scenario, access, userClaims.id),
      ),
      total: filtered.length,
    };
  }

  async findById(
    id: string,
    userClaims: UserClaims,
  ): Promise<ScenarioResponseDto> {
    const access = await this.getScenarioAccessContext(userClaims);
    const scenario = await this.requireReadableScenario(id, userClaims, access);
    return this.mapToResponseDto(scenario, access, userClaims.id);
  }

  private async generateOne(
    request: GenerateScenarioRequestDto,
    userClaims: UserClaims,
    variationIndex: number,
    totalCount: number,
  ): Promise<ScenarioDraftDto> {
    const access = await this.getScenarioAccessContext(userClaims);
    this.assertWorkspaceAccess(request.orgId, userClaims, access);

    this.logger.log(
      `Generating scenario draft ${variationIndex + 1}/${totalCount} for workspace ${request.orgId}`,
    );

    const routingConfig = await this.routingConfigService.getActiveConfig({
      orgId: request.orgId,
      userId: userClaims.id,
    });

    const defaultRoute = routingConfig.defaultRoute ?? {
      provider: 'openai',
      model: 'gpt-4o',
    };

    const systemPrompt = await buildScenarioSystemPrompt(request.language);
    const variationLabel = this.getVariationLabel(variationIndex);

    const userPrompt = JSON.stringify(
      {
        workspaceId: request.orgId,
        workspaceType: summarizeWorkspaceType(
          request.orgId,
          userClaims.id,
          access,
        ),
        variationNumber: variationIndex + 1,
        variationInstruction:
          totalCount > 1
            ? `Make this variation meaningfully distinct while staying grounded. Focus the tension on ${variationLabel}.`
            : undefined,
        topic: request.name,
        objective: request.objective,
        context: request.context,
        sessionType: request.type,
        language: request.language,
        tags: request.tags,
        sessionConfig: request.sessionConfig,
        personaId: request.personaId,
        personaSnapshot: request.personaSnapshot,
        crmContextId: request.crmContextId,
        crmSelections: request.crmSelections,
        userSnapshot: request.userSnapshot,
        orgSnapshot: request.orgSnapshot,
      },
      null,
      2,
    );

    const llmRequest: LLMRequestDto = {
      sessionId: `scenario-gen:${request.orgId}`,
      userId: userClaims.id,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Generate a scenario draft from this grounded input:\n${userPrompt}`,
        },
      ],
      config: {
        provider: defaultRoute.provider,
        model: defaultRoute.model,
        temperature: totalCount > 1 ? 0.85 : 0.65,
        maxTokens: 1400,
      },
    };

    const response = await this.llmService.complete(llmRequest, {
      orgId: request.orgId,
      userId: userClaims.id,
      purpose: 'scenario_generation',
    });

    const parsed = this.extractScenario(response.content ?? '');
    return this.normalizeDraft({
      request,
      parsed,
      rawContent: response.content ?? '',
      userClaims,
      access,
      variationIndex,
    });
  }

  private async getScenarioAccessContext(
    userClaims: UserClaims,
  ): Promise<ScenarioAccessContext> {
    try {
      const teams = await firstValueFrom<Team[]>(
        this.userClient
          .send<Team[]>(USER_SERVICE_PATTERNS.GET_USER_TEAMS, {
            userClaims,
          })
          .pipe(timeout(8000)),
      );

      const teamIds = new Set<string>();
      const teamRoles = new Map<string, Role>();

      for (const team of teams ?? []) {
        if (!team?.id) continue;
        teamIds.add(team.id);
        const membership = team.memberships?.find(
          (entry: TeamMembership) => entry.userId === userClaims.id,
        );
        if (membership?.role) {
          teamRoles.set(team.id, membership.role);
        }
      }

      return { teamIds, teamRoles };
    } catch (error) {
      this.logger.warn(
        `Failed to resolve team access context for ${userClaims.id}: ${(error as Error)?.message}`,
      );
      return { teamIds: new Set(), teamRoles: new Map() };
    }
  }

  private requireReadableScenario(
    id: string,
    userClaims: UserClaims,
    access: ScenarioAccessContext,
  ): Promise<Scenario> {
    return this.scenarioRepository.findById(id).then((scenario) => {
      if (!scenario || !this.canReadScenario(scenario, userClaims.id, access)) {
        throw new NotFoundException(`Scenario with ID ${id} not found`);
      }
      return scenario;
    });
  }

  private canReadScenario(
    scenario: Scenario,
    userId: string,
    access: ScenarioAccessContext,
  ): boolean {
    if (this.isReadonlyLegacy(scenario)) {
      return scenario.orgId === userId || access.teamIds.has(scenario.orgId);
    }

    if (scenario.visibility === 'PUBLIC') {
      return true;
    }

    if (scenario.createdByUserId === userId) {
      return true;
    }

    if (scenario.visibility === 'TEAM') {
      return access.teamIds.has(scenario.orgId);
    }

    return false;
  }

  private canEditScenario(
    scenario: Scenario,
    userId: string,
    access: ScenarioAccessContext,
  ): boolean {
    if (this.isReadonlyLegacy(scenario)) {
      return false;
    }

    if (scenario.createdByUserId === userId) {
      return true;
    }

    if (scenario.visibility !== 'TEAM') {
      return false;
    }

    const role = access.teamRoles.get(scenario.orgId);
    return role === 'OWNER' || role === 'ADMIN';
  }

  private canDeleteScenario(
    scenario: Scenario,
    userId: string,
    access: ScenarioAccessContext,
  ): boolean {
    return this.canEditScenario(scenario, userId, access);
  }

  private assertWorkspaceAccess(
    orgId: string,
    userClaims: UserClaims,
    access: ScenarioAccessContext,
  ): void {
    if (orgId === userClaims.id) {
      return;
    }

    if (!access.teamIds.has(orgId)) {
      throw new ForbiddenException('You do not have access to this workspace.');
    }
  }

  private assertVisibilityAllowed(
    visibility: ScenarioVisibilityDto,
    orgId: string,
    userClaims: UserClaims,
    access: ScenarioAccessContext,
  ): void {
    const isPersonalWorkspace = orgId === userClaims.id;
    const isTeamWorkspace = access.teamIds.has(orgId);

    if (!isPersonalWorkspace && !isTeamWorkspace) {
      throw new ForbiddenException('You do not have access to this workspace.');
    }

    if (visibility === ScenarioVisibilityDto.TEAM && !isTeamWorkspace) {
      throw new BadRequestException(
        'Team visibility is only available when saving into a team workspace.',
      );
    }
  }

  private buildListWhere(
    scope: ScenarioListScopeDto,
    orgId: string | undefined,
    userClaims: UserClaims,
    access: ScenarioAccessContext,
  ): Prisma.ScenarioWhereInput | null {
    if (scope === ScenarioListScopeDto.public) {
      return {
        visibility: 'PUBLIC',
        createdByUserId: { not: null },
      };
    }

    if (scope === ScenarioListScopeDto.team) {
      if (!orgId || !access.teamIds.has(orgId)) {
        return null;
      }

      return {
        OR: [
          {
            orgId,
            visibility: 'TEAM',
          },
          {
            orgId,
            createdByUserId: null,
          },
        ],
      };
    }

    if (orgId) {
      if (orgId === userClaims.id) {
        return {
          OR: [
            {
              orgId,
              createdByUserId: userClaims.id,
            },
            {
              orgId,
              createdByUserId: null,
            },
          ],
        };
      }

      if (!access.teamIds.has(orgId)) {
        return null;
      }

      return {
        orgId,
        createdByUserId: userClaims.id,
      };
    }

    return {
      createdByUserId: userClaims.id,
    };
  }

  private filterBySearch(scenarios: Scenario[], query?: string): Scenario[] {
    const search = pickString(query)?.toLowerCase();
    if (!search) {
      return scenarios;
    }

    return scenarios.filter((scenario) => {
      const tags = uniqueStrings(
        isRecord(scenario.config) ? scenario.config.tags : undefined,
      ).join(' ');
      const haystack = [scenario.name, scenario.description, tags]
        .filter(
          (value): value is string =>
            typeof value === 'string' && value.length > 0,
        )
        .join(' ')
        .toLowerCase();
      return haystack.includes(search);
    });
  }

  private getVariationLabel(index: number): string {
    const labels = [
      'stakeholder pushback',
      'commercial pressure',
      'execution risk',
      'relationship tension',
      'timeline pressure',
    ];
    return labels[index % labels.length] ?? 'a new business tension';
  }

  private normalizeDraft(params: {
    request: GenerateScenarioRequestDto;
    parsed: ParsedScenarioDraft | null;
    rawContent: string;
    userClaims: UserClaims;
    access: ScenarioAccessContext;
    variationIndex: number;
  }): ScenarioDraftDto {
    const { request, parsed, rawContent, userClaims, access, variationIndex } =
      params;
    const parsedConfig = isRecord(parsed?.config) ? parsed?.config : {};
    const requestedConfig = isRecord(request.sessionConfig)
      ? request.sessionConfig
      : {};
    const requestedRoles = alignPitchRolePair(
      pickString(requestedConfig.aiRole),
      pickString(requestedConfig.userRole),
    );
    const parsedRoles = this.normalizeRoles(parsedConfig.roles, requestedRoles);
    const background =
      pickString(parsedConfig.background) ??
      pickString(parsedConfig.context) ??
      pickString(request.context) ??
      this.buildFallbackBackground(request, userClaims, access);
    const objective =
      pickString(parsedConfig.objective) ??
      pickString(request.objective) ??
      `Make progress on ${pickString(request.name) ?? 'the scenario objective'}`;
    const durationMinutes = clampMinutes(
      parsedConfig.durationMinutes ?? requestedConfig.durationMinutes,
      20,
    );
    const stages = this.normalizeStages(
      parsedConfig.stages,
      objective,
      durationMinutes,
    );
    const constraints = uniqueStrings(parsedConfig.constraints);
    const successCriteria = uniqueStrings(parsedConfig.successCriteria);
    const stakes = uniqueStrings(parsedConfig.stakes);
    const tags = uniqueStrings(parsedConfig.tags, request.tags ?? []);
    const language =
      pickString(parsedConfig.language) ??
      pickString(request.language) ??
      'en-US';
    const visibility = ScenarioVisibilityDto.PRIVATE;
    const name =
      this.normalizeTitle(
        parsed?.name ??
          request.name ??
          `Generated Scenario${variationIndex > 0 ? ` ${variationIndex + 1}` : ''}`,
      ) || 'Generated Scenario';
    const description =
      pickString(parsed?.description) ??
      this.buildFallbackDescription(
        background,
        objective,
        parsedRoles.assistant,
      );

    const normalizedConfig: JsonRecord = {
      objective,
      background,
      context: background,
      roles: parsedRoles,
      constraints:
        constraints.length > 0
          ? constraints
          : ['Limited time to move the conversation forward effectively'],
      successCriteria:
        successCriteria.length > 0
          ? successCriteria
          : ['Establish a credible next step before ending the meeting'],
      stakes:
        stakes.length > 0
          ? stakes
          : ['The learner needs to protect momentum while preserving trust'],
      stages,
      difficulty: normalizeDifficulty(
        parsedConfig.difficulty ?? requestedConfig.difficulty,
      ),
      durationMinutes,
      tags,
      language,
      grounding: {
        personaId: request.personaId,
        personaSnapshot: request.personaSnapshot,
        crmContextId: request.crmContextId,
        crmSelections: request.crmSelections,
        userSnapshot: request.userSnapshot,
        orgSnapshot: request.orgSnapshot,
        workspaceType: summarizeWorkspaceType(
          request.orgId,
          userClaims.id,
          access,
        ),
        rawExcerpt: rawContent.slice(0, 400),
      },
      sessionConfig: {
        aiRole: parsedRoles.assistant,
        userRole: parsedRoles.user,
        durationMinutes,
        difficulty: normalizeDifficulty(
          parsedConfig.difficulty ?? requestedConfig.difficulty,
        ),
      },
    };

    return {
      draftId: this.createDraftId(),
      name,
      description,
      visibility,
      config: normalizedConfig,
    };
  }

  private normalizeConfig(
    input: Record<string, unknown>,
  ): Record<string, unknown> {
    const normalized = isRecord(input) ? { ...input } : {};
    const roles = this.normalizeRoles(normalized.roles, {
      assistant: pickString(
        isRecord(normalized.sessionConfig)
          ? normalized.sessionConfig.aiRole
          : undefined,
      ),
      user: pickString(
        isRecord(normalized.sessionConfig)
          ? normalized.sessionConfig.userRole
          : undefined,
      ),
    });
    const objective = pickString(normalized.objective);
    const background =
      pickString(normalized.background) ?? pickString(normalized.context) ?? '';
    const durationMinutes = clampMinutes(normalized.durationMinutes, 20);
    const normalizedConfig: Record<string, unknown> = {
      ...normalized,
      objective,
      background,
      context: background,
      roles,
      constraints: uniqueStrings(normalized.constraints),
      successCriteria: uniqueStrings(normalized.successCriteria),
      stakes: uniqueStrings(normalized.stakes),
      stages: this.normalizeStages(
        normalized.stages,
        objective,
        durationMinutes,
      ),
      difficulty: normalizeDifficulty(normalized.difficulty),
      durationMinutes,
      tags: uniqueStrings(normalized.tags),
      language: pickString(normalized.language) ?? 'en-US',
      sessionConfig: {
        ...(isRecord(normalized.sessionConfig) ? normalized.sessionConfig : {}),
        aiRole: roles.assistant,
        userRole: roles.user,
        durationMinutes,
        difficulty: normalizeDifficulty(normalized.difficulty),
      },
    };

    return normalizedConfig;
  }

  private normalizeRoles(
    value: unknown,
    fallback?: { assistant?: string; user?: string },
  ): { assistant?: string; user?: string } {
    if (isRecord(value)) {
      const assistantRole =
        pickString(value.assistant) ??
        pickString(value.ai) ??
        pickCounterpartRole([
          pickString(value.assistant),
          pickString(value.ai),
          pickString(value.client),
          pickString(value.user),
        ]);
      const userRole =
        pickString(value.user) ??
        pickPitcherRole([
          pickString(value.user),
          pickString(value.assistant),
          pickString(value.client),
        ]) ??
        pickFirstDifferentRole(
          [
            pickString(value.user),
            pickString(value.assistant),
            pickString(value.client),
            pickString(value.ai),
          ],
          assistantRole,
        );
      return alignPitchRolePair(
        assistantRole ?? fallback?.assistant,
        userRole ?? fallback?.user,
      );
    }

    if (Array.isArray(value)) {
      const roleNames = value.map((entry) =>
        isRecord(entry) ? pickString(entry.name) : pickString(entry),
      );
      return alignPitchRolePair(
        pickCounterpartRole(roleNames) ?? roleNames[0],
        pickPitcherRole(roleNames) ??
          pickFirstDifferentRole(roleNames, roleNames[0]),
      );
    }

    return alignPitchRolePair(fallback?.assistant, fallback?.user);
  }

  private normalizeStages(
    value: unknown,
    objective: string | undefined,
    durationMinutes: number,
  ): Array<{ label: string; description?: string; duration?: number }> {
    if (Array.isArray(value) && value.length > 0) {
      const normalized: Array<{
        label: string;
        description?: string;
        duration?: number;
      }> = [];

      for (const [index, stage] of value.entries()) {
        if (typeof stage === 'string') {
          normalized.push({
            label: stage.trim() || `Stage ${index + 1}`,
          });
          continue;
        }

        if (!isRecord(stage)) {
          continue;
        }

        normalized.push({
          label:
            pickString(stage.label) ??
            pickString(stage.name) ??
            pickString(stage.title) ??
            `Stage ${index + 1}`,
          description: pickString(stage.description),
          duration:
            typeof stage.duration === 'number'
              ? Math.min(60, Math.max(3, Math.round(stage.duration)))
              : undefined,
        });
      }

      if (normalized.length > 0) {
        return normalized;
      }
    }

    const stageDuration = Math.max(
      4,
      Math.round(durationMinutes / DEFAULT_STAGE_LABELS.length),
    );
    return DEFAULT_STAGE_LABELS.map(([label, description], index) => ({
      label,
      description:
        index === DEFAULT_STAGE_LABELS.length - 1 && objective
          ? objective
          : description,
      duration: stageDuration,
    }));
  }

  private buildFallbackBackground(
    request: GenerateScenarioRequestDto,
    userClaims: UserClaims,
    access: ScenarioAccessContext,
  ): string {
    const workspaceType = summarizeWorkspaceType(
      request.orgId,
      userClaims.id,
      access,
    );
    const personaName =
      pickString(
        isRecord(request.personaSnapshot)
          ? request.personaSnapshot.name
          : undefined,
      ) ?? 'a key stakeholder';
    const crmSelections = request.crmSelections;
    const crmSummary = crmSelections
      ? [
          ...(crmSelections.accounts?.slice(0, 2) ?? []),
          ...(crmSelections.opportunities?.slice(0, 2) ?? []),
          ...(crmSelections.leads?.slice(0, 1) ?? []),
          ...(crmSelections.contacts?.slice(0, 2) ?? []),
        ]
      : [];
    const topic = pickString(request.name) ?? 'a live customer conversation';
    const workspaceLabel =
      workspaceType === 'team'
        ? 'team'
        : workspaceType === 'personal'
          ? 'individual'
          : 'workspace';

    return `The learner is preparing for ${topic} inside a ${workspaceLabel} practice workspace. The counterpart is ${personaName}. ${
      crmSummary.length > 0
        ? `Ground the discussion around these selected records: ${crmSummary.join(', ')}.`
        : 'Use a plausible account and meeting context that matches the topic.'
    }`;
  }

  private buildFallbackDescription(
    background: string,
    objective: string,
    counterpartRole?: string,
  ): string {
    const counterpartText = counterpartRole
      ? ` The AI counterpart acts as ${counterpartRole}.`
      : '';
    return `${background} The learner needs to ${objective}.${counterpartText}`;
  }

  private extractScenario(content: string): ParsedScenarioDraft | null {
    if (!content) return null;

    const fenced = content.match(/```json\s*([\s\S]*?)\s*```/i);
    const raw = fenced ? fenced[1] : content;
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start === -1 || end === -1) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw.slice(start, end + 1)) as Record<
        string,
        unknown
      >;
      if (!parsed || typeof parsed !== 'object') return null;
      return {
        name: pickString(parsed.name),
        description: pickString(parsed.description),
        config:
          parsed.config && typeof parsed.config === 'object'
            ? (parsed.config as Record<string, unknown>)
            : undefined,
      };
    } catch (error) {
      this.logger.warn(
        `Failed to parse scenario JSON from LLM output: ${(error as Error)?.message}`,
      );
      return null;
    }
  }

  private createDraftId(): string {
    const random = Math.random().toString(36).slice(2, 10);
    return `draft_${Date.now()}_${random}`;
  }

  private normalizeTitle(input: string): string {
    const title = pickString(input);
    if (!title) {
      throw new BadRequestException('Scenario name is required.');
    }
    return title.slice(0, 160);
  }

  private isReadonlyLegacy(scenario: Scenario): boolean {
    return !scenario.createdByUserId;
  }

  private mapToResponseDto(
    scenario: Scenario,
    access: ScenarioAccessContext,
    userId: string,
  ): ScenarioResponseDto {
    return {
      id: scenario.id,
      orgId: scenario.orgId,
      createdByUserId: scenario.createdByUserId ?? undefined,
      visibility: this.getDisplayVisibility(scenario, access, userId),
      name: scenario.name,
      description: scenario.description ?? undefined,
      config: (scenario.config as Record<string, unknown>) ?? undefined,
      isReadonlyLegacy: this.isReadonlyLegacy(scenario),
      permissions: this.buildPermissions(scenario, userId, access),
      createdAt: scenario.createdAt.toISOString(),
      updatedAt: scenario.updatedAt.toISOString(),
    };
  }

  private buildPermissions(
    scenario: Scenario,
    userId: string,
    access: ScenarioAccessContext,
  ): ScenarioPermissionsDto {
    return {
      canUse: this.canReadScenario(scenario, userId, access),
      canEdit: this.canEditScenario(scenario, userId, access),
      canDelete: this.canDeleteScenario(scenario, userId, access),
      canDuplicate: this.canReadScenario(scenario, userId, access),
    };
  }

  private getDisplayVisibility(
    scenario: Scenario,
    access: ScenarioAccessContext,
    userId: string,
  ): ScenarioVisibilityDto {
    if (!this.isReadonlyLegacy(scenario)) {
      return scenario.visibility as unknown as ScenarioVisibilityDto;
    }

    if (scenario.orgId === userId) {
      return ScenarioVisibilityDto.PRIVATE;
    }

    if (access.teamIds.has(scenario.orgId)) {
      return ScenarioVisibilityDto.TEAM;
    }

    return ScenarioVisibilityDto.PRIVATE;
  }
}
