/**
 * Comprehensive tests for useConversation hook.
 *
 * Strategy:
 *  - Mock `conversationService` singleton: capture registered event callbacks
 *    so tests can fire them directly without a real WebSocket.
 *  - Mock the `Audio` constructor: control play/pause/onended lifecycle manually.
 *  - Mock URL.createObjectURL / revokeObjectURL to track blob lifecycle.
 *  - Each test renders a fresh hook instance via renderHook.
 *
 * NOTE: jest.mock factories are hoisted above all declarations, so the mock
 * object must be defined inline inside the factory. Use jest.requireMock()
 * to obtain a typed reference to it after the fact.
 */
import { renderHook, act, waitFor } from '@testing-library/react'
import { useConversation } from '../useConversation'

// ─── Auth mocks ───────────────────────────────────────────────────────────────
jest.mock('@/lib/client', () => ({
  getAccessToken: jest.fn().mockReturnValue('mock-token'),
  refreshAccessToken: jest.fn().mockResolvedValue('mock-token'),
}))

// ─── Service mock (factory must be self-contained — no outer variable refs) ───
jest.mock('../../services/conversation.service', () => ({
  conversationService: {
    connect: jest.fn(),
    disconnect: jest.fn(),
    isConnected: jest.fn(),
    sendConversation: jest.fn(),
    cancelConversation: jest.fn(),
    clearSocketDisconnect: jest.fn(),
    sendVisualState: jest.fn(),
    onSocketDisconnect: jest.fn(),
    onConversationText: jest.fn(),
    offConversationText: jest.fn(),
    onConversationStreamDelta: jest.fn(),
    offConversationStreamDelta: jest.fn(),
    onConversationStreamCompleted: jest.fn(),
    offConversationStreamCompleted: jest.fn(),
    onConversationAudioReady: jest.fn(),
    offConversationAudioReady: jest.fn(),
    onConversationAudioChunk: jest.fn(),
    offConversationAudioChunk: jest.fn(),
    onConversationError: jest.fn(),
    offConversationError: jest.fn(),
    onConversationEnd: jest.fn(),
    offConversationEnd: jest.fn(),
    onConversationCancel: jest.fn(),
    offConversationCancel: jest.fn(),
    onConversationHangupRequested: jest.fn(),
    offConversationHangupRequested: jest.fn(),
    onConversationToolExecuted: jest.fn(),
    offConversationToolExecuted: jest.fn(),
    onConversationCoachingTip: jest.fn(),
    offConversationCoachingTip: jest.fn(),
  },
}))

// ─── Typed reference to the mocked service ────────────────────────────────────
// jest.requireMock() is safe here: jest.mock() is hoisted above this line.
const svc = jest.requireMock('../../services/conversation.service').conversationService as {
  connect: jest.Mock
  disconnect: jest.Mock
  isConnected: jest.Mock
  sendConversation: jest.Mock
  cancelConversation: jest.Mock
  clearSocketDisconnect: jest.Mock
  sendVisualState: jest.Mock
  onSocketDisconnect: jest.Mock
  onConversationText: jest.Mock
  offConversationText: jest.Mock
  onConversationStreamDelta: jest.Mock
  offConversationStreamDelta: jest.Mock
  onConversationStreamCompleted: jest.Mock
  offConversationStreamCompleted: jest.Mock
  onConversationAudioReady: jest.Mock
  offConversationAudioReady: jest.Mock
  onConversationAudioChunk: jest.Mock
  offConversationAudioChunk: jest.Mock
  onConversationError: jest.Mock
  offConversationError: jest.Mock
  onConversationEnd: jest.Mock
  offConversationEnd: jest.Mock
  onConversationCancel: jest.Mock
  offConversationCancel: jest.Mock
  onConversationHangupRequested: jest.Mock
  offConversationHangupRequested: jest.Mock
  onConversationToolExecuted: jest.Mock
  offConversationToolExecuted: jest.Mock
  onConversationCoachingTip: jest.Mock
  offConversationCoachingTip: jest.Mock
}

// ─── Captured event callbacks (populated when setupEventListeners() fires) ────
const cbs: {
  text?: (d: any) => void
  delta?: (d: any) => void
  completed?: (d: any) => void
  audioChunk?: (d: any) => void
  error?: (d: any) => void
  end?: (d: any) => void
  cancel?: (d: any) => void
  hangup?: (d: any) => void
  toolExecuted?: (d: any) => void
  coachingTip?: (d: any) => void
  disconnectMid?: (reason: string) => void
} = {}

// ─── Audio element mock ───────────────────────────────────────────────────────
type MockAudio = {
  play: jest.Mock
  pause: jest.Mock
  currentTime: number
  onended: (() => void) | null
  onerror: (() => void) | null
  onplay: (() => void) | null
  preload: string
}

let audioInstances: MockAudio[] = []

