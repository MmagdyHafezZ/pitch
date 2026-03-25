import { act } from '@testing-library/react'
import { useSessionsStore } from '../sessions.store'
import { SessionService } from '../../services/sessions.service'
import type { Session, SessionListResponse } from '../../types/sessions.types'

const makeSession = (overrides: Partial<Session> = {}): Session => ({
  id: 'session_1',
  userId: 'user_1',
  orgId: 'org_1',
  type: 'text',
  tags: [],
  status: 'active',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  ...overrides,
})

const makeListResponse = (
  sessions: Session[] = [],
  overrides: Partial<SessionListResponse> = {}
): SessionListResponse => ({
  sessions,
  total: sessions.length,
  limit: 10,
  offset: 0,
  ...overrides,
})

const resetStore = () => {
  act(() => {
    useSessionsStore.setState({
      sessions: [],
      activeSessionId: null,
      currentSession: null,
      total: 0,
      limit: 10,
      offset: 0,
      loading: false,
      error: null,
    })
  })
}

describe('SessionsStore', () => {
  beforeEach(() => {
    resetStore()
    jest.restoreAllMocks()
  })

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const state = useSessionsStore.getState()

      expect(state.sessions).toEqual([])
      expect(state.activeSessionId).toBeNull()
      expect(state.currentSession).toBeNull()
      expect(state.total).toBe(0)
      expect(state.limit).toBe(10)
      expect(state.offset).toBe(0)
      expect(state.loading).toBe(false)
      expect(state.error).toBeNull()
    })
  })

  describe('setActiveSessionId', () => {
    it('should set the active session id', () => {
      act(() => {
        useSessionsStore.getState().setActiveSessionId('session_abc')
      })

      expect(useSessionsStore.getState().activeSessionId).toBe('session_abc')
    })

    it('should clear the active session id when set to null', () => {
      act(() => {
        useSessionsStore.setState({ activeSessionId: 'session_abc' })
        useSessionsStore.getState().setActiveSessionId(null)
      })

      expect(useSessionsStore.getState().activeSessionId).toBeNull()
    })
  })

  describe('fetchSessions', () => {
    it('should fetch sessions and update state on success', async () => {
      const sessions = [makeSession({ id: 'session_1' }), makeSession({ id: 'session_2' })]
      jest.spyOn(SessionService, 'getAll').mockResolvedValueOnce(makeListResponse(sessions))

      await act(async () => {
        await useSessionsStore.getState().fetchSessions()
      })

      const state = useSessionsStore.getState()
      expect(state.sessions).toEqual(sessions)
      expect(state.total).toBe(2)
      expect(state.loading).toBe(false)
      expect(state.error).toBeNull()
    })

    it('should pick the first session as currentSession when no active id is set', async () => {
      const sessions = [makeSession({ id: 'session_1' }), makeSession({ id: 'session_2' })]
      jest.spyOn(SessionService, 'getAll').mockResolvedValueOnce(makeListResponse(sessions))

      await act(async () => {
        await useSessionsStore.getState().fetchSessions()
      })

      const state = useSessionsStore.getState()
      expect(state.currentSession?.id).toBe('session_1')
      expect(state.activeSessionId).toBe('session_1')
    })

    it('should prefer the existing active session id when fetching', async () => {
      const sessions = [makeSession({ id: 'session_1' }), makeSession({ id: 'session_2' })]
      jest.spyOn(SessionService, 'getAll').mockResolvedValueOnce(makeListResponse(sessions))

      act(() => {
        useSessionsStore.setState({ activeSessionId: 'session_2' })
      })

      await act(async () => {
        await useSessionsStore.getState().fetchSessions()
      })

      const state = useSessionsStore.getState()
      expect(state.currentSession?.id).toBe('session_2')
      expect(state.activeSessionId).toBe('session_2')
    })

    it('should set loading to true while fetching', async () => {
      let resolveGetAll!: (value: SessionListResponse) => void
      jest.spyOn(SessionService, 'getAll').mockImplementationOnce(
        () =>
          new Promise<SessionListResponse>((resolve) => {
            resolveGetAll = resolve
          })
      )

      act(() => {
        useSessionsStore.getState().fetchSessions()
      })

      expect(useSessionsStore.getState().loading).toBe(true)

      await act(async () => {
        resolveGetAll(makeListResponse([]))
        await Promise.resolve()
      })
    })

    it('should set error state when fetch fails', async () => {
      jest.spyOn(SessionService, 'getAll').mockRejectedValueOnce(new Error('Network error'))

      await act(async () => {
        await useSessionsStore.getState().fetchSessions()
      })

      const state = useSessionsStore.getState()
      expect(state.error).toBe('Network error')
      expect(state.loading).toBe(false)
    })

    it('should use fallback error message when non-Error is thrown', async () => {
      jest.spyOn(SessionService, 'getAll').mockRejectedValueOnce('unexpected')

      await act(async () => {
        await useSessionsStore.getState().fetchSessions()
      })

      expect(useSessionsStore.getState().error).toBe('Failed to load sessions')
    })

    it('should pass params to the service', async () => {
      const spy = jest.spyOn(SessionService, 'getAll').mockResolvedValueOnce(makeListResponse([]))

      await act(async () => {
        await useSessionsStore.getState().fetchSessions({ limit: 5, offset: 10 })
      })

      expect(spy).toHaveBeenCalledWith({ limit: 5, offset: 10 })
    })
  })

  describe('fetchUserSessions', () => {
    it('should fetch user sessions successfully', async () => {
      const sessions = [makeSession({ userId: 'user_42' })]
      jest
        .spyOn(SessionService, 'getUserSessions')
        .mockResolvedValueOnce(makeListResponse(sessions))

      await act(async () => {
        await useSessionsStore.getState().fetchUserSessions('user_42')
      })

      const state = useSessionsStore.getState()
      expect(state.sessions).toEqual(sessions)
      expect(state.loading).toBe(false)
      expect(state.error).toBeNull()
    })

    it('should set error on failure', async () => {
      jest
        .spyOn(SessionService, 'getUserSessions')
        .mockRejectedValueOnce(new Error('User not found'))

      await act(async () => {
        await useSessionsStore.getState().fetchUserSessions('user_bad')
      })

      expect(useSessionsStore.getState().error).toBe('User not found')
    })

    it('should fallback error message for non-Error throw', async () => {
      jest.spyOn(SessionService, 'getUserSessions').mockRejectedValueOnce('boom')

      await act(async () => {
        await useSessionsStore.getState().fetchUserSessions('user_x')
      })

      expect(useSessionsStore.getState().error).toBe('Failed to load user sessions')
    })
  })

  describe('fetchOrgSessions', () => {
    it('should fetch org sessions successfully', async () => {
      const sessions = [makeSession({ orgId: 'org_99' })]
      jest.spyOn(SessionService, 'getOrgSessions').mockResolvedValueOnce(makeListResponse(sessions))

      await act(async () => {
        await useSessionsStore.getState().fetchOrgSessions('org_99')
      })

      expect(useSessionsStore.getState().sessions).toEqual(sessions)
    })

    it('should set error on failure', async () => {
      jest.spyOn(SessionService, 'getOrgSessions').mockRejectedValueOnce(new Error('Org error'))

      await act(async () => {
        await useSessionsStore.getState().fetchOrgSessions('org_bad')
      })

      expect(useSessionsStore.getState().error).toBe('Org error')
    })

    it('should fallback error message for non-Error throw', async () => {
      jest.spyOn(SessionService, 'getOrgSessions').mockRejectedValueOnce(null)

      await act(async () => {
        await useSessionsStore.getState().fetchOrgSessions('org_x')
      })

      expect(useSessionsStore.getState().error).toBe('Failed to load org sessions')
    })
  })

  describe('fetchSessionById', () => {
    it('should fetch a session by id and upsert it into the list', async () => {
      const session = makeSession({ id: 'session_5' })
      jest.spyOn(SessionService, 'getById').mockResolvedValueOnce(session)

      await act(async () => {
        await useSessionsStore.getState().fetchSessionById('session_5')
      })

      const state = useSessionsStore.getState()
      expect(state.currentSession).toEqual(session)
      expect(state.activeSessionId).toBe('session_5')
      expect(state.sessions).toContainEqual(session)
      expect(state.loading).toBe(false)
    })

    it('should update an existing session in place when fetched again', async () => {
      const existing = makeSession({ id: 'session_5', status: 'active' })
      act(() => {
        useSessionsStore.setState({ sessions: [existing], total: 1 })
      })

      const updated = { ...existing, status: 'ended' }
      jest.spyOn(SessionService, 'getById').mockResolvedValueOnce(updated)

      await act(async () => {
        await useSessionsStore.getState().fetchSessionById('session_5')
      })

      const state = useSessionsStore.getState()
      expect(state.sessions).toHaveLength(1)
      expect(state.sessions[0].status).toBe('ended')
    })

    it('should set error when fetch fails', async () => {
      jest.spyOn(SessionService, 'getById').mockRejectedValueOnce(new Error('Not found'))

      await act(async () => {
        await useSessionsStore.getState().fetchSessionById('bad_id')
      })

      expect(useSessionsStore.getState().error).toBe('Not found')
    })

    it('should fallback error for non-Error throw', async () => {
      jest.spyOn(SessionService, 'getById').mockRejectedValueOnce(0)

      await act(async () => {
        await useSessionsStore.getState().fetchSessionById('bad_id')
      })

      expect(useSessionsStore.getState().error).toBe('Failed to load session')
    })
  })

  describe('createSession', () => {
    it('should create a session and set it as current and active', async () => {
      const session = makeSession({ id: 'session_new' })
      jest.spyOn(SessionService, 'create').mockResolvedValueOnce(session)

      let result: Session | undefined
      await act(async () => {
        result = await useSessionsStore.getState().createSession({
          orgId: 'org_1',
          type: 'text',
        })
      })

      const state = useSessionsStore.getState()
      expect(result).toEqual(session)
      expect(state.currentSession).toEqual(session)
      expect(state.activeSessionId).toBe('session_new')
      expect(state.sessions).toContainEqual(session)
      expect(state.loading).toBe(false)
    })

    it('should throw and set error when creation fails', async () => {
      jest.spyOn(SessionService, 'create').mockRejectedValueOnce(new Error('Create failed'))

      await expect(
        act(async () => {
          await useSessionsStore.getState().createSession({ orgId: 'org_1', type: 'text' })
        })
      ).rejects.toThrow('Create failed')

      expect(useSessionsStore.getState().error).toBe('Create failed')
    })

    it('should use fallback error for non-Error throw', async () => {
      jest.spyOn(SessionService, 'create').mockRejectedValueOnce('bad')

      await expect(
        act(async () => {
          await useSessionsStore.getState().createSession({ orgId: 'org_1', type: 'text' })
        })
      ).rejects.toBe('bad')

      expect(useSessionsStore.getState().error).toBe('Failed to create session')
    })
  })

  describe('updateSession', () => {
    it('should update a session and refresh state', async () => {
      const session = makeSession({ id: 'session_1', status: 'ended' })
      jest.spyOn(SessionService, 'update').mockResolvedValueOnce(session)

      await act(async () => {
        await useSessionsStore.getState().updateSession('session_1', { status: 'ended' })
      })

      const state = useSessionsStore.getState()
      expect(state.currentSession?.status).toBe('ended')
      expect(state.loading).toBe(false)
    })

    it('should throw and set error when update fails', async () => {
      jest.spyOn(SessionService, 'update').mockRejectedValueOnce(new Error('Update failed'))

      await expect(
        act(async () => {
          await useSessionsStore.getState().updateSession('session_1', {})
        })
      ).rejects.toThrow('Update failed')

      expect(useSessionsStore.getState().error).toBe('Update failed')
    })

    it('should fallback error for non-Error throw', async () => {
      jest.spyOn(SessionService, 'update').mockRejectedValueOnce(undefined)

      await expect(
        act(async () => {
          await useSessionsStore.getState().updateSession('session_1', {})
        })
      ).rejects.toBeUndefined()

      expect(useSessionsStore.getState().error).toBe('Failed to update session')
    })
  })

  describe('endSession', () => {
    it('should end a session and update it in state', async () => {
      const session = makeSession({ id: 'session_1', status: 'ended' })
      jest.spyOn(SessionService, 'end').mockResolvedValueOnce(session)

      await act(async () => {
        await useSessionsStore.getState().endSession('session_1', { reason: 'done' })
      })

      const state = useSessionsStore.getState()
      expect(state.currentSession?.status).toBe('ended')
      expect(state.loading).toBe(false)
    })

    it('should throw and set error when end fails', async () => {
      jest.spyOn(SessionService, 'end').mockRejectedValueOnce(new Error('End failed'))

      await expect(
        act(async () => {
          await useSessionsStore.getState().endSession('session_1')
        })
      ).rejects.toThrow('End failed')

      expect(useSessionsStore.getState().error).toBe('End failed')
    })

    it('should fallback error for non-Error throw', async () => {
      jest.spyOn(SessionService, 'end').mockRejectedValueOnce(false)

      await expect(
        act(async () => {
          await useSessionsStore.getState().endSession('session_1')
        })
      ).rejects.toBe(false)

      expect(useSessionsStore.getState().error).toBe('Failed to end session')
    })
  })

  describe('deleteSession', () => {
    it('should delete a session and remove it from the list', async () => {
      const sessions = [makeSession({ id: 'session_1' }), makeSession({ id: 'session_2' })]
      act(() => {
        useSessionsStore.setState({ sessions, total: 2, activeSessionId: 'session_1' })
      })

      jest
        .spyOn(SessionService, 'delete')
        .mockResolvedValueOnce({ message: 'Deleted', id: 'session_1' })

      await act(async () => {
        await useSessionsStore.getState().deleteSession('session_1')
      })

      const state = useSessionsStore.getState()
      expect(state.sessions).not.toContainEqual(expect.objectContaining({ id: 'session_1' }))
      expect(state.sessions).toHaveLength(1)
      expect(state.total).toBe(1)
      expect(state.loading).toBe(false)
    })

    it('should resolve currentSession to the first remaining session after delete', async () => {
      const sessions = [makeSession({ id: 'session_1' }), makeSession({ id: 'session_2' })]
      act(() => {
        useSessionsStore.setState({ sessions, total: 2, activeSessionId: 'session_1' })
      })

      jest
        .spyOn(SessionService, 'delete')
        .mockResolvedValueOnce({ message: 'Deleted', id: 'session_1' })

      await act(async () => {
        await useSessionsStore.getState().deleteSession('session_1')
      })

      expect(useSessionsStore.getState().currentSession?.id).toBe('session_2')
    })

    it('should throw and set error when delete fails', async () => {
      jest.spyOn(SessionService, 'delete').mockRejectedValueOnce(new Error('Delete failed'))

      await expect(
        act(async () => {
          await useSessionsStore.getState().deleteSession('session_1')
        })
      ).rejects.toThrow('Delete failed')

      expect(useSessionsStore.getState().error).toBe('Delete failed')
    })

    it('should fallback error for non-Error throw', async () => {
      jest.spyOn(SessionService, 'delete').mockRejectedValueOnce(null)

      await expect(
        act(async () => {
          await useSessionsStore.getState().deleteSession('session_1')
        })
      ).rejects.toBeNull()

      expect(useSessionsStore.getState().error).toBe('Failed to delete session')
    })
  })
})
