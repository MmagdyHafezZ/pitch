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
})
