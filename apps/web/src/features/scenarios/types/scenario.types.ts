export type ScenarioVisibility = 'PRIVATE' | 'TEAM' | 'PUBLIC'
export type ScenarioListScope = 'mine' | 'team' | 'public'

export interface ScenarioPermissions {
  canUse: boolean
  canRead?: boolean
  canEdit: boolean
  canDelete: boolean
  canDuplicate: boolean
}

export interface ScenarioStage {
  title: string
  goal: string
}

export interface ScenarioRoles {
  user?: string
  assistant?: string
  client?: string
  ai?: string
  [key: string]: unknown
}

export interface ScenarioConfig {
  objective?: string
  background?: string
  context?: string
  roles?: ScenarioRoles
  constraints?: string[]
  successCriteria?: string[]
  stakes?: string[]
  stages?: ScenarioStage[]
  difficulty?: string
  durationMinutes?: number
  tags?: string[]
  language?: string
  grounding?: Record<string, unknown>
  sessionConfig?: Record<string, unknown>
  [key: string]: unknown
}

export interface ScenarioDraft {
  draftId: string
  name: string
  description?: string
  visibility: ScenarioVisibility
  config?: ScenarioConfig | null
}

export interface Scenario {
  id: string
  orgId: string
  createdByUserId?: string | null
  visibility: ScenarioVisibility
  name: string
  description?: string | null
  config?: ScenarioConfig | null
  isReadonlyLegacy: boolean
  permissions: ScenarioPermissions
  createdAt: string
  updatedAt: string
}

export interface EditableScenarioDraft extends ScenarioDraft {
  sourceScenarioId?: string | null
  sourceType?: 'generated' | 'library' | 'session'
}

export interface GenerateScenarioCrmSelections {
  accounts?: string[]
  opportunities?: string[]
  leads?: string[]
  contacts?: string[]
}

export interface GenerateScenarioRequest {
  orgId: string
  name: string
  type?: string
  tags?: string[]
  language?: string
  sessionConfig?: Record<string, unknown>
  personaId?: string
  personaSnapshot?: Record<string, unknown>
  crmContextId?: string
  crmSelections?: GenerateScenarioCrmSelections
  userSnapshot?: Record<string, unknown>
  orgSnapshot?: Record<string, unknown>
  objective?: string
  context?: string
}

export interface GenerateScenarioBatchRequest extends GenerateScenarioRequest {
  count?: number
}

export interface CreateScenarioInput {
  orgId: string
  name: string
  description?: string
  visibility: ScenarioVisibility
  config?: ScenarioConfig
}

export interface UpdateScenarioInput {
  name?: string
  description?: string
  visibility?: ScenarioVisibility
  config?: ScenarioConfig
}

export interface ScenarioListParams {
  orgId?: string
  scope?: ScenarioListScope
  query?: string
}

export interface ScenarioDraftListResponse {
  scenarios: ScenarioDraft[]
  total: number
}

export interface ScenarioListResponse {
  scenarios: Scenario[]
  total: number
}
