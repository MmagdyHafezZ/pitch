import { renderHook, act } from '@testing-library/react'
import { useSessions } from '../useSessions'
import { useInvitations } from '../useInvitations'
import { useSessionsStore } from '../../stores/sessions.store'
import { useInvitationsStore } from '../../stores/invitations.store'

beforeEach(() => {
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
  act(() => {
    useInvitationsStore.setState({
      invitations: [],
      currentInvitation: null,
      pendingCount: 0,
      lastCreateResult: null,
      loading: false,
      error: null,
    })
  })
})

describe('useSessions', () => {
  it('returns initial state', () => {
    const { result } = renderHook(() => useSessions())

    expect(result.current.sessions).toEqual([])
    expect(result.current.activeSessionId).toBeNull()
    expect(result.current.currentSession).toBeNull()
    expect(result.current.total).toBe(0)
    expect(result.current.limit).toBe(10)
    expect(result.current.offset).toBe(0)
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('exposes all store methods', () => {
    const { result } = renderHook(() => useSessions())

    expect(typeof result.current.fetchSessions).toBe('function')
    expect(typeof result.current.fetchSessionById).toBe('function')
    expect(typeof result.current.fetchUserSessions).toBe('function')
    expect(typeof result.current.fetchOrgSessions).toBe('function')
    expect(typeof result.current.createSession).toBe('function')
    expect(typeof result.current.updateSession).toBe('function')
    expect(typeof result.current.endSession).toBe('function')
    expect(typeof result.current.deleteSession).toBe('function')
    expect(typeof result.current.setActiveSessionId).toBe('function')
  })

  it('reflects store state changes', () => {
    const { result } = renderHook(() => useSessions())

    act(() => {
      useSessionsStore.setState({
        sessions: [{ id: 's1', status: 'active' } as any],
        activeSessionId: 's1',
        currentSession: { id: 's1', status: 'active' } as any,
        total: 1,
        loading: false,
        error: null,
      })
    })

    expect(result.current.sessions).toHaveLength(1)
    expect(result.current.activeSessionId).toBe('s1')
    expect(result.current.currentSession?.id).toBe('s1')
    expect(result.current.total).toBe(1)
  })

  it('reflects loading state', () => {
    const { result } = renderHook(() => useSessions())

    act(() => {
      useSessionsStore.setState({ loading: true })
    })

    expect(result.current.loading).toBe(true)
  })

  it('reflects error state', () => {
    const { result } = renderHook(() => useSessions())

    act(() => {
      useSessionsStore.setState({ error: 'Something went wrong' })
    })

    expect(result.current.error).toBe('Something went wrong')
  })
})

describe('useInvitations', () => {
  it('returns initial state', () => {
    const { result } = renderHook(() => useInvitations())

    expect(result.current.invitations).toEqual([])
    expect(result.current.currentInvitation).toBeNull()
    expect(result.current.pendingCount).toBe(0)
    expect(result.current.lastCreateResult).toBeNull()
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('exposes all store methods', () => {
    const { result } = renderHook(() => useInvitations())

    expect(typeof result.current.createInvitations).toBe('function')
    expect(typeof result.current.fetchSessionInvitations).toBe('function')
    expect(typeof result.current.fetchMyInvitations).toBe('function')
    expect(typeof result.current.fetchSentInvitations).toBe('function')
    expect(typeof result.current.fetchInvitationById).toBe('function')
    expect(typeof result.current.acceptInvitation).toBe('function')
    expect(typeof result.current.declineInvitation).toBe('function')
    expect(typeof result.current.revokeInvitation).toBe('function')
    expect(typeof result.current.fetchPendingCount).toBe('function')
  })

  it('reflects store state changes', () => {
    const { result } = renderHook(() => useInvitations())

    act(() => {
      useInvitationsStore.setState({
        invitations: [{ id: 'i1', status: 'pending' } as any],
        currentInvitation: { id: 'i1', status: 'pending' } as any,
        pendingCount: 3,
        loading: false,
      })
    })

    expect(result.current.invitations).toHaveLength(1)
    expect(result.current.currentInvitation?.id).toBe('i1')
    expect(result.current.pendingCount).toBe(3)
  })

  it('reflects loading state', () => {
    const { result } = renderHook(() => useInvitations())

    act(() => {
      useInvitationsStore.setState({ loading: true })
    })

    expect(result.current.loading).toBe(true)
  })

  it('reflects error state', () => {
    const { result } = renderHook(() => useInvitations())

    act(() => {
      useInvitationsStore.setState({ error: 'Invitation error' })
    })

    expect(result.current.error).toBe('Invitation error')
  })
})
