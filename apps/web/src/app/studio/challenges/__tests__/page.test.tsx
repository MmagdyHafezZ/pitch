/** @jest-environment jsdom */
import { render, screen, waitFor } from '@testing-library/react'
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

const mockFetch = jest.fn()
const mockParticipate = jest.fn()
const mockTimeLeft = jest.fn().mockReturnValue('2h 30m left')

let mockChallenges: any[] = []
let mockLoading = false
let mockError: string | null = null

jest.mock('@/features/challenges', () => ({
  useChallenges: () => ({
    challenges: mockChallenges,
    loading: mockLoading,
    error: mockError,
    fetch: mockFetch,
    participate: mockParticipate,
    timeLeft: mockTimeLeft,
  }),
}))

const mockStartTour = jest.fn()

jest.mock('@/features/onboarding', () => ({
  useTour: () => ({ startTour: mockStartTour }),
}))

jest.mock('@/features/auth', () => ({
  useAuth: () => ({ user: { id: 'user-1', name: 'Test User', email: 'test@example.com' } }),
}))

jest.mock('@/features/i18n', () => ({
  useI18n: () => ({ tp: (s: string) => s, locale: 'en-US' }),
}))

jest.mock('@/lib/client', () => ({
  api: {
    challenges: {
      adminGenerate: jest.fn().mockResolvedValue({}),
      get: jest.fn().mockResolvedValue({
        scenarioPrompt: 'mock scenario',
        evaluatorPersonaPrompt: 'mock persona',
      }),
    },
    sessions: {
      create: jest.fn().mockResolvedValue({ id: 'new-session-id' }),
    },
  },
}))

import ChallengesPage from '../page'

const qc = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
})

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={qc}>
      <MantineProvider>{children}</MantineProvider>
    </QueryClientProvider>
  )
}

const makeChallenges = (overrides: Partial<any>[] = []) => {
  const base = {
    id: 'ch-1',
    period: 'DAILY' as const,
    difficulty: 'BEGINNER' as const,
    status: 'ACTIVE' as const,
    title: 'Sell the Pen',
    description: 'Convince a prospect to buy an ordinary pen.',
    topic: 'Objection Handling',
    startsAt: '2025-01-01T00:00:00Z',
    expiresAt: '2025-12-31T23:59:59Z',
    participationCount: 42,
    myParticipation: null,
  }
  if (overrides.length === 0) return [base]
  return overrides.map((o, i) => ({ ...base, id: `ch-${i + 1}`, ...o }))
}

beforeEach(() => {
  jest.clearAllMocks()
  mockChallenges = []
  mockLoading = false
  mockError = null
  mockGet.mockReturnValue(null)
})

