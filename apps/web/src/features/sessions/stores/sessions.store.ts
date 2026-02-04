'use client'

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { SessionService } from '../services/sessions.service'
import type {
  Session,
  SessionListResponse,
  CreateSessionInput,
  UpdateSessionInput,
  EndSessionInput,
  ListSessionsParams,
} from '../types/sessions.types'

type SessionsState = {
  sessions: Session[]
  activeSessionId: string | null
  currentSession: Session | null
  total: number
  limit: number
  offset: number
  loading: boolean
  error: string | null

  fetchSessions: (params?: ListSessionsParams) => Promise<void>
  fetchSessionById: (id: string) => Promise<void>
  fetchUserSessions: (userId: string, params?: { limit?: number; offset?: number }) => Promise<void>
  fetchOrgSessions: (orgId: string, params?: { limit?: number; offset?: number }) => Promise<void>
  createSession: (input: CreateSessionInput) => Promise<Session>
  updateSession: (id: string, input: UpdateSessionInput) => Promise<void>
  endSession: (id: string, input?: EndSessionInput) => Promise<void>
  deleteSession: (id: string) => Promise<void>

  setActiveSessionId: (id: string | null) => void
}

const upsertSession = (sessions: Session[], session: Session): Session[] => {
  const index = sessions.findIndex((item) => item.id === session.id)
  if (index === -1) return [...sessions, session]

  const next = sessions.slice()
  next[index] = session
  return next
}

const resolveActiveSession = (sessions: Session[], activeId: string | null): Session | null => {
  if (activeId) {
    const existing = sessions.find((session) => session.id === activeId)
    if (existing) return existing
  }
  return sessions[0] ?? null
}

const applyListResponse = (response: SessionListResponse, activeId: string | null) => {
  const current = resolveActiveSession(response.sessions, activeId)
  return {
    sessions: response.sessions,
    total: response.total,
    limit: response.limit,
    offset: response.offset,
    activeSessionId: current?.id ?? null,
    currentSession: current,
  }
}

export const useSessionsStore = create<SessionsState>()(
  persist(
    (set, get) => ({
      sessions: [],
      activeSessionId: null,
      currentSession: null,
      total: 0,
      limit: 10,
      offset: 0,
      loading: false,
      error: null,

      setActiveSessionId: (id) => set({ activeSessionId: id }),

      fetchSessions: async (params?: ListSessionsParams) => {
        set({ loading: true, error: null })
        try {
          const data = await SessionService.getAll(params)
          const activeId = get().activeSessionId
          set({
            ...applyListResponse(data, activeId),
            loading: false,
          })
        } catch (err) {
          set({
            loading: false,
            error: err instanceof Error ? err.message : 'Failed to load sessions',
          })
        }
      },

      fetchUserSessions: async (userId: string, params?: { limit?: number; offset?: number }) => {
        set({ loading: true, error: null })
        try {
          const data = await SessionService.getUserSessions(userId, params)
          const activeId = get().activeSessionId
          set({
            ...applyListResponse(data, activeId),
            loading: false,
          })
        } catch (err) {
          set({
            loading: false,
            error: err instanceof Error ? err.message : 'Failed to load user sessions',
          })
        }
      },

      fetchOrgSessions: async (orgId: string, params?: { limit?: number; offset?: number }) => {
        set({ loading: true, error: null })
        try {
          const data = await SessionService.getOrgSessions(orgId, params)
          const activeId = get().activeSessionId
          set({
            ...applyListResponse(data, activeId),
            loading: false,
          })
        } catch (err) {
          set({
            loading: false,
            error: err instanceof Error ? err.message : 'Failed to load org sessions',
          })
        }
      },

      fetchSessionById: async (id: string) => {
        set({ loading: true, error: null })
        try {
          const session = await SessionService.getById(id)
          set((state) => ({
            loading: false,
            currentSession: session,
            activeSessionId: session.id,
            sessions: upsertSession(state.sessions, session),
            total: Math.max(state.total, state.sessions.length),
          }))
        } catch (err) {
          set({
            loading: false,
            error: err instanceof Error ? err.message : 'Failed to load session',
          })
        }
      },

      createSession: async (input: CreateSessionInput) => {
        set({ loading: true, error: null })
        try {
          const session = await SessionService.create(input)
          set((state) => {
            const sessions = upsertSession(state.sessions, session)
            return {
              loading: false,
              currentSession: session,
              activeSessionId: session.id,
              sessions,
              total: Math.max(state.total, sessions.length),
            }
          })
          return session
        } catch (err) {
          set({
            loading: false,
            error: err instanceof Error ? err.message : 'Failed to create session',
          })
          throw err
        }
      },

      updateSession: async (id: string, input: UpdateSessionInput) => {
        set({ loading: true, error: null })
        try {
          const session = await SessionService.update(id, input)
          set((state) => ({
            loading: false,
            currentSession: session,
            activeSessionId: session.id,
            sessions: upsertSession(state.sessions, session),
            total: Math.max(state.total, state.sessions.length),
          }))
        } catch (err) {
          set({
            loading: false,
            error: err instanceof Error ? err.message : 'Failed to update session',
          })
          throw err
        }
      },

      endSession: async (id: string, input?: EndSessionInput) => {
        set({ loading: true, error: null })
        try {
          const session = await SessionService.end(id, input)
          set((state) => ({
            loading: false,
            currentSession: session,
            activeSessionId: session.id,
            sessions: upsertSession(state.sessions, session),
            total: Math.max(state.total, state.sessions.length),
          }))
        } catch (err) {
          set({
            loading: false,
            error: err instanceof Error ? err.message : 'Failed to end session',
          })
          throw err
        }
      },

      deleteSession: async (id: string) => {
        set({ loading: true, error: null })
        try {
          await SessionService.delete(id)
          set((state) => {
            const sessions = state.sessions.filter((session) => session.id !== id)
            const nextCurrent = resolveActiveSession(sessions, state.activeSessionId)
            return {
              loading: false,
              sessions,
              currentSession: nextCurrent,
              activeSessionId: nextCurrent?.id ?? null,
              total: Math.max(state.total - 1, 0),
            }
          })
        } catch (err) {
          set({
            loading: false,
            error: err instanceof Error ? err.message : 'Failed to delete session',
          })
          throw err
        }
      },
    }),
    {
      name: 'sessions-store',
      storage: createJSONStorage(() => window.localStorage),
      partialize: (state) => ({
        sessions: state.sessions,
        activeSessionId: state.activeSessionId,
        currentSession: state.currentSession,
      }),
    }
  )
)
