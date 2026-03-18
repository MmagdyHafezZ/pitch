import { io, Socket } from 'socket.io-client'
import {
  WsEnvelope,
  WsMessageType,
  ConversationStartPayload,
  ConversationTextPayload,
  ConversationStreamDeltaPayload,
  ConversationStreamCompletedPayload,
  ConversationAudioReadyPayload,
  ConversationAudioChunkPayload,
  ConversationErrorPayload,
  ConversationHangupRequestedPayload,
  ConversationToolExecutedPayload,
} from '../types/conversation.types'
import type { VisualState } from '../types/visual-state.types'

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:8000'

export class ConversationService {
  private socket: Socket | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000

  connect(token: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.socket?.connected) {
        resolve()
        return
      }

      this.socket = io(`${WS_URL}/simulation`, {
        auth: { token },
        transports: ['websocket'],
        reconnection: true,
        reconnectionDelay: this.reconnectDelay,
        reconnectionAttempts: this.maxReconnectAttempts,
      })

      this.socket.on('connect', () => {
        this.reconnectAttempts = 0
        resolve()
      })

      this.socket.on('connect_error', (error) => {
        this.reconnectAttempts++
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          reject(new Error(`Failed to connect after ${this.maxReconnectAttempts} attempts`))
        }
      })

      this.socket.on('disconnect', (reason) => {})
    })
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
  }

  sendConversation(sessionId: string, payload: ConversationStartPayload): string {
    if (!this.socket?.connected) {
      throw new Error('WebSocket not connected')
    }

    const requestId = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    const envelope: WsEnvelope<ConversationStartPayload> = {
      type: WsMessageType.CONVERSATION_START,
      requestId,
      sessionId,
      payload,
      timestamp: new Date().toISOString(),
    }

    this.socket.emit(WsMessageType.CONVERSATION_START, envelope)

    return requestId
  }

  /**
   * Send a semantic VisualState snapshot to the server.
   * The gateway stores it in memory and injects it into the next
   * CONVERSATION_START prompt — no blocking, no extra RTT.
   */
  sendVisualState(sessionId: string, state: VisualState) {
    if (!this.socket?.connected) return
    this.socket.emit(WsMessageType.CONVERSATION_VISUAL_STATE, { sessionId, state })
  }

  cancelConversation(sessionId: string, requestId?: string) {
    if (!this.socket?.connected) {
      return
    }

    const envelope = {
      type: WsMessageType.CONVERSATION_CANCEL,
      requestId: requestId || `cancel_${Date.now()}`,
      sessionId,
      payload: {},
      timestamp: new Date().toISOString(),
    }

    this.socket.emit(WsMessageType.CONVERSATION_CANCEL, envelope)
  }

  onConversationText(callback: (data: WsEnvelope<ConversationTextPayload>) => void) {
    if (!this.socket) return

    this.socket.on(WsMessageType.CONVERSATION_TEXT, callback)
  }

  onConversationStreamDelta(callback: (data: WsEnvelope<ConversationStreamDeltaPayload>) => void) {
    if (!this.socket) return

    this.socket.on(WsMessageType.CONVERSATION_STREAM_DELTA, callback)
  }

  onConversationStreamCompleted(
    callback: (data: WsEnvelope<ConversationStreamCompletedPayload>) => void
  ) {
    if (!this.socket) return

    this.socket.on(WsMessageType.CONVERSATION_STREAM_COMPLETED, callback)
  }

  onConversationAudioReady(callback: (data: WsEnvelope<ConversationAudioReadyPayload>) => void) {
    if (!this.socket) return

    this.socket.on(WsMessageType.CONVERSATION_AUDIO_READY, callback)
  }

  onConversationAudioChunk(
    callback: (data: {
      requestId: string
      sessionId: string
      payload: ConversationAudioChunkPayload
    }) => void
  ): () => void {
    if (!this.socket) return () => {}
    this.socket.on(WsMessageType.CONVERSATION_AUDIO_CHUNK, callback)
    return () => this.socket?.off(WsMessageType.CONVERSATION_AUDIO_CHUNK, callback)
  }

  offConversationAudioChunk() {
    if (!this.socket) return
    this.socket.off(WsMessageType.CONVERSATION_AUDIO_CHUNK)
  }

  onConversationError(callback: (data: WsEnvelope<ConversationErrorPayload>) => void) {
    if (!this.socket) return

    this.socket.on(WsMessageType.CONVERSATION_ERROR, callback)
  }

  onConversationEnd(callback: (data: any) => void) {
    if (!this.socket) return

    this.socket.on(WsMessageType.CONVERSATION_END, callback)
  }

  offConversationText() {
    if (!this.socket) return
    this.socket.off(WsMessageType.CONVERSATION_TEXT)
  }

  offConversationStreamDelta() {
    if (!this.socket) return
    this.socket.off(WsMessageType.CONVERSATION_STREAM_DELTA)
  }

  offConversationStreamCompleted() {
    if (!this.socket) return
    this.socket.off(WsMessageType.CONVERSATION_STREAM_COMPLETED)
  }

  offConversationAudioReady() {
    if (!this.socket) return
    this.socket.off(WsMessageType.CONVERSATION_AUDIO_READY)
  }

  offConversationError() {
    if (!this.socket) return
    this.socket.off(WsMessageType.CONVERSATION_ERROR)
  }

  offConversationEnd() {
    if (!this.socket) return
    this.socket.off(WsMessageType.CONVERSATION_END)
  }

  onConversationCancel(callback: (data: any) => void) {
    if (!this.socket) return
    this.socket.on(WsMessageType.CONVERSATION_CANCEL, callback)
  }

  offConversationCancel() {
    if (!this.socket) return
    this.socket.off(WsMessageType.CONVERSATION_CANCEL)
  }

  onConversationHangupRequested(
    callback: (data: WsEnvelope<ConversationHangupRequestedPayload>) => void
  ) {
    if (!this.socket) return
    this.socket.on(WsMessageType.CONVERSATION_HANGUP_REQUESTED, callback)
  }

  offConversationHangupRequested() {
    if (!this.socket) return
    this.socket.off(WsMessageType.CONVERSATION_HANGUP_REQUESTED)
  }

  onConversationToolExecuted(
    callback: (data: WsEnvelope<ConversationToolExecutedPayload>) => void
  ) {
    if (!this.socket) return
    this.socket.on(WsMessageType.CONVERSATION_TOOL_EXECUTED, callback)
  }

  offConversationToolExecuted() {
    if (!this.socket) return
    this.socket.off(WsMessageType.CONVERSATION_TOOL_EXECUTED)
  }

  isConnected(): boolean {
    return this.socket?.connected || false
  }

  ping() {
    if (!this.socket?.connected) return

    this.socket.emit(WsMessageType.PING)
  }

  onPong(callback: (data: any) => void) {
    if (!this.socket) return

    this.socket.on(WsMessageType.PONG, callback)
  }
}

export const conversationService = new ConversationService()
