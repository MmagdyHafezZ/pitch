import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
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

  it('shows "All Systems Online" badge when all services are online', async () => {
    api.admin.healthServices.mockResolvedValue({
      services: [
        { name: 'Gateway API', status: 'online', latency: 10 },
        { name: 'Simulation Sessions', status: 'online', latency: 12 },
        { name: 'Simulation Invitations', status: 'online', latency: 8 },
        { name: 'LLM Service', status: 'online', latency: 15 },
      ],
      containers: [],
    })

    await act(async () => {
      render(
        <Wrapper>
          <ServiceStatusPanel />
        </Wrapper>
      )
    })

    await waitFor(() => {
      expect(screen.getByText('All Systems Online')).toBeInTheDocument()
    })
  })

  it('shows "Degraded" badge when a service has status offline', async () => {
    api.admin.healthServices.mockResolvedValue({
      services: [
        { name: 'Gateway API', status: 'offline', latency: 0 },
        { name: 'Simulation Sessions', status: 'online', latency: 12 },
        { name: 'Simulation Invitations', status: 'online', latency: 8 },
        { name: 'LLM Service', status: 'online', latency: 15 },
      ],
      containers: [],
    })

    await act(async () => {
      render(
        <Wrapper>
          <ServiceStatusPanel />
        </Wrapper>
      )
    })

    await waitFor(() => {
      expect(screen.getByText('Degraded')).toBeInTheDocument()
    })
  })

  it('shows container name and "Running" badge when container is running', async () => {
    api.admin.healthServices.mockResolvedValue({
      services: [
        { name: 'Gateway API', status: 'online', latency: 10 },
        { name: 'Simulation Sessions', status: 'online', latency: 12 },
        { name: 'Simulation Invitations', status: 'online', latency: 8 },
        { name: 'LLM Service', status: 'online', latency: 15 },
      ],
      containers: [
        {
          id: 'abc123456789',
          name: 'my-app',
          image: 'nginx:latest',
          state: 'running',
          status: 'Up 2 hours',
        },
      ],
    })

    await act(async () => {
      render(
        <Wrapper>
          <ServiceStatusPanel />
        </Wrapper>
      )
    })

    await waitFor(() => {
      expect(screen.getByText('All Systems Online')).toBeInTheDocument()
    })

    const badge = screen.getByText('All Systems Online')
    await userEvent.click(badge)

    await waitFor(() => {
      expect(screen.getByText('my-app')).toBeInTheDocument()
      expect(screen.getByText('Running')).toBeInTheDocument()
    })
  })

  it('shows "Docker not available" when containers is empty', async () => {
    api.admin.healthServices.mockResolvedValue({
      services: [
        { name: 'Gateway API', status: 'online', latency: 10 },
        { name: 'Simulation Sessions', status: 'online', latency: 12 },
        { name: 'Simulation Invitations', status: 'online', latency: 8 },
        { name: 'LLM Service', status: 'online', latency: 15 },
      ],
      containers: [],
    })

    await act(async () => {
      render(
        <Wrapper>
          <ServiceStatusPanel />
        </Wrapper>
      )
    })

    await waitFor(() => {
      expect(screen.getByText('All Systems Online')).toBeInTheDocument()
    })

    const badge = screen.getByText('All Systems Online')
    await userEvent.click(badge)

    await waitFor(() => {
      expect(screen.getByText('Docker not available')).toBeInTheDocument()
    })
  })
})
