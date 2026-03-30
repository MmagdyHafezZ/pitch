import { resolveConversationWsUrl, ConversationService } from '../conversation.service'
import { WsMessageType } from '../../types/conversation.types'

// ─── resolveConversationWsUrl ──────────────────────────────────────────────────
describe('resolveConversationWsUrl', () => {
  it('prefers an explicit websocket url when configured', () => {
    expect(resolveConversationWsUrl('https://ws.pitch.test', 'https://api.pitch.test/api/v1')).toBe(
      'https://ws.pitch.test'
    )
  })

  it('derives the websocket origin from the api url when no websocket url is set', () => {
    expect(resolveConversationWsUrl(undefined, 'https://api.pitch.test/api/v1')).toBe(
      'https://api.pitch.test'
    )
  })

  it('falls back to localhost when the api url cannot be parsed', () => {
    expect(resolveConversationWsUrl(undefined, 'not a url')).toBe('http://localhost:8000')
  })

  it('strips /api/v2 path from api url', () => {
    expect(resolveConversationWsUrl(undefined, 'https://api.example.com/api/v2')).toBe(
      'https://api.example.com'
    )
  })

  it('strips trailing slash from the resolved url', () => {
    const result = resolveConversationWsUrl(undefined, 'https://api.example.com/api/v1/')
    expect(result).not.toMatch(/\/$/)
  })

  it('falls back to localhost when no urls are provided', () => {
    expect(resolveConversationWsUrl(undefined, undefined)).toBe('http://localhost:8000')
  })

  it('trims whitespace from the websocket url', () => {
    expect(resolveConversationWsUrl('  https://ws.pitch.test  ', 'https://api.pitch.test')).toBe(
      'https://ws.pitch.test'
    )
  })

  it('ignores an empty string websocket url and falls back to api url', () => {
    expect(resolveConversationWsUrl('', 'https://api.pitch.test/api/v1')).toBe(
      'https://api.pitch.test'
    )
  })
})

// ─── ConversationService ───────────────────────────────────────────────────────

// Mock socket.io-client so we can control socket events without a real server
type SocketEventHandler = (...args: any[]) => void

interface MockSocket {
  connected: boolean
  on: jest.Mock
  off: jest.Mock
  emit: jest.Mock
  disconnect: jest.Mock
  // helpers to fire events in tests
  _trigger: (event: string, ...args: any[]) => void
  _handlers: Map<string, SocketEventHandler[]>
}

const makeMockSocket = (): MockSocket => {
  const handlers: Map<string, SocketEventHandler[]> = new Map()

  const socket: MockSocket = {
    connected: false,
    on: jest.fn((event: string, handler: SocketEventHandler) => {
      const list = handlers.get(event) ?? []
      list.push(handler)
      handlers.set(event, list)
    }),
    off: jest.fn((event: string, handler?: SocketEventHandler) => {
      if (!handler) {
        handlers.delete(event)
      } else {
        const list = (handlers.get(event) ?? []).filter((h) => h !== handler)
        handlers.set(event, list)
      }
    }),
    emit: jest.fn(),
    disconnect: jest.fn().mockImplementation(() => {
      socket.connected = false
    }),
    _trigger: (event: string, ...args: any[]) => {
      ;(handlers.get(event) ?? []).forEach((h) => h(...args))
    },
    _handlers: handlers,
  }
  return socket
}

let mockSocket: MockSocket

jest.mock('socket.io-client', () => ({
  io: jest.fn(),
}))

const { io } = require('socket.io-client') as { io: jest.Mock }

beforeEach(() => {
  mockSocket = makeMockSocket()
  io.mockImplementation(() => mockSocket)
})

afterEach(() => {
  io.mockReset()
})

