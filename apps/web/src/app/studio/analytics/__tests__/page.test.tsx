/** @jest-environment jsdom */
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MantineProvider } from '@mantine/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const mockPush = jest.fn()
let mockTabParam: string | null = 'Personal'
const mockGet = jest.fn((key: string) => {
  if (key === 'tab') return mockTabParam
  return null
})

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn() }),
  useSearchParams: () => ({
    get: mockGet,
    toString: jest.fn().mockReturnValue(''),
  }),
  useParams: () => ({ id: 'test-id' }),
}))

const mockStartTour = jest.fn().mockResolvedValue(undefined)
jest.mock('@/features/onboarding', () => ({
  useTour: () => ({ startTour: mockStartTour }),
}))

let mockUser: Record<string, unknown> | null = {
  id: 'user-1',
  name: 'Jane Doe',
  email: 'jane@example.com',
}
jest.mock('@/features/auth', () => ({
  useAuth: () => ({ user: mockUser }),
}))

let mockTeams: Record<string, unknown>[] = []
const mockFetchUserTeams = jest.fn()
jest.mock('@/features/teams', () => ({
  useTeams: () => ({
    teams: mockTeams,
    fetchUserTeams: mockFetchUserTeams,
  }),
}))

const mockGetDashboard = jest.fn()
jest.mock('@/lib/client', () => ({
  api: {
    analytics: {
      getDashboard: (...args: unknown[]) => mockGetDashboard(...args),
    },
  },
}))

jest.mock('@mantine/charts', () => ({
  LineChart: (props: Record<string, unknown>) => <div data-testid="line-chart" data-h={props.h} />,
  BarChart: (props: Record<string, unknown>) => (
    <div data-testid="bar-chart" data-key={props.dataKey} />
  ),
  DonutChart: (props: Record<string, unknown>) => (
    <div data-testid="donut-chart" data-label={props.chartLabel} />
  ),
}))

jest.mock(
  '@tabler/icons-react',
  () =>
    new Proxy(
      {},
      {
        get: (_target, prop: string) => {
          if (prop === '__esModule') return true
          return function MockIcon(props: Record<string, unknown>) {
            return <span data-testid={`icon-${prop}`} {...props} />
          }
        },
      }
    )
)

import AnalyticsPage from '../page'

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={qc}>
        <MantineProvider>{children}</MantineProvider>
      </QueryClientProvider>
    )
  }
}

function makeDashboardSession(overrides: Record<string, unknown> = {}) {
  return {
    id: `sess-${Math.random().toString(36).slice(2, 10)}`,
    name: 'Mock Session',
    type: 'voice',
    status: 'ended',
    createdAt: '2025-11-15T10:00:00Z',
    endedAt: '2025-11-15T10:30:00Z',
    runId: null,
    totalScore: 8.5,
    scoreBreakdown: { empathy: 7, clarity: 9, persuasion: 10 },
    ...overrides,
  }
}

function makeDashboardResponse(sessions: Record<string, unknown>[] = []) {
  return { sessions }
}

