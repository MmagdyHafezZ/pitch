import type {
  EditableScenarioDraft,
  Scenario,
  ScenarioConfig,
  ScenarioDraft,
  ScenarioRoles,
  ScenarioStage,
  ScenarioVisibility,
} from '../types/scenario.types'

const COUNTERPART_ROLE_PATTERN =
  /client|customer|buyer|prospect|stakeholder|procurement|decision maker|decision-maker|economic buyer|cto|cfo|cio|vp/i

const PITCHER_ROLE_PATTERN =
  /sales|seller|pitch|account executive|account manager|sales rep|representative|bdr|sdr|business development|founder|consultant/i

const DEFAULT_STAGES: ScenarioStage[] = [
  { title: 'Opening', goal: 'Set the agenda and establish the stakes.' },
  { title: 'Discovery', goal: 'Surface what matters most to the counterpart.' },
  { title: 'Discussion', goal: 'Navigate tension, objections, and tradeoffs.' },
  { title: 'Close', goal: 'Land on a clear next step or decision.' },
]

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const pickString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined

const normalizeRole = (value: string | undefined): string | undefined =>
  value ? value.trim().replace(/\s+/g, ' ').toLowerCase() : undefined

const normalizeStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return []
  }

  const seen = new Set<string>()
  const next: string[] = []

  for (const item of value) {
    const candidate = pickString(item)
    if (!candidate) {
      continue
    }

    const key = candidate.toLowerCase()
    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    next.push(candidate)
  }

  return next
}

const normalizeStage = (value: unknown): ScenarioStage | null => {
  if (!isRecord(value)) {
    return null
  }

  const title =
    pickString(value.title) ?? pickString(value.label) ?? pickString(value.name) ?? undefined
  const goal =
    pickString(value.goal) ??
    pickString(value.description) ??
    pickString(value.outcome) ??
    undefined

  if (!title && !goal) {
    return null
  }

  return {
    title: title ?? 'Stage',
    goal: goal ?? 'Advance the conversation.',
  }
}

const normalizeStages = (value: unknown): ScenarioStage[] => {
  if (!Array.isArray(value)) {
    return DEFAULT_STAGES
  }

  const normalized = value.map(normalizeStage).filter((stage): stage is ScenarioStage => !!stage)
  return normalized.length > 0 ? normalized : DEFAULT_STAGES
}

const normalizeRoles = (value: unknown): ScenarioRoles => {
  if (!isRecord(value)) {
    return {}
  }

  return {
    ...value,
    user: pickString(value.user),
    assistant: pickString(value.assistant) ?? pickString(value.ai),
    client: pickString(value.client),
    ai: pickString(value.ai),
  }
}

export const normalizeScenarioConfig = (value: unknown, fallback?: Partial<ScenarioConfig>) => {
  const source = isRecord(value) ? value : {}

  return {
    objective: pickString(source.objective) ?? pickString(fallback?.objective) ?? '',
    background:
      pickString(source.background) ??
      pickString(source.context) ??
      pickString(fallback?.background) ??
      pickString(fallback?.context) ??
      '',
    context:
      pickString(source.context) ??
      pickString(source.background) ??
      pickString(fallback?.context) ??
      pickString(fallback?.background) ??
      '',
    roles: normalizeRoles(source.roles ?? fallback?.roles),
    constraints: normalizeStringArray(source.constraints ?? fallback?.constraints),
    successCriteria: normalizeStringArray(source.successCriteria ?? fallback?.successCriteria),
    stakes: normalizeStringArray(source.stakes ?? fallback?.stakes),
    stages: normalizeStages(source.stages ?? fallback?.stages),
    difficulty: pickString(source.difficulty) ?? pickString(fallback?.difficulty) ?? 'medium',
    durationMinutes:
      typeof source.durationMinutes === 'number'
        ? source.durationMinutes
        : typeof fallback?.durationMinutes === 'number'
          ? fallback.durationMinutes
          : 20,
    tags: normalizeStringArray(source.tags ?? fallback?.tags),
    language: pickString(source.language) ?? pickString(fallback?.language) ?? 'en-US',
    grounding: isRecord(source.grounding)
      ? source.grounding
      : isRecord(fallback?.grounding)
        ? fallback.grounding
        : {},
    sessionConfig: isRecord(source.sessionConfig)
      ? source.sessionConfig
      : isRecord(fallback?.sessionConfig)
        ? fallback.sessionConfig
        : {},
  } satisfies ScenarioConfig
}