// ─── connect() ────────────────────────────────────────────────────────────────
describe('ConversationService.connect()', () => {
  it('resolves when the socket emits "connect"', async () => {
    const svc = new ConversationService()
    const p = svc.connect('token-abc')

    // Simulate successful connection
    mockSocket.connected = true
    mockSocket._trigger('connect')

    await expect(p).resolves.toBeUndefined()
    expect(svc.isConnected()).toBe(true)
  })

  it('rejects when connect_error fires', async () => {
    const svc = new ConversationService()
    const p = svc.connect('token-abc')

    mockSocket._trigger('connect_error', new Error('unauthorized'))

    await expect(p).rejects.toThrow('unauthorized')
    expect(svc.isConnected()).toBe(false)
  })

  it('rejects when the socket disconnects before connecting', async () => {
    const svc = new ConversationService()
    const p = svc.connect('token-abc')

    mockSocket._trigger('disconnect', 'transport close')

    await expect(p).rejects.toThrow(/Disconnected while connecting/)
  })

  it('times out and rejects after 6 seconds with no response', async () => {
    jest.useFakeTimers()
    const svc = new ConversationService()
    const p = svc.connect('token-abc')

    jest.advanceTimersByTime(6001)

    await expect(p).rejects.toThrow(/Timed out/)
    jest.useRealTimers()
  })

  it('supersedes the previous in-flight connect() when called again', async () => {
    const svc = new ConversationService()
    const first = svc.connect('token-1')
    const second = svc.connect('token-2')

    // First should reject with "Connection superseded"
    await expect(first).rejects.toThrow('Connection superseded')

    // Second resolves normally
    mockSocket.connected = true
    mockSocket._trigger('connect')
    await expect(second).resolves.toBeUndefined()
  })

  it('resolves immediately when already connected (no-op)', async () => {
    const svc = new ConversationService()
    // First connect
    const p1 = svc.connect('token')
    mockSocket.connected = true
    mockSocket._trigger('connect')
    await p1

    // Second connect when already connected
    io.mockImplementation(() => makeMockSocket())
    await expect(svc.connect('token')).resolves.toBeUndefined()
    // io() was called only once (first connect)
    expect(io).toHaveBeenCalledTimes(1)
  })

  it('calls onSocketDisconnect callback on mid-session drop', async () => {
    const svc = new ConversationService()
    const p = svc.connect('token')
    mockSocket.connected = true
    mockSocket._trigger('connect')
    await p

    const onDrop = jest.fn()
    svc.onSocketDisconnect(onDrop)

    // Simulate mid-session drop
    mockSocket._trigger('disconnect', 'ping timeout')

    expect(onDrop).toHaveBeenCalledWith('ping timeout')
  })
})

// ─── disconnect() ─────────────────────────────────────────────────────────────
describe('ConversationService.disconnect()', () => {
  it('disconnects the socket and sets isConnected to false', async () => {
    const svc = new ConversationService()
    const p = svc.connect('token')
    mockSocket.connected = true
    mockSocket._trigger('connect')
    await p

    svc.disconnect()

    expect(mockSocket.disconnect).toHaveBeenCalled()
    expect(svc.isConnected()).toBe(false)
  })

  it('rejects any in-flight connect() with "Connection superseded"', async () => {
    const svc = new ConversationService()
    const p = svc.connect('token')

    svc.disconnect()

    await expect(p).rejects.toThrow('Connection superseded')
  })

  it('clears the disconnect callback', async () => {
    const svc = new ConversationService()
    const p = svc.connect('token')
    mockSocket.connected = true
    mockSocket._trigger('connect')
    await p

    const onDrop = jest.fn()
    svc.onSocketDisconnect(onDrop)
    svc.disconnect()

    // Callback should not fire after explicit disconnect
    mockSocket._trigger('disconnect', 'io client disconnect')
    expect(onDrop).not.toHaveBeenCalled()
  })
})