const makeAudioInstance = (
  playBehavior: 'resolve' | 'reject-not-allowed' | 'reject-other' = 'resolve'
): MockAudio => {
  const inst: MockAudio = {
    play: jest.fn().mockImplementation(() => {
      if (playBehavior === 'resolve') return Promise.resolve()
      if (playBehavior === 'reject-not-allowed')
        return Promise.reject(new DOMException('autoplay blocked', 'NotAllowedError'))
      return Promise.reject(new Error('media error'))
    }),
    pause: jest.fn(),
    currentTime: 0,
    onended: null,
    onerror: null,
    onplay: null,
    preload: '',
  }
  audioInstances.push(inst)
  return inst
}

// ─── URL mocks ────────────────────────────────────────────────────────────────
let urlCounter = 0
const savedCreate = URL.createObjectURL
const savedRevoke = URL.revokeObjectURL

// ─── Constants ────────────────────────────────────────────────────────────────
const SESSION_ID = 'sess-test'
const REQ_ID = 'req-1'

// ─── Per-test setup ───────────────────────────────────────────────────────────
beforeEach(() => {
  // Clear captured callbacks from previous test
  Object.keys(cbs).forEach((k) => delete (cbs as any)[k])

  audioInstances = []
  urlCounter = 0

  // Default: Audio plays successfully
  ;(global as any).Audio = jest.fn().mockImplementation(() => makeAudioInstance('resolve'))

  URL.createObjectURL = jest.fn().mockImplementation(() => `blob:mock-${++urlCounter}`)
  URL.revokeObjectURL = jest.fn()

  // Reset all service mock call histories
  Object.values(svc).forEach((fn) => {
    if (typeof fn === 'function' && 'mockReset' in (fn as any)) {
      ;(fn as jest.Mock).mockReset()
    }
  })

  // Re-apply default return values after mockReset
  svc.connect.mockResolvedValue(undefined)
  svc.isConnected.mockReturnValue(true)
  svc.sendConversation.mockReturnValue(REQ_ID)
  svc.cancelConversation.mockResolvedValue(undefined)

  // Re-bind callback capture implementations
  svc.onSocketDisconnect.mockImplementation((cb: any) => {
    cbs.disconnectMid = cb
  })
  svc.onConversationText.mockImplementation((cb: any) => {
    cbs.text = cb
  })
  svc.onConversationStreamDelta.mockImplementation((cb: any) => {
    cbs.delta = cb
  })
  svc.onConversationStreamCompleted.mockImplementation((cb: any) => {
    cbs.completed = cb
  })
  svc.onConversationAudioReady.mockImplementation(() => {})
  svc.onConversationAudioChunk.mockImplementation((cb: any) => {
    cbs.audioChunk = cb
  })
  svc.onConversationError.mockImplementation((cb: any) => {
    cbs.error = cb
  })
  svc.onConversationEnd.mockImplementation((cb: any) => {
    cbs.end = cb
  })
  svc.onConversationCancel.mockImplementation((cb: any) => {
    cbs.cancel = cb
  })
  svc.onConversationHangupRequested.mockImplementation((cb: any) => {
    cbs.hangup = cb
  })
  svc.onConversationToolExecuted.mockImplementation((cb: any) => {
    cbs.toolExecuted = cb
  })
  svc.onConversationCoachingTip.mockImplementation((cb: any) => {
    cbs.coachingTip = cb
  })
})

