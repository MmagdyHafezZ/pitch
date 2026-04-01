/**
 * @jest-environment jsdom
 */
import { act, render, screen, waitFor } from '@/__tests__/utils/test-utils'
import LiveSessionPage from '../page'

const mockPush = jest.fn()
const mockBack = jest.fn()

type MockConversationState = ReturnType<typeof buildConversationState>
type MockSpeechState = ReturnType<typeof buildSpeechState>

let mockConversationState: MockConversationState
let mockSpeechState: MockSpeechState

const buildConversationState = () => ({
  isConnected: true,
  isConnecting: false,
  isProcessing: false,
  messages: [] as Array<{ id: string; role: 'user' | 'assistant'; text: string; timestamp: Date }>,
  error: null as string | null,
  sendMessage: jest.fn((text: string) => {
    mockConversationState.messages = [
      ...mockConversationState.messages,
      {
        id: `user-${mockConversationState.messages.length + 1}`,
        role: 'user',
        text,
        timestamp: new Date(),
      },
    ]
  }),
  startAssistantTurn: jest.fn(),
  currentAudioUrl: null as string | null,
  isAudioPlaying: false,
  hangupRequest: null as { reason: string } | null,
  hangUp: jest.fn(),
  interrupt: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn(),
  stopAudio: jest.fn(),
  replayAudio: jest.fn(),
  clearMessages: jest.fn(() => {
    mockConversationState.messages = []
  }),
  hydrateMessages: jest.fn(
    (
      nextMessages: Array<{
        id: string
        role: 'user' | 'assistant'
        text: string
        timestamp: Date
      }>
    ) => {
      mockConversationState.messages = nextMessages
    }
  ),
  clearHangupRequest: jest.fn(),
  clearToolEvents: jest.fn(),
  toolEvents: [] as any[],
  coachingTip: null as { tip: string; stage: string; stageIndex: number } | null,
  clearCoachingTip: jest.fn(),
  audioElementRef: { current: null as HTMLAudioElement | null },
})

const buildSpeechState = () => ({
  isListening: false,
  transcript: '',
  interimTranscript: '',
  error: null as string | null,
  microphonePermission: 'granted' as const,
  isPermissionBlocked: false,
  isSupported: true,
  startListening: jest.fn().mockImplementation(async () => {
    mockSpeechState.isListening = true
    return true
  }),
  stopListening: jest.fn(() => {
    mockSpeechState.isListening = false
    mockSpeechState.interimTranscript = ''
  }),
  resetTranscript: jest.fn(() => {
    mockSpeechState.transcript = ''
    mockSpeechState.interimTranscript = ''
  }),
  requestMicrophoneAccess: jest.fn().mockResolvedValue(true),
})

jest.mock('next/navigation', () => ({
  useParams: () => ({ id: 'session-1' }),
  useSearchParams: () => ({ get: () => null }),
  useRouter: () => ({ push: mockPush, back: mockBack }),
}))

jest.mock('@/features/auth', () => ({
  useAuthStore: (selector: (state: { user: { settings: Record<string, unknown> } }) => unknown) =>
    selector({
      user: {
        settings: {
          voiceVideo: {
            speechSendDelayMs: 4000,
          },
        },
      },
    }),
}))

jest.mock('@/features/coins/hooks/useCoinsBalance', () => ({
  useInvalidateCoinsBalance: () => jest.fn(),
}))

jest.mock('@/features/stt', () => ({
  useSpeechToText: jest.fn(() => mockSpeechState),
}))

jest.mock('@/features/conversation', () => {
  const actual = jest.requireActual('@/features/conversation')
  return {
    ...actual,
    useConversation: jest.fn(() => mockConversationState),
    useVisualState: jest.fn(() => ({ isReady: false, currentState: null })),
    CameraEngagementIndicator: () => null,
  }
})

jest.mock('@/features/conversation/hooks/useAudioLevel', () => ({
  useAudioLevel: jest.fn(() => ({ current: null })),
}))

jest.mock('@/features/conversation/components/VoiceOrbSession', () => ({
  __esModule: true,
  default: (props: Record<string, any>) => (
    <div>
      <button type="button" onClick={props.onMicrophoneClick}>
        mic
      </button>
      <div data-testid="interim-transcript">{props.interimTranscript}</div>
      <div data-testid="pending-transcript">{props.pendingTranscript}</div>
      <div data-testid="commit-remaining">{String(props.sttCommitRemainingMs)}</div>
    </div>
  ),
}))

jest.mock('@/components/ui/CoachChatWidget', () => ({
  CoachChatWidget: () => null,
}))

jest.mock('@/components/ui/SettingsModal', () => ({
  SettingsModal: () => null,
}))

jest.mock('@/app/studio/sessions/create/components/UploadSection', () => ({
  UploadSection: () => null,
}))

jest.mock('@mantine/notifications', () => ({
  __esModule: true,
  Notifications: () => null,
  notifications: {
    show: jest.fn(),
  },
}))

jest.mock('@/lib/client', () => ({
  API_CONFIG: {
    baseURL: 'https://api.pitch.test/api/v1',
  },
  api: {
    sessions: {
      getById: jest.fn().mockResolvedValue({
        id: 'session-1',
        type: 'voice',
        status: 'active',
        name: 'Enterprise Pitch',
        sessionConfig: {
          multiTurnEnabled: true,
        },
      }),
      timeline: jest.fn().mockResolvedValue({
        total: 1,
        currentProgress: 25,
        plannedStages: [],
        conversationHistory: [
          {
            id: 'assistant-1',
            role: 'assistant',
            text: 'Welcome back. Tell me your opening pitch.',
            createdAt: '2026-04-01T10:00:00.000Z',
          },
        ],
      }),
      end: jest.fn(),
      restart: jest.fn(),
      update: jest.fn(),
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
      end: jest.fn(),
      start: jest.fn(),
    },
    tts: {
      speak: jest.fn(),
    },
  },
}))

describe('/session/[id] voice flow wiring', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
    mockConversationState = buildConversationState()
    mockSpeechState = buildSpeechState()
  })

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers()
    })
    jest.useRealTimers()
  })

  it('auto-starts the mic on the user turn and commits after the configured silence + send windows', async () => {
    let view: ReturnType<typeof render>
    await act(async () => {
      view = render(<LiveSessionPage />)
      await Promise.resolve()
    })

    await waitFor(() => expect(mockConversationState.hydrateMessages).toHaveBeenCalled())
    await waitFor(() => expect(mockSpeechState.startListening).toHaveBeenCalledTimes(1))

    mockSpeechState.isListening = true
    mockSpeechState.interimTranscript = 'My opening pitch'
    view!.rerender(<LiveSessionPage />)

    await waitFor(() =>
      expect(screen.getByTestId('interim-transcript')).toHaveTextContent('My opening pitch')
    )

    mockSpeechState.transcript = 'My opening pitch'
    mockSpeechState.interimTranscript = ''
    view!.rerender(<LiveSessionPage />)

    act(() => {
      jest.advanceTimersByTime(3000)
    })

    await waitFor(() =>
      expect(screen.getByTestId('pending-transcript')).toHaveTextContent('My opening pitch')
    )
    expect(
      Number(screen.getByTestId('commit-remaining').textContent ?? '0')
    ).toBeGreaterThanOrEqual(3900)

    act(() => {
      jest.advanceTimersByTime(4000)
    })

    await waitFor(() =>
      expect(mockConversationState.sendMessage).toHaveBeenCalledWith('My opening pitch')
    )
  })
})