export const createDraftId = () =>
  globalThis.crypto?.randomUUID?.() ?? `draft:${Date.now()}:${Math.random().toString(16).slice(2)}`

export const createEditableScenarioDraft = (input?: {
  name?: string
  description?: string
  visibility?: ScenarioVisibility
  config?: ScenarioConfig | null
  sourceScenarioId?: string | null
  sourceType?: EditableScenarioDraft['sourceType']
}): EditableScenarioDraft => ({
  draftId: createDraftId(),
  name: input?.name?.trim() || 'Untitled scenario',
  description: input?.description?.trim() || '',
  visibility: input?.visibility ?? 'PRIVATE',
  config: normalizeScenarioConfig(input?.config),
  sourceScenarioId: input?.sourceScenarioId ?? null,
  sourceType: input?.sourceType ?? 'generated',
})

export const draftFromScenario = (
  scenario: Scenario | ScenarioDraft,
  sourceType: EditableScenarioDraft['sourceType'] = 'generated'
): EditableScenarioDraft => {
  const sourceScenarioId = 'id' in scenario ? scenario.id : undefined

  return createEditableScenarioDraft({
    name: scenario.name,
    description: scenario.description ?? '',
    visibility: scenario.visibility,
    config: normalizeScenarioConfig(scenario.config),
    sourceScenarioId,
    sourceType,
  })
}

export const draftFromSessionScenario = (
  value: unknown,
  fallbackName?: string
): EditableScenarioDraft | null => {
  if (!isRecord(value)) {
    return null
  }

  const name = pickString(value.name) ?? pickString(value.topic) ?? fallbackName
  const description = pickString(value.description) ?? ''
  const visibility = (pickString(value.visibility) as ScenarioVisibility | undefined) ?? 'PRIVATE'

  return createEditableScenarioDraft({
    name: name ?? 'Session scenario',
    description,
    visibility,
    config: normalizeScenarioConfig(value, {
      objective: pickString(value.objective),
      background: pickString(value.background) ?? pickString(value.context),
      context: pickString(value.context) ?? pickString(value.background),
      language: pickString(value.language),
    }),
    sourceType: 'session',
  })
}

const pickCounterpartRole = (candidates: Array<string | undefined>): string | undefined =>
  candidates.find((candidate) => {
    const role = pickString(candidate)
    return !!role && COUNTERPART_ROLE_PATTERN.test(role.toLowerCase())
  })

const pickPitcherRole = (candidates: Array<string | undefined>): string | undefined =>
  candidates.find((candidate) => {
    const role = pickString(candidate)
    return !!role && PITCHER_ROLE_PATTERN.test(role.toLowerCase())
  })

const pickFirstDifferentRole = (
  candidates: Array<string | undefined>,
  exclude?: string
): string | undefined => {
  const normalizedExclude = normalizeRole(exclude)

  return candidates.find((candidate) => {
    const role = pickString(candidate)
    return !!role && normalizeRole(role) !== normalizedExclude
  })
}

export const alignPitchRolePair = (
  aiRole?: string,
  userRole?: string
): { aiRole?: string; userRole?: string } => {
  let resolvedAiRole = pickString(aiRole)
  let resolvedUserRole = pickString(userRole)

  if (
    resolvedAiRole &&
    resolvedUserRole &&
    PITCHER_ROLE_PATTERN.test(resolvedAiRole.toLowerCase()) &&
    COUNTERPART_ROLE_PATTERN.test(resolvedUserRole.toLowerCase())
  ) {
    const previousAiRole = resolvedAiRole
    resolvedAiRole = resolvedUserRole
    resolvedUserRole = previousAiRole
  }

  if (
    resolvedAiRole &&
    resolvedUserRole &&
    normalizeRole(resolvedAiRole) === normalizeRole(resolvedUserRole)
  ) {
    resolvedAiRole = undefined
  }

  return {
    aiRole: resolvedAiRole,
    userRole: resolvedUserRole,
  }
}

