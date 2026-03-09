'use client'

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { api } from '@/lib/client'

type LiveAvatarSdkModule = typeof import('@heygen/liveavatar-web-sdk')
type LiveAvatarSessionInstance = InstanceType<LiveAvatarSdkModule['LiveAvatarSession']>

type LiveAvatarStatus = 'idle' | 'starting' | 'ready' | 'error' | 'stopped'

interface UseLiveAvatarOptions {
  sessionId: string
  enabled: boolean
  videoRef: RefObject<HTMLVideoElement | null>
  onError?: (error: string) => void
}

interface PendingSpeak {
  resolve: () => void
  reject: (error: Error) => void
  timeoutId: ReturnType<typeof setTimeout> | null
}

const KEEP_ALIVE_INTERVAL_MS = 45_000
const PCM_SAMPLE_RATE = 24_000
const PCM_BYTES_PER_SAMPLE = 2
const LIVE_AVATAR_CONCURRENCY_RETRY_DELAYS_MS = [1500, 3000] as const
const LIVE_AVATAR_CONCURRENCY_BLOCK_KEY = 'liveavatar:concurrency:block-until-ms'
const LIVE_AVATAR_CONCURRENCY_BLOCK_MS = 2 * 60_000
const LIVE_AVATAR_CONCURRENCY_MESSAGE =
  'Session concurrency limit reached. Close other active realtime avatar tabs/sessions, then retry.'

const isLiveAvatarConcurrencyError = (message: string): boolean =>
  /session concurrency limit reached|concurrency limit/i.test(message)

const isIgnorableLiveAvatarSdkError = (message: string): boolean =>
  /session not found|session is not connected/i.test(message)

const normalizeLiveAvatarErrorMessage = (message: string): string =>
  isLiveAvatarConcurrencyError(message) ? LIVE_AVATAR_CONCURRENCY_MESSAGE : message

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms)
  })

const readConcurrencyBlockUntil = (): number => {
  if (typeof window === 'undefined') return 0
  const raw = window.localStorage.getItem(LIVE_AVATAR_CONCURRENCY_BLOCK_KEY)
  if (!raw) return 0
  const parsed = Number.parseInt(raw, 10)
  return Number.isFinite(parsed) ? parsed : 0
}

const writeConcurrencyBlockUntil = (timestampMs: number): void => {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(LIVE_AVATAR_CONCURRENCY_BLOCK_KEY, String(timestampMs))
}

const clearConcurrencyBlockUntil = (): void => {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(LIVE_AVATAR_CONCURRENCY_BLOCK_KEY)
}

