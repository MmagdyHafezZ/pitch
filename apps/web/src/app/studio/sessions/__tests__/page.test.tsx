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

jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
  type: { Variants: {} },
}))

const mockFetchUserSessions = jest.fn()
const mockFetchUserTeams = jest.fn()
const mockStartTour = jest.fn()

jest.mock('@/features/auth', () => ({
  useAuth: () => ({ user: { id: 'user-1', name: 'Test User', email: 'test@example.com' } }),
}))

jest.mock('@/features/onboarding', () => ({
  useTour: () => ({ startTour: mockStartTour }),
}))

let mockSessions: any[] = []
let mockLoading = false

jest.mock('@/features/sessions', () => ({
  useSessions: () => ({
    sessions: mockSessions,
    loading: mockLoading,
    fetchUserSessions: mockFetchUserSessions,
  }),
}))

jest.mock('@/features/teams', () => ({
  useTeams: () => ({
    teams: [],
    fetchUserTeams: mockFetchUserTeams,
  }),
}))

jest.mock('@/features/i18n', () => ({
  useI18n: () => ({ tp: (s: string) => s, locale: 'en-US' }),
}))

import SessionsPage from '../page'

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

beforeEach(() => {
  jest.clearAllMocks()
  mockSessions = []
  mockLoading = false
  mockGet.mockReturnValue(null)
})

describe('SessionsPage', () => {
  it('renders a loader when sessions are loading', () => {
    mockLoading = true
    render(<SessionsPage />, { wrapper: Wrapper })
    expect(document.querySelector('.mantine-Loader-root')).toBeInTheDocument()
  })

  it('renders empty state when no sessions exist', () => {
    mockSessions = []
    render(<SessionsPage />, { wrapper: Wrapper })
    expect(screen.getByText('No sessions found')).toBeInTheDocument()
    expect(
      screen.getByText('Try adjusting your filters or create a new session.')
    ).toBeInTheDocument()
    expect(screen.getByText('Create a session')).toBeInTheDocument()
  })

  it('navigates to create session page when empty state button is clicked', async () => {
    const user = userEvent.setup()
    mockSessions = []
    render(<SessionsPage />, { wrapper: Wrapper })

    await user.click(screen.getByText('Create a session'))
    expect(mockPush).toHaveBeenCalledWith('/studio/sessions/create')
  })

  it('renders session cards when sessions exist', () => {
    mockSessions = [
      {
        id: 'sess-001',
        name: 'Sales Training',
        userId: 'user-1',
        orgId: 'user-1',
        type: 'text',
        tags: ['pitch', 'demo'],
        status: 'active',
        createdAt: '2025-01-15T10:00:00Z',
        updatedAt: '2025-01-15T10:00:00Z',
      },
      {
        id: 'sess-002',
        name: 'Cold Call Practice',
        userId: 'user-1',
        orgId: 'user-1',
        type: 'voice',
        tags: [],
        status: 'ended',
        createdAt: '2025-01-10T10:00:00Z',
        updatedAt: '2025-01-10T10:00:00Z',
      },
    ]
    render(<SessionsPage />, { wrapper: Wrapper })

    expect(screen.getByText('Sales Training')).toBeInTheDocument()
    expect(screen.getByText('Cold Call Practice')).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getByText('Ended')).toBeInTheDocument()
  })

  it('displays session type and tags as badges', () => {
    mockSessions = [
      {
        id: 'sess-001',
        name: 'Sales Training',
        userId: 'user-1',
        orgId: 'user-1',
        type: 'text',
        tags: ['pitch', 'demo'],
        status: 'active',
        createdAt: '2025-01-15T10:00:00Z',
        updatedAt: '2025-01-15T10:00:00Z',
      },
    ]
    render(<SessionsPage />, { wrapper: Wrapper })

    expect(screen.getByText('text')).toBeInTheDocument()
    expect(screen.getByText('pitch')).toBeInTheDocument()
    expect(screen.getByText('demo')).toBeInTheDocument()
  })

  it('falls back to truncated id when session has no name', () => {
    mockSessions = [
      {
        id: 'abcdefgh-1234-5678',
        name: null,
        userId: 'user-1',
        orgId: 'user-1',
        type: 'text',
        tags: [],
        status: 'active',
        createdAt: '2025-01-15T10:00:00Z',
        updatedAt: '2025-01-15T10:00:00Z',
      },
    ]
    render(<SessionsPage />, { wrapper: Wrapper })
    expect(screen.getByText('Session abcdefgh')).toBeInTheDocument()
  })

  it('navigates to session detail on card click', async () => {
    const user = userEvent.setup()
    mockSessions = [
      {
        id: 'sess-001',
        name: 'Sales Training',
        userId: 'user-1',
        orgId: 'user-1',
        type: 'text',
        tags: [],
        status: 'active',
        createdAt: '2025-01-15T10:00:00Z',
        updatedAt: '2025-01-15T10:00:00Z',
      },
    ]
    render(<SessionsPage />, { wrapper: Wrapper })

    await user.click(screen.getByText('Sales Training'))
    expect(mockPush).toHaveBeenCalledWith('/studio/sessions/sess-001')
  })

  it('fetches sessions and teams on mount', () => {
    render(<SessionsPage />, { wrapper: Wrapper })
    expect(mockFetchUserSessions).toHaveBeenCalledWith('user-1')
    expect(mockFetchUserTeams).toHaveBeenCalled()
  })

  it('shows Personal group header', () => {
    mockSessions = [
      {
        id: 'sess-001',
        name: 'My Session',
        userId: 'user-1',
        orgId: 'user-1',
        type: 'text',
        tags: [],
        status: 'active',
        createdAt: '2025-01-15T10:00:00Z',
        updatedAt: '2025-01-15T10:00:00Z',
      },
    ]
    render(<SessionsPage />, { wrapper: Wrapper })
    expect(screen.getByText(/Personal/)).toBeInTheDocument()
  })
})
