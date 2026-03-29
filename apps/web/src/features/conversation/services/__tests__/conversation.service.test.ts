import { ConversationService, conversationService } from '../conversation.service'
import { WsMessageType } from '../../types/conversation.types'

const mockSocket = {
  connected: false,
  on: jest.fn(),
  off: jest.fn(),
  emit: jest.fn(),
  disconnect: jest.fn(),
}

jest.mock('socket.io-client', () => ({
  io: jest.fn(() => mockSocket),
}))

beforeEach(() => {
  jest.clearAllMocks()
  mockSocket.connected = false
  mockSocket.on.mockReset()
  mockSocket.off.mockReset()
  mockSocket.emit.mockReset()
  mockSocket.disconnect.mockReset()
})

describe('ConversationService', () => {
  let service: ConversationService

  beforeEach(() => {
    service = new ConversationService()
  })

  describe('connect', () => {
    it('resolves immediately if already connected', async () => {
      mockSocket.connected = true
      // Simulate first connect to set socket
      mockSocket.on.mockImplementation((event: string, cb: Function) => {
        if (event === 'connect') cb()
      })
      await service.connect('token')

      // Second connect should resolve immediately
      await expect(service.connect('token')).resolves.toBeUndefined()
    })

    it('resolves on successful connection', async () => {
      mockSocket.on.mockImplementation((event: string, cb: Function) => {
        if (event === 'connect') {
          mockSocket.connected = true
          cb()
        }
      })

      await expect(service.connect('test-token')).resolves.toBeUndefined()
    })

    it('rejects after max reconnect attempts', async () => {
      mockSocket.on.mockImplementation((event: string, cb: Function) => {
        if (event === 'connect_error') {
          for (let i = 0; i < 5; i++) {
            cb(new Error('Connection failed'))
          }
        }
      })

      await expect(service.connect('test-token')).rejects.toThrow(
        'Failed to connect after 5 attempts'
      )
    })
  })

  describe('disconnect', () => {
    it('disconnects and nullifies socket', async () => {
      mockSocket.on.mockImplementation((event: string, cb: Function) => {
        if (event === 'connect') {
          mockSocket.connected = true
          cb()
        }
      })

      await service.connect('token')
      service.disconnect()
      expect(mockSocket.disconnect).toHaveBeenCalled()
    })

    it('does nothing when no socket exists', () => {
      expect(() => service.disconnect()).not.toThrow()
    })
  })

  describe('sendConversation', () => {
    beforeEach(async () => {
      mockSocket.on.mockImplementation((event: string, cb: Function) => {
        if (event === 'connect') {
          mockSocket.connected = true
          cb()
        }
      })
      await service.connect('token')
    })

    it('emits conversation start with envelope', () => {
      const requestId = service.sendConversation('session-1', { text: 'Hello' })

      expect(requestId).toMatch(/^conv_/)
      expect(mockSocket.emit).toHaveBeenCalledWith(
        WsMessageType.CONVERSATION_START,
        expect.objectContaining({
          type: WsMessageType.CONVERSATION_START,
          sessionId: 'session-1',
          payload: { text: 'Hello' },
        })
      )
    })

    it('throws when socket is not connected', () => {
      mockSocket.connected = false
      expect(() => service.sendConversation('s1', { text: 'hi' })).toThrow(
        'WebSocket not connected'
      )
    })
  })

  describe('sendVisualState', () => {
    it('does nothing when not connected', () => {
      service.sendVisualState('s1', {} as any)
      expect(mockSocket.emit).not.toHaveBeenCalled()
    })

    it('emits visual state when connected', async () => {
      mockSocket.on.mockImplementation((event: string, cb: Function) => {
        if (event === 'connect') {
          mockSocket.connected = true
          cb()
        }
      })
      await service.connect('token')

      const state = { screen: 'main' } as any
      service.sendVisualState('s1', state)
      expect(mockSocket.emit).toHaveBeenCalledWith(WsMessageType.CONVERSATION_VISUAL_STATE, {
        sessionId: 's1',
        state,
      })
    })
  })

  describe('cancelConversation', () => {
    it('resolves immediately when not connected', async () => {
      await expect(service.cancelConversation('s1')).resolves.toBeUndefined()
    })

    it('emits cancel and resolves on ack', async () => {
      mockSocket.on.mockImplementation((event: string, cb: Function) => {
        if (event === 'connect') {
          mockSocket.connected = true
          cb()
        }
        if (event === WsMessageType.CONVERSATION_CANCEL) {
          setTimeout(() => cb({ requestId: 'cancel_123' }), 10)
        }
      })
      await service.connect('token')

      await expect(service.cancelConversation('s1', 'cancel_123')).resolves.toBeUndefined()
    })

    it('resolves via timeout if no ack received', async () => {
      mockSocket.on.mockImplementation((event: string, cb: Function) => {
        if (event === 'connect') {
          mockSocket.connected = true
          cb()
        }
      })
      await service.connect('token')

      jest.useFakeTimers()
      const promise = service.cancelConversation('s1')
      jest.advanceTimersByTime(1500)
      await expect(promise).resolves.toBeUndefined()
      jest.useRealTimers()
    })
  })

  describe('event listener methods', () => {
    beforeEach(async () => {
      mockSocket.on.mockImplementation((event: string, cb: Function) => {
        if (event === 'connect') {
          mockSocket.connected = true
          cb()
        }
      })
      await service.connect('token')
      mockSocket.on.mockClear()
      mockSocket.off.mockClear()
    })

    it('onConversationText registers listener', () => {
      const cb = jest.fn()
      service.onConversationText(cb)
      expect(mockSocket.on).toHaveBeenCalledWith(WsMessageType.CONVERSATION_TEXT, cb)
    })

    it('offConversationText removes listener', () => {
      service.offConversationText()
      expect(mockSocket.off).toHaveBeenCalledWith(WsMessageType.CONVERSATION_TEXT)
    })

    it('onConversationStreamDelta registers listener', () => {
      const cb = jest.fn()
      service.onConversationStreamDelta(cb)
      expect(mockSocket.on).toHaveBeenCalledWith(WsMessageType.CONVERSATION_STREAM_DELTA, cb)
    })

    it('offConversationStreamDelta removes listener', () => {
      service.offConversationStreamDelta()
      expect(mockSocket.off).toHaveBeenCalledWith(WsMessageType.CONVERSATION_STREAM_DELTA)
    })

    it('onConversationStreamCompleted registers listener', () => {
      const cb = jest.fn()
      service.onConversationStreamCompleted(cb)
      expect(mockSocket.on).toHaveBeenCalledWith(WsMessageType.CONVERSATION_STREAM_COMPLETED, cb)
    })

    it('offConversationStreamCompleted removes listener', () => {
      service.offConversationStreamCompleted()
      expect(mockSocket.off).toHaveBeenCalledWith(WsMessageType.CONVERSATION_STREAM_COMPLETED)
    })

    it('onConversationAudioReady registers listener', () => {
      const cb = jest.fn()
      service.onConversationAudioReady(cb)
      expect(mockSocket.on).toHaveBeenCalledWith(WsMessageType.CONVERSATION_AUDIO_READY, cb)
    })

    it('offConversationAudioReady removes listener', () => {
      service.offConversationAudioReady()
      expect(mockSocket.off).toHaveBeenCalledWith(WsMessageType.CONVERSATION_AUDIO_READY)
    })

    it('onConversationAudioChunk returns unsubscribe function', () => {
      const cb = jest.fn()
      const unsub = service.onConversationAudioChunk(cb)
      expect(mockSocket.on).toHaveBeenCalledWith(WsMessageType.CONVERSATION_AUDIO_CHUNK, cb)
      unsub()
      expect(mockSocket.off).toHaveBeenCalledWith(WsMessageType.CONVERSATION_AUDIO_CHUNK, cb)
    })

    it('offConversationAudioChunk removes all listeners for the event', () => {
      service.offConversationAudioChunk()
      expect(mockSocket.off).toHaveBeenCalledWith(WsMessageType.CONVERSATION_AUDIO_CHUNK)
    })

    it('onConversationError registers listener', () => {
      const cb = jest.fn()
      service.onConversationError(cb)
      expect(mockSocket.on).toHaveBeenCalledWith(WsMessageType.CONVERSATION_ERROR, cb)
    })

    it('offConversationError removes listener', () => {
      service.offConversationError()
      expect(mockSocket.off).toHaveBeenCalledWith(WsMessageType.CONVERSATION_ERROR)
    })

    it('onConversationEnd registers listener', () => {
      const cb = jest.fn()
      service.onConversationEnd(cb)
      expect(mockSocket.on).toHaveBeenCalledWith(WsMessageType.CONVERSATION_END, cb)
    })

    it('offConversationEnd removes listener', () => {
      service.offConversationEnd()
      expect(mockSocket.off).toHaveBeenCalledWith(WsMessageType.CONVERSATION_END)
    })

    it('onConversationCancel registers listener', () => {
      const cb = jest.fn()
      service.onConversationCancel(cb)
      expect(mockSocket.on).toHaveBeenCalledWith(WsMessageType.CONVERSATION_CANCEL, cb)
    })

    it('offConversationCancel removes listener', () => {
      service.offConversationCancel()
      expect(mockSocket.off).toHaveBeenCalledWith(WsMessageType.CONVERSATION_CANCEL)
    })

    it('onConversationHangupRequested registers listener', () => {
      const cb = jest.fn()
      service.onConversationHangupRequested(cb)
      expect(mockSocket.on).toHaveBeenCalledWith(WsMessageType.CONVERSATION_HANGUP_REQUESTED, cb)
    })

    it('offConversationHangupRequested removes listener', () => {
      service.offConversationHangupRequested()
      expect(mockSocket.off).toHaveBeenCalledWith(WsMessageType.CONVERSATION_HANGUP_REQUESTED)
    })

    it('onConversationToolExecuted registers listener', () => {
      const cb = jest.fn()
      service.onConversationToolExecuted(cb)
      expect(mockSocket.on).toHaveBeenCalledWith(WsMessageType.CONVERSATION_TOOL_EXECUTED, cb)
    })

    it('offConversationToolExecuted removes listener', () => {
      service.offConversationToolExecuted()
      expect(mockSocket.off).toHaveBeenCalledWith(WsMessageType.CONVERSATION_TOOL_EXECUTED)
    })
  })

  describe('event listeners on null socket', () => {
    it('on* methods are no-ops when socket is null', () => {
      const cb = jest.fn()
      service.onConversationText(cb)
      service.onConversationStreamDelta(cb)
      service.onConversationStreamCompleted(cb)
      service.onConversationAudioReady(cb)
      service.onConversationError(cb)
      service.onConversationEnd(cb)
      service.onConversationCancel(cb)
      service.onConversationHangupRequested(cb)
      service.onConversationToolExecuted(cb)
      expect(mockSocket.on).not.toHaveBeenCalled()
    })

    it('off* methods are no-ops when socket is null', () => {
      service.offConversationText()
      service.offConversationStreamDelta()
      service.offConversationStreamCompleted()
      service.offConversationAudioReady()
      service.offConversationAudioChunk()
      service.offConversationError()
      service.offConversationEnd()
      service.offConversationCancel()
      service.offConversationHangupRequested()
      service.offConversationToolExecuted()
      expect(mockSocket.off).not.toHaveBeenCalled()
    })

    it('onConversationAudioChunk returns no-op unsub when no socket', () => {
      const unsub = service.onConversationAudioChunk(jest.fn())
      expect(unsub).toBeInstanceOf(Function)
      expect(() => unsub()).not.toThrow()
    })
  })

  describe('isConnected', () => {
    it('returns false when no socket', () => {
      expect(service.isConnected()).toBe(false)
    })

    it('returns true when connected', async () => {
      mockSocket.on.mockImplementation((event: string, cb: Function) => {
        if (event === 'connect') {
          mockSocket.connected = true
          cb()
        }
      })
      await service.connect('token')
      expect(service.isConnected()).toBe(true)
    })
  })

  describe('ping / onPong', () => {
    it('ping does nothing when not connected', () => {
      service.ping()
      expect(mockSocket.emit).not.toHaveBeenCalled()
    })

    it('ping emits when connected', async () => {
      mockSocket.on.mockImplementation((event: string, cb: Function) => {
        if (event === 'connect') {
          mockSocket.connected = true
          cb()
        }
      })
      await service.connect('token')
      service.ping()
      expect(mockSocket.emit).toHaveBeenCalledWith(WsMessageType.PING)
    })

    it('onPong does nothing when no socket', () => {
      service.onPong(jest.fn())
      expect(mockSocket.on).not.toHaveBeenCalled()
    })

    it('onPong registers listener when connected', async () => {
      mockSocket.on.mockImplementation((event: string, cb: Function) => {
        if (event === 'connect') {
          mockSocket.connected = true
          cb()
        }
      })
      await service.connect('token')
      mockSocket.on.mockClear()

      const cb = jest.fn()
      service.onPong(cb)
      expect(mockSocket.on).toHaveBeenCalledWith(WsMessageType.PONG, cb)
    })
  })

  describe('conversationService singleton', () => {
    it('is an instance of ConversationService', () => {
      expect(conversationService).toBeInstanceOf(ConversationService)
    })
  })
})
