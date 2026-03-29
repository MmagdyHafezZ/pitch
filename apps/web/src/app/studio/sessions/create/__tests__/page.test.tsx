/** @jest-environment jsdom */
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MantineProvider } from '@mantine/core'

let mockPush: jest.Mock
let mockCreateSession: jest.Mock
let mockFetchUserTeams: jest.Mock
let mockFetchCrmStatus: jest.Mock
let mockNotificationsShow: jest.Mock

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: (...a: any[]) => mockPush(...a),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
  usePathname: () => '/studio/sessions/create',
  useSearchParams: () => new URLSearchParams(),
}))

jest.mock('next/font/google', () => ({
  Space_Grotesk: () => ({ className: 'sg' }),
  Fraunces: () => ({ className: 'fr' }),
}))

jest.mock('@mantine/notifications', () => ({
  notifications: { show: (...a: any[]) => mockNotificationsShow(...a) },
}))

jest.mock('@mantine/hooks', () => ({
  ...jest.requireActual('@mantine/hooks'),
  useMediaQuery: () => false,
}))

jest.mock('@/features/auth', () => ({
  useAuth: () => ({
    user: { id: 'user_1', email: 'u@test.com', name: 'User' },
    isAuthenticated: true,
  }),
}))

jest.mock('@/features/i18n', () => ({
  useI18n: () => ({ locale: 'en-US' }),
}))

jest.mock('@/features/onboarding', () => ({
  useTour: () => ({ startTour: jest.fn() }),
}))

jest.mock('@/features/teams', () => ({
  useTeams: () => ({
    teams: [{ id: 'team_1', name: 'Team A', orgId: 'org_1' }],
    activeTeamId: 'team_1',
    fetchUserTeams: (...a: any[]) => mockFetchUserTeams(...a),
    loading: false,
  }),
}))

jest.mock('@/features/sessions', () => ({
  ...jest.requireActual('@/features/sessions'),
  useSessions: () => ({
    sessions: [],
    createSession: (...a: any[]) => mockCreateSession(...a),
    loading: false,
    error: null,
  }),
}))

jest.mock('@/features/tts', () => ({
  useTtsProviders: () => ({
    providers: [{ name: 'elevenlabs', description: 'ElevenLabs', voices: ['Rachel'], models: [] }],
    loading: false,
  }),
}))

jest.mock('@/features/sessions/hooks/useLLMProviders', () => ({
  useLLMProviders: () => ({
    data: {
      providers: [
        {
          name: 'openai',
          enabled: true,
          models: ['gpt-4o'],
          modelDetails: [
            {
              name: 'gpt-4o',
              pricing: { inputTokensPerMillion: 5, outputTokensPerMillion: 15 },
              maxTokens: 128000,
              maxOutputTokens: 4096,
              supportsStreaming: true,
              supportsTools: true,
              supportsVision: true,
              supportsAudio: false,
              supportedModalities: ['text', 'image'],
            },
          ],
        },
      ],
    },
    isLoading: false,
  }),
}))

jest.mock('@/features/crm', () => ({
  useCrm: () => ({
    status: null,
    loadingStatus: false,
    loadingData: false,
    accounts: [],
    opportunities: [],
    leads: [],
    contacts: [],
    fetchStatus: (...a: any[]) => mockFetchCrmStatus(...a),
    connect: jest.fn(),
    loadData: jest.fn(),
  }),
}))

jest.mock('@/lib/client', () => ({
  api: {
    personas: {
      getAll: jest.fn().mockResolvedValue({
        personas: [
          {
            id: 'p1',
            name: 'Alice',
            orgId: 'org_1',
            traits: { role: 'VP', voice: { provider: 'openai', voiceName: 'alloy' } },
          },
        ],
      }),
      create: jest.fn(),
      getPreviewAudio: jest.fn().mockRejectedValue(new Error('no audio')),
    },
    scenarios: {
      getAll: jest.fn().mockResolvedValue({ scenarios: [] }),
      generateBatch: jest.fn(),
    },
    users: {
      getMySettings: jest.fn().mockResolvedValue({}),
      updateMySettings: jest.fn(),
    },
  },
}))

jest.mock('../components/BasicsStep', () => ({
  BasicsStep: (props: any) => (
    <div data-testid="basics-step">
      <span>Pick a session type</span>
      {props.errors?.sessionType && <span>{props.errors.sessionType}</span>}
      <button onClick={() => props.setSessionType('text')}>Select Text</button>
      <button onClick={() => props.setSessionType('voice')}>Select Voice</button>
    </div>
  ),
}))

