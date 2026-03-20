/**
 * @jest-environment jsdom
 */
import { render, screen, waitFor } from '@/__tests__/utils/test-utils'
import userEvent from '@testing-library/user-event'
import { QueryClient } from '@tanstack/react-query'
import CreateSessionPage from '../page'

// Mock next/navigation
const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
  usePathname: () => '/studio/sessions/create',
  useSearchParams: () => new URLSearchParams(),
}))

// Mock auth hook
jest.mock('@/features/auth', () => ({
  useAuth: () => ({
    user: {
      id: 'user_123',
      email: 'test@example.com',
      name: 'Test User',
      isActive: true,
    },
    isAuthenticated: true,
    isLoading: false,
    error: null,
    token: 'mock-jwt-token',
    login: jest.fn(),
    logout: jest.fn(),
    register: jest.fn(),
    setUser: jest.fn(),
    setToken: jest.fn(),
    refreshAccessToken: jest.fn(),
    initializeAuth: jest.fn(),
  }),
}))

// Mock teams hook
jest.mock('@/features/teams', () => ({
  useTeams: () => ({
    teams: [
      {
        id: 'team_1',
        name: 'Test Team',
        orgId: 'org_123',
      },
    ],
    activeTeamId: 'team_1',
    fetchUserTeams: jest.fn(),
    loading: false,
    error: null,
  }),
}))

// Mock sessions hook
jest.mock('@/features/sessions', () => ({
  ...jest.requireActual('@/features/sessions'),
  useSessions: () => ({
    sessions: [],
    createSession: jest.fn().mockResolvedValue({
      id: 'session_123',
      name: 'Test Session',
    }),
    loading: false,
    error: null,
  }),
}))

// Mock TTS providers hook
jest.mock('@/features/tts', () => ({
  useTtsProviders: () => ({
    providers: [
      {
        name: 'elevenlabs',
        description: 'ElevenLabs',
        voices: ['Rachel', 'Adam'],
        models: [],
      },
    ],
    loading: false,
    error: null,
  }),
}))

describe('CreateSessionWizard - Navigation', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    mockPush.mockClear()
  })

  const renderWizard = () => {
    return render(<CreateSessionPage />, { queryClient })
  }

  it('renders the wizard with all steps in stepper', async () => {
    renderWizard()

    await waitFor(() => {
      expect(screen.getByText('Basics')).toBeInTheDocument()
    })

    expect(screen.getByText('Scenario')).toBeInTheDocument()
    expect(screen.getByText('Persona')).toBeInTheDocument()
    expect(screen.getByText('AI Brain')).toBeInTheDocument()
    expect(screen.getByText('CRM')).toBeInTheDocument()
    expect(screen.getByText('Style')).toBeInTheDocument()
    expect(screen.getByText('Review')).toBeInTheDocument()
  })

  it('starts at step 0 (Basics)', async () => {
    renderWizard()

    await waitFor(() => {
      expect(screen.getByText('Pick a session type')).toBeInTheDocument()
    })

    expect(screen.getByText('Session Name')).toBeInTheDocument()
  })

  it('disables "Next" button and shows error when session type not selected', async () => {
    renderWizard()
    const user = userEvent.setup()

    await waitFor(() => {
      const nextButton = screen.getByRole('button', { name: /next/i })
      expect(nextButton).toBeInTheDocument()
    })

    const nextButton = screen.getByRole('button', { name: /next/i })
    await user.click(nextButton)

    // Should show error
    await waitFor(() => {
      expect(screen.getByText(/session type is required/i)).toBeInTheDocument()
    })

    // Should still be on Basic Info step
    expect(screen.getByText('Session Name')).toBeInTheDocument()
  })

  it('does not show a phone number field during phone-call setup', async () => {
    renderWizard()
    const user = userEvent.setup()

    await waitFor(() => {
      expect(screen.getByText('Pick a session type')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Phone calls'))

    expect(screen.queryByText('Phone Number')).not.toBeInTheDocument()
    expect(
      screen.getByText(/phone number is collected when the session starts/i)
    ).toBeInTheDocument()
  })

  it('prevents jumping ahead with the stepper when basics is invalid', async () => {
    renderWizard()
    const user = userEvent.setup()

    await waitFor(() => {
      expect(screen.getByText('Pick a session type')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /scenario/i }))

    await waitFor(() => {
      expect(screen.getByText(/session type is required/i)).toBeInTheDocument()
    })

    expect(screen.getByText('Pick a session type')).toBeInTheDocument()
    expect(screen.queryByText('Choose a Scenario')).not.toBeInTheDocument()
  })

  it('advances to step 1 (Scenario) when session type is selected', async () => {
    renderWizard()
    const user = userEvent.setup()

    await waitFor(() => {
      expect(screen.getByText('Pick a session type')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Text'))

    // Click Next
    const nextButton = screen.getByRole('button', { name: /next/i })
    await user.click(nextButton)

    // Should advance to Scenario step
    await waitFor(
      () => {
        expect(screen.getByText('Choose a Scenario')).toBeInTheDocument()
      },
      { timeout: 3000 }
    )
  })

  it('disables "Back" button on first step', async () => {
    renderWizard()

    await waitFor(() => {
      const backButton = screen.getByRole('button', { name: /back/i })
      expect(backButton).toBeDisabled()
    })
  })

  it('enables "Back" button on subsequent steps', async () => {
    renderWizard()
    const user = userEvent.setup()

    // Navigate to step 1
    await waitFor(() => {
      expect(screen.getByText('Pick a session type')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Text'))
    await user.click(screen.getByRole('button', { name: /next/i }))

    await waitFor(() => {
      expect(screen.getByText('Choose a Scenario')).toBeInTheDocument()
    })

    // Back button should be enabled
    const backButton = screen.getByRole('button', { name: /back/i })
    expect(backButton).not.toBeDisabled()

    // Click back
    await user.click(backButton)

    // Should return to step 0
    await waitFor(() => {
      expect(screen.getByText('Pick a session type')).toBeInTheDocument()
    })
  })
})
