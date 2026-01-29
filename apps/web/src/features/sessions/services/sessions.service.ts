import { api } from '@/lib/client'
import type {
  Session,
  SessionListResponse,
  CreateSessionInput,
  UpdateSessionInput,
  EndSessionInput,
  ListSessionsParams,
  DeleteSessionResponse,
} from '../types/sessions.types'

export const SessionService = {
  getAll(params?: ListSessionsParams): Promise<SessionListResponse> {
    return api.sessions.getAll(params)
  },

  getById(id: string): Promise<Session> {
    return api.sessions.getById(id)
  },

  getUserSessions(
    userId: string,
    params?: { limit?: number; offset?: number }
  ): Promise<SessionListResponse> {
    return api.sessions.getUserSessions(userId, params)
  },

  getOrgSessions(
    orgId: string,
    params?: { limit?: number; offset?: number }
  ): Promise<SessionListResponse> {
    return api.sessions.getOrgSessions(orgId, params)
  },

  create(payload: CreateSessionInput): Promise<Session> {
    return api.sessions.create(payload)
  },

  update(id: string, payload: UpdateSessionInput): Promise<Session> {
    return api.sessions.update(id, payload)
  },

  end(id: string, payload?: EndSessionInput): Promise<Session> {
    return api.sessions.end(id, payload)
  },

  delete(id: string): Promise<DeleteSessionResponse> {
    return api.sessions.delete(id)
  },
}
