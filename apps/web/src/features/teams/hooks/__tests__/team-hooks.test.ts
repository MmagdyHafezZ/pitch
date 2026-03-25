import { renderHook, act } from '@testing-library/react'
import { useTeams } from '../useTeams'
import { useCreateTeamForm } from '../useTeamForm'
import { useTeamsStore } from '../../stores/teams.store'

beforeEach(() => {
  act(() => {
    useTeamsStore.getState().resetStore()
  })
})

describe('useTeams', () => {
  it('returns initial empty state', () => {
    const { result } = renderHook(() => useTeams())

    expect(result.current.teams).toEqual([])
    expect(result.current.activeTeamId).toBeNull()
    expect(result.current.currentTeam).toBeNull()
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('exposes all store methods', () => {
    const { result } = renderHook(() => useTeams())

    expect(typeof result.current.fetchTeams).toBe('function')
    expect(typeof result.current.fetchTeamById).toBe('function')
    expect(typeof result.current.fetchUserTeams).toBe('function')
    expect(typeof result.current.createTeam).toBe('function')
    expect(typeof result.current.updateTeam).toBe('function')
    expect(typeof result.current.deleteTeam).toBe('function')
    expect(typeof result.current.addMember).toBe('function')
    expect(typeof result.current.inviteMember).toBe('function')
    expect(typeof result.current.sendSignupInvite).toBe('function')
    expect(typeof result.current.acceptInvite).toBe('function')
    expect(typeof result.current.updateMember).toBe('function')
    expect(typeof result.current.deleteMember).toBe('function')
    expect(typeof result.current.leaveTeam).toBe('function')
    expect(typeof result.current.setActiveTeamId).toBe('function')
  })

  it('reflects store state changes', () => {
    const { result } = renderHook(() => useTeams())

    act(() => {
      useTeamsStore.setState({
        teams: [{ id: 't1', name: 'Team 1' } as any],
        activeTeamId: 't1',
        currentTeam: { id: 't1', name: 'Team 1' } as any,
        loading: false,
        error: null,
      })
    })

    expect(result.current.teams).toHaveLength(1)
    expect(result.current.activeTeamId).toBe('t1')
    expect(result.current.currentTeam?.id).toBe('t1')
  })
})

describe('useCreateTeamForm', () => {
  it('returns initial empty values', () => {
    const { result } = renderHook(() => useCreateTeamForm())

    expect(result.current.values.name).toBe('')
    expect(result.current.values.slug).toBe('')
    expect(result.current.values.billingEmail).toBe('')
    expect(result.current.errors).toEqual({})
    expect(result.current.submitting).toBe(false)
    expect(result.current.apiError).toBeNull()
  })

  it('setField updates a field value and clears its error', () => {
    const { result } = renderHook(() => useCreateTeamForm())

    act(() => {
      result.current.setField('name', 'My Team')
    })

    expect(result.current.values.name).toBe('My Team')
    expect(result.current.errors.name).toBeUndefined()
  })

  it('submit validates short name', async () => {
    const { result } = renderHook(() => useCreateTeamForm())

    act(() => {
      result.current.setField('name', 'A')
    })

    let success = false
    await act(async () => {
      success = await result.current.submit()
    })

    expect(success).toBe(false)
    expect(result.current.errors.name).toBe('Team name must be between 2 and 64 characters')
  })

  it('submit validates long name', async () => {
    const { result } = renderHook(() => useCreateTeamForm())

    act(() => {
      result.current.setField('name', 'A'.repeat(65))
    })

    let success = false
    await act(async () => {
      success = await result.current.submit()
    })

    expect(success).toBe(false)
    expect(result.current.errors.name).toBeDefined()
  })

  it('submit validates slug format', async () => {
    const { result } = renderHook(() => useCreateTeamForm())

    act(() => {
      result.current.setField('name', 'Valid Name')
      result.current.setField('slug', 'INVALID SLUG')
    })

    let success = false
    await act(async () => {
      success = await result.current.submit()
    })

    expect(success).toBe(false)
    expect(result.current.errors.slug).toBe(
      'Slug must be lowercase letters/numbers with "-" separators'
    )
  })

  it('submit validates billing email format', async () => {
    const { result } = renderHook(() => useCreateTeamForm())

    act(() => {
      result.current.setField('name', 'Valid Name')
      result.current.setField('billingEmail', 'not-an-email')
    })

    let success = false
    await act(async () => {
      success = await result.current.submit()
    })

    expect(success).toBe(false)
    expect(result.current.errors.billingEmail).toBe('Invalid email address')
  })

  it('submit validates address fields when any address field is provided', async () => {
    const { result } = renderHook(() => useCreateTeamForm())

    act(() => {
      result.current.setField('name', 'Valid Name')
      result.current.setField('street', '123 Main St')
    })

    let success = false
    await act(async () => {
      success = await result.current.submit()
    })

    expect(success).toBe(false)
    expect(result.current.errors.city).toBeDefined()
    expect(result.current.errors.stateProvince).toBeDefined()
    expect(result.current.errors.postalCode).toBeDefined()
    expect(result.current.errors.country).toBeDefined()
  })

  it('submit does not validate address when no address fields provided', async () => {
    const { result } = renderHook(() => useCreateTeamForm())

    const mockCreateTeam = jest.fn().mockResolvedValue(undefined)
    act(() => {
      useTeamsStore.setState({ createTeam: mockCreateTeam } as any)
    })

    act(() => {
      result.current.setField('name', 'Valid Name')
    })

    let success = false
    await act(async () => {
      success = await result.current.submit()
    })

    expect(success).toBe(true)
    expect(result.current.errors.city).toBeUndefined()
  })

  it('submit passes with valid name only', async () => {
    const mockCreateTeam = jest.fn().mockResolvedValue(undefined)
    act(() => {
      useTeamsStore.setState({ createTeam: mockCreateTeam } as any)
    })

    const { result } = renderHook(() => useCreateTeamForm())

    act(() => {
      result.current.setField('name', 'Good Team')
    })

    let success = false
    await act(async () => {
      success = await result.current.submit()
    })

    expect(success).toBe(true)
    expect(mockCreateTeam).toHaveBeenCalledWith(expect.objectContaining({ name: 'Good Team' }))
  })

  it('submit builds proper payload with address', async () => {
    const mockCreateTeam = jest.fn().mockResolvedValue(undefined)
    act(() => {
      useTeamsStore.setState({ createTeam: mockCreateTeam } as any)
    })

    const { result } = renderHook(() => useCreateTeamForm())

    act(() => {
      result.current.setField('name', 'With Address')
      result.current.setField('billingEmail', 'billing@test.com')
      result.current.setField('street', '123 Main')
      result.current.setField('city', 'Springfield')
      result.current.setField('stateProvince', 'IL')
      result.current.setField('postalCode', '62704')
      result.current.setField('country', 'US')
    })

    let success = false
    await act(async () => {
      success = await result.current.submit()
    })

    expect(success).toBe(true)
    expect(mockCreateTeam).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'With Address',
        billingEmail: 'billing@test.com',
        billingAddress: expect.objectContaining({
          street: '123 Main',
          city: 'Springfield',
        }),
      })
    )
  })

  it('submit handles API error', async () => {
    const mockCreateTeam = jest.fn().mockRejectedValue(new Error('API down'))
    act(() => {
      useTeamsStore.setState({ createTeam: mockCreateTeam } as any)
    })

    const { result } = renderHook(() => useCreateTeamForm())

    act(() => {
      result.current.setField('name', 'Valid Name')
    })

    let success = false
    await act(async () => {
      success = await result.current.submit()
    })

    expect(success).toBe(false)
    expect(result.current.apiError).toBe('API down')
  })

  it('submit handles non-Error API failure', async () => {
    const mockCreateTeam = jest.fn().mockRejectedValue('string-error')
    act(() => {
      useTeamsStore.setState({ createTeam: mockCreateTeam } as any)
    })

    const { result } = renderHook(() => useCreateTeamForm())

    act(() => {
      result.current.setField('name', 'Valid Name')
    })

    let success = false
    await act(async () => {
      success = await result.current.submit()
    })

    expect(success).toBe(false)
    expect(result.current.apiError).toBe('Failed to create team')
  })

  it('accepts valid slug', async () => {
    const mockCreateTeam = jest.fn().mockResolvedValue(undefined)
    act(() => {
      useTeamsStore.setState({ createTeam: mockCreateTeam } as any)
    })

    const { result } = renderHook(() => useCreateTeamForm())

    act(() => {
      result.current.setField('name', 'Valid Name')
      result.current.setField('slug', 'valid-slug-123')
    })

    let success = false
    await act(async () => {
      success = await result.current.submit()
    })

    expect(success).toBe(true)
  })
})
