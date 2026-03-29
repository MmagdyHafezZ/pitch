/** @jest-environment jsdom */
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MantineProvider } from '@mantine/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const mockPush = jest.fn()
const mockGet = jest.fn().mockReturnValue(null)

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

const mockUser = { id: 'user-1', name: 'Jane Doe', email: 'jane@example.com' }
jest.mock('@/features/auth', () => ({
  useAuth: () => ({ user: mockUser }),
}))

const mockTeams = [
  {
    id: 'team-1',
    name: 'Alpha Team',
    memberships: [
      { userId: 'user-1', isActive: true },
      { userId: 'user-2', isActive: true },
      { userId: 'user-3', isActive: false },
    ],
  },
  {
    id: 'team-2',
    name: 'Beta Team',
    memberships: [{ userId: 'user-1', isActive: true }],
  },
]
const mockFetchUserTeams = jest.fn()

jest.mock('@/features/teams', () => ({
  useTeams: () => ({
    teams: mockTeams,
    fetchUserTeams: mockFetchUserTeams,
  }),
}))

const mockGetAllSessions = jest.fn()
jest.mock('@/lib/client', () => ({
  api: {
    sessions: {
      getAll: (...args: unknown[]) => mockGetAllSessions(...args),
    },
  },
}))

jest.mock('@mantine/charts', () => ({
  LineChart: (props: Record<string, unknown>) => <div data-testid="line-chart" data-h={props.h} />,
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

import DashboardHome from '../page'

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

const now = new Date()
const dayMs = 86400000

function makeSession(overrides: Record<string, unknown> = {}) {
  return {
    id: `sess-${Math.random().toString(36).slice(2, 10)}`,
    name: 'Mock Session',
    status: 'ended',
    type: 'voice',
    createdAt: new Date(now.getTime() - dayMs).toISOString(),
    endedAt: now.toISOString(),
    updatedAt: now.toISOString(),
    ...overrides,
  }
}

function makeSessions(count: number, overrides: Record<string, unknown> = {}) {
  return Array.from({ length: count }, (_, i) =>
    makeSession({ id: `sess-${i}`, name: `Session ${i}`, ...overrides })
  )
}

describe('DashboardHome', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetAllSessions.mockResolvedValue({ sessions: [] })
  })

  it('shows loading state initially', () => {
    mockGetAllSessions.mockReturnValue(new Promise(() => {}))
    const { container } = render(<DashboardHome />, { wrapper: createWrapper() })
    expect(container.querySelector('.mantine-Loader-root')).toBeInTheDocument()
  })

  it('renders welcome message with user first name', async () => {
    mockGetAllSessions.mockResolvedValue({ sessions: [] })
    render(<DashboardHome />, { wrapper: createWrapper() })
    await waitFor(() => {
      expect(screen.getByText(/Welcome back, Jane/)).toBeInTheDocument()
    })
  })

  it('shows error alert when session fetch fails', async () => {
    mockGetAllSessions.mockRejectedValue(new Error('Network error'))
    render(<DashboardHome />, { wrapper: createWrapper() })
    await waitFor(() => {
      expect(screen.getByText('Failed to load your session metrics.')).toBeInTheDocument()
    })
  })

  it('renders stat cards with correct values', async () => {
    const sessions = [
      ...makeSessions(3, { status: 'ended' }),
      ...makeSessions(2, { status: 'active' }),
    ]
    mockGetAllSessions.mockResolvedValue({ sessions })

    render(<DashboardHome />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText('Total sessions')).toBeInTheDocument()
    })

    const statGrid = screen.getByText('Total sessions').closest('[data-tour-id="home-analytics"]')!
    const totalCard = within(statGrid).getByText('Total sessions').closest('.mantine-Card-root')!
    expect(within(totalCard).getByText('5')).toBeInTheDocument()
    expect(screen.getByText('2 active, 3 completed')).toBeInTheDocument()
    expect(screen.getByText('60%')).toBeInTheDocument()
  })

  it('shows empty state for recent sessions when no sessions exist', async () => {
    mockGetAllSessions.mockResolvedValue({ sessions: [] })
    render(<DashboardHome />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(
        screen.getByText('No sessions yet. Start one to unlock personalized analytics.')
      ).toBeInTheDocument()
    })
  })

  it('renders recent sessions list', async () => {
    const sessions = makeSessions(3, { status: 'ended' })
    mockGetAllSessions.mockResolvedValue({ sessions })
    render(<DashboardHome />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText('Session 0')).toBeInTheDocument()
    })
    expect(screen.getByText('Session 1')).toBeInTheDocument()
    expect(screen.getByText('Session 2')).toBeInTheDocument()
  })

  it('navigates to create session on "Start session" click', async () => {
    const user = userEvent.setup()
    mockGetAllSessions.mockResolvedValue({ sessions: [] })
    render(<DashboardHome />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText('Start session')).toBeInTheDocument()
    })
    await user.click(screen.getByText('Start session'))
    expect(mockPush).toHaveBeenCalledWith('/studio/sessions/create')
  })

  it('navigates to sessions list on "View sessions" click', async () => {
    const user = userEvent.setup()
    mockGetAllSessions.mockResolvedValue({ sessions: [] })
    render(<DashboardHome />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText('View sessions')).toBeInTheDocument()
    })
    await user.click(screen.getByText('View sessions'))
    expect(mockPush).toHaveBeenCalledWith('/studio/sessions')
  })

  it('navigates to all sessions on "Open all sessions" click', async () => {
    const user = userEvent.setup()
    mockGetAllSessions.mockResolvedValue({ sessions: makeSessions(1) })
    render(<DashboardHome />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText('Open all sessions')).toBeInTheDocument()
    })
    await user.click(screen.getByText('Open all sessions'))
    expect(mockPush).toHaveBeenCalledWith('/studio/sessions')
  })

  it('navigates to session performance on session card click', async () => {
    const user = userEvent.setup()
    const sessions = [makeSession({ id: 'sess-abc', name: 'Clicked Session' })]
    mockGetAllSessions.mockResolvedValue({ sessions })
    render(<DashboardHome />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText('Clicked Session')).toBeInTheDocument()
    })
    await user.click(screen.getByText('Clicked Session'))
    expect(mockPush).toHaveBeenCalledWith('/session/sess-abc/performance')
  })

  it('renders weekly badges and streak info', async () => {
    const sessions = makeSessions(3, { status: 'ended' })
    mockGetAllSessions.mockResolvedValue({ sessions })
    render(<DashboardHome />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText(/sessions this week/)).toBeInTheDocument()
    })
    expect(screen.getByText(/teams/)).toBeInTheDocument()
    expect(screen.getByText(/day streak/i)).toBeInTheDocument()
  })

  it('renders team snapshot cards', async () => {
    mockGetAllSessions.mockResolvedValue({ sessions: [] })
    render(<DashboardHome />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText('Team snapshot')).toBeInTheDocument()
    })
    expect(screen.getByText('Alpha Team')).toBeInTheDocument()
    expect(screen.getByText('Beta Team')).toBeInTheDocument()
  })

  it('renders session momentum chart', async () => {
    mockGetAllSessions.mockResolvedValue({ sessions: makeSessions(2) })
    render(<DashboardHome />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText('Session momentum')).toBeInTheDocument()
    })
    expect(screen.getByTestId('line-chart')).toBeInTheDocument()
  })

  it('renders practice activity map', async () => {
    mockGetAllSessions.mockResolvedValue({ sessions: makeSessions(2) })
    render(<DashboardHome />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText('Practice activity map')).toBeInTheDocument()
    })
    expect(screen.getByText(/Goal progress this week/)).toBeInTheDocument()
  })

  it('navigates to team-config on "Manage teams" click', async () => {
    const user = userEvent.setup()
    mockGetAllSessions.mockResolvedValue({ sessions: [] })
    render(<DashboardHome />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText('Manage teams')).toBeInTheDocument()
    })
    await user.click(screen.getByText('Manage teams'))
    expect(mockPush).toHaveBeenCalledWith('/studio/team-config')
  })

  it('fetches user sessions with correct params', async () => {
    mockGetAllSessions.mockResolvedValue({ sessions: [] })
    render(<DashboardHome />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(mockGetAllSessions).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-1', limit: 400, offset: 0 })
      )
    })
  })

  it('fetches team sessions for each team', async () => {
    mockGetAllSessions.mockResolvedValue({ sessions: [] })
    render(<DashboardHome />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(mockGetAllSessions).toHaveBeenCalledWith(expect.objectContaining({ orgId: 'team-1' }))
      expect(mockGetAllSessions).toHaveBeenCalledWith(expect.objectContaining({ orgId: 'team-2' }))
    })
  })

  it('shows session status badge colors correctly', async () => {
    const sessions = [
      makeSession({ id: 'ended-1', name: 'Ended One', status: 'ended' }),
      makeSession({ id: 'active-1', name: 'Active One', status: 'active' }),
    ]
    mockGetAllSessions.mockResolvedValue({ sessions })
    render(<DashboardHome />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText('Ended One')).toBeInTheDocument()
    })
    expect(screen.getByText('Active One')).toBeInTheDocument()
    expect(screen.getByText('ended')).toBeInTheDocument()
    expect(screen.getByText('active')).toBeInTheDocument()
  })

  it('shows latest session name at the bottom', async () => {
    const sessions = [
      makeSession({
        id: 'old',
        name: 'Old Session',
        createdAt: new Date(now.getTime() - 2 * dayMs).toISOString(),
      }),
      makeSession({
        id: 'new',
        name: 'Newest Session',
        createdAt: now.toISOString(),
      }),
    ]
    mockGetAllSessions.mockResolvedValue({ sessions })
    render(<DashboardHome />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText(/Latest: Newest Session/)).toBeInTheDocument()
    })
  })

  it('truncates session name to ID prefix when name is empty', async () => {
    const sessions = [makeSession({ id: 'abcdef12-rest', name: '' })]
    mockGetAllSessions.mockResolvedValue({ sessions })
    render(<DashboardHome />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText('Session abcdef12')).toBeInTheDocument()
    })
  })

  it('shows completion rate as 0% when no sessions', async () => {
    mockGetAllSessions.mockResolvedValue({ sessions: [] })
    render(<DashboardHome />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText('Completion rate')).toBeInTheDocument()
    })
    expect(screen.getByText('0%')).toBeInTheDocument()
  })

  it('limits recent sessions list to 6', async () => {
    const sessions = makeSessions(10)
    mockGetAllSessions.mockResolvedValue({ sessions })
    render(<DashboardHome />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText('Session 0')).toBeInTheDocument()
    })
    expect(screen.queryByText('Session 7')).not.toBeInTheDocument()
  })
})
