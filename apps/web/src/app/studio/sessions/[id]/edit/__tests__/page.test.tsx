/** @jest-environment jsdom */
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MantineProvider } from '@mantine/core'

let mockPush: jest.Mock
let mockUpdateSession: jest.Mock
let mockFetchSessionById: jest.Mock
let mockFetchUserTeams: jest.Mock
let mockFetchCrmStatus: jest.Mock
let mockNotificationsShow: jest.Mock
let mockCurrentSession: any

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: (...a: any[]) => mockPush(...a),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
  useParams: () => ({ id: 'session_abc' }),
  usePathname: () => '/studio/sessions/session_abc/edit',
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
    currentSession: mockCurrentSession,
    loading: false,
    error: null,
    fetchSessionById: (...a: any[]) => mockFetchSessionById(...a),
    updateSession: (...a: any[]) => mockUpdateSession(...a),
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
        personas: [{ id: 'p1', name: 'Alice', orgId: 'org_1', traits: { role: 'VP' } }],
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

jest.mock('@/app/studio/sessions/create/components/BasicsStep', () => ({
  BasicsStep: (props: any) => (
    <div data-testid="basics-step">
      <span>Pick a session type</span>
      {props.errors?.sessionType && <span>{props.errors.sessionType}</span>}
      <button onClick={() => props.setSessionType('text')}>Select Text</button>
    </div>
  ),
}))

jest.mock('@/app/studio/sessions/create/components/ScenarioStep', () => ({
  ScenarioStep: (props: any) => (
    <div data-testid="scenario-step">
      <span>Scenario Step</span>
      {props.errors?.durationMinutes && <span>{props.errors.durationMinutes}</span>}
    </div>
  ),
  ScenarioOption: {},
}))

jest.mock('@/app/studio/sessions/create/components/PersonaStep', () => ({
  PersonaStep: (props: any) => (
    <div data-testid="persona-step">
      <span>Persona Step</span>
      {props.errors?.persona && <span>{props.errors.persona}</span>}
      <button onClick={() => props.setSelectedPersona('p1')}>Select Alice</button>
    </div>
  ),
}))

jest.mock('@/app/studio/sessions/create/components/AIBrainStep', () => ({
  AIBrainStep: (props: any) => (
    <div data-testid="aibrain-step">
      <span>AI Brain Step</span>
      {props.errors?.llmProvider && <span>{props.errors.llmProvider}</span>}
      {props.errors?.llmModel && <span>{props.errors.llmModel}</span>}
    </div>
  ),
}))

jest.mock('@/app/studio/sessions/create/components/CrmStep', () => ({
  CrmStep: () => <div data-testid="crm-step">CRM Step</div>,
}))

jest.mock('@/app/studio/sessions/create/components/StyleStep', () => ({
  StyleStep: () => <div data-testid="style-step">Style Step</div>,
}))

jest.mock('@/app/studio/sessions/create/components/ReviewStep', () => ({
  ReviewStep: () => <div data-testid="review-step">Review Step</div>,
}))

import EditSessionPage from '../page'

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

const makeSession = (overrides: Record<string, any> = {}) => ({
  id: 'session_abc',
  orgId: 'team_1',
  userId: 'user_1',
  name: 'Test Session',
  type: 'text',
  tags: ['demo'],
  language: 'en-US',
  personaId: 'p1',
  scenarioId: null,
  sessionConfig: {
    multiTurnEnabled: true,
    tone: 'Formal',
    accent: 'Persona-based',
    speechRate: 'Conversational',
    responseLength: 'Balanced',
    patienceLevel: 'Medium',
    initiativeLevel: 'Balanced',
    difficulty: 5,
    durationMinutes: 30,
    llm: { provider: 'openai', model: 'gpt-4o' },
  },
  ...overrides,
})

beforeEach(() => {
  mockPush = jest.fn()
  mockUpdateSession = jest.fn().mockResolvedValue({})
  mockFetchSessionById = jest.fn()
  mockFetchUserTeams = jest.fn()
  mockFetchCrmStatus = jest.fn()
  mockNotificationsShow = jest.fn()
  mockCurrentSession = makeSession()
})

