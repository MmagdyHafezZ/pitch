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
})
