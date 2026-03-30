import { act } from '@testing-library/react'
import { useTeamConfigStore } from '../team-config.store'
import { api, queryClient } from '@/lib/client'

jest.mock('@/lib/client', () => ({
  api: {
    users: { getAll: jest.fn() },
    plans: { getAll: jest.fn() },
    subscriptions: {
      getByTeamId: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      upgrade: jest.fn(),
    },
  },
  queryClient: {
    invalidateQueries: jest.fn(),
  },
}))

describe('TeamConfigStore', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    act(() => {
      useTeamConfigStore.setState({
        orgUsers: [],
        orgUsersLoading: false,
        orgUsersError: null,
        plans: [],
        plansLoading: false,
        plansError: null,
        subscriptionsByTeam: {},
        subscriptionLoadingByTeam: {},
        subscriptionErrorByTeam: {},
      } as any)
    })
  })

  it('treats missing plans route as empty plans without error', async () => {
    ;(api.plans.getAll as jest.Mock).mockRejectedValue(new Error('Cannot GET /api/v1/plans'))

    const result = await useTeamConfigStore.getState().fetchPlans()

    expect(result).toEqual([])
    expect(useTeamConfigStore.getState().plansError).toBeNull()
    expect(useTeamConfigStore.getState().plans).toEqual([])
  })

  it('treats missing team subscription route as null subscription without error', async () => {
    ;(api.subscriptions.getByTeamId as jest.Mock).mockRejectedValue(
      new Error('Cannot GET /api/v1/subscriptions/teams/team-1')
    )

    const result = await useTeamConfigStore.getState().fetchSubscriptionByTeam('team-1')

    expect(result).toBeNull()
    expect(useTeamConfigStore.getState().subscriptionErrorByTeam['team-1']).toBeNull()
    expect(useTeamConfigStore.getState().subscriptionsByTeam['team-1']).toBeNull()
  })

  it('invalidates coin queries after selecting a team plan', async () => {
    ;(api.subscriptions.create as jest.Mock).mockResolvedValue({
      id: 'sub-1',
      teamId: 'team-1',
      planId: 'plan-pro',
      interval: 'YEAR',
    })

    const result = await useTeamConfigStore.getState().selectTeamPlan('team-1', {
      planId: 'plan-pro',
      interval: 'YEAR',
    })

    expect(result).toEqual(
      expect.objectContaining({
        id: 'sub-1',
        teamId: 'team-1',
        planId: 'plan-pro',
      })
    )
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['coins'],
    })
  })
})