export const inferScenarioRolePair = (
  config?: ScenarioConfig | Record<string, unknown> | null
): { aiRole?: string; userRole?: string } => {
  if (!config || !isRecord(config)) {
    return {}
  }

  const scenarioConfig = normalizeScenarioConfig(config)
  const roles = scenarioConfig.roles ?? {}
  const sessionConfig = isRecord(scenarioConfig.sessionConfig) ? scenarioConfig.sessionConfig : {}

  const aiRoleFromSessionConfig =
    pickString(sessionConfig.aiRole) ?? pickString(sessionConfig.assistantRole)
  const userRoleFromSessionConfig = pickString(sessionConfig.userRole)

  const assistantRole =
    pickString(roles.assistant) ?? pickString(roles.ai) ?? pickString(roles.client)
  const clientRole = pickString(roles.client)
  const userRole = pickString(roles.user)

  const aiRole =
    pickCounterpartRole([clientRole, assistantRole, userRole, aiRoleFromSessionConfig]) ??
    aiRoleFromSessionConfig ??
    assistantRole ??
    clientRole
  const inferredUserRole =
    userRoleFromSessionConfig ??
    userRole ??
    pickPitcherRole([assistantRole, clientRole]) ??
    pickFirstDifferentRole([assistantRole, clientRole, userRole], aiRole)

  return alignPitchRolePair(aiRole, inferredUserRole)
}

export const getScenarioSummary = (
  scenario: Scenario | ScenarioDraft | EditableScenarioDraft | null | undefined
) => {
  if (!scenario) {
    return null
  }

  const config = normalizeScenarioConfig(scenario.config)
  const roles = inferScenarioRolePair(config)

  return {
    name: scenario.name,
    description: scenario.description ?? '',
    visibility: scenario.visibility,
    objective: config.objective ?? '',
    background: config.background ?? config.context ?? '',
    constraints: config.constraints ?? [],
    successCriteria: config.successCriteria ?? [],
    stakes: config.stakes ?? [],
    stages: config.stages ?? [],
    tags: config.tags ?? [],
    difficulty: config.difficulty ?? 'medium',
    durationMinutes: config.durationMinutes ?? 20,
    language: config.language ?? 'en-US',
    aiRole: roles.aiRole ?? '',
    userRole: roles.userRole ?? '',
  }
}

export const buildInlineSessionScenario = (input: {
  topic: string
  objective?: string
  context?: string
  selectedScenario?: Scenario | null
  draft?: EditableScenarioDraft | null
}) => {
  if (input.draft) {
    const config = normalizeScenarioConfig(input.draft.config)
    return {
      topic: input.topic || input.draft.name,
      name: input.draft.name,
      description: input.draft.description ?? '',
      objective: config.objective || input.objective || '',
      context: config.background || config.context || input.context || '',
      background: config.background || config.context || input.context || '',
      roles: config.roles,
      constraints: config.constraints,
      successCriteria: config.successCriteria,
      stakes: config.stakes,
      stages: config.stages,
      difficulty: config.difficulty,
      durationMinutes: config.durationMinutes,
      tags: config.tags,
      language: config.language,
      visibility: input.draft.visibility,
      grounding: config.grounding,
    }
  }

  if (input.selectedScenario) {
    const config = normalizeScenarioConfig(input.selectedScenario.config)
    return {
      topic: input.topic || input.selectedScenario.name,
      scenarioId: input.selectedScenario.id,
      objective: config.objective || input.objective || '',
      context: config.background || config.context || input.context || '',
      background: config.background || config.context || input.context || '',
    }
  }

  return {
    topic: input.topic,
    objective: input.objective || '',
    context: input.context || '',
  }
}
