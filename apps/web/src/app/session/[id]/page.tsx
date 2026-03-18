'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useMediaQuery } from '@mantine/hooks'
import {
  Box,
  Group,
  Stack,
  Title,
  Text,
  Paper,
  ActionIcon,
  Badge,
  TextInput,
  Select,
  Loader,
  Modal,
  Button,
} from '@mantine/core'
import { IconPhone, IconArrowRight } from '@tabler/icons-react'
import { useRouter, useParams } from 'next/navigation'
import { useConversation, useVisualState, CameraEngagementIndicator } from '@/features/conversation'
import { type GlobeState } from '@/features/conversation/components/GlobeVisualizer'
import VoiceOrbSession from '@/features/conversation/components/VoiceOrbSession'
import { useAudioLevel } from '@/features/conversation/hooks/useAudioLevel'
import { CoachChatWidget } from '@/components/ui/CoachChatWidget'
import { useSpeechToText } from '@/features/stt'
import { API_CONFIG, api } from '@/lib/client'
import { notifications } from '@mantine/notifications'
import type { SessionType } from '@/features/sessions'

type AvatarVideoStatus = 'idle' | 'queued' | 'rendering' | 'ready' | 'failed'

interface AvatarVideoState {
  status: AvatarVideoStatus
  provider: string | null
  url: string | null
  error: string | null
  jobId: string | null
  playbackToken: string | null
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const normalizeSessionStatus = (
  session: unknown,
  options?: { launchFreshIteration?: boolean }
): string | null => {
  if (!isRecord(session) || typeof session.status !== 'string') {
    return null
  }

  const status = session.status.trim().toLowerCase()
  if (options?.launchFreshIteration && status === 'ended') {
    return 'active'
  }

  return status
}

const readAvatarVideoState = (session: unknown): AvatarVideoState => {
  if (!isRecord(session)) {
    return {
      status: 'idle',
      provider: null,
      url: null,
      error: null,
      jobId: null,
      playbackToken: null,
    }
  }

  const sessionConfig = isRecord(session.sessionConfig) ? session.sessionConfig : {}
  const videoConfig = isRecord(sessionConfig.video) ? sessionConfig.video : {}
  const runtime = isRecord(videoConfig.runtime) ? videoConfig.runtime : {}
  const rawStatus = typeof runtime.status === 'string' ? runtime.status.trim().toLowerCase() : ''

  const status: AvatarVideoStatus =
    rawStatus === 'queued' ||
    rawStatus === 'rendering' ||
    rawStatus === 'ready' ||
    rawStatus === 'failed'
      ? rawStatus
      : 'idle'

  return {
    status,
    provider:
      typeof runtime.provider === 'string'
        ? runtime.provider
        : typeof videoConfig.provider === 'string'
          ? videoConfig.provider
          : null,
    url: typeof runtime.assetUrl === 'string' ? runtime.assetUrl : null,
    error: typeof runtime.lastError === 'string' ? runtime.lastError : null,
    jobId: typeof runtime.activeJobId === 'string' ? runtime.activeJobId : null,
    playbackToken: typeof runtime.playbackToken === 'string' ? runtime.playbackToken : null,
  }
}

const buildSessionVideoStreamUrl = (sessionId: string, token: string, jobId?: string | null) => {
  const url = new URL(`${API_CONFIG.baseURL}/simulation/video/stream/${sessionId}`)
  url.searchParams.set('token', token)
  if (jobId) {
    url.searchParams.set('job', jobId)
  }
  return url.toString()
}

export default function LiveSessionPage() {
  const router = useRouter()
  const params = useParams()
  const sessionId = params.id as string
  const isMobile = useMediaQuery('(max-width: 768px)')
  const [time, setTime] = useState(0)
  const [textInput, setTextInput] = useState('')
  const [hints, setHints] = useState<string[]>([])
  const [timelineStages, setTimelineStages] = useState<
    Array<{
      order: number
      label: string
      description?: string
      active: boolean
      completed: boolean
    }>
  >([])
  const [currentProgress, setCurrentProgress] = useState(0)
  const [hintsError, setHintsError] = useState<string | null>(null)
  const [timelineError, setTimelineError] = useState<string | null>(null)
  const [sessionType, setSessionType] = useState<SessionType | null>(null)
  const [sessionStatus, setSessionStatus] = useState<string | null>(null)
  const [sessionName, setSessionName] = useState<string>('')
  const [personaName, setPersonaName] = useState<string | null>(null)
  const [hintsEnabled, setHintsEnabled] = useState(false)
  const [timelineEnabled, setTimelineEnabled] = useState(false)
  const [callStarted, setCallStarted] = useState(false)
  const [phoneNumber, setPhoneNumber] = useState('')
  const [callProvider, setCallProvider] = useState('twilio')
  const [callModalOpen, setCallModalOpen] = useState(false)
  const [callLoading, setCallLoading] = useState(false)
  const [callError, setCallError] = useState<string | null>(null)
  const [avatarVideoUrl, setAvatarVideoUrl] = useState<string | null>(null)
  const [avatarVideoStatus, setAvatarVideoStatus] = useState<AvatarVideoStatus>('idle')
  const [avatarVideoProvider, setAvatarVideoProvider] = useState<string | null>(null)
  const [avatarVideoError, setAvatarVideoError] = useState<string | null>(null)
  const [avatarVideoJobId, setAvatarVideoJobId] = useState<string | null>(null)
  const [autoConnectConversation, setAutoConnectConversation] = useState(false)
  const [resumePromptOpen, setResumePromptOpen] = useState(false)
  const [entryDecisionLoading, setEntryDecisionLoading] = useState(true)
  const [startOverLoading, setStartOverLoading] = useState(false)
  const [loadedSessionRecord, setLoadedSessionRecord] = useState<Record<string, unknown> | null>(
    null
  )
  const [sttCommitRemainingMs, setSttCommitRemainingMs] = useState(0)
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestMessagesRef = useRef<Array<{ role: 'user' | 'assistant'; text: string }>>([])
  const hintsRequestSeqRef = useRef(0)
  const speechFinalizeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const speechFinalizeTickerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const previousAudioPlayingRef = useRef(false)
  const speechBufferRef = useRef<string>('')
  const assistantInterruptTriggeredRef = useRef(false)
  const hasUserEnabledMicRef = useRef(false)
  const [isMultiTurn, setIsMultiTurn] = useState(false)
  const assistantStartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const lastAssistantMessageIdRef = useRef<string | null>(null)
  // Hidden pose camera feed used by MediaPipe across session types.
  const poseVideoRef = useRef<HTMLVideoElement | null>(null)
  // Visible PiP camera feed shown in the Zoom-like video layout.
  const userPipVideoRef = useRef<HTMLVideoElement | null>(null)
  const poseCameraStreamRef = useRef<MediaStream | null>(null)
  const [visualEnabled, setVisualEnabled] = useState(true)
  const speechFinalizeDelayMs = sessionType === 'voice' || sessionType === 'video' ? 250 : 1500
  const isVideoSession = sessionType === 'video'

  const scheduleIdleHints = useCallback(
    (delayMs = 20000) => {
      if (!hintsEnabled || sessionStatus === 'ended') return
      if (!sessionId) return
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current)
      }
      idleTimerRef.current = setTimeout(async () => {
        const requestSeq = ++hintsRequestSeqRef.current
        try {
          const hintMessages = latestMessagesRef.current.slice(-24).map((msg) => ({
            role: msg.role,
            content: msg.text,
          }))
          const generated = await api.hints.generate({
            sessionId,
            strategy: 'contextual',
            maxHints: 3,
            includeObjectives: true,
            messages: hintMessages,
          })
          if (requestSeq !== hintsRequestSeqRef.current) return
          const nextHints = generated?.hints?.map((hint: { content: string }) => hint.content) ?? []
          setHints(nextHints)
          setHintsError(null)
        } catch (err) {
          if (requestSeq !== hintsRequestSeqRef.current) return
          setHintsError('Unable to load hints')
        }
      }, delayMs)
    },
    [hintsEnabled, sessionId, sessionStatus]
  )

  const clearSpeechFinalizeState = () => {
    if (speechFinalizeTimerRef.current) {
      clearTimeout(speechFinalizeTimerRef.current)
      speechFinalizeTimerRef.current = null
    }
    if (speechFinalizeTickerRef.current) {
      clearInterval(speechFinalizeTickerRef.current)
      speechFinalizeTickerRef.current = null
    }
    setSttCommitRemainingMs(0)
  }

  const flushSpeechBuffer = () => {
    clearSpeechFinalizeState()
    const buffered = speechBufferRef.current.trim()
    if (sessionStatus !== 'ended' && buffered) {
      sendMessage(buffered)
      scheduleIdleHints()
    }
    speechBufferRef.current = ''
    resetTranscript()
  }

  const handleSpeechEnd = useCallback(() => {
    // speechend fires when the user stops speaking — accelerate commit if there's buffered content
    if (speechFinalizeTimerRef.current && speechBufferRef.current.trim()) {
      clearTimeout(speechFinalizeTimerRef.current)
      speechFinalizeTimerRef.current = setTimeout(flushSpeechBuffer, 80)
    }
    // If no buffer yet, speechend fired before isFinal — the normal isFinal→250ms path handles it
  }, [flushSpeechBuffer])

  const {
    isConnected,
    isConnecting,
    isProcessing,
    messages,
    error: conversationError,
    sendMessage,
    startAssistantTurn,
    currentAudioUrl,
    isAudioPlaying,
    hangupRequest,
    hangUp,
    interrupt,
    stopAudio,
    replayAudio,
    clearMessages,
    clearHangupRequest,
    clearToolEvents,
    toolEvents,
    audioElementRef,
  } = useConversation({
    sessionId,
    autoConnect: autoConnectConversation,
    audioOutput: 'browser',
    onError: () => {},
  })
  const assistantSpeaking = isAudioPlaying

  const {
    isListening,
    transcript,
    interimTranscript,
    error: sttError,
    microphonePermission,
    isPermissionBlocked: isSttPermissionBlocked,
    isSupported: isSttSupported,
    startListening,
    stopListening,
    resetTranscript,
    requestMicrophoneAccess,
  } = useSpeechToText({
    continuous: true,
    interimResults: true,
    onSpeechEnd: handleSpeechEnd,
    onResult: (text, isFinal) => {
      if (sessionStatus === 'ended') return
      const cleaned = text.trim()
      if (!cleaned) return

      const canBargeIn =
        (sessionType === 'voice' || sessionType === 'video') &&
        hasUserEnabledMicRef.current &&
        (assistantSpeaking || isProcessing)

      if (!isFinal) {
        const wordCount = cleaned.split(/\s+/u).filter(Boolean).length
        if (
          canBargeIn &&
          !assistantInterruptTriggeredRef.current &&
          wordCount >= 2 &&
          cleaned.length >= 8
        ) {
          assistantInterruptTriggeredRef.current = true
          void interrupt()
        }
        return
      }

      if (canBargeIn && !assistantInterruptTriggeredRef.current) {
        assistantInterruptTriggeredRef.current = true
        void interrupt()
      }

      speechBufferRef.current = speechBufferRef.current
        ? `${speechBufferRef.current.trim()} ${cleaned}`
        : cleaned

      clearSpeechFinalizeState()
      setSttCommitRemainingMs(speechFinalizeDelayMs)
      const startedAt = Date.now()
      speechFinalizeTickerRef.current = setInterval(() => {
        const elapsed = Date.now() - startedAt
        const remaining = Math.max(0, speechFinalizeDelayMs - elapsed)
        setSttCommitRemainingMs(remaining)
        if (remaining === 0 && speechFinalizeTickerRef.current) {
          clearInterval(speechFinalizeTickerRef.current)
          speechFinalizeTickerRef.current = null
        }
      }, 50)
      speechFinalizeTimerRef.current = setTimeout(() => {
        flushSpeechBuffer()
      }, speechFinalizeDelayMs)
    },
    onError: () => {
      clearSpeechFinalizeState()
    },
  })

  const analyserRef = useAudioLevel({ audioElementRef, assistantSpeaking })

  const { isReady: poseIsReady, currentState: visualState } = useVisualState({
    sessionId,
    videoRef: poseVideoRef,
    enabled: isVideoSession && visualEnabled && isConnected,
    sendIntervalMs: 5000,
    onUserAbsent: () => {},
  })

  const syncSessionState = useCallback(
    (session: any, options?: { launchFreshIteration?: boolean }) => {
      const config = (session?.sessionConfig as Record<string, any>) ?? {}
      const avatarState = readAvatarVideoState(session)
      const normalizedStatus = normalizeSessionStatus(session, options)
      const nextAvatarVideoUrl =
        session?.id && avatarState.status === 'ready' && avatarState.playbackToken
          ? buildSessionVideoStreamUrl(session.id, avatarState.playbackToken, avatarState.jobId)
          : avatarState.url

      setIsMultiTurn(Boolean(config.multiTurnEnabled))
      setSessionType(session?.type ?? null)
      setSessionStatus(normalizedStatus)
      setSessionName((session as any)?.name ?? (session as any)?.scenario?.name ?? '')
      setPersonaName((session as any)?.persona?.name ?? null)
      setPhoneNumber('')
      setAvatarVideoStatus(avatarState.status)
      setAvatarVideoProvider(avatarState.provider)
      setAvatarVideoError(avatarState.error)
      setAvatarVideoJobId(avatarState.jobId)
      setAvatarVideoUrl(nextAvatarVideoUrl)

      const resolvedProvider =
        typeof config.phoneProvider === 'string'
          ? config.phoneProvider
          : typeof config.phone?.provider === 'string'
            ? config.phone.provider
            : 'twilio'

      setCallProvider(
        resolvedProvider === 'vapi' || resolvedProvider === 'twilio' ? resolvedProvider : 'twilio'
      )
      setCallModalOpen(session?.type === 'phone' && normalizedStatus !== 'ended')
    },
    []
  )

  useEffect(() => {
    const interval = setInterval(() => {
      setTime((prev) => prev + 1)
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!sessionId) return

    let cancelled = false
    setAutoConnectConversation(false)
    setResumePromptOpen(false)
    setEntryDecisionLoading(true)
    setStartOverLoading(false)
    setLoadedSessionRecord(null)

    const loadSession = async () => {
      try {
        const session = await api.sessions.getById(sessionId)
        if (cancelled) return

        const sessionRecord = isRecord(session) ? session : {}
        setLoadedSessionRecord(sessionRecord)
        const status = normalizeSessionStatus(session)

        if (status === 'ended') {
          syncSessionState(session, { launchFreshIteration: true })
          setAutoConnectConversation(true)
          return
        }

        syncSessionState(session)

        let hasExistingProgress = false
        try {
          const timeline = await api.sessions.timeline(sessionId, 1)
          if (cancelled) return
          const totalTurns = typeof timeline?.total === 'number' ? timeline.total : 0
          const history = Array.isArray(timeline?.conversationHistory)
            ? timeline.conversationHistory
            : []
          hasExistingProgress = totalTurns > 0 || history.length > 0
        } catch {
          hasExistingProgress = false
        }

        if (cancelled) return

        if (hasExistingProgress) {
          setResumePromptOpen(true)
          setAutoConnectConversation(false)
        } else {
          setAutoConnectConversation(true)
        }
      } catch {
        if (cancelled) return
        setIsMultiTurn(false)
        setAutoConnectConversation(true)
      } finally {
        if (!cancelled) {
          setEntryDecisionLoading(false)
        }
      }
    }

    void loadSession()

    return () => {
      cancelled = true
    }
  }, [sessionId, syncSessionState])

  const handleResumeSession = useCallback(() => {
    setResumePromptOpen(false)
    setAutoConnectConversation(true)
  }, [])

  const handleStartOver = useCallback(async () => {
    if (!loadedSessionRecord || startOverLoading) return

    setStartOverLoading(true)
    try {
      await interrupt()
      stopListening()
      stopAudio()

      const restartedSession = await api.sessions.restart(sessionId, {
        reason: 'restart_from_scratch',
      })
      const restartedRecord = isRecord(restartedSession) ? restartedSession : {}

      clearMessages()
      clearToolEvents()
      clearHangupRequest()
      setTextInput('')
      setHints([])
      setHintsError(null)
      setTimelineStages([])
      setCurrentProgress(0)
      setTimelineError(null)
      setCallStarted(false)
      setCallError(null)
      speechBufferRef.current = ''
      assistantInterruptTriggeredRef.current = false
      resetTranscript()

      setLoadedSessionRecord(restartedRecord)
      syncSessionState(restartedSession)

      if (hintsEnabled) {
        try {
          const response = await api.hints.history(sessionId, 1)
          const latest = response?.history?.[0]
          const nextHints = latest?.hints?.map((hint: { content: string }) => hint.content) ?? []
          setHints(nextHints)
          setHintsError(null)
        } catch {
          setHintsError('Unable to load hints')
        }
      }

      if (timelineEnabled) {
        try {
          const response = await api.sessions.timeline(sessionId, 50)
          const plannedStages = response?.plannedStages ?? []
          const progress = response?.currentProgress ?? 0
          const totalTurns = response?.total ?? 0

          if (plannedStages.length === 0) {
            setTimelineStages([])
            setCurrentProgress(0)
            setTimelineError(null)
          } else {
            const currentStageIndex = Math.min(
              plannedStages.length - 1,
              Math.floor((progress / 100) * plannedStages.length)
            )

            const stages = plannedStages.map((stage: any, index: number) => ({
              order: stage.order,
              label: stage.label,
              description: stage.description,
              active: index === currentStageIndex && totalTurns > 0,
              completed: index < currentStageIndex,
            }))

            setTimelineStages(stages)
            setCurrentProgress(progress)
            setTimelineError(null)
          }
        } catch {
          setTimelineError('Unable to load timeline')
        }
      }

      notifications.show({
        title: 'Started a new iteration',
        message: 'You are now in a fresh iteration of this session.',
        color: 'green',
      })
      setResumePromptOpen(false)
      setAutoConnectConversation(true)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to start a new iteration right now.'
      notifications.show({
        title: 'Start over failed',
        message,
        color: 'red',
      })
    } finally {
      setStartOverLoading(false)
    }
  }, [
    clearHangupRequest,
    clearMessages,
    clearToolEvents,
    hintsEnabled,
    interrupt,
    loadedSessionRecord,
    resetTranscript,
    sessionId,
    startOverLoading,
    stopAudio,
    stopListening,
    syncSessionState,
    timelineEnabled,
  ])

  // Hidden pose camera for MediaPipe across session types.
  // The visible video area is reserved for the AI avatar on video sessions.
  useEffect(() => {
    if (sessionType === null) return

    if (!isVideoSession || !visualEnabled || !isConnected) {
      poseCameraStreamRef.current?.getTracks().forEach((t) => t.stop())
      poseCameraStreamRef.current = null
      if (poseVideoRef.current) poseVideoRef.current.srcObject = null
      if (userPipVideoRef.current) userPipVideoRef.current.srcObject = null
      return
    }

    let cancelled = false
    const poseVideoElement = poseVideoRef.current
    const startPoseCamera = async () => {
      if (!navigator.mediaDevices?.getUserMedia) return
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        poseCameraStreamRef.current = stream
        if (poseVideoElement) {
          poseVideoElement.srcObject = stream
          poseVideoElement.play().catch(() => {})
        }
        if (userPipVideoRef.current) {
          userPipVideoRef.current.srcObject = stream
          userPipVideoRef.current.play().catch(() => {})
        }
      } catch {
        // Camera permission denied — visual state won't be sent; conversation still works normally
      }
    }

    void startPoseCamera()

    return () => {
      cancelled = true
      poseCameraStreamRef.current?.getTracks().forEach((t) => t.stop())
      poseCameraStreamRef.current = null
      if (poseVideoElement) poseVideoElement.srcObject = null
      if (userPipVideoRef.current) userPipVideoRef.current.srcObject = null
    }
  }, [isVideoSession, visualEnabled, isConnected, sessionType])

  const handleStartPhoneCall = async () => {
    if (!sessionId) return
    const normalized = phoneNumber.trim()
    const requiresPlus = callProvider === 'vapi'
    const validPattern = requiresPlus ? /^\+[1-9]\d{7,14}$/ : /^\+?[1-9]\d{7,14}$/
    if (!normalized || !validPattern.test(normalized)) {
      setCallError(
        requiresPlus
          ? 'Enter a valid phone number with + and country code (e.g. +15551234567)'
          : 'Enter a valid phone number in E.164 format (e.g. +15551234567)'
      )
      return
    }

    setCallLoading(true)
    setCallError(null)
    try {
      await api.phoneCalls.start({
        sessionId,
        phoneNumber: normalized,
        provider: callProvider,
      })
      notifications.show({
        title: 'Calling now',
        message: `We’re calling ${normalized}. Answer your phone to begin.`,
        color: 'green',
      })
      setCallStarted(true)
      setCallModalOpen(false)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to start the phone call right now.'
      setCallError(message)
      notifications.show({
        title: 'Call failed',
        message,
        color: 'red',
      })
    } finally {
      setCallLoading(false)
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handleSendText = () => {
    if (sessionStatus === 'ended') return
    if (textInput.trim() && isConnected) {
      clearSpeechFinalizeState()
      speechBufferRef.current = ''
      if (isListening) {
        stopListening()
      }
      sendMessage(textInput.trim())
      setTextInput('')
      scheduleIdleHints()
    }
  }

  const handleMicrophoneClick = async () => {
    if (!isSttSupported || !isConnected || sessionStatus === 'ended') {
      return
    }

    if (isListening) {
      stopListening()
      if (speechBufferRef.current.trim()) {
        flushSpeechBuffer()
      } else {
        clearSpeechFinalizeState()
      }
      return
    }

    if (assistantSpeaking || isProcessing) {
      interrupt()
      stopAudio()
    }

    clearSpeechFinalizeState()
    const permissionGranted = await requestMicrophoneAccess()
    if (!permissionGranted) {
      return
    }
    hasUserEnabledMicRef.current = true
    void startListening()
  }

  const handlePauseReplay = useCallback(() => {
    if (assistantSpeaking) {
      stopAudio()
    } else if (currentAudioUrl) {
      if (isVideoSession && videoRef.current && avatarVideoUrl) {
        videoRef.current.currentTime = 0
        videoRef.current.play().catch(() => {})
      }
      replayAudio()
    } else if (isProcessing) {
      interrupt()
    }
  }, [
    assistantSpeaking,
    currentAudioUrl,
    isVideoSession,
    avatarVideoUrl,
    isProcessing,
    stopAudio,
    replayAudio,
    interrupt,
  ])

  useEffect(() => {
    latestMessagesRef.current = messages.map((msg) => ({
      role: msg.role,
      text: msg.text,
    }))
  }, [messages])

  useEffect(() => {
    if (!sessionId || !hintsEnabled) {
      hintsRequestSeqRef.current += 1
      setHints([])
      setHintsError(null)
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current)
        idleTimerRef.current = null
      }
      return
    }

    const loadHints = async () => {
      if (latestMessagesRef.current.length > 0) {
        return
      }
      const loadRequestSeq = ++hintsRequestSeqRef.current
      try {
        const response = await api.hints.history(sessionId, 1)
        if (loadRequestSeq !== hintsRequestSeqRef.current) return
        const latest = response?.history?.[0]
        const nextHints = latest?.hints?.map((hint: { content: string }) => hint.content) ?? []
        setHints(nextHints)
        setHintsError(null)
      } catch (err) {
        if (loadRequestSeq !== hintsRequestSeqRef.current) return
        setHintsError('Unable to load hints')
      }
    }

    void loadHints()
    scheduleIdleHints()
  }, [sessionId, hintsEnabled, scheduleIdleHints])

  useEffect(() => {
    if (!hintsEnabled || sessionStatus === 'ended') return
    if (messages.length === 0) return
    if (isProcessing) return

    scheduleIdleHints(1200)
  }, [hintsEnabled, sessionStatus, messages.length, isProcessing, scheduleIdleHints])

  useEffect(() => {
    if (!sessionId || !timelineEnabled) {
      setTimelineStages([])
      setCurrentProgress(0)
      setTimelineError(null)
      return
    }

    const loadTimeline = async () => {
      try {
        const response = await api.sessions.timeline(sessionId, 50)
        const plannedStages = response?.plannedStages ?? []
        const progress = response?.currentProgress ?? 0
        const totalTurns = response?.total ?? 0

        if (plannedStages.length === 0) {
          setTimelineStages([])
          setCurrentProgress(0)
          setTimelineError(null)
          return
        }

        const currentStageIndex = Math.min(
          plannedStages.length - 1,
          Math.floor((progress / 100) * plannedStages.length)
        )

        const stages = plannedStages.map((stage: any, index: number) => ({
          order: stage.order,
          label: stage.label,
          description: stage.description,
          active: index === currentStageIndex && totalTurns > 0,
          completed: index < currentStageIndex,
        }))

        setTimelineStages(stages)
        setCurrentProgress(progress)
        setTimelineError(null)
      } catch (err) {
        setTimelineError('Unable to load timeline')
      }
    }

    void loadTimeline()
  }, [sessionId, timelineEnabled])

  useEffect(() => {
    return () => {
      hintsRequestSeqRef.current += 1
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current)
      }
      if (speechFinalizeTimerRef.current) {
        clearTimeout(speechFinalizeTimerRef.current)
      }
      if (speechFinalizeTickerRef.current) {
        clearInterval(speechFinalizeTickerRef.current)
      }
      if (assistantStartTimerRef.current) {
        clearTimeout(assistantStartTimerRef.current)
      }
      poseCameraStreamRef.current?.getTracks().forEach((t) => t.stop())
      poseCameraStreamRef.current = null
    }
  }, [])

  useEffect(() => {
    if (sessionStatus === 'ended') return
    if (!isMultiTurn || !isConnected) return
    if (messages.length > 0) return

    if (assistantStartTimerRef.current) {
      clearTimeout(assistantStartTimerRef.current)
    }
    assistantStartTimerRef.current = setTimeout(() => {
      startAssistantTurn()
    }, 600)
  }, [isMultiTurn, isConnected, messages.length, startAssistantTurn, sessionStatus])

  useEffect(() => {
    const shouldPauseMicWhileAssistantSpeaks = sessionType !== 'voice' && sessionType !== 'video'

    if (assistantSpeaking && isListening && shouldPauseMicWhileAssistantSpeaks) {
      stopListening()
    }
  }, [assistantSpeaking, isListening, sessionType, stopListening])

  useEffect(() => {
    if (!assistantSpeaking && !isProcessing) {
      assistantInterruptTriggeredRef.current = false
    }
  }, [assistantSpeaking, isProcessing])

  useEffect(() => {
    const isVoiceOrVideo = sessionType === 'voice' || sessionType === 'video'
    const canAutoResumeMic = hasUserEnabledMicRef.current || microphonePermission === 'granted'
    if (
      previousAudioPlayingRef.current &&
      !assistantSpeaking &&
      isVoiceOrVideo &&
      canAutoResumeMic &&
      isSttSupported &&
      !isSttPermissionBlocked &&
      isConnected &&
      sessionStatus !== 'ended' &&
      !isListening
    ) {
      void startListening()
    }
    previousAudioPlayingRef.current = assistantSpeaking
  }, [
    assistantSpeaking,
    sessionType,
    microphonePermission,
    isSttSupported,
    isSttPermissionBlocked,
    isConnected,
    sessionStatus,
    isListening,
    startListening,
  ])

  useEffect(() => {
    if (sessionType !== 'video') return

    const lastMessage = messages[messages.length - 1]
    if (!lastMessage || lastMessage.role !== 'assistant') return
    if (lastAssistantMessageIdRef.current === lastMessage.id) return

    lastAssistantMessageIdRef.current = lastMessage.id
    setAvatarVideoStatus('rendering')
    setAvatarVideoError(null)
  }, [messages, sessionType])

  useEffect(() => {
    if (sessionType !== 'video') return
    if (avatarVideoStatus !== 'queued' && avatarVideoStatus !== 'rendering') return
    if (!sessionId) return

    let cancelled = false
    const refreshVideoState = async () => {
      try {
        const session = await api.sessions.getById(sessionId)
        const nextAvatarState = readAvatarVideoState(session)
        if (!cancelled && (nextAvatarState.status !== 'idle' || session?.status === 'ended')) {
          syncSessionState(session)
        }
      } catch {
        // Keep the current rendering state and try again on the next tick.
      }
    }

    void refreshVideoState()
    const interval = setInterval(() => {
      void refreshVideoState()
    }, 3000)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [avatarVideoStatus, sessionId, sessionType, syncSessionState])

  useEffect(() => {
    if (sessionType !== 'video' || !avatarVideoUrl || !videoRef.current) return
    videoRef.current.currentTime = 0
    videoRef.current.play().catch(() => {})
  }, [avatarVideoUrl, sessionType])

  // Refresh timeline when messages change (conversation progresses)
  useEffect(() => {
    if (!timelineEnabled) return
    if (messages.length > 0 && sessionId) {
      const loadTimeline = async () => {
        try {
          const response = await api.sessions.timeline(sessionId, 50)
          const plannedStages = response?.plannedStages ?? []
          const progress = response?.currentProgress ?? 0
          const totalTurns = response?.total ?? 0

          if (plannedStages.length === 0) return

          const currentStageIndex = Math.min(
            plannedStages.length - 1,
            Math.floor((progress / 100) * plannedStages.length)
          )

          const stages = plannedStages.map((stage: any, index: number) => ({
            order: stage.order,
            label: stage.label,
            description: stage.description,
            active: index === currentStageIndex && totalTurns > 0,
            completed: index < currentStageIndex,
          }))

          setTimelineStages(stages)
          setCurrentProgress(progress)
        } catch {
          // Silently fail on updates
        }
      }

      void loadTimeline()
    }
  }, [messages.length, sessionId, timelineEnabled])

  const handleHangUp = async () => {
    clearSpeechFinalizeState()
    speechBufferRef.current = ''
    if (isListening) {
      stopListening()
    }
    try {
      await api.sessions.end(sessionId, { reason: 'hangup' })
      setSessionStatus('ended')
    } catch (err) {
      console.warn('Failed to end session', err)
    }

    hangUp()
    router.push(`/session/${sessionId}/performance`)
  }

  useEffect(() => {
    if (sessionType === 'phone' && sessionStatus === 'ended') {
      router.push(`/session/${sessionId}/performance`)
    }
  }, [sessionType, sessionStatus, sessionId, router])

  const sttCommitProgress = Math.min(1, Math.max(0, sttCommitRemainingMs / speechFinalizeDelayMs))

  const todayStr = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  const globeState: GlobeState = assistantSpeaking
    ? 'speaking'
    : isProcessing
      ? 'processing'
      : isListening
        ? 'listening'
        : 'idle'
  // ── Tool event derived UI state ────────────────────────────────────────────
  const latestMoodEvent = toolEvents.findLast((e) => e.tool === 'update_mood')
  const currentMood = latestMoodEvent ? (latestMoodEvent.args.mood as string) : null
  const moodDotColor =
    currentMood === 'interested' || currentMood === 'satisfied'
      ? 'green'
      : currentMood === 'skeptical'
        ? 'orange'
        : currentMood === 'impatient' || currentMood === 'frustrated'
          ? 'red'
          : 'gray'

  const activeObjections = toolEvents.filter((e) => e.tool === 'raise_objection')
  const latestNextStep = toolEvents.findLast((e) => e.tool === 'propose_next_step') ?? null

  // Show coaching toast for each new flag_moment event
  useEffect(() => {
    const lastFlag = toolEvents.findLast((e) => e.tool === 'flag_moment')
    if (!lastFlag) return
    notifications.show({
      title: '🎯 Coaching Moment',
      message: String(lastFlag.args.description ?? ''),
      color: 'blue',
      autoClose: 6000,
    })
  }, [toolEvents])

  return (
    <Box
      style={{
        height: '100vh',
        backgroundColor: 'var(--mantine-color-dark-9)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Resume prompt is now rendered inside VoiceOrbSession as an orb speech bubble */}
      <Modal
        opened={callModalOpen && sessionType === 'phone'}
        onClose={() => setCallModalOpen(false)}
        title="Start phone call"
        centered
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            Enter the destination number now. Phone-call sessions no longer store this during setup.
          </Text>
          <TextInput
            label="Phone number"
            placeholder="+15551234567"
            value={phoneNumber}
            onChange={(event) => {
              setPhoneNumber(event.currentTarget.value)
              if (callError) {
                setCallError(null)
              }
            }}
            error={callError ?? undefined}
            type="tel"
            autoComplete="tel"
          />
          <Select
            label="Provider"
            data={[
              { value: 'twilio', label: 'Twilio' },
              { value: 'vapi', label: 'Vapi' },
            ]}
            value={callProvider}
            onChange={(value) => setCallProvider(value ?? 'twilio')}
            allowDeselect={false}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setCallModalOpen(false)}>
              Not now
            </Button>
            <Button onClick={handleStartPhoneCall} loading={callLoading}>
              Start call
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* AI Hang-up Confirmation Modal */}
      <Modal
        opened={!!hangupRequest}
        onClose={clearHangupRequest}
        title="The AI persona wants to hang up"
        centered
        size="sm"
        styles={{
          header: { background: 'var(--mantine-color-dark-7)' },
          body: { background: 'var(--mantine-color-dark-7)' },
        }}
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            {hangupRequest?.reason}
          </Text>
          <Group justify="flex-end" gap="sm">
            <Button variant="default" onClick={clearHangupRequest}>
              Continue anyway
            </Button>
            <Button
              color="red"
              leftSection={<IconPhone size={14} />}
              onClick={() => {
                clearHangupRequest()
                void handleHangUp()
              }}
            >
              Let them hang up
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Top Bar */}
      <Box
        style={{
          backgroundColor: 'var(--mantine-color-dark-8)',
          padding: isMobile ? '10px 12px' : '16px 32px',
          paddingTop: isMobile ? 'max(10px, env(safe-area-inset-top, 10px))' : '16px',
          borderBottom: '1px solid var(--mantine-color-dark-6)',
          flexShrink: 0,
        }}
      >
        <Group justify="space-between" align="center" wrap="wrap" gap="sm">
          <Group gap="sm" align="center" style={{ minWidth: 0, flex: 1 }}>
            <Stack gap={2}>
              <Text fw={600} size="lg" c="white">
                {sessionName || 'Live Session'}
              </Text>
              {personaName && (
                <Group gap={6} align="center">
                  <Text size="xs" c="dimmed">
                    with {personaName}
                  </Text>
                  {currentMood && (
                    <Box
                      title={`Mood: ${currentMood}`}
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        backgroundColor: `var(--mantine-color-${moodDotColor}-5)`,
                        flexShrink: 0,
                        transition: 'background-color 0.4s ease',
                      }}
                    />
                  )}
                </Group>
              )}
            </Stack>
          </Group>
          <Group gap={isMobile ? 'xs' : 'xl'} wrap="nowrap" style={{ flexShrink: 0 }}>
            <Text size={isMobile ? 'md' : 'xl'} fw={700} c="white">
              {formatTime(time)}
            </Text>
            {!isMobile && (
              <Group gap="xs">
                <Box
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    backgroundColor: 'red',
                    animation: 'pulse 2s infinite',
                  }}
                />
                <Text c="red" fw={600}>
                  Recording
                </Text>
              </Group>
            )}
            {!isMobile && <Text c="dimmed">{todayStr}</Text>}
            <Group gap="xs">
              {isConnecting && <Loader size="sm" color="white" />}
              {entryDecisionLoading && <Loader size="sm" color="white" />}
              {conversationError && (
                <Text size="xs" c="red">
                  {conversationError}
                </Text>
              )}
              {isConnected && !isConnecting && (
                <Box
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    backgroundColor: 'green',
                  }}
                />
              )}
              {isVideoSession && (
                <CameraEngagementIndicator
                  isActive={visualEnabled}
                  isReady={poseIsReady}
                  onToggle={() => setVisualEnabled((v) => !v)}
                />
              )}
              {sessionType === 'phone' && sessionStatus !== 'ended' && !callStarted && (
                <Button
                  size="xs"
                  variant="light"
                  color="blue"
                  onClick={() => setCallModalOpen(true)}
                >
                  Start call
                </Button>
              )}
              <ActionIcon
                size="lg"
                variant="subtle"
                color="white"
                onClick={handleHangUp}
                title="End call and return to sessions"
              >
                <IconPhone size={20} />
              </ActionIcon>
            </Group>
          </Group>
        </Group>
      </Box>

      {/* Main Content */}
      <Box
        style={{
          display: 'flex',
          gap: isMobile ? 12 : 24,
          flex: 1,
          overflow: isMobile ? 'auto' : 'hidden',
          flexDirection: isMobile ? 'column' : 'row',
          padding: isMobile ? '0.75rem' : '1.5rem',
        }}
      >
        {!isMobile && hintsEnabled ? (
          <Paper
            withBorder
            radius="lg"
            p="lg"
            style={{
              width: 220,
              backgroundColor: 'var(--pitch-surface-bg)',
              height: 'fit-content',
              flexShrink: 0,
            }}
          >
            <Group justify="space-between" mb="md">
              <Group gap="xs">
                <Title order={4}>Hints</Title>
                <Badge size="sm" variant="light">
                  {hints.length}
                </Badge>
              </Group>
              <Button
                size="xs"
                variant="subtle"
                color="gray"
                onClick={() => setHintsEnabled(false)}
              >
                Hide
              </Button>
            </Group>
            <Stack gap="md">
              {hintsError && (
                <Text size="xs" c="red">
                  {hintsError}
                </Text>
              )}
              {!hintsError && hints.length === 0 && (
                <Text size="xs" c="dimmed">
                  No hints yet.
                </Text>
              )}
              {hints.map((hint, i) => (
                <Group key={i} gap="xs" align="start">
                  <IconArrowRight size={16} style={{ marginTop: 4, flexShrink: 0 }} />
                  <Text size="sm">{hint}</Text>
                </Group>
              ))}
            </Stack>
          </Paper>
        ) : !isMobile ? (
          <Box
            style={{
              width: 220,
              display: 'flex',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Button variant="light" color="brand" onClick={() => setHintsEnabled(true)}>
              Show hints
            </Button>
          </Box>
        ) : null}

        <Box
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: 24,
            overflow: 'hidden',
          }}
        >
          <VoiceOrbSession
            mode={sessionType === 'text' ? 'text' : sessionType === 'video' ? 'video' : 'voice'}
            messages={messages}
            globeState={globeState}
            analyserRef={analyserRef}
            resumePromptOpen={resumePromptOpen}
            onResume={handleResumeSession}
            onStartOver={handleStartOver}
            startOverLoading={startOverLoading}
            assistantSpeaking={assistantSpeaking}
            isListening={isListening}
            isProcessing={isProcessing}
            isConnected={isConnected}
            sessionStatus={sessionStatus}
            isSttSupported={isSttSupported}
            isSttPermissionBlocked={isSttPermissionBlocked}
            transcript={transcript}
            interimTranscript={interimTranscript}
            sttError={sttError ?? null}
            sttCommitRemainingMs={sttCommitRemainingMs}
            sttCommitProgress={sttCommitProgress}
            textInput={textInput}
            currentAudioUrl={currentAudioUrl}
            isMobile={!!isMobile}
            activeObjections={activeObjections}
            latestNextStep={latestNextStep}
            onHangUp={handleHangUp}
            onPauseReplay={handlePauseReplay}
            onMicrophoneClick={handleMicrophoneClick}
            onSendText={handleSendText}
            onTextInputChange={setTextInput}
            onScheduleIdleHints={scheduleIdleHints}
            isVideoSession={isVideoSession}
            avatarVideoUrl={avatarVideoUrl}
            avatarVideoJobId={avatarVideoJobId}
            avatarVideoStatus={avatarVideoStatus}
            avatarVideoProvider={avatarVideoProvider}
            avatarVideoError={avatarVideoError}
            videoRef={videoRef}
            visualState={visualState}
            poseIsReady={poseIsReady}
            cameraEnabled={visualEnabled}
            onToggleCamera={() => setVisualEnabled((v) => !v)}
            userVideoRef={userPipVideoRef}
          />
        </Box>

        {!isMobile && timelineEnabled ? (
          <Paper
            withBorder
            radius="lg"
            p="lg"
            style={{
              width: 200,
              backgroundColor: 'var(--pitch-surface-bg)',
              height: 'fit-content',
              flexShrink: 0,
            }}
          >
            <Group justify="space-between" mb="xl">
              <Title order={4}>Timeline</Title>
              <Button
                size="xs"
                variant="subtle"
                color="gray"
                onClick={() => setTimelineEnabled(false)}
              >
                Hide
              </Button>
            </Group>
            <Box style={{ position: 'relative', paddingLeft: 40 }}>
              <Box
                style={{
                  position: 'absolute',
                  left: 20,
                  top: 0,
                  bottom: 0,
                  width: 2,
                  backgroundColor: 'var(--mantine-color-gray-4)',
                }}
              />

              <Stack gap={60}>
                {timelineError && (
                  <Text size="xs" c="red">
                    {timelineError}
                  </Text>
                )}
                {!timelineError && currentProgress > 0 && (
                  <Box mb="md">
                    <Badge variant="filled" color="blue" size="lg">
                      {currentProgress}% Complete
                    </Badge>
                  </Box>
                )}
                {!timelineError && timelineStages.length === 0 && (
                  <Text size="xs" c="dimmed">
                    Loading session plan...
                  </Text>
                )}
                {timelineStages.map((stage, i) => (
                  <Box key={i} style={{ position: 'relative' }}>
                    <Box
                      style={{
                        position: 'absolute',
                        left: -28,
                        top: -4,
                        width: stage.active ? 16 : 8,
                        height: stage.active ? 16 : 8,
                        borderRadius: '50%',
                        backgroundColor: stage.completed
                          ? 'var(--mantine-color-green-6)'
                          : stage.active
                            ? 'var(--mantine-color-blue-6)'
                            : 'var(--mantine-color-gray-5)',
                        border: stage.active ? '2px solid var(--mantine-color-blue-2)' : 'none',
                      }}
                    />
                    <Box>
                      <Text
                        size="sm"
                        fw={stage.active ? 600 : 400}
                        c={stage.active ? 'blue' : stage.completed ? 'green' : 'dimmed'}
                      >
                        {stage.label}
                      </Text>
                      {stage.description && (
                        <Text size="xs" c="dimmed" mt={4} style={{ lineHeight: 1.3 }}>
                          {stage.description}
                        </Text>
                      )}
                    </Box>
                  </Box>
                ))}
              </Stack>
            </Box>
          </Paper>
        ) : !isMobile ? (
          <Box
            style={{
              width: 200,
              display: 'flex',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Button variant="light" color="brand" onClick={() => setTimelineEnabled(true)}>
              Show timeline
            </Button>
          </Box>
        ) : null}
      </Box>

      {/* Hidden MediaPipe pose video.
          Must stay within the viewport (opacity:0.001 not display:none) so the
          browser scheduler doesn't throttle its frame callbacks. */}
      <video
        ref={poseVideoRef}
        autoPlay
        playsInline
        muted
        aria-hidden="true"
        style={{
          position: 'fixed',
          bottom: 0,
          right: 0,
          width: 160,
          height: 120,
          opacity: 0.001,
          pointerEvents: 'none',
          zIndex: -1,
        }}
      />

      <style jsx global>{`
        @keyframes pulse {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
      `}</style>

      <CoachChatWidget
        context={{
          page: 'session',
          sessionId,
          recentTurns: messages.slice(-6).map((m) => ({ role: m.role, text: m.text })),
        }}
      />
    </Box>
  )
}
