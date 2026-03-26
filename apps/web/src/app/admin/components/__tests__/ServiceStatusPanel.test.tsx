import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { act } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { ServiceStatusPanel } from '../ServiceStatusPanel'

jest.mock('@/lib/client', () => ({
  api: {
    admin: {
      healthServices: jest.fn(),
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

const allOnlineServices = [
  { name: 'Gateway API', status: 'online', latency: 10 },
  { name: 'Simulation Sessions', status: 'online', latency: 12 },
  { name: 'Simulation Invitations', status: 'online', latency: 8 },
  { name: 'LLM Service', status: 'online', latency: 15 },
  { name: 'User Service', status: 'online', latency: 5 },
  { name: 'Analytics Service', status: 'online', latency: 6 },
  { name: 'Support Service', status: 'online', latency: 7 },
  { name: 'CRM Service', status: 'online', latency: 9 },
  { name: 'LTI Service', status: 'online', latency: 11 },
  { name: 'S3 Service', status: 'online', latency: 4 },
]

describe('ServiceStatusPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('shows loader before fetch resolves', () => {
    api.admin.healthServices.mockReturnValue(new Promise(() => {}))

    act(() => {
      render(
        <Wrapper>
          <ServiceStatusPanel />
        </Wrapper>
      )
    })

    expect(screen.getByText(/Checking services/i)).toBeInTheDocument()
  })

  it('shows "10/10 Online" button when all services are online', async () => {
    api.admin.healthServices.mockResolvedValue({ services: allOnlineServices })

    await act(async () => {
      render(
        <Wrapper>
          <ServiceStatusPanel />
        </Wrapper>
      )
    })

    await waitFor(() => {
      expect(screen.getByText('10/10 Online')).toBeInTheDocument()
    })
  })

  it('shows partial count when some services are offline', async () => {
    const services = allOnlineServices.map((s, i) =>
      i === 0 ? { ...s, status: 'offline' as const } : s
    )
    api.admin.healthServices.mockResolvedValue({ services })

    await act(async () => {
      render(
        <Wrapper>
          <ServiceStatusPanel />
        </Wrapper>
      )
    })

    await waitFor(() => {
      expect(screen.getByText('9/10 Online')).toBeInTheDocument()
    })
  })

  it('opens popover and shows service groups on button click', async () => {
    api.admin.healthServices.mockResolvedValue({ services: allOnlineServices })

    await act(async () => {
      render(
        <Wrapper>
          <ServiceStatusPanel />
        </Wrapper>
      )
    })

    await waitFor(() => {
      expect(screen.getByText('10/10 Online')).toBeInTheDocument()
    })

    const button = screen.getByText('10/10 Online')
    await userEvent.click(button)

    await waitFor(() => {
      expect(screen.getByText('System Status')).toBeInTheDocument()
      expect(screen.getByText('Gateway & Simulation')).toBeInTheDocument()
      expect(screen.getByText('Core Services')).toBeInTheDocument()
      expect(screen.getByText('Infrastructure')).toBeInTheDocument()
    })
  })

  it('shows individual service names in the popover', async () => {
    api.admin.healthServices.mockResolvedValue({ services: allOnlineServices })

    await act(async () => {
      render(
        <Wrapper>
          <ServiceStatusPanel />
        </Wrapper>
      )
    })

    await waitFor(() => {
      expect(screen.getByText('10/10 Online')).toBeInTheDocument()
    })

    await userEvent.click(screen.getByText('10/10 Online'))

    await waitFor(() => {
      expect(screen.getByText('Gateway API')).toBeInTheDocument()
      expect(screen.getByText('User Service')).toBeInTheDocument()
      expect(screen.getByText('S3 Service')).toBeInTheDocument()
    })
  })

  it('shows "No data available" when services list is empty', async () => {
    api.admin.healthServices.mockResolvedValue({ services: [] })

    await act(async () => {
      render(
        <Wrapper>
          <ServiceStatusPanel />
        </Wrapper>
      )
    })

    await waitFor(() => {
      // After load with empty services, should show 0/0 Online button
      expect(screen.getByRole('button')).toBeInTheDocument()
    })

    await userEvent.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(screen.getByText('No data available')).toBeInTheDocument()
    })
  })
})
