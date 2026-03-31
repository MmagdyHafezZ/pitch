import { useState, useEffect, useCallback, useRef } from 'react'
import { conversationService } from '../services/conversation.service'
import { getAccessToken, refreshAccessToken } from '@/lib/client'
import {
  ConversationStartPayload,
  WsEnvelope,
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

export interface ConversationToolEvent {
  id: string
  tool: string
  args: Record<string, unknown>
  timestamp: Date
}

interface ConversationMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  audioUrl?: string
  timestamp: Date
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
    costUsd?: number
  }
}

interface QueuedAudioChunk {
  audio: ArrayBuffer
  contentType: string
}

interface UseConversationOptions {
  sessionId: string
  autoConnect?: boolean
  autoConnectKey?: number
  audioOutput?: 'browser' | 'external'
  onExternalAudioChunk?: (chunk: {
    requestId: string
    sentenceIndex: number
    audio: ArrayBuffer
    contentType: string
  }) => Promise<void> | void
  onExternalAudioStop?: () => void
  onError?: (error: string) => void
}

export function useConversation(options: UseConversationOptions) {
  const {
    sessionId,
    autoConnect = true,
    autoConnectKey = 0,
    audioOutput = 'browser',
    onExternalAudioChunk,
    onExternalAudioStop,
    onError,
  } = options

  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [messages, setMessages] = useState<ConversationMessage[]>([])
  const [error, setError] = useState<string | null>(null)
  const [currentAudioUrl, setCurrentAudioUrl] = useState<string | null>(null)
  const [isAudioPlaying, setIsAudioPlaying] = useState(false)
  const [hangupRequest, setHangupRequest] = useState<{ reason: string } | null>(null)
  const [toolEvents, setToolEvents] = useState<ConversationToolEvent[]>([])
  const [coachingTip, setCoachingTip] = useState<{
    tip: string
    stage: string
    stageIndex: number
  } | null>(null)

  const currentRequestIdRef = useRef<string | null>(null)
  const currentAudioRef = useRef<HTMLAudioElement | null>(null)
  const pendingPlaybackRef = useRef<{ audioUrl: string; onEnded?: () => void } | null>(null)
  const onErrorRef = useRef(onError)
  const onExternalAudioChunkRef = useRef(onExternalAudioChunk)
  const onExternalAudioStopRef = useRef(onExternalAudioStop)
  const messagesRef = useRef<ConversationMessage[]>([])
  const isHungUpRef = useRef(false)
  const reconnectAttemptsRef = useRef(0)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sentence audio queue — keyed by sentenceIndex for ordered playback
  const audioQueueRef = useRef<Map<number, QueuedAudioChunk>>(new Map())
  const nextPlayIndexRef = useRef(0)
  const isPlayingChunkRef = useRef(false)
  const audioQueueVersionRef = useRef(0)
  // Set once the 'completed' event arrives so gap detection can skip failed sentences
  const totalSentencesRef = useRef<number | null>(null)

  useEffect(() => {
    onErrorRef.current = onError
  }, [onError])

  useEffect(() => {
    onExternalAudioChunkRef.current = onExternalAudioChunk
  }, [onExternalAudioChunk])

  useEffect(() => {
    onExternalAudioStopRef.current = onExternalAudioStop
  }, [onExternalAudioStop])

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  const upsertAssistantMessage = useCallback(
    (requestId: string, updater: (current?: ConversationMessage) => ConversationMessage) => {
      setMessages((prev) => {
        const index = prev.findIndex((msg) => msg.id === requestId)
        if (index === -1) {
          return [...prev, updater()]
        }
        const updated = [...prev]
        updated[index] = updater(updated[index])
        return updated
      })
    },
    []
  )

  const playAudio = useCallback(async (audioUrl: string, onEnded?: () => void) => {
    try {
      // Stop any currently playing audio first
      const audio = currentAudioRef.current
      if (audio) {
        audio.pause()
        audio.currentTime = 0
        audio.onended = null
        audio.onerror = null
        audio.onplay = null
        currentAudioRef.current = null
        setCurrentAudioUrl(null)
        setIsAudioPlaying(false)
      }

      const newAudio = new Audio(audioUrl)
      newAudio.preload = 'auto'
      currentAudioRef.current = newAudio

      newAudio.onplay = () => {
        setIsAudioPlaying(true)
      }

      newAudio.onended = () => {
        if (onEnded) {
          // Caller handles state cleanup (e.g. sentence queue plays next)
          onEnded()
        } else {
          setCurrentAudioUrl(null)
          setIsAudioPlaying(false)
          currentAudioRef.current = null
        }
      }

      newAudio.onerror = () => {
        setCurrentAudioUrl(null)
        setIsAudioPlaying(false)
        currentAudioRef.current = null
        onEnded?.()
      }

      await newAudio.play()
      pendingPlaybackRef.current = null
      setError((previousError) =>
        previousError === AUDIO_AUTOPLAY_BLOCKED_ERROR ? null : previousError
      )
    } catch (err) {
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        // Freeze the queue at the current sentence: do NOT call onEnded (which would
        // advance the queue and revoke the blob URL). Store everything needed to
        // resume from this exact position once the user provides a gesture.
        pendingPlaybackRef.current = { audioUrl, onEnded }
        setError(AUDIO_AUTOPLAY_BLOCKED_ERROR)
        onErrorRef.current?.(AUDIO_AUTOPLAY_BLOCKED_ERROR)
      } else {
        const errorMsg =
          err instanceof Error ? `Failed to play audio: ${err.message}` : 'Failed to play audio'
        setError(errorMsg)
        onErrorRef.current?.(errorMsg)
        setIsAudioPlaying(false)
        onEnded?.()
      }
    }
  }, [])

  const stopAudio = useCallback(() => {
    const audio = currentAudioRef.current
    if (audio) {
      audio.pause()
      audio.currentTime = 0
      audio.onended = null
      audio.onerror = null
      audio.onplay = null
      currentAudioRef.current = null
      setCurrentAudioUrl(null)
      setIsAudioPlaying(false)
    }
    pendingPlaybackRef.current = null
    onExternalAudioStopRef.current?.()
  }, [])

  const clearAudioQueue = useCallback(() => {
    audioQueueVersionRef.current += 1
    audioQueueRef.current.clear()
    nextPlayIndexRef.current = 0
    totalSentencesRef.current = null
    isPlayingChunkRef.current = false
    pendingPlaybackRef.current = null
  }, [])

  const tryPlayNext = useCallback(() => {
    if (isPlayingChunkRef.current) return

    const total = totalSentencesRef.current
    const idx = nextPlayIndexRef.current

    // All sentences have played — reset audio state
    if (total !== null && idx >= total) {
      setCurrentAudioUrl(null)
      setIsAudioPlaying(false)
      currentAudioRef.current = null
      return
    }

    const queuedChunk = audioQueueRef.current.get(idx)

    if (!queuedChunk) {
      // Gap: TTS failed for this sentence; skip it once totalSentences is known
      if (total !== null && idx < total) {
        nextPlayIndexRef.current++
        tryPlayNext()
      }
      // totalSentences not yet known — wait for more chunks or 'completed' event
      return
    }

    isPlayingChunkRef.current = true
    const playbackVersion = audioQueueVersionRef.current
    if (audioOutput === 'external') {
      setCurrentAudioUrl(null)
      setIsAudioPlaying(true)

      Promise.resolve(
        onExternalAudioChunkRef.current?.({
          requestId: currentRequestIdRef.current ?? '',
          sentenceIndex: idx,
          audio: queuedChunk.audio,
          contentType: queuedChunk.contentType,
        })
      )
        .catch((err) => {
          const errorMsg = err instanceof Error ? err.message : 'Failed to play assistant audio'
          setError(errorMsg)
          onErrorRef.current?.(errorMsg)
        })
        .finally(() => {
          if (audioQueueVersionRef.current !== playbackVersion) {
            isPlayingChunkRef.current = false
            setIsAudioPlaying(false)
            return
          }
          audioQueueRef.current.delete(nextPlayIndexRef.current)
          nextPlayIndexRef.current++
          isPlayingChunkRef.current = false
          setIsAudioPlaying(false)
          tryPlayNext()
        })
      return
    }

    const audioBlob = new Blob([queuedChunk.audio], { type: queuedChunk.contentType })
    const audioUrl = URL.createObjectURL(audioBlob)
    setCurrentAudioUrl(audioUrl) // expose URL so the replay button always reflects current sentence

    void playAudio(audioUrl, () => {
      if (audioQueueVersionRef.current !== playbackVersion) {
        isPlayingChunkRef.current = false
        setCurrentAudioUrl(null)
        setIsAudioPlaying(false)
        URL.revokeObjectURL(audioUrl)
        return
      }
      URL.revokeObjectURL(audioUrl)
      audioQueueRef.current.delete(nextPlayIndexRef.current)
      nextPlayIndexRef.current++
      isPlayingChunkRef.current = false
      tryPlayNext()
    })
  }, [audioOutput, playAudio])

  const disconnect = useCallback(() => {
    // Cancel any scheduled reconnect timer and reset the attempt counter so
    // stale timers can't fire and race with the next connect() call.
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
    }
    reconnectAttemptsRef.current = 0

    conversationService.clearSocketDisconnect()
    conversationService.offConversationText()
    conversationService.offConversationStreamDelta()
    conversationService.offConversationStreamCompleted()
    conversationService.offConversationAudioReady()
    conversationService.offConversationAudioChunk()
    conversationService.offConversationError()
    conversationService.offConversationEnd()
    conversationService.offConversationCancel()
    conversationService.offConversationHangupRequested()
    conversationService.offConversationToolExecuted()
    conversationService.offConversationCoachingTip()

    conversationService.disconnect()
    setIsConnected(false)
    setIsConnecting(false)
  }, [])

  const revokeAudioUrls = useCallback(() => {
    messagesRef.current.forEach((msg) => {
      if (msg.audioUrl && msg.audioUrl.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(msg.audioUrl)
        } catch (err) {
          // Ignore if already revoked
        }
      }
    })
  }, [])
  const setupEventListeners = useCallback(() => {
    conversationService.offConversationText()
    conversationService.offConversationStreamDelta()
    conversationService.offConversationStreamCompleted()
    conversationService.offConversationAudioReady()
    conversationService.offConversationAudioChunk()
    conversationService.offConversationError()
    conversationService.offConversationEnd()
    conversationService.offConversationCancel()
    conversationService.offConversationHangupRequested()
    conversationService.offConversationToolExecuted()

    conversationService.onConversationText((data: WsEnvelope<ConversationTextPayload>) => {
      if (isHungUpRef.current) return
      if (data.requestId !== currentRequestIdRef.current) return

      upsertAssistantMessage(data.requestId, (current) => ({
        id: data.requestId,
        role: 'assistant',
        text: data.payload.text,
        timestamp: current?.timestamp ?? new Date(),
        usage: data.payload.usage ?? current?.usage,
        audioUrl: current?.audioUrl,
      }))
    })

    conversationService.onConversationStreamDelta(
      (data: WsEnvelope<ConversationStreamDeltaPayload>) => {
        if (isHungUpRef.current) return
        if (data.requestId !== currentRequestIdRef.current) return

        upsertAssistantMessage(data.requestId, (current) => ({
          id: data.requestId,
          role: 'assistant',
          text: `${current?.text ?? ''}${data.payload.delta ?? ''}`,
          timestamp: current?.timestamp ?? new Date(),
          usage: current?.usage,
          audioUrl: current?.audioUrl,
        }))
      }
    )

    conversationService.onConversationStreamCompleted(
      (data: WsEnvelope<ConversationStreamCompletedPayload>) => {
        if (isHungUpRef.current) return
        if (data.requestId !== currentRequestIdRef.current) return

        // Record totalSentences so tryPlayNext can gap-skip any failed TTS sentences
        totalSentencesRef.current = data.payload.totalSentences ?? null
        // Trigger gap resolution in case all audio arrived before this event
        tryPlayNext()

        upsertAssistantMessage(data.requestId, (current) => ({
          id: data.requestId,
          role: 'assistant',
          text: data.payload.fullText ?? current?.text ?? '',
          timestamp: current?.timestamp ?? new Date(),
          usage: data.payload.usage ?? current?.usage,
          audioUrl: current?.audioUrl,
        }))
      }
    )

    conversationService.onConversationAudioReady(
      (data: WsEnvelope<ConversationAudioReadyPayload>) => {
        if (isHungUpRef.current) return
        if (data.requestId === currentRequestIdRef.current) {
          if (!data.payload.audioBase64 || !data.payload.contentType) {
            const errorMsg = 'Audio unavailable for this turn'
            setError(errorMsg)
            onErrorRef.current?.(errorMsg)
            return
          }
          const audioBlob = base64ToBlob(data.payload.audioBase64, data.payload.contentType)
          const audioUrl = URL.createObjectURL(audioBlob)
          setCurrentAudioUrl(audioUrl)

          upsertAssistantMessage(data.requestId, (current) => ({
            id: data.requestId,
            role: 'assistant',
            text: current?.text ?? data.payload.text ?? '',
            timestamp: current?.timestamp ?? new Date(),
            usage: current?.usage,
            audioUrl,
          }))

          void playAudio(audioUrl)
        }
      }
    )

    // Binary per-sentence audio chunks — play in index order via the sentence queue
    conversationService.onConversationAudioChunk(
      (envelope: {
        requestId: string
        sessionId: string
        payload: ConversationAudioChunkPayload
      }) => {
        if (isHungUpRef.current) return
        if (envelope.requestId !== currentRequestIdRef.current) return

        const { sentenceIndex, audio, contentType } = envelope.payload
        audioQueueRef.current.set(sentenceIndex, {
          audio: normalizeAudioChunk(audio),
          contentType,
        })
        tryPlayNext()
      }
    )

    conversationService.onConversationError((data: WsEnvelope<ConversationErrorPayload>) => {
      if (isHungUpRef.current) return
      if (data.requestId === currentRequestIdRef.current) {
        const errorMsg = data.payload.error
        setError(errorMsg)
        onErrorRef.current?.(errorMsg)
        setIsProcessing(false)
        stopAudio()
        clearAudioQueue()
        revokeAudioUrls()
        currentRequestIdRef.current = null
      }
    })

    conversationService.onConversationEnd((data: any) => {
      if (isHungUpRef.current) return
      if (data.requestId === currentRequestIdRef.current) {
        setIsProcessing(false)
        currentRequestIdRef.current = null
      }
    })

    conversationService.onConversationCancel((data: any) => {
      if (data.requestId === currentRequestIdRef.current) {
        setIsProcessing(false)
        currentRequestIdRef.current = null
        stopAudio()
        clearAudioQueue()
      }
    })

    conversationService.onConversationHangupRequested(
      (data: WsEnvelope<ConversationHangupRequestedPayload>) => {
        if (isHungUpRef.current) return
        setHangupRequest({ reason: data.payload.reason })
      }
    )

    conversationService.onConversationToolExecuted(
      (data: WsEnvelope<ConversationToolExecutedPayload>) => {
        if (isHungUpRef.current) return
        const event: ConversationToolEvent = {
          id: `tool_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          tool: data.payload.tool,
          args: data.payload.args,
          timestamp: new Date(),
        }
        // Ring buffer — keep last 10 tool events
        setToolEvents((prev) => [...prev.slice(-9), event])
      }
    )

    conversationService.onConversationCoachingTip(
      (data: WsEnvelope<ConversationCoachingTipPayload>) => {
        if (isHungUpRef.current) return
        setCoachingTip({
          tip: data.payload.tip,
          stage: data.payload.stage,
          stageIndex: data.payload.stageIndex,
        })
      }
    )
  }, [playAudio, stopAudio, revokeAudioUrls, tryPlayNext, clearAudioQueue, upsertAssistantMessage])

  const connect = useCallback(
    async (resetAttempts = true) => {
      // If this is a retry but the socket is already connected, skip.
      if (!resetAttempts && conversationService.isConnected()) return

      let token = getAccessToken()
      if (!token) {
        token = await refreshAccessToken()
      }
      if (!token) {
        const errorMsg = 'No authentication token found'
        setError(errorMsg)
        onErrorRef.current?.(errorMsg)
        return
      }

      // Clear any scheduled reconnect timer
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }

      if (resetAttempts) {
        reconnectAttemptsRef.current = 0
      }

      // Clear hung-up flag so events are processed on this new connection
      isHungUpRef.current = false

      setIsConnecting(true)
      setError(null)

      // Flags used in finally to avoid incorrect state resets
      let superseded = false
      let willRetry = false

      try {
        await conversationService.connect(token)
        setIsConnected(true)
        setError(null)
        setupEventListeners()

        // Register mid-session drop handler. On unexpected disconnect, auto-reconnect
        // up to 3 times with linear backoff before giving up.
        conversationService.onSocketDisconnect((reason) => {
          if (isHungUpRef.current) return

          setIsConnected(false)

          const attempt = reconnectAttemptsRef.current + 1
          reconnectAttemptsRef.current = attempt

          if (attempt > 3) {
            console.error(
              `[useConversation] Mid-session drop — max reconnect attempts (3) exceeded, giving up. Last reason: ${reason}`
            )
            setIsConnecting(false)
            setError('Connection lost. Please refresh the page.')
            return
          }

          const delay = attempt * 1500 // 1.5s, 3s, 4.5s
          console.warn(
            `[useConversation] Mid-session drop (attempt ${attempt}/3), reason: ${reason} — reconnecting in ${delay}ms`
          )
          setIsConnecting(true)
          reconnectTimerRef.current = setTimeout(() => {
            if (!isHungUpRef.current) {
              void connect(false)
            }
          }, delay)
        })
      } catch (err) {
        // Ignore errors from connections that were superseded by a newer connect() call.
        // The superseding connection owns isConnecting from this point on.
        if (err instanceof Error && err.message === 'Connection superseded') {
          superseded = true
          return
        }

        const attempt = reconnectAttemptsRef.current + 1
        reconnectAttemptsRef.current = attempt
        const errorMsg = err instanceof Error ? err.message : 'Failed to connect'

        if (attempt <= 3 && !isHungUpRef.current) {
          // Auto-retry failed initial connections with the same linear backoff
          // used for mid-session drops.
          const delay = attempt * 1500 // 1.5s, 3s, 4.5s
          console.warn(
            `[useConversation] Connection failed (attempt ${attempt}/3): ${errorMsg} — retrying in ${delay}ms`
          )
          willRetry = true
          setIsConnecting(true)
          reconnectTimerRef.current = setTimeout(() => {
            if (!isHungUpRef.current) {
              void connect(false)
            }
          }, delay)
        } else {
          console.error(
            `[useConversation] Connection failed after ${attempt} attempt(s) — showing error: ${errorMsg}`
          )
          setError(errorMsg)
          onErrorRef.current?.(errorMsg)
        }
      } finally {
        // Don't reset isConnecting if:
        // - This connection was superseded (the newer connect() owns the state)
        // - A retry is already scheduled (isConnecting stays true until retry resolves)
        if (!superseded && !willRetry) {
          setIsConnecting(false)
        }
      }
    },
    [setupEventListeners]
  )

  const hangUp = useCallback(() => {
    // Mark as hung up to prevent further message processing
    isHungUpRef.current = true

    // Cancel any pending reconnect attempt
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
    }
    reconnectAttemptsRef.current = 0
    conversationService.clearSocketDisconnect()

    // Cancel any ongoing conversation
    if (currentRequestIdRef.current) {
      void conversationService.cancelConversation(sessionId, currentRequestIdRef.current)
      currentRequestIdRef.current = null
    }

    // Stop audio immediately and clear sentence queue
    stopAudio()
    clearAudioQueue()

    // Reset processing state
    setIsProcessing(false)
    setError(null)

    // Disconnect from WebSocket
    disconnect()

    // Clean up audio URLs
    messagesRef.current.forEach((msg) => {
      if (msg.audioUrl) {
        URL.revokeObjectURL(msg.audioUrl)
      }
    })
  }, [sessionId, disconnect, stopAudio, clearAudioQueue])

  const interrupt = useCallback(async () => {
    const requestId = currentRequestIdRef.current
    currentRequestIdRef.current = null

    // Stop audio and clear sentence queue immediately for responsive barge-in
    stopAudio()
    clearAudioQueue()
    setIsProcessing(false)

    if (requestId) {
      await conversationService.cancelConversation(sessionId, requestId)
    }
  }, [sessionId, stopAudio, clearAudioQueue])

  const sendMessage = useCallback(
    (text: string, options?: Partial<ConversationStartPayload>) => {
      void (async () => {
        if (!conversationService.isConnected()) {
          const errorMsg = 'Not connected to conversation service'
          setError(errorMsg)
          onErrorRef.current?.(errorMsg)
          return
        }

        if (currentRequestIdRef.current) {
          await interrupt()
        }

        if (!conversationService.isConnected()) {
          const errorMsg = 'Not connected to conversation service'
          setError(errorMsg)
          onErrorRef.current?.(errorMsg)
          return
        }

        setIsProcessing(true)
        setError(null)
        setHangupRequest(null)
        stopAudio()
        clearAudioQueue()

        const userMessage: ConversationMessage = {
          id: `user_${Date.now()}`,
          role: 'user',
          text,
          timestamp: new Date(),
        }
        setMessages((prev) => [...prev, userMessage])

        const payload: ConversationStartPayload = {
          text,
          ...options,
        }

        const requestId = conversationService.sendConversation(sessionId, payload)
        currentRequestIdRef.current = requestId
      })()
    },
    [sessionId, stopAudio, interrupt, clearAudioQueue]
  )

  const startAssistantTurn = useCallback(
    (options?: Partial<ConversationStartPayload>) => {
      void (async () => {
        if (!conversationService.isConnected()) {
          const errorMsg = 'Not connected to conversation service'
          setError(errorMsg)
          onErrorRef.current?.(errorMsg)
          return
        }

        if (currentRequestIdRef.current) {
          await interrupt()
        }

        if (!conversationService.isConnected()) {
          const errorMsg = 'Not connected to conversation service'
          setError(errorMsg)
          onErrorRef.current?.(errorMsg)
          return
        }

        setIsProcessing(true)
        setError(null)
        stopAudio()

        const payload: ConversationStartPayload = {
          text: '',
          startAsAssistant: true,
          ...options,
        }

        const requestId = conversationService.sendConversation(sessionId, payload)
        currentRequestIdRef.current = requestId
      })()
    },
    [sessionId, stopAudio, interrupt]
  )

  const clearMessages = useCallback(() => {
    revokeAudioUrls()
    setMessages([])
  }, [revokeAudioUrls])

  const hydrateMessages = useCallback(
    (
      nextMessages: Array<
        Pick<ConversationMessage, 'id' | 'role' | 'text' | 'timestamp' | 'usage' | 'audioUrl'>
      >,
      options?: {
        autoPlayLatestAudio?: boolean
      }
    ) => {
      revokeAudioUrls()
      const latestAssistantAudioUrl =
        [...nextMessages]
          .reverse()
          .find(
            (message) =>
              message.role === 'assistant' &&
              typeof message.audioUrl === 'string' &&
              message.audioUrl.length > 0
          )?.audioUrl ?? null

      const activeAudio = currentAudioRef.current
      if (activeAudio) {
        activeAudio.pause()
        activeAudio.currentTime = 0
        activeAudio.onended = null
        activeAudio.onerror = null
        activeAudio.onplay = null
        currentAudioRef.current = null
      }
      pendingPlaybackRef.current = null
      setIsAudioPlaying(false)
      setCurrentAudioUrl(latestAssistantAudioUrl)

      setMessages(
        nextMessages.map((message) => ({
          ...message,
          timestamp:
            message.timestamp instanceof Date ? message.timestamp : new Date(message.timestamp),
        }))
      )

      if (options?.autoPlayLatestAudio && audioOutput === 'browser' && latestAssistantAudioUrl) {
        // Defer past the connect-lifecycle useEffect cleanup, which calls stopAudio()
        // synchronously in the same render batch. Without the delay, stopAudio() kills
        // the audio element before it starts because currentAudioRef is set synchronously
        // inside playAudio before its first await.
        const url = latestAssistantAudioUrl
        setTimeout(() => void playAudio(url), 0)
      }
    },
    [audioOutput, playAudio, revokeAudioUrls]
  )

  const clearHangupRequest = useCallback(() => {
    setHangupRequest(null)
  }, [])

  const clearToolEvents = useCallback(() => {
    setToolEvents([])
  }, [])

  const replayAudio = useCallback(() => {
    if (audioOutput !== 'browser') return
    if (!currentAudioUrl) return
    void playAudio(currentAudioUrl)
  }, [audioOutput, currentAudioUrl, playAudio])

  useEffect(() => {
    const replayPendingAudio = () => {
      const pending = pendingPlaybackRef.current
      if (!pending) return
      // Clear first so a re-entrant NotAllowedError doesn't loop forever
      pendingPlaybackRef.current = null
      void playAudio(pending.audioUrl, pending.onEnded)
    }

    window.addEventListener('pointerdown', replayPendingAudio)
    window.addEventListener('keydown', replayPendingAudio)

    return () => {
      window.removeEventListener('pointerdown', replayPendingAudio)
      window.removeEventListener('keydown', replayPendingAudio)
    }
  }, [playAudio])

  useEffect(() => {
    if (autoConnect) {
      isHungUpRef.current = false
      void connect()
    }

    return () => {
      // Clean up on unmount
      stopAudio()
      revokeAudioUrls()
      disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoConnect, autoConnectKey, revokeAudioUrls])

  return {
    isConnected,
    isConnecting,
    isProcessing,
    messages,
    error,
    currentAudioUrl,
    isAudioPlaying,
    hangupRequest,
    toolEvents,
    coachingTip,
    connect,
    disconnect,
    hangUp,
    interrupt,
    sendMessage,
    startAssistantTurn,
    clearMessages,
    hydrateMessages,
    clearHangupRequest,
    clearToolEvents,
    clearCoachingTip: () => setCoachingTip(null),
    stopAudio,
    replayAudio,
    audioElementRef: currentAudioRef,
  }
}

const AUDIO_AUTOPLAY_BLOCKED_ERROR =
  'Audio is ready, but your browser blocked autoplay. Press Play once to enable sound.'

function base64ToBlob(base64: string, contentType: string): Blob {
  const normalizedBase64 = normalizeBase64(base64)
  const byteCharacters = atob(normalizedBase64)
  const byteNumbers = new Array(byteCharacters.length)
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i)
  }
  const byteArray = new Uint8Array(byteNumbers)
  return new Blob([byteArray], { type: contentType })
}

function normalizeBase64(value: string): string {
  const cleaned = value.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/')
  const remainder = cleaned.length % 4
  if (remainder === 0) {
    return cleaned
  }
  return `${cleaned}${'='.repeat(4 - remainder)}`
}

function normalizeAudioChunk(
  value: ArrayBuffer | Uint8Array | { type?: unknown; data?: unknown } | string
): ArrayBuffer {
  if (value instanceof ArrayBuffer) {
    return value
  }

  if (value instanceof Uint8Array) {
    const normalized = new Uint8Array(value.byteLength)
    normalized.set(value)
    return normalized.buffer
  }

  if (typeof value === 'string') {
    return decodeBase64ToArrayBuffer(value)
  }

  if (isBufferJson(value)) {
    const normalized = Uint8Array.from(value.data)
    return normalized.buffer
  }

  if (ArrayBuffer.isView(value)) {
    const normalized = new Uint8Array(value.byteLength)
    normalized.set(new Uint8Array(value.buffer, value.byteOffset, value.byteLength))
    return normalized.buffer
  }

  return new ArrayBuffer(0)
}

function decodeBase64ToArrayBuffer(value: string): ArrayBuffer {
  try {
    const normalizedBase64 = normalizeBase64(value)
    const byteCharacters = atob(normalizedBase64)
    const bytes = new Uint8Array(byteCharacters.length)
    for (let i = 0; i < byteCharacters.length; i++) {
      bytes[i] = byteCharacters.charCodeAt(i)
    }
    return bytes.buffer
  } catch {
    return new ArrayBuffer(0)
  }
}

function isBufferJson(value: unknown): value is {
  type: 'Buffer'
  data: number[]
} {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { type?: unknown }).type === 'Buffer' &&
    Array.isArray((value as { data?: unknown }).data) &&
    (value as { data: unknown[] }).data.every((entry) => typeof entry === 'number')
  )
}
