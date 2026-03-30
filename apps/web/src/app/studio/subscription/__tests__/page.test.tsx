/**
 * @jest-environment jsdom
 */
import { act } from 'react'
import { createTestQueryClient, render, screen, waitFor } from '@/__tests__/utils/test-utils'
import SubscriptionPage from '../page'

var currentRefillRequest: any
var mockApi: {
  subscriptions: { getByTeamId: jest.Mock }
  plans: { getAll: jest.Mock }
  coins: {
    myRefillRequest: jest.Mock
    ledgerHistory: jest.Mock
    refillRequest: jest.Mock
  }
}
var mockSharedQueryClient: {
  invalidateQueries: jest.Mock
  setQueryData: jest.Mock
}
var mockUseTeams: jest.Mock
var mockUsePersonalCoinsBalance: jest.Mock
var mockUseCoinsBalance: jest.Mock

jest.mock('@/lib/client', () => {
  mockSharedQueryClient = {
    invalidateQueries: jest.fn(),
    setQueryData: jest.fn(),
  }
  mockApi = {
    subscriptions: {
      getByTeamId: jest.fn(),
    },
    plans: {
      getAll: jest.fn(),
    },
    coins: {
      myRefillRequest: jest.fn(() => Promise.resolve(currentRefillRequest)),
      ledgerHistory: jest.fn(),
      refillRequest: jest.fn(),
    },
  }

  return {
    api: mockApi,
    queryClient: mockSharedQueryClient,
  }
})

jest.mock('@/features/teams/hooks/useTeams', () => ({
  useTeams: (...args: any[]) => {
    mockUseTeams ??= jest.fn()
    return mockUseTeams(...args)
  },
}))

jest.mock('@/features/coins/hooks/useCoinsBalance', () => ({
  usePersonalCoinsBalance: (...args: any[]) => {
    mockUsePersonalCoinsBalance ??= jest.fn()
    return mockUsePersonalCoinsBalance(...args)
  },
  useCoinsBalance: (...args: any[]) => {
    mockUseCoinsBalance ??= jest.fn()
    return mockUseCoinsBalance(...args)
  },
}))

jest.mock('@/features/auth/stores/auth.store', () => ({
  useAuthStore: (selector: (state: any) => unknown) =>
    selector({
      user: {
        id: 'user-1',
        email: 'user@example.com',
        name: 'Pitch Nova',
        settings: { studioAccess: { teamId: 'team-personal' } },
      },
      setUser: jest.fn(),
    }),
}))

describe('SubscriptionPage refill status updates', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()

    currentRefillRequest = {
      requestedCoins: 2500,
      requestedAt: '2026-03-29T11:00:00.000Z',
      status: 'pending',
      teamId: 'team-personal',
    }

    mockUseTeams = jest.fn().mockReturnValue({
      activeTeamId: 'team-personal',
      teams: [
        {
          id: 'team-personal',
          name: 'Pitch Nova Workspace',
          memberships: [{ userId: 'user-1', isActive: true }],
        },
      ],
      loading: false,
      fetchUserTeams: jest.fn().mockResolvedValue(undefined),
      setActiveTeamId: jest.fn(),
    })
    mockUsePersonalCoinsBalance = jest.fn().mockReturnValue({
      data: {
        ok: true,
        userId: 'user-1',
        periodKey: 'personal:user-1:2026-03',
        allowance: 500,
        remaining: 200,
      },
      isLoading: false,
      isError: false,
    })
    mockUseCoinsBalance = jest.fn().mockReturnValue({
      data: null,
      isLoading: false,
      isError: false,
    })

    mockApi.subscriptions.getByTeamId.mockResolvedValue({
      id: 'sub-1',
      teamId: 'team-personal',
      planId: 'plan-1',
      interval: 'MONTH',
      currentPeriodStart: '2026-03-01T00:00:00.000Z',
      currentPeriodEnd: '2026-04-01T00:00:00.000Z',
      isActive: true,
      plan: {
        id: 'plan-1',
        name: 'Starter',
        planLevel: 'FREE',
        maxCoins: 500,
        coinCostPerSession: 10,
        coinPriceUsd: 0.1,
        isActive: true,
      },
    })
    mockApi.plans.getAll.mockResolvedValue([
      {
        id: 'plan-1',
        name: 'Starter',
        planLevel: 'FREE',
        maxCoins: 500,
        coinCostPerSession: 10,
        coinPriceUsd: 0.1,
        isActive: true,
      },
    ])
    mockApi.coins.ledgerHistory.mockResolvedValue([])
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('updates from pending to denied without a page reload', async () => {
    const queryClient = createTestQueryClient()
    render(<SubscriptionPage />, { queryClient })

    await act(async () => {
      jest.advanceTimersByTime(20)
      await Promise.resolve()
    })

    expect(await screen.findByRole('button', { name: 'Top-up pending' })).toBeDisabled()

    currentRefillRequest = {
      ...currentRefillRequest,
      status: 'denied',
      reviewedBy: 'admin@example.com',
    }

    await act(async () => {
      jest.advanceTimersByTime(15_000)
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(mockApi.coins.myRefillRequest).toHaveBeenCalledTimes(2)
    })
    expect(await screen.findByRole('button', { name: 'Request top-up' })).toBeInTheDocument()
    expect(screen.getByText('Request not approved')).toBeInTheDocument()
  })
})
