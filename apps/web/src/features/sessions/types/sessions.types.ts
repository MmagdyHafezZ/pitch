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
  name?: string
  tags?: string[]
  sessionConfig?: Record<string, unknown>
  scenarioId?: string
  personaId?: string
  language?: string
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
