import { act, renderHook, waitFor } from '@testing-library/react'
import { useVoiceTurnController, type VoiceTurnPhase } from '../useVoiceTurnController'

type MutableControllerOptions = Parameters<typeof useVoiceTurnController>[0]

const buildOptions = (
  overrides: Partial<MutableControllerOptions> = {}
): MutableControllerOptions => ({
  enabled: true,
  sessionStatus: 'active',
  sessionName: 'Enterprise Pitch',
  personaName: 'Avery Chen',
  isConnected: true,
  isConnecting: false,
  isProcessing: false,
  assistantSpeaking: false,
  isListening: false,
  isSttSupported: true,
  isSttPermissionBlocked: false,
  microphonePermission: 'granted',
  transcript: '',
  interimTranscript: '',
  messages: [],
  entryDecisionLoading: false,
  resumePromptOpen: false,
  prelaunchModalOpen: false,
  postSilenceSendDelayMs: 4000,
  startAssistantTurn: jest.fn(),
  onCommitUserTurn: jest.fn(),
  interrupt: jest.fn().mockResolvedValue(undefined),
  stopAudio: jest.fn(),
  requestMicrophoneAccess: jest.fn().mockResolvedValue(true),
  startListening: jest.fn().mockResolvedValue(true),
  stopListening: jest.fn(),
  resetTranscript: jest.fn(),
  ...overrides,
})

const expectPhase = async (
  result: { current: { phase: VoiceTurnPhase } },
  phase: VoiceTurnPhase
) => {
  await waitFor(() => expect(result.current.phase).toBe(phase))
}