describe('ChallengesPage', () => {
  it('shows a loader when loading', () => {
    mockLoading = true
    render(<ChallengesPage />, { wrapper: Wrapper })
    expect(document.querySelector('.mantine-Loader-root')).toBeInTheDocument()
  })

  it('shows error message when there is an error', () => {
    mockError = 'Something went wrong'
    render(<ChallengesPage />, { wrapper: Wrapper })
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
  })

  it('shows empty state when no challenges exist', () => {
    mockChallenges = []
    render(<ChallengesPage />, { wrapper: Wrapper })
    expect(screen.getByText('No active challenges right now. Check back soon!')).toBeInTheDocument()
  })

  it('renders the page header with title and buttons', () => {
    mockChallenges = []
    render(<ChallengesPage />, { wrapper: Wrapper })
    expect(screen.getByText('Public Challenges')).toBeInTheDocument()
    expect(screen.getByText('Generate Daily')).toBeInTheDocument()
  })

  it('renders challenge cards grouped by difficulty', () => {
    mockChallenges = makeChallenges([
      { difficulty: 'BEGINNER', title: 'Beginner Challenge' },
      { difficulty: 'EXPERT', title: 'Expert Challenge' },
    ])
    render(<ChallengesPage />, { wrapper: Wrapper })

    expect(screen.getByText('Beginner Challenge')).toBeInTheDocument()
    expect(screen.getByText('Expert Challenge')).toBeInTheDocument()
    expect(screen.getAllByText('BEGINNER').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('EXPERT').length).toBeGreaterThanOrEqual(1)
  })

  it('displays challenge description and topic', () => {
    mockChallenges = makeChallenges([
      { description: 'Practice cold calls', topic: 'Sales Techniques' },
    ])
    render(<ChallengesPage />, { wrapper: Wrapper })

    expect(screen.getByText('Practice cold calls')).toBeInTheDocument()
    expect(screen.getByText('Sales Techniques')).toBeInTheDocument()
  })

  it('displays participation count and time left', () => {
    mockChallenges = makeChallenges([{ participationCount: 99 }])
    render(<ChallengesPage />, { wrapper: Wrapper })

    expect(screen.getByText('99')).toBeInTheDocument()
    expect(screen.getByText('2h 30m left')).toBeInTheDocument()
  })

  it('shows Accept Challenge button for unparticipated challenges', () => {
    mockChallenges = makeChallenges([{ myParticipation: null }])
    render(<ChallengesPage />, { wrapper: Wrapper })

    expect(screen.getByText('Accept Challenge')).toBeInTheDocument()
  })

  it('shows Continue button for in-progress challenges', () => {
    mockChallenges = makeChallenges([
      { myParticipation: { sessionId: 'sess-1', score: null, completedAt: null } },
    ])
    render(<ChallengesPage />, { wrapper: Wrapper })

    expect(screen.getByText('Continue')).toBeInTheDocument()
    expect(screen.getByText('In Progress')).toBeInTheDocument()
  })

  it('shows View Result button for completed challenges', () => {
    mockChallenges = makeChallenges([
      {
        myParticipation: {
          sessionId: 'sess-1',
          score: 85.5,
          completedAt: '2025-06-01T00:00:00Z',
        },
      },
    ])
    render(<ChallengesPage />, { wrapper: Wrapper })

    expect(screen.getByText('View Result')).toBeInTheDocument()
    expect(screen.getByText('Completed')).toBeInTheDocument()
    expect(screen.getByText('85.5')).toBeInTheDocument()
  })

  it('navigates to session detail when View Result is clicked', async () => {
    const user = userEvent.setup()
    mockChallenges = makeChallenges([
      {
        myParticipation: {
          sessionId: 'sess-1',
          score: 90,
          completedAt: '2025-06-01T00:00:00Z',
        },
      },
    ])
    render(<ChallengesPage />, { wrapper: Wrapper })

    await user.click(screen.getByText('View Result'))
    expect(mockPush).toHaveBeenCalledWith('/studio/sessions/sess-1')
  })

  it('navigates to live session when Continue is clicked', async () => {
    const user = userEvent.setup()
    mockChallenges = makeChallenges([
      { myParticipation: { sessionId: 'sess-1', score: null, completedAt: null } },
    ])
    render(<ChallengesPage />, { wrapper: Wrapper })

    await user.click(screen.getByText('Continue'))
    expect(mockPush).toHaveBeenCalledWith('/session/sess-1')
  })

  it('fetches challenges on mount', () => {
    render(<ChallengesPage />, { wrapper: Wrapper })
    expect(mockFetch).toHaveBeenCalledWith(undefined, undefined)
  })

  it('shows difficulty group count', () => {
    mockChallenges = makeChallenges([
      { difficulty: 'BEGINNER', title: 'A' },
      { difficulty: 'BEGINNER', title: 'B' },
    ])
    render(<ChallengesPage />, { wrapper: Wrapper })

    expect(screen.getByText('2 challenges')).toBeInTheDocument()
  })

  it('does not render empty difficulty groups', () => {
    mockChallenges = makeChallenges([{ difficulty: 'BEGINNER' }])
    render(<ChallengesPage />, { wrapper: Wrapper })

    expect(screen.queryByText('MASTER')).not.toBeInTheDocument()
    expect(screen.queryByText('EXPERT')).not.toBeInTheDocument()
    expect(screen.queryByText('INTERMEDIATE')).not.toBeInTheDocument()
  })
})
