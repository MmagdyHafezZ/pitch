export type SessionType = 'text' | 'voice' | 'video' | 'phone' | string
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
  scenario?: {
    id: string
    orgId?: string
    name?: string | null
    description?: string | null
    config?: Record<string, unknown> | null
    createdAt?: string
    updatedAt?: string
  } | null
  persona?: {
    id: string
    orgId?: string
    name?: string | null
    traits?: Record<string, unknown> | null
    createdAt?: string
    updatedAt?: string
  } | null
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
  model?: string
  speed?: number
  stability?: number
}

export interface PhoneConfig {
  number: string
}

export interface VideoRuntimeConfig {
  status?: 'idle' | 'queued' | 'rendering' | 'ready' | 'failed' | string
  provider?: string
  activeJobId?: string
  playbackToken?: string
  requestId?: string
  providerJobId?: string
  assetUrl?: string
  lastError?: string
  submittedAt?: string
  completedAt?: string
  updatedAt?: string
  textPreview?: string
  fallbackUsed?: boolean
}

export interface VideoConfig {
  mode?: 'rendered' | string
  provider?: string
  runtime?: VideoRuntimeConfig
}

export interface SessionConfigData {
  llm?: LLMConfig
  voice?: VoiceConfig
  phone?: PhoneConfig
  video?: VideoConfig
  multiTurnEnabled?: boolean
  tone?: string
  speechRate?: string
  responseLength?: string
  patienceLevel?: string
  initiativeLevel?: string
  accent?: string
  difficulty?: number
  aiRole?: string
  userRole?: string
}
