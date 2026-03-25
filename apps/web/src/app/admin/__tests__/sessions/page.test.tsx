import React from 'react'
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'
import { act } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'

const mockPush = jest.fn()
const mockReplace = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  usePathname: () => '/admin',
}))

jest.mock('@/lib/client', () => ({
  api: {
    admin: {
      sessions: {
        list: jest.fn(),
        delete: jest.fn(),
      },
      users: {
        list: jest.fn(),
      },
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

const makeSession = (
  overrides: Partial<{
    id: string
    name: string | null
    userId: string
    orgId: string
    type: string
    status: string
    createdAt: string
    endedAt: string | null
    scenario: { name?: string } | null
    persona: { name?: string } | null
  }> = {}
) => ({
  id: 'session-abc123',
  name: 'Test Session',
  userId: 'user-1',
  orgId: 'org-1',
  type: 'text',
  status: 'ended',
  createdAt: '2024-01-15T10:00:00.000Z',
  endedAt: '2024-01-15T10:30:00.000Z',
  scenario: { name: 'Sales Pitch' },
  persona: { name: 'Customer' },
  ...overrides,
})

describe('SessionsManagement page', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    api.admin.users.list.mockResolvedValue([])
  })

  it('shows skeletons while loading', () => {
    api.admin.sessions.list.mockReturnValue(new Promise(() => {}))

    const SessionsPage = require('../../sessions/page').default

    act(() => {
      render(
        <Wrapper>
          <SessionsPage />
        </Wrapper>
      )
    })

    const skeletons = document.querySelectorAll('[class*="Skeleton"]')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('renders sessions after load', async () => {
    api.admin.sessions.list.mockResolvedValue({
      sessions: [
        makeSession({ id: 'session-001', name: 'Alpha Session', status: 'active' }),
        makeSession({ id: 'session-002', name: 'Beta Session', status: 'ended' }),
      ],
      total: 2,
    })

    const SessionsPage = require('../../sessions/page').default

    await act(async () => {
      render(
        <Wrapper>
          <SessionsPage />
        </Wrapper>
      )
    })

    await waitFor(() => {
      expect(screen.getByText('Alpha Session')).toBeInTheDocument()
      expect(screen.getByText('Beta Session')).toBeInTheDocument()
    })
  })

  it('shows empty state when no sessions exist', async () => {
    api.admin.sessions.list.mockResolvedValue({ sessions: [], total: 0 })

    const SessionsPage = require('../../sessions/page').default

    await act(async () => {
      render(
        <Wrapper>
          <SessionsPage />
        </Wrapper>
      )
    })

    await waitFor(() => {
      expect(screen.getByText('No sessions found.')).toBeInTheDocument()
    })
  })

  it('search input filters sessions by name', async () => {
    api.admin.sessions.list.mockResolvedValue({
      sessions: [
        makeSession({ id: 's1', name: 'Alpha Session' }),
        makeSession({ id: 's2', name: 'Beta Session' }),
      ],
      total: 2,
    })

    const SessionsPage = require('../../sessions/page').default

    await act(async () => {
      render(
        <Wrapper>
          <SessionsPage />
        </Wrapper>
      )
    })

    await waitFor(() => {
      expect(screen.getByText('Alpha Session')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByPlaceholderText(/search by name, id, user, scenario/i), {
      target: { value: 'Alpha' },
    })

    await waitFor(() => {
      expect(screen.getByText('Alpha Session')).toBeInTheDocument()
      expect(screen.queryByText('Beta Session')).not.toBeInTheDocument()
    })
  })

  it('shows "No sessions match your filters" when search has no results', async () => {
    api.admin.sessions.list.mockResolvedValue({
      sessions: [makeSession({ id: 's1', name: 'Alpha Session' })],
      total: 1,
    })

    const SessionsPage = require('../../sessions/page').default

    await act(async () => {
      render(
        <Wrapper>
          <SessionsPage />
        </Wrapper>
      )
    })

    await waitFor(() => {
      expect(screen.getByText('Alpha Session')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByPlaceholderText(/search by name, id, user, scenario/i), {
      target: { value: 'nonexistent-xyz' },
    })

    await waitFor(() => {
      expect(screen.getByText('No sessions match your filters.')).toBeInTheDocument()
    })
  })

  it('shows total sessions count after load', async () => {
    api.admin.sessions.list.mockResolvedValue({
      sessions: [makeSession({ id: 's1', name: 'Session' })],
      total: 42,
    })

    const SessionsPage = require('../../sessions/page').default

    await act(async () => {
      render(
        <Wrapper>
          <SessionsPage />
        </Wrapper>
      )
    })

    await waitFor(() => {
      expect(screen.getByText('42 total sessions')).toBeInTheDocument()
    })
  })

  it('shows type and status badges', async () => {
    api.admin.sessions.list.mockResolvedValue({
      sessions: [makeSession({ id: 's1', name: 'Voice Session', type: 'voice', status: 'active' })],
      total: 1,
    })

    const SessionsPage = require('../../sessions/page').default

    await act(async () => {
      render(
        <Wrapper>
          <SessionsPage />
        </Wrapper>
      )
    })

    await waitFor(() => {
      expect(screen.getByText('voice')).toBeInTheDocument()
      expect(screen.getByText('active')).toBeInTheDocument()
    })
  })

  it('shows duration as "Ongoing" for sessions without endedAt', async () => {
    api.admin.sessions.list.mockResolvedValue({
      sessions: [
        makeSession({ id: 's1', name: 'Active Session', endedAt: null, status: 'active' }),
      ],
      total: 1,
    })

    const SessionsPage = require('../../sessions/page').default

    await act(async () => {
      render(
        <Wrapper>
          <SessionsPage />
        </Wrapper>
      )
    })

    await waitFor(() => {
      expect(screen.getByText('Ongoing')).toBeInTheDocument()
    })
  })

  it('shows scenario name when present', async () => {
    api.admin.sessions.list.mockResolvedValue({
      sessions: [makeSession({ id: 's1', name: 'Session X', scenario: { name: 'Sales Pitch' } })],
      total: 1,
    })

    const SessionsPage = require('../../sessions/page').default

    await act(async () => {
      render(
        <Wrapper>
          <SessionsPage />
        </Wrapper>
      )
    })

    await waitFor(() => {
      expect(screen.getByText('Sales Pitch')).toBeInTheDocument()
    })
  })

  it('navigates to session detail when view button is clicked', async () => {
    api.admin.sessions.list.mockResolvedValue({
      sessions: [makeSession({ id: 'session-abc123', name: 'Test Session' })],
      total: 1,
    })

    const SessionsPage = require('../../sessions/page').default

    await act(async () => {
      render(
        <Wrapper>
          <SessionsPage />
        </Wrapper>
      )
    })

    await waitFor(() => {
      expect(screen.getByText('Test Session')).toBeInTheDocument()
    })

    const table = screen.getByRole('table')
    const rows = within(table).getAllByRole('row')
    const dataRow = rows[1]
    const buttons = within(dataRow).getAllByRole('button')
    await act(async () => {
      fireEvent.click(buttons[0])
    })

    expect(mockPush).toHaveBeenCalledWith('/admin/sessions/session-abc123')
  })
})