describe('AnalyticsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockTabParam = 'Personal'
    mockUser = { id: 'user-1', name: 'Jane Doe', email: 'jane@example.com' }
    mockTeams = []
    mockGetDashboard.mockResolvedValue(makeDashboardResponse([]))
  })

  // ── Loading & Error States ──────────────────────────────────────────

  it('shows skeleton loaders while loading', () => {
    mockGetDashboard.mockReturnValue(new Promise(() => {}))
    const { container } = render(<AnalyticsPage />, { wrapper: createWrapper() })
    const skeletons = container.querySelectorAll('.mantine-Skeleton-root')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('shows error alert when API call fails', async () => {
    mockGetDashboard.mockRejectedValue(new Error('fail'))
    render(<AnalyticsPage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(
        screen.getByText('Unable to load your analytics. Please try again.')
      ).toBeInTheDocument()
    })
  })

  // ── Personal Tab: Empty State ───────────────────────────────────────

  it('shows empty state when no sessions exist', async () => {
    mockGetDashboard.mockResolvedValue(makeDashboardResponse([]))
    render(<AnalyticsPage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText('No sessions found')).toBeInTheDocument()
    })
    expect(
      screen.getByText(/Complete a practice session and it will automatically appear/)
    ).toBeInTheDocument()
  })

  it('navigates to sessions from empty state button', async () => {
    const user = userEvent.setup()
    mockGetDashboard.mockResolvedValue(makeDashboardResponse([]))
    render(<AnalyticsPage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText('Go to sessions')).toBeInTheDocument()
    })
    await user.click(screen.getByText('Go to sessions'))
    expect(mockPush).toHaveBeenCalledWith('/studio/sessions')
  })

  // ── Personal Tab: With Data ─────────────────────────────────────────

  it('renders KPI cards with correct values', async () => {
    const sessions = [
      makeDashboardSession({ id: 's1', totalScore: 10 }),
      makeDashboardSession({ id: 's2', totalScore: 6 }),
      makeDashboardSession({ id: 's3', totalScore: null, status: 'active' }),
    ]
    mockGetDashboard.mockResolvedValue(makeDashboardResponse(sessions))
    render(<AnalyticsPage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText('Total sessions')).toBeInTheDocument()
    })

    const kpiGrid = screen.getByText('Total sessions').closest('[data-tour-id="analytics-kpis"]')!
    const totalCard = within(kpiGrid).getByText('Total sessions').closest('.mantine-Card-root')!
    expect(within(totalCard).getByText('3')).toBeInTheDocument()
    expect(screen.getByText('2 assessed')).toBeInTheDocument()
    expect(screen.getByText('2 scored sessions')).toBeInTheDocument()
    expect(screen.getByText('Personal best')).toBeInTheDocument()
  })

  it('renders session history table', async () => {
    const sessions = [
      makeDashboardSession({ id: 's1', name: 'Interview Prep' }),
      makeDashboardSession({ id: 's2', name: 'Sales Pitch' }),
    ]
    mockGetDashboard.mockResolvedValue(makeDashboardResponse(sessions))
    render(<AnalyticsPage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText('Session history')).toBeInTheDocument()
    })
    expect(screen.getByText('Interview Prep')).toBeInTheDocument()
    expect(screen.getByText('Sales Pitch')).toBeInTheDocument()
  })

  it('renders score trend chart when multiple months of data', async () => {
    const sessions = [
      makeDashboardSession({ id: 's1', endedAt: '2025-09-15T10:00:00Z', totalScore: 5 }),
      makeDashboardSession({ id: 's2', endedAt: '2025-10-15T10:00:00Z', totalScore: 8 }),
    ]
    mockGetDashboard.mockResolvedValue(makeDashboardResponse(sessions))
    render(<AnalyticsPage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText('Score trend')).toBeInTheDocument()
    })
    expect(screen.getByTestId('line-chart')).toBeInTheDocument()
  })

  it('shows "Keep going" when only one month of data', async () => {
    const sessions = [
      makeDashboardSession({ id: 's1', endedAt: '2025-11-15T10:00:00Z', totalScore: 5 }),
    ]
    mockGetDashboard.mockResolvedValue(makeDashboardResponse(sessions))
    render(<AnalyticsPage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText(/Keep going/)).toBeInTheDocument()
    })
  })

  it('renders session types donut chart', async () => {
    const sessions = [
      makeDashboardSession({ id: 's1', type: 'voice' }),
      makeDashboardSession({ id: 's2', type: 'text' }),
    ]
    mockGetDashboard.mockResolvedValue(makeDashboardResponse(sessions))
    render(<AnalyticsPage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText('Session types')).toBeInTheDocument()
    })
    expect(screen.getByTestId('donut-chart')).toBeInTheDocument()
  })

  it('renders competency breakdown bar chart', async () => {
    const sessions = [
      makeDashboardSession({
        id: 's1',
        scoreBreakdown: { empathy: 7, clarity: 9 },
      }),
    ]
    mockGetDashboard.mockResolvedValue(makeDashboardResponse(sessions))
    render(<AnalyticsPage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText('Competency breakdown')).toBeInTheDocument()
    })
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument()
  })

  it('navigates to session performance from View button', async () => {
    const user = userEvent.setup()
    const sessions = [makeDashboardSession({ id: 'sess-xyz', name: 'Test' })]
    mockGetDashboard.mockResolvedValue(makeDashboardResponse(sessions))
    render(<AnalyticsPage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText('Session history')).toBeInTheDocument()
    })

    const viewButton = screen.getByRole('button', { name: /View/ })
    await user.click(viewButton)
    expect(mockPush).toHaveBeenCalledWith('/session/sess-xyz/performance')
  })

  it('appends runId to performance URL when present', async () => {
    const user = userEvent.setup()
    const sessions = [makeDashboardSession({ id: 'sess-xyz', name: 'Test', runId: 'run-123' })]
    mockGetDashboard.mockResolvedValue(makeDashboardResponse(sessions))
    render(<AnalyticsPage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText('Session history')).toBeInTheDocument()
    })

    const viewButton = screen.getByRole('button', { name: /View/ })
    await user.click(viewButton)
    expect(mockPush).toHaveBeenCalledWith('/session/sess-xyz/performance?runId=run-123')
  })

  it('shows "No sessions match your filters" for empty filter result', async () => {
    const sessions = [makeDashboardSession({ id: 's1', name: 'Alpha' })]
    mockGetDashboard.mockResolvedValue(makeDashboardResponse(sessions))
    const user = userEvent.setup()
    render(<AnalyticsPage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText('Session history')).toBeInTheDocument()
    })

    const searchInput = screen.getByPlaceholderText('Search sessions…')
    await user.type(searchInput, 'xyznotfound')

    await waitFor(() => {
      expect(screen.getByText('No sessions match your filters.')).toBeInTheDocument()
    })
  })

  it('filters sessions by text search', async () => {
    const sessions = [
      makeDashboardSession({ id: 's1', name: 'Alpha Session' }),
      makeDashboardSession({ id: 's2', name: 'Beta Session' }),
    ]
    mockGetDashboard.mockResolvedValue(makeDashboardResponse(sessions))
    const user = userEvent.setup()
    render(<AnalyticsPage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText('Alpha Session')).toBeInTheDocument()
    })

    const searchInput = screen.getByPlaceholderText('Search sessions…')
    await user.type(searchInput, 'Alpha')

    await waitFor(() => {
      expect(screen.getByText('Alpha Session')).toBeInTheDocument()
      expect(screen.queryByText('Beta Session')).not.toBeInTheDocument()
    })
  })

  it('shows dash for sessions without a score', async () => {
    const sessions = [makeDashboardSession({ id: 's1', name: 'Unscored', totalScore: null })]
    mockGetDashboard.mockResolvedValue(makeDashboardResponse(sessions))
    render(<AnalyticsPage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText('Unscored')).toBeInTheDocument()
    })

    const dashElements = screen.getAllByText('—')
    expect(dashElements.length).toBeGreaterThan(0)
  })

  it('calls getDashboard with user ID', async () => {
    mockGetDashboard.mockResolvedValue(makeDashboardResponse([]))
    render(<AnalyticsPage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(mockGetDashboard).toHaveBeenCalledWith('user-1')
    })
  })

  // ── Team Tab ────────────────────────────────────────────────────────

  it('shows non-manager message when user has no managed teams', async () => {
    mockTabParam = 'Team'
    mockTeams = [
      {
        id: 'team-1',
        name: 'ViewOnly Team',
        memberships: [{ userId: 'user-1', role: 'MEMBER', user: mockUser }],
      },
    ]
    mockGetDashboard.mockResolvedValue(makeDashboardResponse([]))
    render(<AnalyticsPage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText('Team analytics')).toBeInTheDocument()
    })
    expect(
      screen.getByText('You need to be a team owner or admin to view team analytics.')
    ).toBeInTheDocument()
  })

  it('shows "No team members found" when team has no other members', async () => {
    mockTabParam = 'Team'
    mockTeams = [
      {
        id: 'team-1',
        name: 'Solo Team',
        memberships: [{ userId: 'user-1', role: 'OWNER', user: mockUser }],
      },
    ]
    mockGetDashboard.mockResolvedValue(makeDashboardResponse([]))
    render(<AnalyticsPage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText('No team members found')).toBeInTheDocument()
    })
  })

  it('renders team KPI cards and leaderboard', async () => {
    mockTabParam = 'Team'
    const member2 = { id: 'user-2', name: 'Bob Smith', email: 'bob@example.com' }
    mockTeams = [
      {
        id: 'team-1',
        name: 'Dev Team',
        memberships: [
          { userId: 'user-1', role: 'OWNER', user: mockUser },
          { userId: 'user-2', role: 'MEMBER', user: member2 },
        ],
      },
    ]
    mockGetDashboard.mockImplementation((userId: string) => {
      if (userId === 'user-1') return Promise.resolve(makeDashboardResponse([]))
      if (userId === 'user-2')
        return Promise.resolve(
          makeDashboardResponse([
            makeDashboardSession({ id: 'ms1', totalScore: 12 }),
            makeDashboardSession({ id: 'ms2', totalScore: 8 }),
          ])
        )
      return Promise.resolve(makeDashboardResponse([]))
    })

    render(<AnalyticsPage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText('Members')).toBeInTheDocument()
    })

    expect(screen.getByText('Team avg score')).toBeInTheDocument()
    expect(screen.getByText('Top performer')).toBeInTheDocument()
    expect(screen.getByText('Total sessions')).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText('Team leaderboard')).toBeInTheDocument()
    })
  })

  it('renders member detail cards with session info', async () => {
    mockTabParam = 'Team'
    const member2 = { id: 'user-2', name: 'Alice Johnson', email: 'alice@test.com' }
    mockTeams = [
      {
        id: 'team-1',
        name: 'Sales Team',
        memberships: [
          { userId: 'user-1', role: 'ADMIN', user: mockUser },
          { userId: 'user-2', role: 'MEMBER', user: member2 },
        ],
      },
    ]
    mockGetDashboard.mockImplementation((userId: string) => {
      if (userId === 'user-1') return Promise.resolve(makeDashboardResponse([]))
      return Promise.resolve(
        makeDashboardResponse([
          makeDashboardSession({ id: 'ms1', name: 'Session A', totalScore: 10 }),
        ])
      )
    })

    render(<AnalyticsPage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText('Alice Johnson')).toBeInTheDocument()
    })
    expect(screen.getByText('alice@test.com')).toBeInTheDocument()
  })

  it('shows team loading skeleton', () => {
    mockTabParam = 'Team'
    mockTeams = [
      {
        id: 'team-1',
        name: 'Team',
        memberships: [
          { userId: 'user-1', role: 'OWNER', user: mockUser },
          {
            userId: 'user-2',
            role: 'MEMBER',
            user: { id: 'user-2', name: 'Bob', email: 'bob@x.com' },
          },
        ],
      },
    ]
    mockGetDashboard.mockImplementation((userId: string) => {
      if (userId === 'user-1') return Promise.resolve(makeDashboardResponse([]))
      return new Promise(() => {})
    })

    const { container } = render(<AnalyticsPage />, { wrapper: createWrapper() })

    const skeletons = container.querySelectorAll('.mantine-Skeleton-root')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  // ── Session type display ────────────────────────────────────────────

  it('displays session type badges in the table', async () => {
    const sessions = [
      makeDashboardSession({ id: 's1', name: 'Voice Call', type: 'voice' }),
      makeDashboardSession({ id: 's2', name: 'Text Chat', type: 'text' }),
    ]
    mockGetDashboard.mockResolvedValue(makeDashboardResponse(sessions))
    render(<AnalyticsPage />, { wrapper: createWrapper() })

    await waitFor(() => {
      const voiceElements = screen.getAllByText('voice')
      expect(voiceElements.length).toBeGreaterThanOrEqual(1)
      const textElements = screen.getAllByText('text')
      expect(textElements.length).toBeGreaterThanOrEqual(1)
    })
  })

  it('shows positive score with plus sign', async () => {
    const sessions = [makeDashboardSession({ id: 's1', name: 'Good', totalScore: 15 })]
    mockGetDashboard.mockResolvedValue(makeDashboardResponse(sessions))
    render(<AnalyticsPage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText('+15')).toBeInTheDocument()
    })
  })
})
