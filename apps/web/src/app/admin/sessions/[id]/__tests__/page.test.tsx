/** @jest-environment jsdom */
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MantineProvider } from '@mantine/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const mockPush = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
  useParams: () => ({ id: 'sess-1' }),
}))

jest.mock('@mantine/notifications', () => ({
  notifications: { show: jest.fn() },
}))

const mockSessionsGet = jest.fn()
const mockSessionsGetEvents = jest.fn()
const mockGetLatestForSession = jest.fn()

jest.mock('@/lib/client', () => ({
  api: {
    admin: {
      sessions: {
        get: (...args: any[]) => mockSessionsGet(...args),
        getEvents: (...args: any[]) => mockSessionsGetEvents(...args),
      },
    },
    assessments: {
      getLatestForSession: (...args: any[]) => mockGetLatestForSession(...args),
    },
  },
}))

import SessionDetail from '../page'

const qc = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
})

function renderPage() {
  return render(
    <QueryClientProvider client={qc}>
      <MantineProvider>
        <SessionDetail />
      </MantineProvider>
    </QueryClientProvider>
  )
}

const mockSession = {
  id: 'sess-1',
  name: 'Test Session',
  status: 'active',
  type: 'text',
  userId: 'u1',
  createdAt: '2025-01-01T00:00:00.000Z',
  endedAt: null,
}

beforeEach(() => {
  jest.clearAllMocks()
  mockSessionsGet.mockResolvedValue(mockSession)
  mockSessionsGetEvents.mockResolvedValue([])
  mockGetLatestForSession.mockRejectedValue(new Error('no assessment'))
})

describe('AdminSessionDetail', () => {
  it('shows loading skeletons initially', () => {
    mockSessionsGet.mockReturnValue(new Promise(() => {}))
    renderPage()
    const skeletons = document.querySelectorAll('[class*="skeleton"], [class*="Skeleton"]')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('shows session not found when session is null', async () => {
    mockSessionsGet.mockRejectedValue(new Error('not found'))
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Session not found.')).toBeInTheDocument()
    })
  })

  it('renders session details after loading', async () => {
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Test Session')).toBeInTheDocument()
    })
    expect(screen.getByText('active')).toBeInTheDocument()
  })

  it('shows Back button that navigates to admin sessions', async () => {
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Back')).toBeInTheDocument()
    })

    const user = userEvent.setup()
    await user.click(screen.getByText('Back'))
    expect(mockPush).toHaveBeenCalledWith('/admin/sessions')
  })

  it('renders timeline section', async () => {
    mockSessionsGetEvents.mockResolvedValue([
      {
        id: 'e1',
        type: 'message',
        role: 'user',
        content: 'Hello',
        createdAt: '2025-01-01T00:01:00.000Z',
      },
    ])
    renderPage()

    await waitFor(() => {
      expect(screen.getByText(/Session Timeline/)).toBeInTheDocument()
    })
    expect(screen.getByText('Hello')).toBeInTheDocument()
  })

  it('shows empty timeline message when no events', async () => {
    renderPage()

    await waitFor(() => {
      expect(screen.getByText(/No timeline events recorded/)).toBeInTheDocument()
    })
  })

  it('shows assessment results when available', async () => {
    mockGetLatestForSession.mockResolvedValue({
      totalScore: 85,
      scoreBreakdown: { clarity: 90, engagement: 80 },
    })
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Score: 85')).toBeInTheDocument()
    })
    expect(screen.getByText('90')).toBeInTheDocument()
    expect(screen.getByText('80')).toBeInTheDocument()
  })

  it('renders scenario and persona when present', async () => {
    mockSessionsGet.mockResolvedValue({
      ...mockSession,
      scenario: { name: 'Discovery Call', description: 'Qualify the lead' },
      persona: { name: 'Sales Coach' },
    })
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Discovery Call')).toBeInTheDocument()
    })
    expect(screen.getByText('Sales Coach')).toBeInTheDocument()
  })

  it('shows session config when present', async () => {
    mockSessionsGet.mockResolvedValue({
      ...mockSession,
      sessionConfig: { maxTurns: 10 },
    })
    renderPage()

    await waitFor(() => {
      expect(screen.getByText(/Session Configuration/)).toBeInTheDocument()
    })
  })

  it('displays duration in hours when > 60 minutes', async () => {
    mockSessionsGet.mockResolvedValue({
      ...mockSession,
      createdAt: '2025-01-01T00:00:00.000Z',
      endedAt: '2025-01-01T02:30:00.000Z',
    })
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('2h 30m')).toBeInTheDocument()
    })
  })
})
