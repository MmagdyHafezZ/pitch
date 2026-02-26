/**
 * @jest-environment jsdom
 */
import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@/__tests__/utils/test-utils'
import { TeamSubscriptionPanel } from '../TeamSubscriptionPanel'

var mockApi: {
  plans: { getAll: jest.Mock }
  subscriptions: {
    getByTeamId: jest.Mock
    create: jest.Mock
    update: jest.Mock
    upgrade: jest.Mock
  }
}

jest.mock('@mantine/notifications', () => {
  const actual = jest.requireActual('@mantine/notifications')
  return {
    ...actual,
    notifications: {
      show: jest.fn(),
    },
  }
})

jest.mock('@/lib/client', () => {
  mockApi = {
    plans: {
      getAll: jest.fn(),
    },
    subscriptions: {
      getByTeamId: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      upgrade: jest.fn(),
    },
  }
  return { api: mockApi }
})

describe('TeamSubscriptionPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockApi.plans.getAll.mockResolvedValue([
      {
        id: 'plan-pro',
        name: 'Pro Plan',
        planLevel: 'PRO',
        description: 'Access to pro features',
        maxCoins: 1999,
        isActive: true,
      },
      {
        id: 'plan-enterprise',
        name: 'Enterprise',
        planLevel: 'ENTERPRISE',
        maxCoins: 9999,
        isActive: false,
      },
    ])
    mockApi.subscriptions.getByTeamId.mockRejectedValue(
      new Error("Couldn't find a subscription for team with ID team-1")
    )
    mockApi.subscriptions.create.mockResolvedValue({
      id: 'sub-1',
      teamId: 'team-1',
      planId: 'plan-pro',
      interval: 'YEAR',
      plan: { id: 'plan-pro', name: 'Pro Plan', maxCoins: 1999 },
    })
  })

  it('treats missing subscription as empty state and shows only active plans', async () => {
    render(<TeamSubscriptionPanel teamId="team-1" teamName="Pitch Team" canManage />)

    expect(await screen.findByText('No subscription configured')).toBeInTheDocument()
    expect(screen.getByText('Pro Plan')).toBeInTheDocument()
    expect(screen.queryByText('Enterprise')).not.toBeInTheDocument()

    await waitFor(() => {
      expect(mockApi.plans.getAll).toHaveBeenCalledTimes(1)
      expect(mockApi.subscriptions.getByTeamId).toHaveBeenCalledWith('team-1')
    })
  })

  it('creates a subscription with the selected interval when choosing a plan', async () => {
    const user = userEvent.setup()
    render(<TeamSubscriptionPanel teamId="team-1" teamName="Pitch Team" canManage />)

    await screen.findByText('Pro Plan')

    await user.click(screen.getByRole('radio', { name: 'Yearly' }))
    await user.click(screen.getByRole('button', { name: /select plan/i }))

    await waitFor(() => {
      expect(mockApi.subscriptions.create).toHaveBeenCalledWith({
        teamId: 'team-1',
        planId: 'plan-pro',
        interval: 'YEAR',
      })
    })
  })
})