jest.mock('../components/ScenarioStep', () => ({
  ScenarioStep: (props: any) => (
    <div data-testid="scenario-step">
      <span>Scenario &amp; Topic</span>
      {props.errors?.durationMinutes && <span>{props.errors.durationMinutes}</span>}
      <button onClick={() => props.setDurationMinutes(30)}>Set Duration 30</button>
      <button onClick={() => props.setDurationMinutes(0)}>Set Duration 0</button>
      <button onClick={() => props.setScenarioTopic('Sales')}>Set Topic</button>
      <button onClick={props.onGenerate}>Generate</button>
    </div>
  ),
  ScenarioOption: {},
}))

jest.mock('../components/PersonaStep', () => ({
  PersonaStep: (props: any) => (
    <div data-testid="persona-step">
      <span>Select Persona</span>
      {props.errors?.persona && <span>{props.errors.persona}</span>}
      <button onClick={() => props.setSelectedPersona('p1')}>Select Alice</button>
    </div>
  ),
}))

jest.mock('../components/AIBrainStep', () => ({
  AIBrainStep: (props: any) => (
    <div data-testid="aibrain-step">
      <span>AI Brain</span>
      {props.errors?.llmProvider && <span>{props.errors.llmProvider}</span>}
      {props.errors?.llmModel && <span>{props.errors.llmModel}</span>}
    </div>
  ),
}))

jest.mock('../components/CrmStep', () => ({
  CrmStep: () => <div data-testid="crm-step">CRM Step</div>,
}))

jest.mock('../components/StyleStep', () => ({
  StyleStep: () => <div data-testid="style-step">Style Step</div>,
}))

jest.mock('../components/UploadSection', () => ({
  UploadSection: () => <div data-testid="upload-step">Upload Step</div>,
}))

jest.mock('../components/ReviewStep', () => ({
  ReviewStep: () => <div data-testid="review-step">Review Step</div>,
}))

import CreateSessionPage from '../page'

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
  mockPush = jest.fn()
  mockCreateSession = jest.fn().mockResolvedValue({ id: 'session_123', name: 'Test' })
  mockFetchUserTeams = jest.fn()
  mockFetchCrmStatus = jest.fn()
  mockNotificationsShow = jest.fn()
})

