import { act } from '@testing-library/react'
import { useTeamsStore } from '../teams.store'
import { TeamService } from '../../services/teams.service'

describe('TeamsStore', () => {
  beforeEach(() => {
    jest.restoreAllMocks()
    act(() => {
      useTeamsStore.getState().resetStore()
    })
  })

  it('fetchUserTeams refreshes and replaces stale cached teams', async () => {
    const staleTeam = {
      id: 'stale-team',
      name: 'Admin Team (stale)',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    } as any
    const memberTeam = {
      id: 'member-team',
      name: 'Member Team',
      createdAt: '2024-02-01T00:00:00.000Z',
      updatedAt: '2024-02-01T00:00:00.000Z',
    } as any

    let resolveRequest!: (value: any[]) => void
    const getUserTeamsSpy = jest.spyOn(TeamService, 'getUserTeams').mockImplementation(
      () =>
        new Promise<any[]>((resolve) => {
          resolveRequest = resolve
        })
    )

    act(() => {
      useTeamsStore.setState({
        teams: [staleTeam],
        activeTeamId: staleTeam.id,
        currentTeam: staleTeam,
        loading: false,
        error: null,
      })
    })

    const fetchPromise = act(async () => {
      await useTeamsStore.getState().fetchUserTeams()
    })

    // Store should clear stale data immediately while loading fresh user teams.
    expect(useTeamsStore.getState().loading).toBe(true)
    expect(useTeamsStore.getState().teams).toEqual([])
    expect(useTeamsStore.getState().activeTeamId).toBeNull()
    expect(useTeamsStore.getState().currentTeam).toBeNull()

    resolveRequest([memberTeam])
    await fetchPromise

    expect(getUserTeamsSpy).toHaveBeenCalledTimes(1)
    expect(useTeamsStore.getState().loading).toBe(false)
    expect(useTeamsStore.getState().teams).toEqual([memberTeam])
    expect(useTeamsStore.getState().activeTeamId).toBe('member-team')
    expect(useTeamsStore.getState().currentTeam).toEqual(memberTeam)
  })

  it('resetStore clears teams and active team state', () => {
    act(() => {
      useTeamsStore.setState({
        teams: [{ id: 'team-1', name: 'Team 1' } as any],
        activeTeamId: 'team-1',
        currentTeam: { id: 'team-1', name: 'Team 1' } as any,
        loading: true,
        error: 'some error',
      })
    })

    act(() => {
      useTeamsStore.getState().resetStore()
    })

    const state = useTeamsStore.getState()
    expect(state.teams).toEqual([])
    expect(state.activeTeamId).toBeNull()
    expect(state.currentTeam).toBeNull()
    expect(state.loading).toBe(false)
    expect(state.error).toBeNull()
  })

  it('preserves active team selection when refreshing user teams and the team still exists', async () => {
    const team1 = {
      id: 'team-1',
      name: 'Team 1',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    } as any
    const team2 = {
      id: 'team-2',
      name: 'Team 2',
      createdAt: '2024-02-01T00:00:00.000Z',
      updatedAt: '2024-02-01T00:00:00.000Z',
    } as any

    jest.spyOn(TeamService, 'getUserTeams').mockResolvedValue([team1, team2])

    act(() => {
      useTeamsStore.setState({
        teams: [team1, team2],
        activeTeamId: 'team-2',
        currentTeam: team2,
        loading: false,
        error: null,
      })
    })

    await act(async () => {
      await useTeamsStore.getState().fetchUserTeams()
    })

    expect(useTeamsStore.getState().teams).toEqual([team1, team2])
    expect(useTeamsStore.getState().activeTeamId).toBe('team-2')
    expect(useTeamsStore.getState().currentTeam).toEqual(team2)
  })

  it('sendSignupInvite clears loading on success', async () => {
    jest.spyOn(TeamService, 'sendSignupInvite').mockResolvedValue({
      message: 'Signup invite sent to new@example.com',
    })

    await act(async () => {
      await useTeamsStore.getState().sendSignupInvite('team-1', { email: 'new@example.com' })
    })

    expect(TeamService.sendSignupInvite).toHaveBeenCalledWith('team-1', {
      email: 'new@example.com',
    })
    expect(useTeamsStore.getState().loading).toBe(false)
    expect(useTeamsStore.getState().error).toBeNull()
  })

  it('sendSignupInvite stores error and rethrows on failure', async () => {
    jest
      .spyOn(TeamService, 'sendSignupInvite')
      .mockRejectedValue(new Error('Failed to send signup invitation'))

    await expect(
      act(async () => {
        await useTeamsStore.getState().sendSignupInvite('team-1', { email: 'new@example.com' })
      })
    ).rejects.toThrow('Failed to send signup invitation')

    expect(useTeamsStore.getState().loading).toBe(false)
    expect(useTeamsStore.getState().error).toBe('Failed to send signup invitation')
  })

  it('inviteMember refreshes team details after creating pending invitation', async () => {
    const refreshedTeam = {
      id: 'team-1',
      name: 'Team 1',
      memberships: [
        {
          id: 'm-1',
          userId: 'u-2',
          teamId: 'team-1',
          role: 'MEMBER',
          tokenLimit: 0,
          isActive: false,
          acceptedAt: null,
        },
      ],
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    } as any

    jest.spyOn(TeamService, 'inviteMember').mockResolvedValue({
      id: 'm-1',
      userId: 'u-2',
      teamId: 'team-1',
      role: 'MEMBER',
      tokenLimit: 0,
      isActive: false,
      acceptedAt: null,
    } as any)
    jest.spyOn(TeamService, 'getById').mockResolvedValue(refreshedTeam)

    act(() => {
      useTeamsStore.setState({
        teams: [{ id: 'team-1', name: 'Team 1' } as any],
        activeTeamId: 'team-1',
        currentTeam: { id: 'team-1', name: 'Team 1' } as any,
        loading: false,
        error: null,
      })
    })

    await act(async () => {
      await useTeamsStore.getState().inviteMember('team-1', { userId: 'u-2', role: 'MEMBER' })
    })

    expect(TeamService.inviteMember).toHaveBeenCalledWith('team-1', {
      userId: 'u-2',
      role: 'MEMBER',
    })
    expect(TeamService.getById).toHaveBeenCalledWith('team-1')
    expect(useTeamsStore.getState().currentTeam).toEqual(refreshedTeam)
  })

  it('createTeam stores error and rethrows on failure', async () => {
    jest.spyOn(TeamService, 'create').mockRejectedValue(new Error('Failed to create team'))

    await expect(
      act(async () => {
        await useTeamsStore.getState().createTeam({
          name: 'Revenue Ops',
          isActive: true,
        })
      })
    ).rejects.toThrow('Failed to create team')

    expect(useTeamsStore.getState().loading).toBe(false)
    expect(useTeamsStore.getState().error).toBe('Failed to create team')
  })

  it('createTeam rejects blank names without calling the API', async () => {
    const createSpy = jest.spyOn(TeamService, 'create')

    await expect(
      act(async () => {
        await useTeamsStore.getState().createTeam({
          name: '   ',
          isActive: true,
        })
      })
    ).rejects.toThrow('Team name is required')

    expect(createSpy).not.toHaveBeenCalled()
    expect(useTeamsStore.getState().error).toBe('Team name is required')
  })

  it('createTeam adds new team on success', async () => {
    const newTeam = { id: 'new-team', name: 'Revenue Ops' } as any
    jest.spyOn(TeamService, 'create').mockResolvedValue(newTeam)

    await act(async () => {
      await useTeamsStore.getState().createTeam({ name: 'Revenue Ops', isActive: true })
    })

    const state = useTeamsStore.getState()
    expect(state.teams).toContainEqual(newTeam)
    expect(state.currentTeam).toEqual(newTeam)
    expect(state.activeTeamId).toBe('new-team')
    expect(state.loading).toBe(false)
  })

  it('createTeam does not duplicate existing team id', async () => {
    const team = { id: 'existing', name: 'Existing' } as any
    jest.spyOn(TeamService, 'create').mockResolvedValue(team)

    act(() => {
      useTeamsStore.setState({ teams: [team] })
    })

    await act(async () => {
      await useTeamsStore.getState().createTeam({ name: 'Existing', isActive: true })
    })

    expect(useTeamsStore.getState().teams.filter((t) => t.id === 'existing')).toHaveLength(1)
  })

  it('setActiveTeamId updates the active team', () => {
    act(() => {
      useTeamsStore.getState().setActiveTeamId('team-99')
    })
    expect(useTeamsStore.getState().activeTeamId).toBe('team-99')
  })

  it('fetchTeams skips when already loading', async () => {
    const spy = jest.spyOn(TeamService, 'getAll')

    act(() => {
      useTeamsStore.setState({ loading: true })
    })

    await act(async () => {
      await useTeamsStore.getState().fetchTeams()
    })

    expect(spy).not.toHaveBeenCalled()
  })

  it('fetchTeams skips when teams already loaded', async () => {
    const spy = jest.spyOn(TeamService, 'getAll')

    act(() => {
      useTeamsStore.setState({ teams: [{ id: 't1', name: 'Team' } as any] })
    })

    await act(async () => {
      await useTeamsStore.getState().fetchTeams()
    })

    expect(spy).not.toHaveBeenCalled()
  })

  it('fetchTeams loads teams and sets first as active', async () => {
    const teams = [
      { id: 't1', name: 'Team 1' },
      { id: 't2', name: 'Team 2' },
    ] as any[]
    jest.spyOn(TeamService, 'getAll').mockResolvedValue(teams)

    await act(async () => {
      await useTeamsStore.getState().fetchTeams()
    })

    const state = useTeamsStore.getState()
    expect(state.teams).toEqual(teams)
    expect(state.activeTeamId).toBe('t1')
    expect(state.currentTeam).toEqual(teams[0])
  })

  it('fetchTeams stores error on failure', async () => {
    jest.spyOn(TeamService, 'getAll').mockRejectedValue(new Error('Network error'))

    await act(async () => {
      await useTeamsStore.getState().fetchTeams()
    })

    expect(useTeamsStore.getState().error).toBe('Network error')
    expect(useTeamsStore.getState().loading).toBe(false)
  })

  it('fetchTeamById updates team in list', async () => {
    const original = { id: 't1', name: 'Original' } as any
    const updated = { id: 't1', name: 'Updated' } as any
    jest.spyOn(TeamService, 'getById').mockResolvedValue(updated)

    act(() => {
      useTeamsStore.setState({ teams: [original] })
    })

    await act(async () => {
      await useTeamsStore.getState().fetchTeamById('t1')
    })

    expect(useTeamsStore.getState().teams[0].name).toBe('Updated')
    expect(useTeamsStore.getState().currentTeam).toEqual(updated)
    expect(useTeamsStore.getState().activeTeamId).toBe('t1')
  })

  it('fetchTeamById adds team when not in list', async () => {
    const team = { id: 't2', name: 'New' } as any
    jest.spyOn(TeamService, 'getById').mockResolvedValue(team)

    await act(async () => {
      await useTeamsStore.getState().fetchTeamById('t2')
    })

    expect(useTeamsStore.getState().teams).toContainEqual(team)
  })

  it('fetchTeamById stores error on failure', async () => {
    jest.spyOn(TeamService, 'getById').mockRejectedValue(new Error('Not found'))

    await act(async () => {
      await useTeamsStore.getState().fetchTeamById('bad')
    })

    expect(useTeamsStore.getState().error).toBe('Not found')
  })

  it('updateTeam updates team in list', async () => {
    const updated = { id: 't1', name: 'Renamed' } as any
    jest.spyOn(TeamService, 'update').mockResolvedValue(updated)

    act(() => {
      useTeamsStore.setState({
        teams: [{ id: 't1', name: 'Original' } as any],
        activeTeamId: 't1',
        currentTeam: { id: 't1', name: 'Original' } as any,
      })
    })

    await act(async () => {
      await useTeamsStore.getState().updateTeam('t1', { name: 'Renamed' })
    })

    expect(useTeamsStore.getState().currentTeam?.name).toBe('Renamed')
    expect(useTeamsStore.getState().teams[0].name).toBe('Renamed')
  })

  it('updateTeam stores error on failure', async () => {
    jest.spyOn(TeamService, 'update').mockRejectedValue(new Error('Update failed'))

    await expect(
      act(async () => {
        await useTeamsStore.getState().updateTeam('t1', { name: 'x' })
      })
    ).rejects.toThrow('Update failed')

    expect(useTeamsStore.getState().error).toBe('Update failed')
  })

  it('deleteTeam removes team and selects next', async () => {
    const t1 = { id: 't1', name: 'Team 1' } as any
    const t2 = { id: 't2', name: 'Team 2' } as any
    jest.spyOn(TeamService, 'delete').mockResolvedValue(undefined)

    act(() => {
      useTeamsStore.setState({
        teams: [t1, t2],
        activeTeamId: 't1',
        currentTeam: t1,
      })
    })

    await act(async () => {
      await useTeamsStore.getState().deleteTeam('t1')
    })

    expect(useTeamsStore.getState().teams).toEqual([t2])
    expect(useTeamsStore.getState().activeTeamId).toBe('t2')
    expect(useTeamsStore.getState().currentTeam).toEqual(t2)
  })

  it('deleteTeam stores error on failure', async () => {
    jest.spyOn(TeamService, 'delete').mockRejectedValue(new Error('Delete failed'))

    await expect(
      act(async () => {
        await useTeamsStore.getState().deleteTeam('t1')
      })
    ).rejects.toThrow('Delete failed')

    expect(useTeamsStore.getState().error).toBe('Delete failed')
  })

  it('addMember refreshes team after adding', async () => {
    const refreshedTeam = { id: 't1', name: 'Team', members: [{ userId: 'u1' }] } as any
    jest.spyOn(TeamService, 'addMember').mockResolvedValue({} as any)
    jest.spyOn(TeamService, 'getById').mockResolvedValue(refreshedTeam)

    act(() => {
      useTeamsStore.setState({
        teams: [{ id: 't1', name: 'Team' } as any],
        activeTeamId: 't1',
        currentTeam: { id: 't1', name: 'Team' } as any,
      })
    })

    await act(async () => {
      await useTeamsStore.getState().addMember('t1', { userId: 'u1', role: 'MEMBER' })
    })

    expect(useTeamsStore.getState().currentTeam).toEqual(refreshedTeam)
  })

  it('addMember stores error on failure', async () => {
    jest.spyOn(TeamService, 'addMember').mockRejectedValue(new Error('Add failed'))

    await expect(
      act(async () => {
        await useTeamsStore.getState().addMember('t1', { userId: 'u1', role: 'MEMBER' })
      })
    ).rejects.toThrow('Add failed')

    expect(useTeamsStore.getState().error).toBe('Add failed')
  })

  it('acceptInvite refreshes team after accepting', async () => {
    const refreshedTeam = { id: 't1', name: 'Team' } as any
    jest.spyOn(TeamService, 'acceptInvite').mockResolvedValue({} as any)
    jest.spyOn(TeamService, 'getById').mockResolvedValue(refreshedTeam)

    await act(async () => {
      await useTeamsStore.getState().acceptInvite('t1')
    })

    expect(useTeamsStore.getState().teams).toContainEqual(refreshedTeam)
  })

  it('acceptInvite stores error on failure', async () => {
    jest.spyOn(TeamService, 'acceptInvite').mockRejectedValue(new Error('Accept failed'))

    await expect(
      act(async () => {
        await useTeamsStore.getState().acceptInvite('t1')
      })
    ).rejects.toThrow('Accept failed')

    expect(useTeamsStore.getState().error).toBe('Accept failed')
  })

  it('updateMember refreshes team after updating', async () => {
    const refreshedTeam = { id: 't1', name: 'Team' } as any
    jest.spyOn(TeamService, 'updateMember').mockResolvedValue({} as any)
    jest.spyOn(TeamService, 'getById').mockResolvedValue(refreshedTeam)

    act(() => {
      useTeamsStore.setState({
        teams: [{ id: 't1', name: 'Team' } as any],
        currentTeam: { id: 't1', name: 'Team' } as any,
      })
    })

    await act(async () => {
      await useTeamsStore.getState().updateMember('t1', 'u1', { role: 'ADMIN' })
    })

    expect(useTeamsStore.getState().currentTeam).toEqual(refreshedTeam)
  })

  it('updateMember stores error on failure', async () => {
    jest.spyOn(TeamService, 'updateMember').mockRejectedValue(new Error('Update member failed'))

    await expect(
      act(async () => {
        await useTeamsStore.getState().updateMember('t1', 'u1', { role: 'ADMIN' })
      })
    ).rejects.toThrow('Update member failed')
  })

  it('deleteMember refreshes team after removing', async () => {
    const refreshedTeam = { id: 't1', name: 'Team', members: [] } as any
    jest.spyOn(TeamService, 'removeMember').mockResolvedValue(undefined)
    jest.spyOn(TeamService, 'getById').mockResolvedValue(refreshedTeam)

    act(() => {
      useTeamsStore.setState({
        teams: [{ id: 't1', name: 'Team' } as any],
        currentTeam: { id: 't1', name: 'Team' } as any,
      })
    })

    await act(async () => {
      await useTeamsStore.getState().deleteMember('t1', 'u1')
    })

    expect(useTeamsStore.getState().currentTeam).toEqual(refreshedTeam)
  })

  it('deleteMember stores error on failure', async () => {
    jest.spyOn(TeamService, 'removeMember').mockRejectedValue(new Error('Remove failed'))

    await expect(
      act(async () => {
        await useTeamsStore.getState().deleteMember('t1', 'u1')
      })
    ).rejects.toThrow('Remove failed')
  })

  it('leaveTeam removes team from list and picks next active', async () => {
    const t1 = { id: 't1', name: 'Team 1' } as any
    const t2 = { id: 't2', name: 'Team 2' } as any
    jest.spyOn(TeamService, 'removeMember').mockResolvedValue(undefined)

    act(() => {
      useTeamsStore.setState({
        teams: [t1, t2],
        activeTeamId: 't1',
        currentTeam: t1,
      })
    })

    await act(async () => {
      await useTeamsStore.getState().leaveTeam('t1', 'u1')
    })

    expect(useTeamsStore.getState().teams).toEqual([t2])
    expect(useTeamsStore.getState().activeTeamId).toBe('t2')
  })

  it('leaveTeam stores error on failure', async () => {
    jest.spyOn(TeamService, 'removeMember').mockRejectedValue(new Error('Leave failed'))

    await expect(
      act(async () => {
        await useTeamsStore.getState().leaveTeam('t1', 'u1')
      })
    ).rejects.toThrow('Leave failed')

    expect(useTeamsStore.getState().error).toBe('Leave failed')
  })

  it('fetchUserTeams handles error', async () => {
    jest.spyOn(TeamService, 'getUserTeams').mockRejectedValue(new Error('Fetch failed'))

    await act(async () => {
      await useTeamsStore.getState().fetchUserTeams()
    })

    expect(useTeamsStore.getState().error).toBe('Fetch failed')
    expect(useTeamsStore.getState().loading).toBe(false)
  })

  it('fetchUserTeams skips when loading', async () => {
    const spy = jest.spyOn(TeamService, 'getUserTeams')

    act(() => {
      useTeamsStore.setState({ loading: true })
    })

    await act(async () => {
      await useTeamsStore.getState().fetchUserTeams()
    })

    expect(spy).not.toHaveBeenCalled()
  })

  it('fetchTeams handles non-Error failure', async () => {
    jest.spyOn(TeamService, 'getAll').mockRejectedValue('string-error')

    await act(async () => {
      await useTeamsStore.getState().fetchTeams()
    })

    expect(useTeamsStore.getState().error).toBe('Failed to load teams')
  })
})