afterEach(() => {
  URL.createObjectURL = savedCreate
  URL.revokeObjectURL = savedRevoke
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Render hook and wait until connected. */
async function setup(opts: Partial<Parameters<typeof useConversation>[0]> = {}) {
  const hook = renderHook(() =>
    useConversation({ sessionId: SESSION_ID, autoConnect: true, ...opts })
  )
  await waitFor(() => expect(hook.result.current.isConnected).toBe(true))
  return hook
}

/** Build a CONVERSATION_AUDIO_CHUNK envelope. */
function mkChunk(sentenceIndex: number, sentenceText?: string, reqId = REQ_ID) {
  return {
    requestId: reqId,
    sessionId: SESSION_ID,
    payload: {
      sentenceIndex,
      audio: new Uint8Array([1, 2, 3]).buffer as ArrayBuffer,
      contentType: 'audio/mpeg',
      ...(sentenceText !== undefined ? { sentenceText } : {}),
    },
  }
}

/** Build a generic WsEnvelope-like object. */
function mkEnv<T>(payload: T, reqId = REQ_ID) {
  return { type: 'test', requestId: reqId, sessionId: SESSION_ID, payload }
}

function dispatchPointerDown() {
  try {
    window.dispatchEvent(new PointerEvent('pointerdown'))
  } catch {
    window.dispatchEvent(new Event('pointerdown'))
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. CONNECTION LIFECYCLE
// ─────────────────────────────────────────────────────────────────────────────
describe('connection lifecycle', () => {
  it('auto-connects on mount and sets isConnected=true', async () => {
    const { result } = await setup()
    expect(svc.connect).toHaveBeenCalledWith('mock-token')
    expect(result.current.isConnected).toBe(true)
    expect(result.current.isConnecting).toBe(false)
  })

  it('does not connect when autoConnect=false', async () => {
    renderHook(() => useConversation({ sessionId: SESSION_ID, autoConnect: false }))
    await new Promise((r) => setTimeout(r, 20))
    expect(svc.connect).not.toHaveBeenCalled()
  })

  it('sets error when connect() rejects after retries', async () => {
    jest.useFakeTimers()
    svc.isConnected.mockReturnValue(false)
    svc.connect.mockRejectedValue(new Error('server down'))

    const { result } = renderHook(() =>
      useConversation({ sessionId: SESSION_ID, autoConnect: true })
    )

    for (let i = 0; i < 4; i++) {
      await act(async () => {
        jest.advanceTimersByTime(5000)
      })
    }

    await waitFor(() => expect(result.current.error).toMatch(/server down/i))
    expect(result.current.isConnected).toBe(false)
    jest.useRealTimers()
  })

  it('registers all event listeners after connecting', async () => {
    await setup()
    expect(svc.onConversationText).toHaveBeenCalled()
    expect(svc.onConversationStreamDelta).toHaveBeenCalled()
    expect(svc.onConversationAudioChunk).toHaveBeenCalled()
    expect(svc.onConversationError).toHaveBeenCalled()
  })

  it('calls disconnect on unmount', async () => {
    const { unmount } = await setup()
    unmount()
    expect(svc.disconnect).toHaveBeenCalled()
  })

  it('reconnects on mid-session drop', async () => {
    jest.useFakeTimers()
    svc.isConnected.mockReturnValue(false)
    await setup()

    act(() => {
      cbs.disconnectMid?.('transport close')
    })

    await act(async () => {
      jest.advanceTimersByTime(2000)
    })
    // connect called once (initial) + at least once (retry)
    expect(svc.connect.mock.calls.length).toBeGreaterThanOrEqual(2)
    jest.useRealTimers()
  })

  it('stops reconnecting after hangUp', async () => {
    jest.useFakeTimers()
    const { result } = await setup()

    act(() => {
      result.current.hangUp()
    })
    act(() => {
      cbs.disconnectMid?.('transport close')
    })
    await act(async () => {
      jest.advanceTimersByTime(5000)
    })

    // connect called only once (initial) — no retry after hang up
    expect(svc.connect).toHaveBeenCalledTimes(1)
    jest.useRealTimers()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. SEND MESSAGE
// ─────────────────────────────────────────────────────────────────────────────
describe('sendMessage', () => {
  it('adds a user message to state and sets isProcessing=true', async () => {
    const { result } = await setup()
    act(() => {
      result.current.sendMessage('hello')
    })

    expect(result.current.isProcessing).toBe(true)
    expect(result.current.messages).toHaveLength(1)
    expect(result.current.messages[0]).toMatchObject({ role: 'user', text: 'hello' })
  })

  it('calls sendConversation on the service with the message text', async () => {
    const { result } = await setup()
    act(() => {
      result.current.sendMessage('hi there')
    })

    expect(svc.sendConversation).toHaveBeenCalledWith(
      SESSION_ID,
      expect.objectContaining({ text: 'hi there' })
    )
  })

  it('sets error and does not send when not connected', async () => {
    svc.isConnected.mockReturnValue(false)
    const { result } = await setup()

    act(() => {
      result.current.sendMessage('hello')
    })

    await waitFor(() => expect(result.current.error).toMatch(/not connected/i))
    expect(svc.sendConversation).not.toHaveBeenCalled()
  })

  it('clears the error state before sending', async () => {
    const { result } = await setup()
    act(() => {
      result.current.sendMessage('hello')
    })
    act(() => {
      cbs.error?.(mkEnv({ error: 'previous error' }))
    })
    await waitFor(() => expect(result.current.error).toBe('previous error'))

    svc.sendConversation.mockReturnValue('req-2')
    act(() => {
      result.current.sendMessage('hello')
    })

    expect(result.current.error).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 3. AUDIO QUEUE — ordering and gap detection
// ─────────────────────────────────────────────────────────────────────────────
describe('audio queue', () => {
  it('plays chunk 0 immediately when it arrives', async () => {
    const { result } = await setup()
    act(() => {
      result.current.sendMessage('hello')
    })

    act(() => {
      cbs.audioChunk!(mkChunk(0))
    })

    await waitFor(() => expect(audioInstances).toHaveLength(1))
    expect(audioInstances[0].play).toHaveBeenCalled()
  })

  it('plays chunks in index order when they arrive out of order', async () => {
    const { result } = await setup()
    act(() => {
      result.current.sendMessage('hello')
    })

    // Chunk 1 arrives before chunk 0
    act(() => {
      cbs.audioChunk!(mkChunk(1))
      cbs.audioChunk!(mkChunk(0))
    })

    // Chunk 0 is played first
    await waitFor(() => expect(audioInstances).toHaveLength(1))
    expect(audioInstances[0].play).toHaveBeenCalled()

    // Finish chunk 0 → chunk 1 plays
    act(() => {
      audioInstances[0].onended?.()
    })
    await waitFor(() => expect(audioInstances).toHaveLength(2))
    expect(audioInstances[1].play).toHaveBeenCalled()
  })

  it('waits for a missing chunk when totalSentences is not yet known', async () => {
    const { result } = await setup()
    act(() => {
      result.current.sendMessage('hello')
    })

    // Only chunk 1 arrives — chunk 0 is missing
    act(() => {
      cbs.audioChunk!(mkChunk(1))
    })

    // Nothing should play (stuck waiting for chunk 0)
    await new Promise((r) => setTimeout(r, 30))
    expect(audioInstances).toHaveLength(0)

    // Chunk 0 arrives → unblocks the queue
    act(() => {
      cbs.audioChunk!(mkChunk(0))
    })
    await waitFor(() => expect(audioInstances).toHaveLength(1))
  })

  it('skips a gap sentence once totalSentences is known', async () => {
    const { result } = await setup()
    act(() => {
      result.current.sendMessage('hello')
    })

    act(() => {
      cbs.audioChunk!(mkChunk(0))
    })
    await waitFor(() => expect(audioInstances).toHaveLength(1))
    act(() => {
      audioInstances[0].onended?.()
    })

    // Chunk 1 never arrives. StreamCompleted says 2 total sentences → gap is skipped.
    act(() => {
      cbs.completed!(mkEnv({ fullText: 'Hello there.', totalSentences: 2 }))
    })

    await new Promise((r) => setTimeout(r, 30))
    // No second Audio created — sentence 1 was skipped
    expect(audioInstances).toHaveLength(1)
  })

  it('revokes the blob URL after a sentence finishes playing', async () => {
    const { result } = await setup()
    act(() => {
      result.current.sendMessage('hello')
    })
    act(() => {
      cbs.audioChunk!(mkChunk(0))
    })
    await waitFor(() => expect(audioInstances).toHaveLength(1))

    act(() => {
      audioInstances[0].onended?.()
    })

    expect(URL.revokeObjectURL).toHaveBeenCalled()
  })

  it('clears the queue on sendMessage (new turn)', async () => {
    const { result } = await setup()
    act(() => {
      result.current.sendMessage('hello')
    })
    act(() => {
      cbs.audioChunk!(mkChunk(0))
    })
    await waitFor(() => expect(audioInstances).toHaveLength(1))

    svc.sendConversation.mockReturnValue('req-2')
    act(() => {
      result.current.sendMessage('next message')
    })

    expect(audioInstances[0].pause).toHaveBeenCalled()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 4. AUTOPLAY RETRY (core bug fix)
// ─────────────────────────────────────────────────────────────────────────────
describe('autoplay retry — NotAllowedError handling', () => {
  beforeEach(() => {
    ;(global as any).Audio = jest
      .fn()
      .mockImplementation(() => makeAudioInstance('reject-not-allowed'))
  })

  it('does NOT call onEnded when play() throws NotAllowedError', async () => {
    const { result } = await setup()
    act(() => {
      result.current.sendMessage('hello')
    })

    // Queue 2 chunks — only sentence 0 is attempted, queue freezes
    act(() => {
      cbs.audioChunk!(mkChunk(0))
      cbs.audioChunk!(mkChunk(1))
    })

    await waitFor(() => expect(result.current.error).toMatch(/browser blocked autoplay/i))

    // Only ONE Audio instance — if onEnded had been called, tryPlayNext would have
    // advanced to sentence 1 and created a second Audio element
    expect((global as any).Audio).toHaveBeenCalledTimes(1)
  })

  it('keeps isAudioPlaying=false when blocked', async () => {
    const { result } = await setup()
    act(() => {
      result.current.sendMessage('hello')
    })
    act(() => {
      cbs.audioChunk!(mkChunk(0))
    })

    await waitFor(() => expect(result.current.error).toMatch(/browser blocked autoplay/i))
    expect(result.current.isAudioPlaying).toBe(false)
  })

  it('resumes from the exact blocked sentence on pointerdown gesture', async () => {
    let callCount = 0
    ;(global as any).Audio = jest.fn().mockImplementation(() => {
      const inst = makeAudioInstance('resolve')
      if (callCount === 0) {
        inst.play.mockRejectedValueOnce(new DOMException('blocked', 'NotAllowedError'))
      }
      callCount++
      return inst
    })

    const { result } = await setup()
    act(() => {
      result.current.sendMessage('hello')
    })
    act(() => {
      cbs.audioChunk!(mkChunk(0))
    })

    await waitFor(() => expect(result.current.error).toMatch(/browser blocked autoplay/i))

    act(() => {
      dispatchPointerDown()
    })

    // Error clears on successful retry
    await waitFor(() => expect(result.current.error).toBeNull())
    // First Audio (blocked) + second Audio (retry)
    expect((global as any).Audio).toHaveBeenCalledTimes(2)
  })

  it('resumes via keydown gesture as well', async () => {
    let first = true
    ;(global as any).Audio = jest.fn().mockImplementation(() => {
      const inst = makeAudioInstance('resolve')
      if (first) {
        inst.play.mockRejectedValueOnce(new DOMException('blocked', 'NotAllowedError'))
        first = false
      }
      return inst
    })

    const { result } = await setup()
    act(() => {
      result.current.sendMessage('hello')
    })
    act(() => {
      cbs.audioChunk!(mkChunk(0))
    })
    await waitFor(() => expect(result.current.error).toMatch(/browser blocked autoplay/i))

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown'))
    })

    await waitFor(() => expect(result.current.error).toBeNull())
  })

  it('advances the queue after retry: sentence 1 plays after sentence 0', async () => {
    let callCount = 0
    ;(global as any).Audio = jest.fn().mockImplementation(() => {
      const inst = makeAudioInstance('resolve')
      if (callCount === 0) {
        inst.play.mockRejectedValueOnce(new DOMException('blocked', 'NotAllowedError'))
      }
      callCount++
      return inst
    })

    const { result } = await setup()
    act(() => {
      result.current.sendMessage('hello')
    })

    act(() => {
      cbs.audioChunk!(mkChunk(0))
      cbs.audioChunk!(mkChunk(1))
    })
    await waitFor(() => expect(result.current.error).toMatch(/browser blocked autoplay/i))

    // Retry sentence 0
    act(() => {
      dispatchPointerDown()
    })
    await waitFor(() => expect(result.current.error).toBeNull())

    // Finish sentence 0 retry (instance index 1)
    act(() => {
      audioInstances[1].onended?.()
    })

    // Sentence 1 now plays (instance index 2)
    await waitFor(() => expect((global as any).Audio).toHaveBeenCalledTimes(3))
    expect(audioInstances[2].play).toHaveBeenCalled()
  })

  it('clears pendingPlaybackRef when stopAudio is called', async () => {
    const { result } = await setup()
    act(() => {
      result.current.sendMessage('hello')
    })
    act(() => {
      cbs.audioChunk!(mkChunk(0))
    })
    await waitFor(() => expect(result.current.error).toMatch(/browser blocked autoplay/i))

    act(() => {
      result.current.stopAudio()
    })

    // After stopAudio, gesture should NOT replay anything
    ;(global as any).Audio = jest.fn().mockImplementation(() => makeAudioInstance('resolve'))
    act(() => {
      dispatchPointerDown()
    })

    await new Promise((r) => setTimeout(r, 20))
    expect((global as any).Audio).not.toHaveBeenCalled()
  })

  it('handles non-NotAllowed errors by calling onEnded and advancing the queue', async () => {
    ;(global as any).Audio = jest.fn().mockImplementation(() => makeAudioInstance('reject-other'))

    const { result } = await setup()
    act(() => {
      result.current.sendMessage('hello')
    })

    act(() => {
      cbs.audioChunk!(mkChunk(0))
      cbs.audioChunk!(mkChunk(1))
    })

    // Non-NotAllowed → onEnded IS called → queue advances → sentence 1 attempted
    await waitFor(() => expect((global as any).Audio).toHaveBeenCalledTimes(2))
    expect(result.current.error).toMatch(/Failed to play audio/i)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 5. TEXT / AUDIO SYNC
// ─────────────────────────────────────────────────────────────────────────────
describe('text/audio sync', () => {
  it('streams delta text normally when no audio chunks arrive', async () => {
    const { result } = await setup()
    act(() => {
      result.current.sendMessage('hello')
    })

    act(() => {
      cbs.delta!(mkEnv({ delta: 'Hello' }))
      cbs.delta!(mkEnv({ delta: ' there' }))
      cbs.delta!(mkEnv({ delta: '!' }))
    })

    await waitFor(() => expect(result.current.messages.at(-1)?.text).toBe('Hello there!'))
  })

  it('suppresses delta updates once the first audio chunk arrives', async () => {
    const { result } = await setup()
    act(() => {
      result.current.sendMessage('hello')
    })

    // Deltas flow before audio
    act(() => {
      cbs.delta!(mkEnv({ delta: 'Hello' }))
    })
    expect(result.current.messages.at(-1)?.text).toBe('Hello')

    // Audio chunk arrives → ttsActive = true → deltas suppressed
    act(() => {
      cbs.audioChunk!(mkChunk(0, 'Audio sentence.'))
    })

    act(() => {
      cbs.delta!(mkEnv({ delta: ' suppressed' }))
    })

    // Text reflects the sentenceText reveal, not the suppressed delta
    await waitFor(() => expect(result.current.messages.at(-1)?.text).toBe('Audio sentence.'))
  })

  it('reveals sentence 0 text when chunk 0 arrives (text set in tryPlayNext)', async () => {
    const { result } = await setup()
    act(() => {
      result.current.sendMessage('hello')
    })

    act(() => {
      cbs.audioChunk!(mkChunk(0, 'First sentence.'))
    })

    await waitFor(() => expect(result.current.messages.at(-1)?.text).toBe('First sentence.'))
  })

  it('accumulates sentences as each one starts playing', async () => {
    const { result } = await setup()
    act(() => {
      result.current.sendMessage('hello')
    })

    // Chunk 0 → text = "First."
    act(() => {
      cbs.audioChunk!(mkChunk(0, 'First.'))
    })
    await waitFor(() => expect(result.current.messages.at(-1)?.text).toBe('First.'))

    // Queue chunk 1, finish chunk 0 → tryPlayNext runs → text = "First. Second."
    act(() => {
      cbs.audioChunk!(mkChunk(1, 'Second.'))
    })
    act(() => {
      audioInstances[0].onended?.()
    })

    await waitFor(() => expect(result.current.messages.at(-1)?.text).toBe('First. Second.'))
  })

  it('skips missing sentence texts gracefully', async () => {
    const { result } = await setup()
    act(() => {
      result.current.sendMessage('hello')
    })

    // Chunk 0 has no sentenceText, chunk 1 has text
    act(() => {
      cbs.audioChunk!(mkChunk(0))
    })
    act(() => {
      cbs.audioChunk!(mkChunk(1, 'Second.'))
    })
    act(() => {
      audioInstances[0].onended?.()
    })

    // Only "Second." appears (idx=0 empty → filtered out)
    await waitFor(() => expect(result.current.messages.at(-1)?.text).toBe('Second.'))
  })

  it('always shows fullText from StreamCompleted regardless of TTS state', async () => {
    const { result } = await setup()
    act(() => {
      result.current.sendMessage('hello')
    })

    act(() => {
      cbs.audioChunk!(mkChunk(0, 'Partial.'))
    })
    act(() => {
      cbs.completed!(mkEnv({ fullText: 'Partial. Complete!', totalSentences: 1 }))
    })

    await waitFor(() => expect(result.current.messages.at(-1)?.text).toBe('Partial. Complete!'))
  })

  it('resets ttsActive on clearAudioQueue so deltas flow again', async () => {
    const { result } = await setup()
    act(() => {
      result.current.sendMessage('hello')
    })

    act(() => {
      cbs.audioChunk!(mkChunk(0, 'Hello.'))
    })
    await waitFor(() => expect(result.current.messages.at(-1)?.text).toBe('Hello.'))

    // Interrupt clears queue → ttsActive = false
    svc.sendConversation.mockReturnValue('req-2')
    act(() => {
      result.current.interrupt()
    })
    act(() => {
      result.current.sendMessage('new message')
    })

    // Deltas should stream again
    act(() => {
      cbs.delta!(mkEnv({ delta: 'Streaming again' }, 'req-2'))
    })

    await waitFor(() => expect(result.current.messages.at(-1)?.text).toBe('Streaming again'))
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 6. WEBSOCKET EVENT HANDLERS
// ─────────────────────────────────────────────────────────────────────────────
describe('event handlers', () => {
  it('CONVERSATION_TEXT: creates/updates assistant message', async () => {
    const { result } = await setup()
    act(() => {
      result.current.sendMessage('hello')
    })
    act(() => {
      cbs.text!(mkEnv({ text: 'I am the AI response.' }))
    })

    await waitFor(() =>
      expect(result.current.messages.at(-1)).toMatchObject({
        role: 'assistant',
        text: 'I am the AI response.',
      })
    )
  })

  it('CONVERSATION_STREAM_DELTA: appends to existing text', async () => {
    const { result } = await setup()
    act(() => {
      result.current.sendMessage('hello')
    })
    act(() => {
      cbs.delta!(mkEnv({ delta: 'Hello' }))
      cbs.delta!(mkEnv({ delta: ' world' }))
    })

    await waitFor(() => expect(result.current.messages.at(-1)?.text).toBe('Hello world'))
  })

  it('CONVERSATION_STREAM_COMPLETED: persists fullText', async () => {
    const { result } = await setup()
    act(() => {
      result.current.sendMessage('hello')
    })
    act(() => {
      cbs.completed!(mkEnv({ fullText: 'Done.', totalSentences: 2 }))
    })

    await waitFor(() => expect(result.current.messages.at(-1)?.text).toBe('Done.'))
  })

  it('CONVERSATION_ERROR: stops processing, sets error, clears queue', async () => {
    const { result } = await setup()
    act(() => {
      result.current.sendMessage('hello')
    })
    act(() => {
      cbs.error!(mkEnv({ error: 'LLM overloaded' }))
    })

    await waitFor(() => {
      expect(result.current.isProcessing).toBe(false)
      expect(result.current.error).toBe('LLM overloaded')
    })
  })

  it('CONVERSATION_END: clears isProcessing', async () => {
    const { result } = await setup()
    act(() => {
      result.current.sendMessage('hello')
    })
    expect(result.current.isProcessing).toBe(true)

    act(() => {
      cbs.end!(mkEnv({}))
    })

    await waitFor(() => expect(result.current.isProcessing).toBe(false))
  })

  it('CONVERSATION_CANCEL: stops audio and clears queue', async () => {
    const { result } = await setup()
    act(() => {
      result.current.sendMessage('hello')
    })
    act(() => {
      cbs.audioChunk!(mkChunk(0))
    })
    await waitFor(() => expect(audioInstances).toHaveLength(1))

    act(() => {
      cbs.cancel!(mkEnv({}))
    })

    expect(audioInstances[0].pause).toHaveBeenCalled()
    await waitFor(() => expect(result.current.isProcessing).toBe(false))
  })

  it('CONVERSATION_HANGUP_REQUESTED: sets hangupRequest', async () => {
    const { result } = await setup()
    act(() => {
      result.current.sendMessage('hello')
    })
    act(() => {
      cbs.hangup!(mkEnv({ reason: 'session_complete' }))
    })

    await waitFor(() =>
      expect(result.current.hangupRequest).toMatchObject({ reason: 'session_complete' })
    )
  })

  it('CONVERSATION_TOOL_EXECUTED: appends to toolEvents', async () => {
    const { result } = await setup()
    act(() => {
      cbs.toolExecuted!(mkEnv({ tool: 'get_calendar_events', args: { date: 'today' } }))
    })

    await waitFor(() => {
      expect(result.current.toolEvents).toHaveLength(1)
      expect(result.current.toolEvents[0].tool).toBe('get_calendar_events')
    })
  })

  it('CONVERSATION_TOOL_EXECUTED: ring buffer caps at 10 events', async () => {
    const { result } = await setup()
    act(() => {
      for (let i = 0; i < 12; i++) {
        cbs.toolExecuted!(mkEnv({ tool: `tool_${i}`, args: {} }))
      }
    })

    await waitFor(() => expect(result.current.toolEvents).toHaveLength(10))
    expect(result.current.toolEvents[9].tool).toBe('tool_11')
  })

  it('CONVERSATION_COACHING_TIP: sets coachingTip', async () => {
    const { result } = await setup()
    act(() => {
      cbs.coachingTip!(mkEnv({ tip: 'Use open questions.', stage: 'discovery', stageIndex: 1 }))
    })

    await waitFor(() =>
      expect(result.current.coachingTip).toMatchObject({
        tip: 'Use open questions.',
        stage: 'discovery',
      })
    )
  })

  it('ignores events from a different requestId (stale responses)', async () => {
    const { result } = await setup()
    act(() => {
      result.current.sendMessage('hello')
    })

    act(() => {
      cbs.text!(mkEnv({ text: 'From wrong request' }, 'wrong-req-id'))
    })

    await new Promise((r) => setTimeout(r, 10))
    expect(result.current.messages.filter((m) => m.role === 'assistant')).toHaveLength(0)
  })

  it('ignores all events after hangUp', async () => {
    const { result } = await setup()
    act(() => {
      result.current.sendMessage('hello')
    })
    act(() => {
      result.current.hangUp()
    })

    act(() => {
      cbs.text?.(mkEnv({ text: 'Should be ignored' }))
      cbs.delta?.(mkEnv({ delta: 'Ignored too' }))
    })

    await new Promise((r) => setTimeout(r, 10))
    expect(result.current.messages.filter((m) => m.role === 'assistant')).toHaveLength(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 7. HANG UP AND INTERRUPT
// ─────────────────────────────────────────────────────────────────────────────
describe('hangUp and interrupt', () => {
  it('hangUp stops audio, disconnects, and resets processing state', async () => {
    const { result } = await setup()
    act(() => {
      result.current.sendMessage('hello')
    })
    act(() => {
      cbs.audioChunk!(mkChunk(0))
    })
    await waitFor(() => expect(audioInstances).toHaveLength(1))

    act(() => {
      result.current.hangUp()
    })

    expect(audioInstances[0].pause).toHaveBeenCalled()
    expect(svc.disconnect).toHaveBeenCalled()
    expect(result.current.isProcessing).toBe(false)
    expect(result.current.isConnected).toBe(false)
  })

  it('interrupt stops current audio and calls cancelConversation', async () => {
    const { result } = await setup()
    act(() => {
      result.current.sendMessage('hello')
    })
    act(() => {
      cbs.audioChunk!(mkChunk(0))
    })
    await waitFor(() => expect(audioInstances).toHaveLength(1))

    act(() => {
      result.current.interrupt()
    })

    expect(audioInstances[0].pause).toHaveBeenCalled()
    expect(svc.cancelConversation).toHaveBeenCalledWith(SESSION_ID, REQ_ID)
    expect(result.current.isProcessing).toBe(false)
  })

  it('interrupt clears queue: stale onended does not play next sentence', async () => {
    const { result } = await setup()
    act(() => {
      result.current.sendMessage('hello')
    })
    act(() => {
      cbs.audioChunk!(mkChunk(0))
      cbs.audioChunk!(mkChunk(1))
    })
    await waitFor(() => expect(audioInstances).toHaveLength(1))

    act(() => {
      result.current.interrupt()
    })

    // Stale onended fires — version mismatch means sentence 1 is NOT played
    act(() => {
      audioInstances[0].onended?.()
    })

    await new Promise((r) => setTimeout(r, 20))
    expect(audioInstances).toHaveLength(1)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 8. MESSAGE MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────
describe('message management', () => {
  it('upsert creates a new message when requestId not found', async () => {
    const { result } = await setup()
    act(() => {
      result.current.sendMessage('hello')
    })
    act(() => {
      cbs.text!(mkEnv({ text: 'Response.' }))
    })

    await waitFor(() =>
      expect(result.current.messages.find((m) => m.role === 'assistant')).toBeDefined()
    )
    expect(result.current.messages).toHaveLength(2) // user + assistant
  })

  it('upsert updates an existing message in-place (no duplicates)', async () => {
    const { result } = await setup()
    act(() => {
      result.current.sendMessage('hello')
    })
    act(() => {
      cbs.delta!(mkEnv({ delta: 'Hello' }))
      cbs.delta!(mkEnv({ delta: ' world' }))
    })

    await waitFor(() => expect(result.current.messages.at(-1)?.text).toBe('Hello world'))
    // 1 assistant message updated in-place, not duplicated
    expect(result.current.messages.filter((m) => m.role === 'assistant')).toHaveLength(1)
  })

  it('clearMessages removes all messages', async () => {
    const { result } = await setup()
    act(() => {
      result.current.sendMessage('hello')
    })
    act(() => {
      cbs.text!(mkEnv({ text: 'Response.' }))
    })
    await waitFor(() => expect(result.current.messages).toHaveLength(2))

    act(() => {
      result.current.clearMessages()
    })

    expect(result.current.messages).toHaveLength(0)
  })

  it('hydrateMessages replaces all messages with the provided set', async () => {
    const { result } = await setup()
    act(() => {
      result.current.sendMessage('hello')
    })
    await waitFor(() => expect(result.current.messages).toHaveLength(1))

    const historical = [
      { id: 'h-1', role: 'user' as const, text: 'Old message', timestamp: new Date() },
      { id: 'h-2', role: 'assistant' as const, text: 'Old reply', timestamp: new Date() },
    ]
    act(() => {
      result.current.hydrateMessages(historical)
    })

    expect(result.current.messages).toHaveLength(2)
    expect(result.current.messages[0].id).toBe('h-1')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 9. EXTERNAL AUDIO OUTPUT
// ─────────────────────────────────────────────────────────────────────────────
describe('external audio output', () => {
  it('routes chunks to onExternalAudioChunk instead of browser Audio', async () => {
    const onExternalChunk = jest.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() =>
      useConversation({
        sessionId: SESSION_ID,
        autoConnect: true,
        audioOutput: 'external',
        onExternalAudioChunk: onExternalChunk,
      })
    )
    await waitFor(() => expect(result.current.isConnected).toBe(true))

    act(() => {
      result.current.sendMessage('hello')
    })
    act(() => {
      cbs.audioChunk!(mkChunk(0))
    })

    await waitFor(() => expect(onExternalChunk).toHaveBeenCalled())

    // No browser Audio elements created
    expect((global as any).Audio).not.toHaveBeenCalled()
    expect(onExternalChunk).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: REQ_ID, sentenceIndex: 0, contentType: 'audio/mpeg' })
    )
  })

  it('calls onExternalAudioStop when stopAudio is invoked', async () => {
    const onStop = jest.fn()
    const { result } = renderHook(() =>
      useConversation({
        sessionId: SESSION_ID,
        autoConnect: true,
        audioOutput: 'external',
        onExternalAudioStop: onStop,
      })
    )
    await waitFor(() => expect(result.current.isConnected).toBe(true))

    act(() => {
      result.current.stopAudio()
    })

    expect(onStop).toHaveBeenCalled()
  })

  it('advances the queue after onExternalAudioChunk resolves', async () => {
    let resolveChunk!: () => void
    const onExternalChunk = jest.fn().mockImplementation(
      () =>
        new Promise<void>((r) => {
          resolveChunk = r
        })
    )
    const { result } = renderHook(() =>
      useConversation({
        sessionId: SESSION_ID,
        autoConnect: true,
        audioOutput: 'external',
        onExternalAudioChunk: onExternalChunk,
      })
    )
    await waitFor(() => expect(result.current.isConnected).toBe(true))
    act(() => {
      result.current.sendMessage('hello')
    })

    act(() => {
      cbs.audioChunk!(mkChunk(0))
      cbs.audioChunk!(mkChunk(1))
    })

    await waitFor(() => expect(onExternalChunk).toHaveBeenCalledTimes(1))

    // Resolve chunk 0 → chunk 1 is sent
    await act(async () => {
      resolveChunk()
    })

    await waitFor(() => expect(onExternalChunk).toHaveBeenCalledTimes(2))
    expect(onExternalChunk).toHaveBeenLastCalledWith(expect.objectContaining({ sentenceIndex: 1 }))
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 10. REPLAY AUDIO
// ─────────────────────────────────────────────────────────────────────────────
describe('replayAudio', () => {
  it('replays the currentAudioUrl when called', async () => {
    const { result } = await setup()
    act(() => {
      result.current.sendMessage('hello')
    })
    act(() => {
      cbs.audioChunk!(mkChunk(0))
    })
    await waitFor(() => expect(audioInstances).toHaveLength(1))

    act(() => {
      result.current.replayAudio()
    })

    await waitFor(() => expect(audioInstances).toHaveLength(2))
    expect(audioInstances[1].play).toHaveBeenCalled()
  })

  it('does nothing when audioOutput is external', async () => {
    const { result } = renderHook(() =>
      useConversation({
        sessionId: SESSION_ID,
        autoConnect: true,
        audioOutput: 'external',
      })
    )
    await waitFor(() => expect(result.current.isConnected).toBe(true))

    act(() => {
      result.current.replayAudio()
    })

    expect((global as any).Audio).not.toHaveBeenCalled()
  })
})
