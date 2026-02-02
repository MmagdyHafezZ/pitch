export type SessionType = 'text' | 'voice' | 'video' | string
export type SessionStatus = 'active' | 'ended' | string

export interface Session {
  id: string
  name?: string | null
  userId: string
  orgId: string
  userSnapshot?: Record<string, unknown> | null
  orgSnapshot?: Record<string, unknown> | null
  type: SessionType
  tags: string[]
  sessionConfig?: Record<string, unknown> | null
  scenarioId?: string | null
  personaId?: string | null
  language?: string | null
  crmContextId?: string | null
  status: SessionStatus
  endedReason?: string | null
  createdAt: string
  updatedAt: string
  endedAt?: string | null
}

export interface CreateSessionInput {
  orgId: string
  userSnapshot?: Record<string, unknown>
  orgSnapshot?: Record<string, unknown>
  name?: string
  type: SessionType
  tags?: string[]
  sessionConfig?: Record<string, unknown>
  scenarioId?: string
  personaId?: string
  language?: string
  crmContextId?: string
}

export interface UpdateSessionInput {
  orgId?: string
  orgSnapshot?: Record<string, unknown>
  name?: string
  type?: SessionType
  tags?: string[]
  sessionConfig?: Record<string, unknown>
  scenarioId?: string
  personaId?: string
  language?: string
  crmContextId?: string
  status?: SessionStatus
  endedReason?: string
}

export interface EndSessionInput {
  reason?: string
}

export interface ListSessionsParams {
  userId?: string
  orgId?: string
  type?: SessionType
  status?: SessionStatus
  scenarioId?: string
  personaId?: string
  limit?: number
  offset?: number
}

export interface SessionListResponse {
  sessions: Session[]
  total: number
  limit: number
  offset: number
}

export interface DeleteSessionResponse {
  message: string
  id: string
}

// LLM Provider Types
export interface ModelPricing {
  inputTokensPerMillion: number
  outputTokensPerMillion: number
  imageTokens?: number
  audioSecondsToTokens?: number
}

export interface LLMModelDetail {
  name: string
  pricing: ModelPricing
  maxTokens: number
  maxOutputTokens?: number
  supportsStreaming: boolean
  supportsTools: boolean
  supportsVision: boolean
  supportsAudio: boolean
  supportedModalities: Array<'text' | 'image' | 'audio'>
}

export interface LLMProviderInfo {
  name: string
  enabled: boolean
  models: string[]
  modelDetails: LLMModelDetail[]
}

export interface LLMProvidersResponse {
  providers: LLMProviderInfo[]
}

// Session Configuration Types
export interface LLMConfig {
  provider: string
  model: string
  temperature?: number
  maxTokens?: number
}

export interface VoiceConfig {
  provider: string
  voice: string
  speed?: number
  stability?: number
}

export interface SessionConfigData {
  llm?: LLMConfig
  voice?: VoiceConfig
  multiTurnEnabled?: boolean
  tone?: string
  speechRate?: string
  accent?: string
  difficulty?: number
}
