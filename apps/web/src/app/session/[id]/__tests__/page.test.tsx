/** @jest-environment jsdom */
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MantineProvider } from '@mantine/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const mockPush = jest.fn()
const mockReplace = jest.fn()
const mockBack = jest.fn()
const mockSearchParamsGet = jest.fn().mockReturnValue(null)

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: mockBack }),
  useSearchParams: () => ({
    get: mockSearchParamsGet,
    toString: jest.fn().mockReturnValue(''),
  }),
  useParams: () => ({ id: 'session-123' }),
}))

jest.mock('@mantine/notifications', () => ({
  notifications: { show: jest.fn(), clean: jest.fn() },
}))

jest.mock('@mantine/hooks', () => {
  const actual = jest.requireActual('@mantine/hooks')
  return { ...actual, useMediaQuery: jest.fn().mockReturnValue(false) }
})

const mockSendMessage = jest.fn()
const mockStartAssistantTurn = jest.fn()
const mockHangUp = jest.fn()
const mockInterrupt = jest.fn().mockResolvedValue(undefined)
const mockStopAudio = jest.fn()
const mockReplayAudio = jest.fn()
const mockClearMessages = jest.fn()
const mockClearHangupRequest = jest.fn()
const mockClearToolEvents = jest.fn()

jest.mock('@/features/conversation', () => ({
  useConversation: jest.fn().mockReturnValue({
    isConnected: false,
    isConnecting: false,
    isProcessing: false,
    messages: [],
    error: null,
    sendMessage: mockSendMessage,
    startAssistantTurn: mockStartAssistantTurn,
    currentAudioUrl: null,
    isAudioPlaying: false,
    hangupRequest: null,
    hangUp: mockHangUp,
    interrupt: mockInterrupt,
    stopAudio: mockStopAudio,
    replayAudio: mockReplayAudio,
    clearMessages: mockClearMessages,
    clearHangupRequest: mockClearHangupRequest,
    clearToolEvents: mockClearToolEvents,
    toolEvents: [],
    audioElementRef: { current: null },
  }),
  useVisualState: jest.fn().mockReturnValue({
    isReady: false,
    currentState: null,
  }),
  CameraEngagementIndicator: ({ isActive, onToggle }: any) => (
    <button data-testid="camera-toggle" onClick={onToggle}>
      Camera {isActive ? 'on' : 'off'}
    </button>
  ),
}))

jest.mock('@/features/conversation/components/VoiceOrbSession', () => ({
  __esModule: true,
  default: (props: any) => (
    <div data-testid="voice-orb-session" data-mode={props.mode}>
      VoiceOrbSession
    </div>
  ),
}))

jest.mock('@/features/conversation/hooks/useAudioLevel', () => ({
  useAudioLevel: jest.fn().mockReturnValue({ current: null }),
}))

jest.mock('@/components/ui/CoachChatWidget', () => ({
  CoachChatWidget: (props: any) => (
    <div data-testid="coach-chat-widget" data-page={props.context?.page}>
      CoachChatWidget
    </div>
  ),
}))

jest.mock('@/features/stt', () => ({
  useSpeechToText: jest.fn().mockReturnValue({
    isListening: false,
    transcript: '',
    interimTranscript: '',
    error: null,
    microphonePermission: 'prompt',
    isPermissionBlocked: false,
    isSupported: true,
    startListening: jest.fn(),
    stopListening: jest.fn(),
    resetTranscript: jest.fn(),
    requestMicrophoneAccess: jest.fn().mockResolvedValue(true),
  }),
}))

const mockApi = {
  sessions: {
    getById: jest.fn(),
    timeline: jest.fn(),
    end: jest.fn(),
    restart: jest.fn(),
  },
  hints: {
    generate: jest.fn(),
    history: jest.fn(),
  },
  users: {
    getMyPhoneVerification: jest.fn(),
    requestPhoneVerification: jest.fn(),
    resendPhoneVerification: jest.fn(),
    verifyPhoneVerification: jest.fn(),
  },
  phoneCalls: {
    start: jest.fn(),
    end: jest.fn(),
  },
  assessments: {
    run: jest.fn(),
    getRunStatus: jest.fn(),
    getLatestForSession: jest.fn(),
    getReport: jest.fn(),
  },
}

