import { act } from '@testing-library/react'
import { useTeamConfigStore } from '../team-config.store'
import { api } from '@/lib/client'

jest.mock('@/lib/client', () => ({
  api: {
    users: { getAll: jest.fn() },
    plans: { getAll: jest.fn() },
    subscriptions: { getByTeamId: jest.fn() },
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
})
