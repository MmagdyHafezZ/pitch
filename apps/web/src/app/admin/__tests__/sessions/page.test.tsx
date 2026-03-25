import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
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
})