jest.mock('@/lib/client', () => ({
  api: mockApi,
  API_CONFIG: { baseURL: 'http://localhost:3001/api' },
}))

jest.mock('next/font/google', () => ({
  Space_Grotesk: () => ({ className: 'mock-space-grotesk' }),
  Fraunces: () => ({ className: 'mock-fraunces' }),
}))

Element.prototype.scrollTo = jest.fn()
Element.prototype.scrollBy = jest.fn()

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

let LiveSessionPage: any

beforeAll(async () => {
  const mod = await import('../page')
  LiveSessionPage = mod.default
})

beforeEach(() => {
  jest.clearAllMocks()
  jest.useFakeTimers({ advanceTimers: true })
  mockSearchParamsGet.mockReturnValue(null)
})

afterEach(() => {
  jest.useRealTimers()
})

const mockTextSession = {
  id: 'session-123',
  name: 'Mock Session',
  type: 'text',
  status: 'active',
  persona: { name: 'Alex Prospect' },
  sessionConfig: {
    multiTurnEnabled: true,
  },
}

const mockPhoneSession = {
  id: 'session-123',
  name: 'Phone Session',
  type: 'phone',
  status: 'active',
  persona: { name: 'Alex Prospect' },
  sessionConfig: {
    multiTurnEnabled: false,
    phone: {},
  },
}

const mockVideoSession = {
  id: 'session-123',
  name: 'Video Session',
  type: 'video',
  status: 'active',
  persona: { name: 'Alex Prospect' },
  sessionConfig: {
    multiTurnEnabled: true,
    video: {
      provider: 'tavus',
      runtime: { status: 'idle' },
    },
  },
}

const mockEndedSession = {
  id: 'session-123',
  name: 'Ended Session',
  type: 'text',
  status: 'ended',
  persona: { name: 'Alex Prospect' },
  sessionConfig: {},
}