describe('CreateSessionPage', () => {
  it('renders the hero section with badge and title', async () => {
    render(<CreateSessionPage />, { wrapper: Wrapper })
    await waitFor(() => {
      expect(screen.getByText('New Session Wizard')).toBeInTheDocument()
    })
    expect(screen.getByText('Compose your next session')).toBeInTheDocument()
  })

  it('renders all stepper labels', async () => {
    render(<CreateSessionPage />, { wrapper: Wrapper })
    await waitFor(() => {
      expect(screen.getByText('Basics')).toBeInTheDocument()
    })
    expect(screen.getByText('Scenario')).toBeInTheDocument()
    expect(screen.getByText('Persona')).toBeInTheDocument()
    expect(screen.getByText('AI Brain')).toBeInTheDocument()
    expect(screen.getByText('CRM')).toBeInTheDocument()
    expect(screen.getByText('Style')).toBeInTheDocument()
    expect(screen.getByText('Files')).toBeInTheDocument()
    expect(screen.getByText('Review')).toBeInTheDocument()
  })

  it('starts at Basics step', async () => {
    render(<CreateSessionPage />, { wrapper: Wrapper })
    await waitFor(() => {
      expect(screen.getByTestId('basics-step')).toBeInTheDocument()
    })
  })

  it('shows Back button disabled on first step', async () => {
    render(<CreateSessionPage />, { wrapper: Wrapper })
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /back/i })).toBeDisabled()
    })
  })

  it('shows Next button on non-final steps', async () => {
    render(<CreateSessionPage />, { wrapper: Wrapper })
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument()
    })
    expect(screen.queryByRole('button', { name: /create session/i })).not.toBeInTheDocument()
  })

  it('validates step 0 - shows error when session type not selected', async () => {
    const user = userEvent.setup()
    render(<CreateSessionPage />, { wrapper: Wrapper })
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: /next/i }))
    await waitFor(() => {
      expect(screen.getByText('Session type is required')).toBeInTheDocument()
    })
    expect(screen.getByTestId('basics-step')).toBeInTheDocument()
  })

  it('advances to step 1 (Scenario) after selecting session type', async () => {
    const user = userEvent.setup()
    render(<CreateSessionPage />, { wrapper: Wrapper })
    await waitFor(() => {
      expect(screen.getByTestId('basics-step')).toBeInTheDocument()
    })
    await user.click(screen.getByText('Select Text'))
    await user.click(screen.getByRole('button', { name: /next/i }))
    await waitFor(() => {
      expect(screen.getByTestId('scenario-step')).toBeInTheDocument()
    })
  })

  it('validates step 1 - shows duration error when invalid', async () => {
    const user = userEvent.setup()
    render(<CreateSessionPage />, { wrapper: Wrapper })
    await waitFor(() => {
      expect(screen.getByTestId('basics-step')).toBeInTheDocument()
    })
    await user.click(screen.getByText('Select Text'))
    await user.click(screen.getByRole('button', { name: /next/i }))
    await waitFor(() => {
      expect(screen.getByTestId('scenario-step')).toBeInTheDocument()
    })
    await user.click(screen.getByText('Set Duration 0'))
    await user.click(screen.getByRole('button', { name: /next/i }))
    await waitFor(() => {
      expect(
        screen.getByText('Session length must be between 5 and 180 minutes')
      ).toBeInTheDocument()
    })
  })

  it('advances to step 2 (Persona) with valid duration', async () => {
    const user = userEvent.setup()
    render(<CreateSessionPage />, { wrapper: Wrapper })
    await waitFor(() => {
      expect(screen.getByTestId('basics-step')).toBeInTheDocument()
    })
    await user.click(screen.getByText('Select Text'))
    await user.click(screen.getByRole('button', { name: /next/i }))
    await waitFor(() => {
      expect(screen.getByTestId('scenario-step')).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: /next/i }))
    await waitFor(() => {
      expect(screen.getByTestId('persona-step')).toBeInTheDocument()
    })
  })

  it('validates step 2 - shows persona error when none selected', async () => {
    const user = userEvent.setup()
    render(<CreateSessionPage />, { wrapper: Wrapper })
    await waitFor(() => {
      expect(screen.getByTestId('basics-step')).toBeInTheDocument()
    })
    await user.click(screen.getByText('Select Text'))
    await user.click(screen.getByRole('button', { name: /next/i }))
    await waitFor(() => {
      expect(screen.getByTestId('scenario-step')).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: /next/i }))
    await waitFor(() => {
      expect(screen.getByTestId('persona-step')).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: /next/i }))
    await waitFor(() => {
      expect(screen.getByText('Please select a persona to continue')).toBeInTheDocument()
    })
  })

  it('navigates back from step 1 to step 0', async () => {
    const user = userEvent.setup()
    render(<CreateSessionPage />, { wrapper: Wrapper })
    await waitFor(() => {
      expect(screen.getByTestId('basics-step')).toBeInTheDocument()
    })
    await user.click(screen.getByText('Select Text'))
    await user.click(screen.getByRole('button', { name: /next/i }))
    await waitFor(() => {
      expect(screen.getByTestId('scenario-step')).toBeInTheDocument()
    })
    const backButton = screen.getByRole('button', { name: /back/i })
    expect(backButton).not.toBeDisabled()
    await user.click(backButton)
    await waitFor(() => {
      expect(screen.getByTestId('basics-step')).toBeInTheDocument()
    })
  })

  it('navigates all the way to Review step and shows Create Session button', async () => {
    const user = userEvent.setup()
    render(<CreateSessionPage />, { wrapper: Wrapper })

    await waitFor(() => {
      expect(screen.getByTestId('basics-step')).toBeInTheDocument()
    })
    await user.click(screen.getByText('Select Text'))
    await user.click(screen.getByRole('button', { name: /next/i }))
    await waitFor(() => {
      expect(screen.getByTestId('scenario-step')).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: /next/i }))
    await waitFor(() => {
      expect(screen.getByTestId('persona-step')).toBeInTheDocument()
    })
    await user.click(screen.getByText('Select Alice'))
    await user.click(screen.getByRole('button', { name: /next/i }))
    await waitFor(() => {
      expect(screen.getByTestId('aibrain-step')).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: /next/i }))
    await waitFor(() => {
      expect(screen.getByTestId('crm-step')).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: /next/i }))
    await waitFor(() => {
      expect(screen.getByTestId('style-step')).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: /next/i }))
    await waitFor(() => {
      expect(screen.getByTestId('upload-step')).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: /next/i }))
    await waitFor(() => {
      expect(screen.getByTestId('review-step')).toBeInTheDocument()
    })

    expect(screen.getByRole('button', { name: /create session/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^next$/i })).not.toBeInTheDocument()
  })

  it('calls createSession and redirects on successful submit', async () => {
    const user = userEvent.setup()
    render(<CreateSessionPage />, { wrapper: Wrapper })

    await waitFor(() => {
      expect(screen.getByTestId('basics-step')).toBeInTheDocument()
    })
    await user.click(screen.getByText('Select Text'))
    await user.click(screen.getByRole('button', { name: /next/i }))
    await waitFor(() => {
      expect(screen.getByTestId('scenario-step')).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: /next/i }))
    await waitFor(() => {
      expect(screen.getByTestId('persona-step')).toBeInTheDocument()
    })
    await user.click(screen.getByText('Select Alice'))
    await user.click(screen.getByRole('button', { name: /next/i }))
    await waitFor(() => {
      expect(screen.getByTestId('aibrain-step')).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: /next/i }))
    await waitFor(() => {
      expect(screen.getByTestId('crm-step')).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: /next/i }))
    await waitFor(() => {
      expect(screen.getByTestId('style-step')).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: /next/i }))
    await waitFor(() => {
      expect(screen.getByTestId('upload-step')).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: /next/i }))
    await waitFor(() => {
      expect(screen.getByTestId('review-step')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /create session/i }))

    await waitFor(() => {
      expect(mockCreateSession).toHaveBeenCalled()
    })
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/studio/sessions')
    })
    expect(mockNotificationsShow).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Success' })
    )
  })

  it('shows error notification on submit failure', async () => {
    mockCreateSession = jest.fn().mockRejectedValue(new Error('Server error'))
    const user = userEvent.setup()
    render(<CreateSessionPage />, { wrapper: Wrapper })

    await waitFor(() => {
      expect(screen.getByTestId('basics-step')).toBeInTheDocument()
    })
    await user.click(screen.getByText('Select Text'))
    await user.click(screen.getByRole('button', { name: /next/i }))
    await waitFor(() => {
      expect(screen.getByTestId('scenario-step')).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: /next/i }))
    await waitFor(() => {
      expect(screen.getByTestId('persona-step')).toBeInTheDocument()
    })
    await user.click(screen.getByText('Select Alice'))
    await user.click(screen.getByRole('button', { name: /next/i }))
    await waitFor(() => {
      expect(screen.getByTestId('aibrain-step')).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: /next/i }))
    await waitFor(() => {
      expect(screen.getByTestId('crm-step')).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: /next/i }))
    await waitFor(() => {
      expect(screen.getByTestId('style-step')).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: /next/i }))
    await waitFor(() => {
      expect(screen.getByTestId('upload-step')).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: /next/i }))
    await waitFor(() => {
      expect(screen.getByTestId('review-step')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /create session/i }))

    await waitFor(() => {
      expect(mockNotificationsShow).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Error', message: 'Server error' })
      )
    })
    expect(mockPush).not.toHaveBeenCalledWith('/studio/sessions')
  })

  it('prevents stepper from jumping ahead when validation fails', async () => {
    const user = userEvent.setup()
    render(<CreateSessionPage />, { wrapper: Wrapper })
    await waitFor(() => {
      expect(screen.getByTestId('basics-step')).toBeInTheDocument()
    })
    const scenarioBtn = screen.getByRole('button', { name: /scenario/i })
    await user.click(scenarioBtn)
    await waitFor(() => {
      expect(screen.getByText('Session type is required')).toBeInTheDocument()
    })
    expect(screen.getByTestId('basics-step')).toBeInTheDocument()
  })

  it('fetchUserTeams is called on mount', async () => {
    render(<CreateSessionPage />, { wrapper: Wrapper })
    await waitFor(() => {
      expect(mockFetchUserTeams).toHaveBeenCalled()
    })
  })

  it('fetchCrmStatus is called on mount', async () => {
    render(<CreateSessionPage />, { wrapper: Wrapper })
    await waitFor(() => {
      expect(mockFetchCrmStatus).toHaveBeenCalledWith(true)
    })
  })
})
