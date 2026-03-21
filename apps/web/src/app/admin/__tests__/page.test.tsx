import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { act } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/admin',
}))

jest.mock('@/lib/client', () => ({
  api: {
    users: { getAll: jest.fn() },
    teams: { getAll: jest.fn() },
    sessions: { getAll: jest.fn() },
    plans: { getAll: jest.fn() },
  },
}))

jest.mock('../components/ServiceStatusPanel', () => ({
  ServiceStatusPanel: () => <div data-testid="service-status-panel" />,
}))

const { api } = jest.requireMock('@/lib/client')

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <MantineProvider>
      <Notifications />
      {children}
    </MantineProvider>
  )
}

describe('AdminOverview (dashboard page)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('shows skeletons while data is loading', () => {
    api.users.getAll.mockReturnValue(new Promise(() => {}))
    api.teams.getAll.mockReturnValue(new Promise(() => {}))
    api.sessions.getAll.mockReturnValue(new Promise(() => {}))
    api.plans.getAll.mockReturnValue(new Promise(() => {}))

    const AdminOverview = require('../page').default

    act(() => {
      render(
        <Wrapper>
          <AdminOverview />
        </Wrapper>
      )
    })

    // Mantine Skeleton renders with role="presentation" or as a div; check for multiple
    const skeletons = document.querySelectorAll('[class*="Skeleton"]')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('renders stat cards after data loads', async () => {
    api.users.getAll.mockResolvedValue([
      { id: 'u1', name: 'Alice', email: 'alice@test.com', isActive: true },
      { id: 'u2', name: 'Bob', email: 'bob@test.com', isActive: false },
    ])
    api.teams.getAll.mockResolvedValue([
      { id: 't1', name: 'Team A', slug: 'team-a', isActive: true, createdAt: '2024-01-01' },
    ])
    api.sessions.getAll.mockResolvedValue({
      sessions: [
        {
          id: 's1',
          status: 'active',
          type: 'text',
          createdAt: '2024-01-01',
          userId: 'u1',
          orgId: 'o1',
        },
      ],
      total: 1,
    })
    api.plans.getAll.mockResolvedValue([
      {
        id: 'p1',
        name: 'Pro',
        planLevel: 'PRO',
        maxCoins: 500,
        isActive: true,
        createdAt: '2024-01-01',
      },
    ])

    const AdminOverview = require('../page').default

    await act(async () => {
      render(
        <Wrapper>
          <AdminOverview />
        </Wrapper>
      )
    })

    await waitFor(() => {
      expect(screen.getByText('Admin Dashboard')).toBeInTheDocument()
    })

    // Stat card titles
    expect(screen.getByText('Total Users')).toBeInTheDocument()
    expect(screen.getByText('Teams')).toBeInTheDocument()
    expect(screen.getByText('Sessions')).toBeInTheDocument()
    expect(screen.getByText('Plans')).toBeInTheDocument()

    // Numeric values — use getAllByText since same count may appear in multiple cards
    expect(screen.getAllByText('2').length).toBeGreaterThan(0) // totalUsers
    expect(screen.getAllByText('1').length).toBeGreaterThan(0) // totalTeams / totalPlans
  })
})
