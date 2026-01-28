import { useState, useEffect, useCallback, useRef } from 'react'
import { conversationService } from '../services/conversation.service'
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

  const currentRequestIdRef = useRef<string | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const onErrorRef = useRef(onError)
  const messagesRef = useRef<ConversationMessage[]>([])

  useEffect(() => {
    onErrorRef.current = onError
  }, [onError])

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])
  const playAudio = useCallback(async (audioUrl: string) => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext()
      }

      const audio = new Audio(audioUrl)
      audio.play()

      audio.onended = () => {
        setCurrentAudioUrl(null)
      }
    } catch (err) {}
  }, [])
  const setupEventListeners = useCallback(() => {
    conversationService.offConversationText()
    conversationService.offConversationAudioReady()
    conversationService.offConversationError()
    conversationService.offConversationEnd()

    conversationService.onConversationText((data: WsEnvelope<ConversationTextPayload>) => {
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
      if (data.requestId === currentRequestIdRef.current) {
        const errorMsg = data.payload.error
        setError(errorMsg)
        onErrorRef.current?.(errorMsg)
        setIsProcessing(false)
      }
    })

    conversationService.onConversationEnd((data: any) => {
      if (data.requestId === currentRequestIdRef.current) {
        setIsProcessing(false)
        currentRequestIdRef.current = null
      }
    })
  }, [playAudio])

  const connect = useCallback(async () => {
    const token = localStorage.getItem('authToken')
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

    conversationService.disconnect()
    setIsConnected(false)
  }, [])

  const sendMessage = useCallback(
    (text: string, options?: Partial<ConversationStartPayload>) => {
      if (!conversationService.isConnected()) {
        const errorMsg = 'Not connected to conversation service'
        setError(errorMsg)
        onErrorRef.current?.(errorMsg)
        return
      }

      setIsProcessing(true)
      setError(null)

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
    [sessionId]
  )

  const clearMessages = useCallback(() => {
    setMessages([])
  }, [])

  useEffect(() => {
    if (autoConnect) {
      connect()
    }

    return () => {
      disconnect()
      messagesRef.current.forEach((msg) => {
        if (msg.audioUrl) {
          URL.revokeObjectURL(msg.audioUrl)
        }
      })
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
    connect,
    disconnect,
    sendMessage,
    clearMessages,
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
