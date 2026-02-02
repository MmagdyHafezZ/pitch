import { useState, useEffect, useCallback, useRef } from 'react'
import { conversationService } from '../services/conversation.service'
import { getAccessToken } from '@/lib/client'
import {
  ConversationStartPayload,
  WsEnvelope,
  ConversationTextPayload,
  ConversationAudioReadyPayload,
  ConversationErrorPayload,
} from '../types/conversation.types'

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

interface UseConversationOptions {
  sessionId: string
  autoConnect?: boolean
  onError?: (error: string) => void
}

export function useConversation(options: UseConversationOptions) {
  const { sessionId, autoConnect = true, onError } = options

  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [messages, setMessages] = useState<ConversationMessage[]>([])
  const [error, setError] = useState<string | null>(null)
  const [currentAudioUrl, setCurrentAudioUrl] = useState<string | null>(null)
  const [isAudioPlaying, setIsAudioPlaying] = useState(false)

  const currentRequestIdRef = useRef<string | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const currentAudioRef = useRef<HTMLAudioElement | null>(null)
  const onErrorRef = useRef(onError)
  const messagesRef = useRef<ConversationMessage[]>([])
  const isHungUpRef = useRef(false)

  useEffect(() => {
    onErrorRef.current = onError
  }, [onError])

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])
  const playAudio = useCallback(async (audioUrl: string) => {
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

      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext()
      }

      const newAudio = new Audio(audioUrl)
      currentAudioRef.current = newAudio

      newAudio.onplay = () => {
        setIsAudioPlaying(true)
      }

      newAudio.onended = () => {
        setCurrentAudioUrl(null)
        setIsAudioPlaying(false)
        currentAudioRef.current = null
      }

      newAudio.onerror = () => {
        setCurrentAudioUrl(null)
        setIsAudioPlaying(false)
        currentAudioRef.current = null
      }

      await newAudio.play()
    } catch (err) {
      setIsAudioPlaying(false)
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
  }, [])
  const setupEventListeners = useCallback(() => {
    conversationService.offConversationText()
    conversationService.offConversationAudioReady()
    conversationService.offConversationError()
    conversationService.offConversationEnd()
    conversationService.offConversationCancel()

    conversationService.onConversationText((data: WsEnvelope<ConversationTextPayload>) => {
      if (isHungUpRef.current) return
      if (data.requestId === currentRequestIdRef.current) {
        const message: ConversationMessage = {
          id: data.requestId,
          role: 'assistant',
          text: data.payload.text,
          timestamp: new Date(),
          usage: data.payload.usage,
        }
        setMessages((prev) => [...prev, message])
      }
    })

    conversationService.onConversationAudioReady(
      (data: WsEnvelope<ConversationAudioReadyPayload>) => {
        if (isHungUpRef.current) return
        if (data.requestId === currentRequestIdRef.current) {
          const audioBlob = base64ToBlob(data.payload.audioBase64, data.payload.contentType)
          const audioUrl = URL.createObjectURL(audioBlob)
          setCurrentAudioUrl(audioUrl)

          setMessages((prev) =>
            prev.map((msg) => (msg.id === data.requestId ? { ...msg, audioUrl } : msg))
          )

          playAudio(audioUrl)
        }
      }
    )

    conversationService.onConversationError((data: WsEnvelope<ConversationErrorPayload>) => {
      if (isHungUpRef.current) return
      if (data.requestId === currentRequestIdRef.current) {
        const errorMsg = data.payload.error
        setError(errorMsg)
        onErrorRef.current?.(errorMsg)
        setIsProcessing(false)
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
      }
    })
  }, [playAudio, stopAudio])

  const connect = useCallback(async () => {
    const token = getAccessToken()
    if (!token) {
      const errorMsg = 'No authentication token found'
      setError(errorMsg)
      onErrorRef.current?.(errorMsg)
      return
    }

    setIsConnecting(true)
    setError(null)

    try {
      await conversationService.connect(token)
      setIsConnected(true)
      setupEventListeners()
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to connect'
      setError(errorMsg)
      onErrorRef.current?.(errorMsg)
    } finally {
      setIsConnecting(false)
    }
  }, [setupEventListeners])

  const disconnect = useCallback(() => {
    conversationService.offConversationText()
    conversationService.offConversationAudioReady()
    conversationService.offConversationError()
    conversationService.offConversationEnd()
    conversationService.offConversationCancel()

    conversationService.disconnect()
    setIsConnected(false)
  }, [])

  const hangUp = useCallback(() => {
    // Mark as hung up to prevent further message processing
    isHungUpRef.current = true

    // Cancel any ongoing conversation
    if (currentRequestIdRef.current) {
      conversationService.cancelConversation(sessionId, currentRequestIdRef.current)
      currentRequestIdRef.current = null
    }

    // Stop audio immediately
    stopAudio()

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
  }, [sessionId, disconnect, stopAudio])

  const interrupt = useCallback(() => {
    // Cancel current request but stay connected
    if (currentRequestIdRef.current) {
      conversationService.cancelConversation(sessionId, currentRequestIdRef.current)
      currentRequestIdRef.current = null
    }

    // Stop audio
    stopAudio()

    // Reset processing state
    setIsProcessing(false)
  }, [sessionId, stopAudio])

  const sendMessage = useCallback(
    (text: string, options?: Partial<ConversationStartPayload>) => {
      if (!conversationService.isConnected()) {
        const errorMsg = 'Not connected to conversation service'
        setError(errorMsg)
        onErrorRef.current?.(errorMsg)
        return
      }

      // If currently processing, interrupt the current conversation
      if (currentRequestIdRef.current) {
        interrupt()
      }

      setIsProcessing(true)
      setError(null)
      stopAudio()

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
    },
    [sessionId, stopAudio, interrupt]
  )

  const startAssistantTurn = useCallback(
    (options?: Partial<ConversationStartPayload>) => {
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
    },
    [sessionId, stopAudio]
  )

  const clearMessages = useCallback(() => {
    setMessages([])
  }, [])

  useEffect(() => {
    if (autoConnect) {
      isHungUpRef.current = false
      connect()
    }

    return () => {
      // Clean up on unmount
      stopAudio()
      messagesRef.current.forEach((msg) => {
        if (msg.audioUrl) {
          URL.revokeObjectURL(msg.audioUrl)
        }
      })
      disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoConnect])

  return {
    isConnected,
    isConnecting,
    isProcessing,
    messages,
    error,
    currentAudioUrl,
    isAudioPlaying,
    connect,
    disconnect,
    hangUp,
    interrupt,
    sendMessage,
    startAssistantTurn,
    clearMessages,
    stopAudio,
  }
}

function base64ToBlob(base64: string, contentType: string): Blob {
  const byteCharacters = atob(base64)
  const byteNumbers = new Array(byteCharacters.length)
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i)
  }
  const byteArray = new Uint8Array(byteNumbers)
  return new Blob([byteArray], { type: contentType })
}