export function useLiveAvatar(options: UseLiveAvatarOptions) {
  const { sessionId, enabled, videoRef, onError } = options

  const [status, setStatus] = useState<LiveAvatarStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [avatarName, setAvatarName] = useState<string | null>(null)
  const [autoplayBlocked, setAutoplayBlocked] = useState(false)

  const onErrorRef = useRef(onError)
  const sessionRef = useRef<LiveAvatarSessionInstance | null>(null)
  const startPromiseRef = useRef<Promise<LiveAvatarSessionInstance> | null>(null)
  const streamReadyPromiseRef = useRef<Promise<void> | null>(null)
  const keepAliveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pendingSpeakRef = useRef<PendingSpeak | null>(null)

  useEffect(() => {
    onErrorRef.current = onError
  }, [onError])

  const resolvePendingSpeak = useCallback(() => {
    const pendingSpeak = pendingSpeakRef.current
    if (!pendingSpeak) return
    if (pendingSpeak.timeoutId) {
      clearTimeout(pendingSpeak.timeoutId)
    }
    pendingSpeak.resolve()
    pendingSpeakRef.current = null
  }, [])

  const rejectPendingSpeak = useCallback((message: string) => {
    const pendingSpeak = pendingSpeakRef.current
    if (!pendingSpeak) return
    if (pendingSpeak.timeoutId) {
      clearTimeout(pendingSpeak.timeoutId)
    }
    pendingSpeak.reject(new Error(message))
    pendingSpeakRef.current = null
  }, [])

  const clearKeepAlive = useCallback(() => {
    if (keepAliveTimerRef.current) {
      clearInterval(keepAliveTimerRef.current)
      keepAliveTimerRef.current = null
    }
  }, [])

  const attachMedia = useCallback(async () => {
    const session = sessionRef.current
    const element = videoRef.current
    if (!session || !element || !isReady) return

    element.autoplay = true
    element.playsInline = true
    element.muted = false
    session.attach(element)

    try {
      await element.play()
      setAutoplayBlocked(false)
    } catch (err) {
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        setAutoplayBlocked(true)
        return
      }

      const message = err instanceof Error ? err.message : 'Failed to attach avatar audio/video'
      setError(message)
      onErrorRef.current?.(message)
    }
  }, [isReady, videoRef])

  const stop = useCallback(async () => {
    clearKeepAlive()
    resolvePendingSpeak()
    const session = sessionRef.current
    sessionRef.current = null
    streamReadyPromiseRef.current = null
    setIsReady(false)
    setIsSpeaking(false)
    setAutoplayBlocked(false)

    if (session) {
      try {
        if (session.state === 'CONNECTED') {
          await session.stop()
        }
      } catch {
        // Ignore cleanup failures during shutdown.
      }
    }

    setStatus(enabled ? 'idle' : 'stopped')
  }, [clearKeepAlive, enabled, resolvePendingSpeak])

  const start = useCallback(async () => {
    if (!enabled) {
      throw new Error('Realtime avatar is disabled for this session.')
    }

    if (sessionRef.current && streamReadyPromiseRef.current) {
      await streamReadyPromiseRef.current
      return sessionRef.current
    }

    if (startPromiseRef.current) {
      return startPromiseRef.current
    }

    startPromiseRef.current = (async () => {
      try {
        setStatus('starting')
        setError(null)

        const blockedUntil = readConcurrencyBlockUntil()
        if (blockedUntil > Date.now()) {
          throw new Error(LIVE_AVATAR_CONCURRENCY_MESSAGE)
        }

        const sdk = await import('@heygen/liveavatar-web-sdk')
        const tokenResponse = await (async () => {
          for (
            let attempt = 0;
            attempt <= LIVE_AVATAR_CONCURRENCY_RETRY_DELAYS_MS.length;
            attempt += 1
          ) {
            try {
              return await api.video.createLiveAvatarSession(sessionId)
            } catch (err) {
              const rawMessage =
                err instanceof Error ? err.message : 'Failed to create realtime avatar session'
              const shouldRetry =
                isLiveAvatarConcurrencyError(rawMessage) &&
                attempt < LIVE_AVATAR_CONCURRENCY_RETRY_DELAYS_MS.length

              if (!shouldRetry) {
                if (isLiveAvatarConcurrencyError(rawMessage)) {
                  writeConcurrencyBlockUntil(Date.now() + LIVE_AVATAR_CONCURRENCY_BLOCK_MS)
                }
                throw new Error(normalizeLiveAvatarErrorMessage(rawMessage))
              }

              await wait(LIVE_AVATAR_CONCURRENCY_RETRY_DELAYS_MS[attempt]!)
            }
          }

          throw new Error('Failed to create realtime avatar session')
        })()

        setAvatarName(tokenResponse.avatarName ?? null)

        const streamReadyPromise = new Promise<void>((resolve, reject) => {
          const session = new sdk.LiveAvatarSession(tokenResponse.sessionToken)
          sessionRef.current = session

          session.on(sdk.SessionEvent.SESSION_STREAM_READY, () => {
            setIsReady(true)
            setStatus('ready')
            resolve()
            void attachMedia()
          })

          session.on(sdk.SessionEvent.SESSION_DISCONNECTED, () => {
            clearKeepAlive()
            setIsReady(false)
            setIsSpeaking(false)
            setStatus('stopped')
            resolvePendingSpeak()
          })

          session.on(sdk.AgentEventsEnum.AVATAR_SPEAK_STARTED, () => {
            setIsSpeaking(true)
          })

          session.on(sdk.AgentEventsEnum.AVATAR_SPEAK_ENDED, () => {
            setIsSpeaking(false)
            resolvePendingSpeak()
          })

          session
            .start()
            .then(() => {
              clearConcurrencyBlockUntil()
              clearKeepAlive()
              keepAliveTimerRef.current = setInterval(() => {
                void session.keepAlive().catch(() => {})
              }, KEEP_ALIVE_INTERVAL_MS)
            })
            .catch((err) => {
              const message = err instanceof Error ? err.message : 'Failed to start realtime avatar'
              reject(new Error(message))
            })
        })

        streamReadyPromiseRef.current = streamReadyPromise
        await streamReadyPromise
        return sessionRef.current as LiveAvatarSessionInstance
      } catch (err) {
        const message = normalizeLiveAvatarErrorMessage(
          err instanceof Error ? err.message : 'Failed to start realtime avatar'
        )
        if (isLiveAvatarConcurrencyError(message)) {
          writeConcurrencyBlockUntil(Date.now() + LIVE_AVATAR_CONCURRENCY_BLOCK_MS)
        }
        setError(message)
        setStatus('error')
        setIsReady(false)
        setIsSpeaking(false)
        onErrorRef.current?.(message)
        await stop()
        throw new Error(message)
      } finally {
        startPromiseRef.current = null
      }
    })()

    return startPromiseRef.current
  }, [attachMedia, clearKeepAlive, enabled, resolvePendingSpeak, sessionId, stop])

  const interrupt = useCallback(() => {
    const session = sessionRef.current
    if (!session) return
    try {
      session.interrupt()
    } catch {
      // Ignore interrupt failures and resolve the pending speak locally.
    }
    setIsSpeaking(false)
    resolvePendingSpeak()
  }, [resolvePendingSpeak])

  const speakAudio = useCallback(
    async (input: { audio: ArrayBuffer; contentType: string }) => {
      if (!enabled) return

      const normalizedContentType = input.contentType.toLowerCase()
      if (!normalizedContentType.startsWith('audio/pcm')) {
        throw new Error('Realtime avatar expects 24k PCM audio.')
      }

      const session = await start()
      if (streamReadyPromiseRef.current) {
        await streamReadyPromiseRef.current
      }

      await attachMedia()

      const binaryAudio = pcmToBinaryString(input.audio)
      const estimatedDurationMs = estimatePcmDurationMs(input.audio.byteLength)

      await new Promise<void>((resolve, reject) => {
        if (pendingSpeakRef.current) {
          resolvePendingSpeak()
        }

        pendingSpeakRef.current = {
          resolve,
          reject,
          timeoutId: setTimeout(() => {
            setIsSpeaking(false)
            resolvePendingSpeak()
          }, estimatedDurationMs + 2000),
        }

        try {
          session.repeatAudio(binaryAudio)
        } catch (err) {
          rejectPendingSpeak(err instanceof Error ? err.message : 'Failed to send avatar audio')
        }
      })
    },
    [attachMedia, enabled, rejectPendingSpeak, resolvePendingSpeak, start]
  )

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason
      const reasonMessage =
        reason instanceof Error
          ? reason.message
          : typeof reason === 'string'
            ? reason
            : reason && typeof reason === 'object' && 'message' in reason
              ? String((reason as { message?: unknown }).message ?? '')
              : ''
      const reasonName =
        reason && typeof reason === 'object' && 'name' in reason
          ? String((reason as { name?: unknown }).name ?? '')
          : ''

      if (isIgnorableLiveAvatarSdkError(reasonMessage)) {
        event.preventDefault()
        return
      }

      if (isLiveAvatarConcurrencyError(reasonMessage)) {
        writeConcurrencyBlockUntil(Date.now() + LIVE_AVATAR_CONCURRENCY_BLOCK_MS)
        event.preventDefault()
        return
      }

      if (/SessionApiError/i.test(reasonName) && /session/i.test(reasonMessage)) {
        event.preventDefault()
      }
    }

    window.addEventListener('unhandledrejection', handleUnhandledRejection)
    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection)
    }
  }, [])

  useEffect(() => {
    if (!enabled) {
      void stop()
      return
    }

    void start().catch(() => {})

    return () => {
      void stop()
    }
  }, [enabled, start, stop])

  useEffect(() => {
    if (!isReady) return
    void attachMedia()
  }, [attachMedia, isReady])

  useEffect(() => {
    if (!autoplayBlocked) return

    const retryPlayback = () => {
      void attachMedia()
    }

    window.addEventListener('pointerdown', retryPlayback)
    window.addEventListener('keydown', retryPlayback)

    return () => {
      window.removeEventListener('pointerdown', retryPlayback)
      window.removeEventListener('keydown', retryPlayback)
    }
  }, [attachMedia, autoplayBlocked])

  return {
    status,
    error,
    isReady,
    isSpeaking,
    avatarName,
    autoplayBlocked,
    start,
    stop,
    interrupt,
    speakAudio,
  }
}

function pcmToBinaryString(audio: ArrayBuffer): string {
  const bytes = new Uint8Array(audio)
  let result = ''
  const chunkSize = 0x8000

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize)
    result += String.fromCharCode(...chunk)
  }

  return result
}

function estimatePcmDurationMs(byteLength: number): number {
  const samples = byteLength / PCM_BYTES_PER_SAMPLE
  return Math.max(250, Math.round((samples / PCM_SAMPLE_RATE) * 1000))
}