describe('useVoiceTurnController', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers()
    })
    jest.useRealTimers()
    jest.clearAllMocks()
  })

  it('opens the assistant after 3 seconds only when the user has not started first', async () => {
    const options = buildOptions()
    const { result } = renderHook(
      (props: MutableControllerOptions) => useVoiceTurnController(props),
      {
        initialProps: options,
      }
    )

    await expectPhase(result, 'assistant_opening_pending')

    act(() => {
      jest.advanceTimersByTime(2999)
    })
    expect(options.startAssistantTurn).not.toHaveBeenCalled()

    act(() => {
      jest.advanceTimersByTime(1)
    })

    expect(options.startAssistantTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        starterPrompt: expect.stringContaining('PITCH practice session'),
      })
    )
  })

  it('cancels the assistant opener if the user manually takes the mic first', async () => {
    const options = buildOptions({
      microphonePermission: 'unknown',
    })
    const { result } = renderHook(
      (props: MutableControllerOptions) => useVoiceTurnController(props),
      {
        initialProps: options,
      }
    )

    await expectPhase(result, 'assistant_opening_pending')

    await act(async () => {
      await result.current.handleMicrophoneClick()
    })

    expect(options.requestMicrophoneAccess).toHaveBeenCalled()
    expect(options.startListening).toHaveBeenCalled()

    act(() => {
      jest.advanceTimersByTime(3000)
    })

    expect(options.startAssistantTurn).not.toHaveBeenCalled()
  })

  it('deduplicates microphone permission requests while access is already being requested', async () => {
    let resolvePermission!: (value: boolean) => void
    const options = buildOptions({
      microphonePermission: 'unknown',
      requestMicrophoneAccess: jest.fn(
        () =>
          new Promise<boolean>((resolve) => {
            resolvePermission = resolve
          })
      ),
      startListening: jest.fn().mockResolvedValue(true),
    })
    const { result } = renderHook(
      (props: MutableControllerOptions) => useVoiceTurnController(props),
      {
        initialProps: options,
      }
    )

    await expectPhase(result, 'assistant_opening_pending')

    let firstTap!: Promise<void>
    let secondTap!: Promise<void>
    await act(async () => {
      firstTap = result.current.handleMicrophoneClick()
      secondTap = result.current.handleMicrophoneClick()
      resolvePermission(true)
      await Promise.all([firstTap, secondTap])
    })

    expect(options.requestMicrophoneAccess).toHaveBeenCalledTimes(1)
    expect(options.startListening).toHaveBeenCalledTimes(1)
  })

  it('turns the mic off immediately when assistant thinking or speaking starts', async () => {
    const options = buildOptions({
      isListening: true,
      messages: [{ id: 'assistant-1', role: 'assistant', text: 'Your turn.' }],
    })
    const { rerender } = renderHook(
      (props: MutableControllerOptions) => useVoiceTurnController(props),
      {
        initialProps: options,
      }
    )

    rerender({
      ...options,
      isListening: true,
      isProcessing: true,
    })

    expect(options.stopListening).toHaveBeenCalledTimes(1)

    rerender({
      ...options,
      isListening: true,
      assistantSpeaking: true,
    })

    expect(options.stopListening).toHaveBeenCalledTimes(2)
  })

  it('auto-starts the mic when the assistant turn ends', async () => {
    const options = buildOptions({
      messages: [{ id: 'assistant-1', role: 'assistant', text: 'Tell me more.' }],
    })
    const { result } = renderHook(
      (props: MutableControllerOptions) => useVoiceTurnController(props),
      {
        initialProps: options,
      }
    )

    await expectPhase(result, 'user_listening')
    await waitFor(() => expect(options.startListening).toHaveBeenCalledTimes(1))
  })

  it('starts the 3 second silence window only after speech stops and resets when speech resumes', async () => {
    const options = buildOptions({
      isListening: true,
      messages: [{ id: 'assistant-1', role: 'assistant', text: 'Go ahead.' }],
      transcript: 'hello there',
    })
    const { result, rerender } = renderHook(
      (props: MutableControllerOptions) => useVoiceTurnController(props),
      {
        initialProps: options,
      }
    )

    await expectPhase(result, 'user_silence_window')
    expect(result.current.sttCommitRemainingMs).toBe(3000)

    act(() => {
      jest.advanceTimersByTime(1200)
    })
    expect(result.current.sttCommitRemainingMs).toBeLessThan(3000)

    rerender({
      ...options,
      isListening: true,
      transcript: 'hello there',
      interimTranscript: 'hello there again',
    })

    await expectPhase(result, 'user_listening')
    expect(result.current.sttCommitRemainingMs).toBe(0)

    rerender({
      ...options,
      isListening: true,
      transcript: 'hello there again',
      interimTranscript: '',
    })

    await expectPhase(result, 'user_silence_window')
    expect(result.current.sttCommitRemainingMs).toBe(3000)
  })

  it('runs the 4 second send countdown, resets on renewed speech, and sends once on expiry', async () => {
    const options = buildOptions({
      isListening: true,
      messages: [{ id: 'assistant-1', role: 'assistant', text: 'Go ahead.' }],
      transcript: 'hello there',
    })
    const { result, rerender } = renderHook(
      (props: MutableControllerOptions) => useVoiceTurnController(props),
      {
        initialProps: options,
      }
    )

    await expectPhase(result, 'user_silence_window')

    act(() => {
      jest.advanceTimersByTime(3000)
    })

    await expectPhase(result, 'user_send_countdown')
    expect(result.current.sttCommitRemainingMs).toBe(4000)

    act(() => {
      jest.advanceTimersByTime(2000)
    })
    expect(result.current.sttCommitRemainingMs).toBeLessThan(4000)

    rerender({
      ...options,
      isListening: true,
      transcript: 'hello there',
      interimTranscript: 'hello there again',
    })

    await expectPhase(result, 'user_listening')
    expect(options.onCommitUserTurn).not.toHaveBeenCalled()

    rerender({
      ...options,
      isListening: true,
      transcript: 'hello there again',
      interimTranscript: '',
    })

    act(() => {
      jest.advanceTimersByTime(3000)
    })
    await expectPhase(result, 'user_send_countdown')

    act(() => {
      jest.advanceTimersByTime(4000)
    })

    expect(options.onCommitUserTurn).toHaveBeenCalledTimes(1)
    expect(options.onCommitUserTurn).toHaveBeenCalledWith('hello there again')
    await expectPhase(result, 'user_committing')

    rerender({
      ...options,
      isListening: false,
      isProcessing: true,
      transcript: 'hello there again',
      interimTranscript: '',
    })

    act(() => {
      jest.advanceTimersByTime(140)
    })

    expect(options.stopListening).toHaveBeenCalled()
    expect(options.resetTranscript).toHaveBeenCalled()
  })

  it('uses the latest commit callback when the countdown completes after props change', async () => {
    const initialCommit = jest.fn()
    const latestCommit = jest.fn()
    const options = buildOptions({
      isListening: true,
      messages: [{ id: 'assistant-1', role: 'assistant', text: 'Go ahead.' }],
      transcript: 'hello there',
      onCommitUserTurn: initialCommit,
    })
    const { result, rerender } = renderHook(
      (props: MutableControllerOptions) => useVoiceTurnController(props),
      {
        initialProps: options,
      }
    )

    await expectPhase(result, 'user_silence_window')

    act(() => {
      jest.advanceTimersByTime(3000)
    })

    await expectPhase(result, 'user_send_countdown')

    rerender({
      ...options,
      isListening: true,
      transcript: 'hello there',
      onCommitUserTurn: latestCommit,
    })

    act(() => {
      jest.advanceTimersByTime(4000)
    })

    expect(initialCommit).not.toHaveBeenCalled()
    expect(latestCommit).toHaveBeenCalledWith('hello there')
  })

  it('interrupts assistant thinking on manual mic tap and starts a fresh capture cycle before commit', async () => {
    const options = buildOptions({
      isProcessing: true,
      messages: [{ id: 'user-1', role: 'user', text: 'Previous turn.' }],
    })
    const { result, rerender } = renderHook(
      (props: MutableControllerOptions) => useVoiceTurnController(props),
      {
        initialProps: options,
      }
    )

    await act(async () => {
      await result.current.handleMicrophoneClick()
    })

    const interruptMock = options.interrupt as jest.Mock
    const startListeningMock = options.startListening as jest.Mock
    const onCommitUserTurnMock = options.onCommitUserTurn as jest.Mock

    expect(options.interrupt).toHaveBeenCalledTimes(1)
    expect(options.stopAudio).toHaveBeenCalledTimes(1)
    expect(options.startListening).toHaveBeenCalledTimes(1)
    expect(interruptMock.mock.invocationCallOrder[0]).toBeLessThan(
      startListeningMock.mock.invocationCallOrder[0]
    )

    rerender({
      ...options,
      isProcessing: false,
      isListening: true,
      transcript: 'updated answer',
    })

    act(() => {
      jest.advanceTimersByTime(3000 + 4000 + 140)
    })

    expect(options.onCommitUserTurn).toHaveBeenCalledWith('updated answer')
    expect(interruptMock.mock.invocationCallOrder[0]).toBeLessThan(
      onCommitUserTurnMock.mock.invocationCallOrder[0]
    )
  })

  it('stops listening and clears the transcript on unmount', () => {
    const options = buildOptions({
      isListening: true,
      transcript: 'hello there',
    })
    const { unmount } = renderHook(
      (props: MutableControllerOptions) => useVoiceTurnController(props),
      {
        initialProps: options,
      }
    )

    unmount()

    expect(options.stopListening).toHaveBeenCalled()
    expect(options.resetTranscript).toHaveBeenCalled()
  })
})
