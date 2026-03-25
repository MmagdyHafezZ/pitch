import { io, Socket } from 'socket.io-client'
import { API_CONFIG } from '@/lib/client'
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
  ConversationCoachingTipPayload,
} from '../types/conversation.types'
import type { VisualState } from '../types/visual-state.types'

const DEFAULT_WS_URL = 'http://localhost:8000'
const INITIAL_CONNECT_TIMEOUT_MS = 6000

export const resolveConversationWsUrl = (
  configuredWsUrl = process.env.NEXT_PUBLIC_WS_URL,
  configuredApiUrl = process.env.NEXT_PUBLIC_API_URL || API_CONFIG.baseURL
) => {
  const normalizedWsUrl = configuredWsUrl?.trim()
  if (normalizedWsUrl) {
    return normalizedWsUrl
  }

  const normalizedApiUrl = configuredApiUrl?.trim()
  if (!normalizedApiUrl) {
    return DEFAULT_WS_URL
  }

  try {
    const parsedUrl = new URL(normalizedApiUrl)
    parsedUrl.pathname = parsedUrl.pathname.replace(/\/api(?:\/v\d+)?\/?$/, '') || '/'
    parsedUrl.search = ''
    parsedUrl.hash = ''
    return parsedUrl.toString().replace(/\/$/, '')
  } catch {
    return DEFAULT_WS_URL
  }
}

const WS_URL = resolveConversationWsUrl()

export class ConversationService {
  private socket: Socket | null = null
  /** Rejects the in-flight connect() promise when a new connect() supersedes it. */
  private pendingConnectReject: ((err: Error) => void) | null = null
  /** Called when the socket drops after a successful connection. */
  private disconnectCallback: ((reason: string) => void) | null = null

  connect(token: string): Promise<void> {
    // Abort any in-flight connect() promise so it doesn't linger as a zombie.
    if (this.pendingConnectReject) {
      this.pendingConnectReject(new Error('Connection superseded'))
      this.pendingConnectReject = null
    }

    if (this.socket?.connected) {
      return Promise.resolve()
    }

    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }

    return new Promise((resolve, reject) => {
      this.pendingConnectReject = reject

      const socket = io(`${WS_URL}/simulation`, {
        auth: { token },
        transports: ['websocket'],
        reconnection: false,
      })
      this.socket = socket

      console.log('[ConversationService] Connecting to', `${WS_URL}/simulation`)

      let settled = false
      let timeoutId: ReturnType<typeof setTimeout> | null = setTimeout(() => {
        console.error(
          `[ConversationService] Connection timed out after ${INITIAL_CONNECT_TIMEOUT_MS}ms`,
          { url: `${WS_URL}/simulation` }
        )
        cleanup()
        if (this.socket === socket) {
          this.socket = null
        }
        socket.disconnect()
        settle(() => reject(new Error('Timed out connecting to conversation service')))
      }, INITIAL_CONNECT_TIMEOUT_MS)

      const cleanup = () => {
        socket.off('connect', handleConnect)
        socket.off('connect_error', handleConnectError)
        socket.off('disconnect', handleDisconnectWhileConnecting)
        if (timeoutId) {
          clearTimeout(timeoutId)
          timeoutId = null
        }
      }

      const settle = (handler: () => void) => {
        if (settled) return
        settled = true
        this.pendingConnectReject = null
        cleanup()
        handler()
      }

      const handleDisconnectWhileConnecting = () => {
        settle(() => {
          console.error('[ConversationService] Disconnected while connecting')
          if (this.socket === socket) {
            this.socket = null
          }
          reject(new Error('Disconnected while connecting to conversation service'))
        })
      }

      const handleConnect = () => {
        settle(() => {
          console.log('[ConversationService] Connected successfully')
          // After connecting, watch for mid-session drops.
          socket.on('disconnect', (reason: string) => {
            if (this.socket === socket) {
              console.warn('[ConversationService] Mid-session disconnect:', reason)
              this.disconnectCallback?.(reason)
            }
          })
          resolve()
        })
      }

      const handleConnectError = (error: Error & { description?: number | string }) => {
        settle(() => {
          const statusText =
            typeof error.description === 'number' ? ` (HTTP ${error.description})` : ''
          const message = error.message?.trim() || 'Failed to connect to conversation service'
          console.error('[ConversationService] connect_error:', `${message}${statusText}`, {
            description: error.description,
            url: `${WS_URL}/simulation`,
          })
          if (this.socket === socket) {
            this.socket = null
          }
          socket.disconnect()
          reject(new Error(`${message}${statusText}`))
        })
      }

      socket.on('connect', handleConnect)
      socket.on('connect_error', handleConnectError)
      socket.on('disconnect', handleDisconnectWhileConnecting)
    })
  }

  /** Register a callback invoked when the socket drops after a successful connect. */
  onSocketDisconnect(callback: (reason: string) => void): void {
    this.disconnectCallback = callback
  }

  /** Remove the mid-session disconnect callback (e.g. on intentional hang-up). */
  clearSocketDisconnect(): void {
    this.disconnectCallback = null
  }

  disconnect() {
    // Reject any in-flight connect() with "Connection superseded" so the
    // useConversation catch block takes the superseded path (no retry timer).
    if (this.pendingConnectReject) {
      this.pendingConnectReject(new Error('Connection superseded'))
      this.pendingConnectReject = null
    }
    this.disconnectCallback = null
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

  cancelConversation(sessionId: string, requestId?: string): Promise<void> {
    if (!this.socket?.connected) {
      return Promise.resolve()
    }

    const socket = this.socket
    const cancelRequestId = requestId || `cancel_${Date.now()}`

    const envelope = {
      type: WsMessageType.CONVERSATION_CANCEL,
      requestId: cancelRequestId,
      sessionId,
      payload: {},
      timestamp: new Date().toISOString(),
    }

    return new Promise((resolve) => {
      let settled = false
      const cleanup = () => {
        socket.off(WsMessageType.CONVERSATION_CANCEL, handleAck)
        if (timeoutId) {
          clearTimeout(timeoutId)
        }
      }
      const resolveOnce = () => {
        if (settled) return
        settled = true
        cleanup()
        resolve()
      }
      const handleAck = (data: { requestId?: string }) => {
        if (data.requestId === cancelRequestId) {
          resolveOnce()
        }
      }
      const timeoutId = setTimeout(resolveOnce, 1500)

      socket.on(WsMessageType.CONVERSATION_CANCEL, handleAck)
      socket.emit(WsMessageType.CONVERSATION_CANCEL, envelope)
    })
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

  onConversationCoachingTip(callback: (data: WsEnvelope<ConversationCoachingTipPayload>) => void) {
    if (!this.socket) return
    this.socket.on(WsMessageType.CONVERSATION_COACHING_TIP, callback)
  }

  offConversationCoachingTip() {
    if (!this.socket) return
    this.socket.off(WsMessageType.CONVERSATION_COACHING_TIP)
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
