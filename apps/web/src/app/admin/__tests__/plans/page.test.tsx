import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { act } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/admin',
}))

jest.mock('@/lib/client', () => ({
  api: {
    plans: {
      getAll: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
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

const makePlan = (
  overrides: Partial<{
    id: string
    name: string
    description: string | null
    planLevel: string
    maxCoins: number
    isActive: boolean
    createdAt: string
    updatedAt: string
  }> = {}
) => ({
  id: 'plan-1',
  name: 'Pro Monthly',
  description: 'Great plan for professionals',
  planLevel: 'PRO',
  maxCoins: 500,
  isActive: true,
  createdAt: '2024-01-15T10:00:00.000Z',
  updatedAt: '2024-01-15T10:00:00.000Z',
  ...overrides,
})

describe('PlansManagement page', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('shows skeletons while loading', () => {
    api.plans.getAll.mockReturnValue(new Promise(() => {}))

    const PlansPage = require('../../plans/page').default

    act(() => {
      render(
        <Wrapper>
          <PlansPage />
        </Wrapper>
      )
    })

    const skeletons = document.querySelectorAll('[class*="Skeleton"]')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('renders plan name after load', async () => {
    api.plans.getAll.mockResolvedValue([
      makePlan({ id: 'p1', name: 'Free Tier', planLevel: 'FREE', maxCoins: 50 }),
      makePlan({ id: 'p2', name: 'Pro Monthly', planLevel: 'PRO', maxCoins: 500 }),
    ])

    const PlansPage = require('../../plans/page').default

    await act(async () => {
      render(
        <Wrapper>
          <PlansPage />
        </Wrapper>
      )
    })

    await waitFor(() => {
      expect(screen.getByText('Free Tier')).toBeInTheDocument()
      expect(screen.getByText('Pro Monthly')).toBeInTheDocument()
    })
  })

  it('"Create Plan" button is visible and clicking it opens modal with "Plan Name" field', async () => {
    api.plans.getAll.mockResolvedValue([])

    const PlansPage = require('../../plans/page').default

    await act(async () => {
      render(
        <Wrapper>
          <PlansPage />
        </Wrapper>
      )
    })

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
    })

    const createBtn = screen.getByRole('button', { name: /create plan/i })
    expect(createBtn).toBeInTheDocument()

    await act(async () => {
      fireEvent.click(createBtn)
    })

    await waitFor(() => {
      expect(screen.getByLabelText(/plan name/i)).toBeInTheDocument()
    })
  })
})
