import React from 'react'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
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

  it('shows empty state when no plans exist', async () => {
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
      expect(screen.getByText(/no plans yet/i)).toBeInTheDocument()
    })
  })

  it('shows Active/Inactive badges for plans', async () => {
    api.plans.getAll.mockResolvedValue([
      makePlan({ id: 'p1', name: 'Active Plan', isActive: true }),
      makePlan({ id: 'p2', name: 'Inactive Plan', isActive: false }),
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
      expect(screen.getByText('Active')).toBeInTheDocument()
      expect(screen.getByText('Inactive')).toBeInTheDocument()
    })
  })

  it('opens edit modal when Edit button is clicked', async () => {
    api.plans.getAll.mockResolvedValue([
      makePlan({ id: 'p1', name: 'Pro Monthly', planLevel: 'PRO', maxCoins: 500 }),
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
      expect(screen.getByText('Pro Monthly')).toBeInTheDocument()
    })

    const table = screen.getByRole('table')
    const rows = within(table).getAllByRole('row')
    const dataRow = rows[1]
    const editBtn = within(dataRow).getByRole('button')
    await act(async () => {
      fireEvent.click(editBtn)
    })

    await waitFor(() => {
      expect(screen.getByText('Edit Plan')).toBeInTheDocument()
      expect(screen.getByLabelText(/plan name/i)).toHaveValue('Pro Monthly')
    })
  })

  it('creates a new plan via the create modal', async () => {
    api.plans.getAll.mockResolvedValue([])
    api.plans.create.mockResolvedValue({ id: 'new-plan' })

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

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /create plan/i }))
    })

    await waitFor(() => {
      expect(screen.getByLabelText(/plan name/i)).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText(/plan name/i), { target: { value: 'My New Plan' } })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^Create$/ }))
    })

    await waitFor(() => {
      expect(api.plans.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'My New Plan' })
      )
    })
  })

  it('shows validation error when creating plan without name', async () => {
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

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /create plan/i }))
    })

    await waitFor(() => {
      expect(screen.getByLabelText(/plan name/i)).toBeInTheDocument()
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^Create$/ }))
    })

    expect(api.plans.create).not.toHaveBeenCalled()
  })

  it('shows plan level badges (PRO, FREE)', async () => {
    api.plans.getAll.mockResolvedValue([
      makePlan({ id: 'p1', name: 'Free Tier', planLevel: 'FREE' }),
      makePlan({ id: 'p2', name: 'Pro Monthly', planLevel: 'PRO' }),
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
      expect(screen.getByText('FREE')).toBeInTheDocument()
      expect(screen.getByText('PRO')).toBeInTheDocument()
    })
  })

  it('updates a plan via the edit modal', async () => {
    api.plans.getAll.mockResolvedValue([
      makePlan({ id: 'p1', name: 'Pro Monthly', planLevel: 'PRO', maxCoins: 500 }),
    ])
    api.plans.update.mockResolvedValue({})

    const PlansPage = require('../../plans/page').default

    await act(async () => {
      render(
        <Wrapper>
          <PlansPage />
        </Wrapper>
      )
    })

    await waitFor(() => {
      expect(screen.getByText('Pro Monthly')).toBeInTheDocument()
    })

    const table = screen.getByRole('table')
    const rows = within(table).getAllByRole('row')
    const editBtn = within(rows[1]).getByRole('button')
    await act(async () => {
      fireEvent.click(editBtn)
    })

    await waitFor(() => {
      expect(screen.getByLabelText(/plan name/i)).toHaveValue('Pro Monthly')
    })

    fireEvent.change(screen.getByLabelText(/plan name/i), { target: { value: 'Pro Annual' } })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^Update$/ }))
    })

    await waitFor(() => {
      expect(api.plans.update).toHaveBeenCalledWith(
        'p1',
        expect.objectContaining({ name: 'Pro Annual' })
      )
    })
  })

  it('shows description text in plans page header', async () => {
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
      expect(screen.getByText('Create and manage subscription plans')).toBeInTheDocument()
    })
  })
})