describe('EditSessionPage', () => {
  it('renders the edit hero section', async () => {
    render(<EditSessionPage />, { wrapper: Wrapper })
    await waitFor(() => {
      expect(screen.getByText('Edit Session Wizard')).toBeInTheDocument()
    })
    expect(screen.getByText('Update your session')).toBeInTheDocument()
  })

  it('renders all stepper labels', async () => {
    render(<EditSessionPage />, { wrapper: Wrapper })
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

  it('fetches session by id on mount', async () => {
    render(<EditSessionPage />, { wrapper: Wrapper })
    await waitFor(() => {
      expect(mockFetchSessionById).toHaveBeenCalledWith('session_abc')
    })
  })

  it('shows loading state when session is not yet available', async () => {
    mockCurrentSession = null
    jest.mock('@/features/sessions', () => ({
      ...jest.requireActual('@/features/sessions'),
      useSessions: () => ({
        currentSession: null,
        loading: true,
        error: null,
        fetchSessionById: mockFetchSessionById,
        updateSession: mockUpdateSession,
      }),
    }))
    render(<EditSessionPage />, { wrapper: Wrapper })
    await waitFor(() => {
      expect(screen.getByText('Edit Session Wizard')).toBeInTheDocument()
    })
  })

  it('shows session not found when session is null and not loading', async () => {
    mockCurrentSession = null
    render(<EditSessionPage />, { wrapper: Wrapper })
    await waitFor(() => {
      expect(screen.getByText('Session not found.')).toBeInTheDocument()
    })
  })

  it('shows read-only message when session belongs to another user', async () => {
    mockCurrentSession = makeSession({ userId: 'other_user' })
    render(<EditSessionPage />, { wrapper: Wrapper })
    await waitFor(() => {
      expect(
        screen.getByText('Only the session owner can modify this session.')
      ).toBeInTheDocument()
    })
  })

  it('renders the basics step initially', async () => {
    render(<EditSessionPage />, { wrapper: Wrapper })
    await waitFor(() => {
      expect(screen.getByTestId('basics-step')).toBeInTheDocument()
    })
  })

  it('shows Back button disabled on first step', async () => {
    render(<EditSessionPage />, { wrapper: Wrapper })
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /back/i })).toBeDisabled()
    })
  })

  it('validates basics step before advancing', async () => {
    mockCurrentSession = makeSession({ type: null })
    const user = userEvent.setup()
    render(<EditSessionPage />, { wrapper: Wrapper })
    await waitFor(() => {
      expect(screen.getByTestId('basics-step')).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: /next/i }))
    await waitFor(() => {
      expect(screen.getByText('Session type is required')).toBeInTheDocument()
    })
  })

  it('advances through steps when valid', async () => {
    const user = userEvent.setup()
    render(<EditSessionPage />, { wrapper: Wrapper })
    await waitFor(() => {
      expect(screen.getByTestId('basics-step')).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: /next/i }))
    await waitFor(() => {
      expect(screen.getByTestId('scenario-step')).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: /next/i }))
    await waitFor(() => {
      expect(screen.getByTestId('persona-step')).toBeInTheDocument()
    })
  })

  it('navigates back properly', async () => {
    const user = userEvent.setup()
    render(<EditSessionPage />, { wrapper: Wrapper })
    await waitFor(() => {
      expect(screen.getByTestId('basics-step')).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: /next/i }))
    await waitFor(() => {
      expect(screen.getByTestId('scenario-step')).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: /back/i }))
    await waitFor(() => {
      expect(screen.getByTestId('basics-step')).toBeInTheDocument()
    })
  })

  it('shows Save Changes button on final step', async () => {
    const user = userEvent.setup()
    render(<EditSessionPage />, { wrapper: Wrapper })
    await waitFor(() => {
      expect(screen.getByTestId('basics-step')).toBeInTheDocument()
    })

    for (let i = 0; i < 6; i++) {
      await user.click(screen.getByRole('button', { name: /next/i }))
    }

    await waitFor(() => {
      expect(screen.getByTestId('review-step')).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument()
  })

  it('calls updateSession on save and redirects', async () => {
    const user = userEvent.setup()
    render(<EditSessionPage />, { wrapper: Wrapper })
    await waitFor(() => {
      expect(screen.getByTestId('basics-step')).toBeInTheDocument()
    })

    for (let i = 0; i < 6; i++) {
      await user.click(screen.getByRole('button', { name: /next/i }))
    }

    await waitFor(() => {
      expect(screen.getByTestId('review-step')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => {
      expect(mockUpdateSession).toHaveBeenCalled()
    })
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/studio/sessions')
    })
    expect(mockNotificationsShow).toHaveBeenCalledWith(expect.objectContaining({ title: 'Saved' }))
  })

  it('shows error notification on update failure', async () => {
    mockUpdateSession = jest.fn().mockRejectedValue(new Error('Update failed'))
    const user = userEvent.setup()
    render(<EditSessionPage />, { wrapper: Wrapper })
    await waitFor(() => {
      expect(screen.getByTestId('basics-step')).toBeInTheDocument()
    })

    for (let i = 0; i < 6; i++) {
      await user.click(screen.getByRole('button', { name: /next/i }))
    }

    await waitFor(() => {
      expect(screen.getByTestId('review-step')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => {
      expect(mockNotificationsShow).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Error', message: 'Update failed' })
      )
    })
    expect(mockPush).not.toHaveBeenCalledWith('/studio/sessions')
  })

  it('fetchUserTeams is called on mount', async () => {
    render(<EditSessionPage />, { wrapper: Wrapper })
    await waitFor(() => {
      expect(mockFetchUserTeams).toHaveBeenCalled()
    })
  })

  it('fetchCrmStatus is called on mount', async () => {
    render(<EditSessionPage />, { wrapper: Wrapper })
    await waitFor(() => {
      expect(mockFetchCrmStatus).toHaveBeenCalledWith(true)
    })
  })
})