// ─── sendConversation() ───────────────────────────────────────────────────────
describe('ConversationService.sendConversation()', () => {
  it('emits a CONVERSATION_START envelope and returns a requestId', async () => {
    const svc = new ConversationService()
    const p = svc.connect('token')
    mockSocket.connected = true
    mockSocket._trigger('connect')
    await p

    const requestId = svc.sendConversation('sess-1', { text: 'hello' })

    expect(typeof requestId).toBe('string')
    expect(requestId).toMatch(/^conv_/)
    expect(mockSocket.emit).toHaveBeenCalledWith(
      WsMessageType.CONVERSATION_START,
      expect.objectContaining({
        type: WsMessageType.CONVERSATION_START,
        sessionId: 'sess-1',
        payload: expect.objectContaining({ text: 'hello' }),
      })
    )
  })

  it('throws when the socket is not connected', () => {
    const svc = new ConversationService()
    expect(() => svc.sendConversation('sess-1', { text: 'hello' })).toThrow(
      /WebSocket not connected/
    )
  })
})

// ─── cancelConversation() ─────────────────────────────────────────────────────
describe('ConversationService.cancelConversation()', () => {
  it('resolves immediately when not connected', async () => {
    const svc = new ConversationService()
    await expect(svc.cancelConversation('sess-1', 'req-1')).resolves.toBeUndefined()
  })

  it('emits CONVERSATION_CANCEL and resolves when ack arrives', async () => {
    const svc = new ConversationService()
    const p = svc.connect('token')
    mockSocket.connected = true
    mockSocket._trigger('connect')
    await p

    const cancelPromise = svc.cancelConversation('sess-1', 'req-cancel-1')

    // Server acknowledges
    mockSocket._trigger(WsMessageType.CONVERSATION_CANCEL, { requestId: 'req-cancel-1' })

    await expect(cancelPromise).resolves.toBeUndefined()
    expect(mockSocket.emit).toHaveBeenCalledWith(
      WsMessageType.CONVERSATION_CANCEL,
      expect.objectContaining({ requestId: 'req-cancel-1' })
    )
  })

  it('resolves after 1.5s timeout if no ack arrives', async () => {
    jest.useFakeTimers()
    const svc = new ConversationService()
    const p = svc.connect('token')
    mockSocket.connected = true
    mockSocket._trigger('connect')
    await p

    const cancelPromise = svc.cancelConversation('sess-1', 'req-timeout')

    jest.advanceTimersByTime(1600)
    await expect(cancelPromise).resolves.toBeUndefined()

    jest.useRealTimers()
  })
})

// ─── event listener helpers ───────────────────────────────────────────────────
describe('ConversationService event listeners', () => {
  let svc: ConversationService

  beforeEach(async () => {
    svc = new ConversationService()
    const p = svc.connect('token')
    mockSocket.connected = true
    mockSocket._trigger('connect')
    await p
  })

  it('onConversationText registers a listener and offConversationText removes it', () => {
    const cb = jest.fn()
    svc.onConversationText(cb)
    expect(mockSocket.on).toHaveBeenCalledWith(WsMessageType.CONVERSATION_TEXT, cb)

    svc.offConversationText()
    expect(mockSocket.off).toHaveBeenCalledWith(WsMessageType.CONVERSATION_TEXT)
  })

  it('onConversationAudioChunk returns an unsubscribe function', () => {
    const cb = jest.fn()
    const unsub = svc.onConversationAudioChunk(cb)

    expect(typeof unsub).toBe('function')
    unsub()
    expect(mockSocket.off).toHaveBeenCalledWith(WsMessageType.CONVERSATION_AUDIO_CHUNK, cb)
  })

  it('isConnected returns true when socket is connected', () => {
    mockSocket.connected = true
    expect(svc.isConnected()).toBe(true)
  })

  it('isConnected returns false when socket is disconnected', () => {
    mockSocket.connected = false
    expect(svc.isConnected()).toBe(false)
  })

  it('sendVisualState is a no-op when not connected', () => {
    mockSocket.connected = false
    expect(() => svc.sendVisualState('sess', { speaking: false } as any)).not.toThrow()
    expect(mockSocket.emit).not.toHaveBeenCalledWith(
      WsMessageType.CONVERSATION_VISUAL_STATE,
      expect.anything()
    )
  })
})
