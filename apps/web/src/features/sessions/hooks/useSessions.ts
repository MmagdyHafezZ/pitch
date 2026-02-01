import { useSessionsStore } from '../stores/sessions.store'

export function useSessions() {
  const sessions = useSessionsStore((s) => s.sessions)
  const activeSessionId = useSessionsStore((s) => s.activeSessionId)
  const currentSession = useSessionsStore((s) => s.currentSession)
  const total = useSessionsStore((s) => s.total)
  const limit = useSessionsStore((s) => s.limit)
  const offset = useSessionsStore((s) => s.offset)
  const loading = useSessionsStore((s) => s.loading)
  const error = useSessionsStore((s) => s.error)
  const fetchSessions = useSessionsStore((s) => s.fetchSessions)
  const fetchSessionById = useSessionsStore((s) => s.fetchSessionById)
  const fetchUserSessions = useSessionsStore((s) => s.fetchUserSessions)
  const fetchOrgSessions = useSessionsStore((s) => s.fetchOrgSessions)
  const createSession = useSessionsStore((s) => s.createSession)
  const updateSession = useSessionsStore((s) => s.updateSession)
  const endSession = useSessionsStore((s) => s.endSession)
  const deleteSession = useSessionsStore((s) => s.deleteSession)
  const setActiveSessionId = useSessionsStore((s) => s.setActiveSessionId)

  return {
    sessions,
    activeSessionId,
    currentSession,
    total,
    limit,
    offset,
    loading,
    error,
    fetchSessions,
    fetchSessionById,
    fetchUserSessions,
    fetchOrgSessions,
    createSession,
    updateSession,
    endSession,
    deleteSession,
    setActiveSessionId,
  }
}