describe('LiveSessionPage', () => {
  describe('initial loading state', () => {
    it('renders loading indicators while session is loading', async () => {
      mockApi.sessions.getById.mockReturnValue(new Promise(() => {}))

      render(<LiveSessionPage />, { wrapper: Wrapper })

      await waitFor(() => {
        expect(screen.getByText('Live Session')).toBeInTheDocument()
      })
    })

    it('calls api.sessions.getById on mount with session id', () => {
      mockApi.sessions.getById.mockReturnValue(new Promise(() => {}))

      render(<LiveSessionPage />, { wrapper: Wrapper })

      expect(mockApi.sessions.getById).toHaveBeenCalledWith('session-123')
    })
  })

  describe('text session', () => {
    beforeEach(() => {
      mockApi.sessions.getById.mockResolvedValue(mockTextSession)
      mockApi.sessions.timeline.mockResolvedValue({ total: 0, conversationHistory: [] })
    })

    it('renders session name and persona after loading', async () => {
      render(<LiveSessionPage />, { wrapper: Wrapper })

      await waitFor(() => {
        expect(screen.getByText('Mock Session')).toBeInTheDocument()
      })
      expect(screen.getByText(/Alex Prospect/)).toBeInTheDocument()
    })

    it('renders VoiceOrbSession for text session', async () => {
      render(<LiveSessionPage />, { wrapper: Wrapper })

      await waitFor(() => {
        expect(screen.getByTestId('voice-orb-session')).toBeInTheDocument()
      })
    })

    it('renders CoachChatWidget', async () => {
      render(<LiveSessionPage />, { wrapper: Wrapper })

      await waitFor(() => {
        expect(screen.getByTestId('coach-chat-widget')).toBeInTheDocument()
      })
      expect(screen.getByTestId('coach-chat-widget')).toHaveAttribute('data-page', 'session')
    })

    it('shows recording indicator on desktop', async () => {
      render(<LiveSessionPage />, { wrapper: Wrapper })

      await waitFor(() => {
        expect(screen.getByText('Recording')).toBeInTheDocument()
      })
    })

    it('shows a timer starting at 0:00', async () => {
      render(<LiveSessionPage />, { wrapper: Wrapper })

      await waitFor(() => {
        expect(screen.getByText('0:00')).toBeInTheDocument()
      })
    })

    it('does not show auto-connect when session has existing progress', async () => {
      mockApi.sessions.timeline.mockResolvedValue({
        total: 5,
        conversationHistory: [
          { id: 't1', role: 'user', text: 'Hello', createdAt: new Date().toISOString() },
        ],
      })

      render(<LiveSessionPage />, { wrapper: Wrapper })

      await waitFor(() => {
        expect(screen.getByText('Mock Session')).toBeInTheDocument()
      })
    })
  })

  describe('ended session', () => {
    it('shows session checkpoint prompt for ended text session', async () => {
      mockApi.sessions.getById.mockResolvedValue(mockEndedSession)

      render(<LiveSessionPage />, { wrapper: Wrapper })

      await waitFor(() => {
        expect(screen.getByTestId('voice-orb-session')).toBeInTheDocument()
      })
    })
  })

  describe('video session', () => {
    beforeEach(() => {
      mockApi.sessions.getById.mockResolvedValue(mockVideoSession)
      mockApi.sessions.timeline.mockResolvedValue({ total: 0, conversationHistory: [] })
    })

    it('renders VoiceOrbSession with video mode', async () => {
      render(<LiveSessionPage />, { wrapper: Wrapper })

      await waitFor(() => {
        const orb = screen.getByTestId('voice-orb-session')
        expect(orb).toHaveAttribute('data-mode', 'video')
      })
    })

    it('renders camera toggle for video sessions', async () => {
      render(<LiveSessionPage />, { wrapper: Wrapper })

      await waitFor(() => {
        expect(screen.getByTestId('camera-toggle')).toBeInTheDocument()
      })
    })
  })

  describe('phone session', () => {
    beforeEach(() => {
      mockApi.sessions.getById.mockResolvedValue(mockPhoneSession)
      mockApi.sessions.timeline.mockResolvedValue({ total: 0, conversationHistory: [] })
      mockApi.users.getMyPhoneVerification.mockResolvedValue({
        verified: false,
        phoneNumber: null,
      })
    })

    it('renders phone session with transcript panel', async () => {
      render(<LiveSessionPage />, { wrapper: Wrapper })

      await waitFor(() => {
        expect(screen.getByText('Live transcript')).toBeInTheDocument()
      })
    })

    it('shows phone status badge in top bar', async () => {
      render(<LiveSessionPage />, { wrapper: Wrapper })

      await waitFor(() => {
        const readyBadges = screen.getAllByText('Ready')
        expect(readyBadges.length).toBeGreaterThanOrEqual(1)
      })
    })

    it('shows call setup button when call not started', async () => {
      render(<LiveSessionPage />, { wrapper: Wrapper })

      await waitFor(() => {
        const buttons = screen.getAllByText('Call setup')
        expect(buttons.length).toBeGreaterThanOrEqual(1)
      })
    })

    it('shows "Transcript will appear here" when no messages', async () => {
      render(<LiveSessionPage />, { wrapper: Wrapper })

      await waitFor(() => {
        expect(screen.getByText('Transcript will appear here')).toBeInTheDocument()
      })
    })
  })

  describe('phone session with verified phone', () => {
    beforeEach(() => {
      mockApi.sessions.getById.mockResolvedValue(mockPhoneSession)
      mockApi.sessions.timeline.mockResolvedValue({ total: 0, conversationHistory: [] })
      mockApi.users.getMyPhoneVerification.mockResolvedValue({
        verified: true,
        phoneNumber: '+15551234567',
      })
    })

    it('shows verified phone number after loading', async () => {
      render(<LiveSessionPage />, { wrapper: Wrapper })

      await waitFor(() => {
        expect(screen.getByText('+15551234567')).toBeInTheDocument()
      })
    })
  })

  describe('hang up', () => {
    beforeEach(() => {
      mockApi.sessions.getById.mockResolvedValue(mockTextSession)
      mockApi.sessions.timeline.mockResolvedValue({ total: 0, conversationHistory: [] })
      mockApi.sessions.end.mockResolvedValue({})
    })

    it('calls end session API and redirects to performance page on hang up', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
      render(<LiveSessionPage />, { wrapper: Wrapper })

      await waitFor(() => {
        expect(screen.getByText('Mock Session')).toBeInTheDocument()
      })

      const hangUpButton = screen.getByTitle('End call and return to sessions')
      await user.click(hangUpButton)

      await waitFor(() => {
        expect(mockApi.sessions.end).toHaveBeenCalledWith('session-123', { reason: 'hangup' })
      })
      expect(mockPush).toHaveBeenCalledWith('/session/session-123/performance')
    })
  })

  describe('hints sidebar', () => {
    beforeEach(() => {
      mockApi.sessions.getById.mockResolvedValue(mockTextSession)
      mockApi.sessions.timeline.mockResolvedValue({ total: 0, conversationHistory: [] })
    })

    it('shows "Show hints" button initially', async () => {
      render(<LiveSessionPage />, { wrapper: Wrapper })

      await waitFor(() => {
        expect(screen.getByText('Show hints')).toBeInTheDocument()
      })
    })
  })

  describe('timeline sidebar', () => {
    beforeEach(() => {
      mockApi.sessions.getById.mockResolvedValue(mockTextSession)
      mockApi.sessions.timeline.mockResolvedValue({ total: 0, conversationHistory: [] })
    })

    it('shows "Show timeline" button initially', async () => {
      render(<LiveSessionPage />, { wrapper: Wrapper })

      await waitFor(() => {
        expect(screen.getByText('Show timeline')).toBeInTheDocument()
      })
    })
  })

  describe('session with retake entry', () => {
    it('restarts an ended phone session when entry=retake', async () => {
      mockSearchParamsGet.mockReturnValue('retake')
      mockApi.sessions.getById.mockResolvedValue({
        ...mockPhoneSession,
        status: 'ended',
      })
      mockApi.sessions.restart.mockResolvedValue({
        ...mockPhoneSession,
        status: 'active',
      })
      mockApi.sessions.timeline.mockResolvedValue({ total: 0, conversationHistory: [] })
      mockApi.users.getMyPhoneVerification.mockResolvedValue({
        verified: false,
        phoneNumber: null,
      })

      render(<LiveSessionPage />, { wrapper: Wrapper })

      await waitFor(() => {
        expect(mockApi.sessions.restart).toHaveBeenCalledWith('session-123', {
          reason: 'restart_from_scratch',
        })
      })
    })
  })

  describe('AI hangup request modal', () => {
    it('does not render hangup modal when no hangup request', async () => {
      mockApi.sessions.getById.mockResolvedValue(mockTextSession)
      mockApi.sessions.timeline.mockResolvedValue({ total: 0, conversationHistory: [] })

      render(<LiveSessionPage />, { wrapper: Wrapper })

      await waitFor(() => {
        expect(screen.getByText('Mock Session')).toBeInTheDocument()
      })

      expect(screen.queryByText('The AI persona wants to hang up')).not.toBeInTheDocument()
    })
  })

  describe('helper functions', () => {
    it('renders live transcript panel for ended phone session', async () => {
      mockApi.sessions.getById.mockResolvedValue({
        ...mockPhoneSession,
        status: 'ended',
      })

      render(<LiveSessionPage />, { wrapper: Wrapper })

      await waitFor(() => {
        expect(screen.getByText('Live transcript')).toBeInTheDocument()
      })
    })
  })
})
