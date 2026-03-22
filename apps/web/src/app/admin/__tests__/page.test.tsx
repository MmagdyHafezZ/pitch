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
    admin: {
      overview: jest.fn(),
    },
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
    api.admin.overview.mockReturnValue(new Promise(() => {}))

    const AdminOverview = require('../page').default

    act(() => {
      render(
        <Wrapper>
          <AdminOverview />
        </Wrapper>
      )
    })

    const skeletons = document.querySelectorAll('[class*="Skeleton"]')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('renders stat cards after data loads', async () => {
    api.admin.overview.mockResolvedValue({
      userCount: 2,
      teamCount: 1,
      sessionCount: 3,
      planCount: 4,
    })

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

    expect(screen.getByText('Total Users')).toBeInTheDocument()
    expect(screen.getByText('Teams')).toBeInTheDocument()
    expect(screen.getByText('Sessions')).toBeInTheDocument()
    expect(screen.getByText('Plans')).toBeInTheDocument()

    expect(screen.getAllByText('2').length).toBeGreaterThan(0)
    expect(screen.getAllByText('1').length).toBeGreaterThan(0)
  })
})
