'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Box,
  Group,
  Stack,
  Title,
  Text,
  Paper,
  Avatar,
  ActionIcon,
  Badge,
  TextInput,
  ScrollArea,
  Loader,
  Modal,
  Button,
} from '@mantine/core'
import {
  IconPhone,
  IconPlayerPause,
  IconMicrophone,
  IconArrowRight,
  IconSend,
} from '@tabler/icons-react'
import { useRouter, useParams } from 'next/navigation'
import {
  useConversation,
  useVisualState,
  VisualStateOverlay,
  CameraEngagementIndicator,
} from '@/features/conversation'
import { CoachChatWidget } from '@/components/ui/CoachChatWidget'
import { useSpeechToText } from '@/features/stt'
import { API_CONFIG, api } from '@/lib/client'
import { notifications } from '@mantine/notifications'
import type { CreateSessionInput, SessionType } from '@/features/sessions'

type AvatarVideoStatus = 'idle' | 'queued' | 'rendering' | 'ready' | 'failed'

interface AvatarVideoState {
  status: AvatarVideoStatus
  provider: string | null
  url: string | null
  error: string | null
  jobId: string | null
  playbackToken: string | null
}

interface PhoneVerificationState {
  verified: boolean
  phoneNumber?: string | null
  verifiedAt?: string | null
  pendingPhoneNumber?: string | null
  pendingExpiresAt?: string | null
  resendAvailableAt?: string | null
  remainingAttempts?: number
  remainingSends?: number
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

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

const readPersonaImageUrl = (session: unknown): string | null => {
  if (!isRecord(session) || !isRecord(session.persona) || !isRecord(session.persona.traits)) {
    return null
  }

  const avatar = isRecord(session.persona.traits.avatar) ? session.persona.traits.avatar : {}
  return typeof avatar.imageUrl === 'string' && avatar.imageUrl.trim().length > 0
    ? avatar.imageUrl
    : null
}

const buildSessionVideoStreamUrl = (sessionId: string, token: string, jobId?: string | null) => {
  const url = new URL(`${API_CONFIG.baseURL}/simulation/video/stream/${sessionId}`)
  url.searchParams.set('token', token)
  if (jobId) {
    url.searchParams.set('job', jobId)
  }
  return url.toString()
}

const buildCreateSessionPayload = (session: Record<string, unknown>): CreateSessionInput => {
  const orgId = typeof session.orgId === 'string' ? session.orgId : ''
  const type = typeof session.type === 'string' ? session.type : ''

  if (!orgId) {
    throw new Error('Unable to start over: session org is missing.')
  }
  if (!type) {
    throw new Error('Unable to start over: session type is missing.')
  }

  return {
    orgId,
    orgSnapshot: isRecord(session.orgSnapshot) ? session.orgSnapshot : undefined,
    userSnapshot: isRecord(session.userSnapshot) ? session.userSnapshot : undefined,
    name: typeof session.name === 'string' ? session.name : undefined,
    type,
    tags: Array.isArray(session.tags)
      ? session.tags.filter((tag): tag is string => typeof tag === 'string')
      : [],
    sessionConfig: isRecord(session.sessionConfig) ? session.sessionConfig : undefined,
    scenarioId: typeof session.scenarioId === 'string' ? session.scenarioId : undefined,
    personaId: typeof session.personaId === 'string' ? session.personaId : undefined,
    language: typeof session.language === 'string' ? session.language : undefined,
    crmContextId: typeof session.crmContextId === 'string' ? session.crmContextId : undefined,
  }
}

export default function LiveSessionPage() {
  const router = useRouter()
  const params = useParams()
  const sessionId = params.id as string
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
  const [personaImageUrl, setPersonaImageUrl] = useState<string | null>(null)
  const [hintsEnabled, setHintsEnabled] = useState(false)
  const [timelineEnabled, setTimelineEnabled] = useState(false)
  const [callStarted, setCallStarted] = useState(false)
  const [phoneNumber, setPhoneNumber] = useState('')
  const [callModalOpen, setCallModalOpen] = useState(false)
  const [callLoading, setCallLoading] = useState(false)
  const [callError, setCallError] = useState<string | null>(null)
  const [phoneVerification, setPhoneVerification] = useState<PhoneVerificationState | null>(null)
  const [phoneVerificationLoading, setPhoneVerificationLoading] = useState(false)
  const [phoneVerificationActionLoading, setPhoneVerificationActionLoading] = useState(false)
  const [verificationCode, setVerificationCode] = useState('')
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
  const hasUserEnabledMicRef = useRef(false)
  const [isMultiTurn, setIsMultiTurn] = useState(false)
  const assistantStartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const lastAssistantMessageIdRef = useRef<string | null>(null)
  // Hidden pose camera feed used by MediaPipe across session types.
  const poseVideoRef = useRef<HTMLVideoElement | null>(null)
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
    clearHangupRequest,
    toolEvents,
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
      if (!isFinal) return
      const cleaned = text.trim()
      if (!cleaned) return

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

  const { isReady: poseIsReady, currentState: visualState } = useVisualState({
    sessionId,
    videoRef: poseVideoRef,
    enabled: isVideoSession && visualEnabled && isConnected,
    sendIntervalMs: 5000,
    onUserAbsent: () => {},
  })

  const syncSessionState = useCallback((session: any) => {
    const config = (session?.sessionConfig as Record<string, any>) ?? {}
    const avatarState = readAvatarVideoState(session)
    const nextAvatarVideoUrl =
      session?.id && avatarState.status === 'ready' && avatarState.playbackToken
        ? buildSessionVideoStreamUrl(session.id, avatarState.playbackToken, avatarState.jobId)
        : avatarState.url

    setIsMultiTurn(Boolean(config.multiTurnEnabled))
    setSessionType(session?.type ?? null)
    setSessionStatus(session?.status ?? null)
    setSessionName((session as any)?.name ?? (session as any)?.scenario?.name ?? '')
    setPersonaName((session as any)?.persona?.name ?? null)
    setPersonaImageUrl(readPersonaImageUrl(session))
    setPhoneNumber('')
    setAvatarVideoStatus(avatarState.status)
    setAvatarVideoProvider(avatarState.provider)
    setAvatarVideoError(avatarState.error)
    setAvatarVideoJobId(avatarState.jobId)
    setAvatarVideoUrl(nextAvatarVideoUrl)
    setCallModalOpen(session?.type === 'phone' && session?.status !== 'ended')
  }, [])

  const loadPhoneVerificationStatus = useCallback(async () => {
    setPhoneVerificationLoading(true)
    try {
      const status = (await api.users.getMyPhoneVerification()) as PhoneVerificationState
      setPhoneVerification(status)
      if (status.phoneNumber) {
        setPhoneNumber(status.phoneNumber)
      } else if (status.pendingPhoneNumber) {
        setPhoneNumber(status.pendingPhoneNumber)
      }
      setCallError(null)
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unable to load your phone verification status right now.'
      setCallError(message)
    } finally {
      setPhoneVerificationLoading(false)
    }
  }, [])

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
        syncSessionState(session)

        const status =
          typeof sessionRecord.status === 'string' ? sessionRecord.status.toLowerCase() : ''

        if (status === 'ended') {
          setAutoConnectConversation(true)
          return
        }

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

  useEffect(() => {
    if (sessionType !== 'phone' || sessionStatus === 'ended') return
    void loadPhoneVerificationStatus()
  }, [sessionType, sessionStatus, loadPhoneVerificationStatus])

  const handleResumeSession = useCallback(() => {
    setResumePromptOpen(false)
    setAutoConnectConversation(true)
  }, [])

  const handleStartOver = useCallback(async () => {
    if (!loadedSessionRecord || startOverLoading) return

    setStartOverLoading(true)
    try {
      const currentStatus =
        typeof loadedSessionRecord.status === 'string'
          ? loadedSessionRecord.status.toLowerCase()
          : ''
      if (currentStatus !== 'ended') {
        try {
          await api.sessions.end(sessionId, { reason: 'restart_from_scratch' })
        } catch {
          // Best effort: if ending fails, still attempt creating a fresh iteration.
        }
      }

      const payload = buildCreateSessionPayload(loadedSessionRecord)
      const freshSession = await api.sessions.create(payload)
      const nextSessionId = typeof freshSession?.id === 'string' ? freshSession.id : ''
      if (!nextSessionId) {
        throw new Error('Unable to start over right now. Please try again.')
      }

      notifications.show({
        title: 'Started a new iteration',
        message: 'You are now in a fresh session with the same setup.',
        color: 'green',
      })
      setResumePromptOpen(false)
      setAutoConnectConversation(false)
      router.replace(`/session/${nextSessionId}`)
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
  }, [loadedSessionRecord, router, sessionId, startOverLoading])

  // Hidden pose camera for MediaPipe across session types.
  // The visible video area is reserved for the AI avatar on video sessions.
  useEffect(() => {
    if (sessionType === null) return

    if (!isVideoSession || !visualEnabled || !isConnected) {
      poseCameraStreamRef.current?.getTracks().forEach((t) => t.stop())
      poseCameraStreamRef.current = null
      if (poseVideoRef.current) poseVideoRef.current.srcObject = null
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
    }
  }, [isVideoSession, visualEnabled, isConnected, sessionType])

  const handleRequestPhoneVerification = async () => {
    const nextPhoneNumber = phoneNumber.trim()
    if (!nextPhoneNumber) {
      setCallError('Enter the phone number you want us to call.')
      return
    }

    setPhoneVerificationActionLoading(true)
    setCallError(null)
    try {
      const status = (await api.users.requestPhoneVerification({
        phoneNumber: nextPhoneNumber,
      })) as PhoneVerificationState
      setPhoneVerification(status)
      setVerificationCode('')
      notifications.show({
        title: 'Verification call sent',
        message: `We’re calling ${status.pendingPhoneNumber ?? nextPhoneNumber} with your verification code.`,
        color: 'blue',
      })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to send the verification challenge.'
      setCallError(message)
      notifications.show({
        title: 'Verification failed',
        message,
        color: 'red',
      })
    } finally {
      setPhoneVerificationActionLoading(false)
    }
  }

  const handleResendPhoneVerification = async () => {
    setPhoneVerificationActionLoading(true)
    setCallError(null)
    try {
      const status = (await api.users.resendPhoneVerification()) as PhoneVerificationState
      setPhoneVerification(status)
      setVerificationCode('')
      notifications.show({
        title: 'Verification call resent',
        message: `We’re calling ${status.pendingPhoneNumber ?? phoneNumber} again with a fresh code.`,
        color: 'blue',
      })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to resend the verification challenge.'
      setCallError(message)
      notifications.show({
        title: 'Resend failed',
        message,
        color: 'red',
      })
    } finally {
      setPhoneVerificationActionLoading(false)
    }
  }

  const handleVerifyPhoneCode = async () => {
    if (!verificationCode.trim()) {
      setCallError('Enter the 6-digit verification code from the call.')
      return
    }

    setPhoneVerificationActionLoading(true)
    setCallError(null)
    try {
      const status = (await api.users.verifyPhoneVerification({
        code: verificationCode.trim(),
      })) as PhoneVerificationState
      setPhoneVerification(status)
      setVerificationCode('')
      if (status.phoneNumber) {
        setPhoneNumber(status.phoneNumber)
      }
      notifications.show({
        title: 'Phone verified',
        message: `${status.phoneNumber ?? 'Your phone number'} is now ready for calling sessions.`,
        color: 'green',
      })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to verify that code right now.'
      setCallError(message)
      notifications.show({
        title: 'Verification failed',
        message,
        color: 'red',
      })
    } finally {
      setPhoneVerificationActionLoading(false)
    }
  }

  const handleStartPhoneCall = async () => {
    if (!sessionId) return
    if (!phoneVerification?.verified || !phoneVerification.phoneNumber) {
      setCallError('Verify your phone number before starting the call.')
      return
    }

    setCallLoading(true)
    setCallError(null)
    try {
      await api.phoneCalls.start({
        sessionId,
      })
      notifications.show({
        title: 'Calling now',
        message: `We’re calling ${phoneVerification.phoneNumber}. Answer your phone to begin.`,
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
    if (assistantSpeaking && isListening) {
      stopListening()
    }
  }, [assistantSpeaking, isListening, stopListening])

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

  const handleHangUp = useCallback(async () => {
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
  }, [hangUp, isListening, router, sessionId, stopListening])

  useEffect(() => {
    if (!hangupRequest || sessionStatus === 'ended') return
    clearHangupRequest()
    void handleHangUp()
  }, [hangupRequest, sessionStatus, clearHangupRequest, handleHangUp])

  useEffect(() => {
    if (sessionType === 'phone' && sessionStatus === 'ended') {
      router.push(`/session/${sessionId}/performance`)
    }
  }, [sessionType, sessionStatus, sessionId, router])

  useEffect(() => {
    if (sessionType !== 'phone' || !callStarted || sessionStatus === 'ended') return

    let cancelled = false
    const refreshStatus = async () => {
      try {
        const session = await api.sessions.getById(sessionId)
        if (cancelled) return
        if (isRecord(session)) {
          const nextStatus =
            typeof session.status === 'string' ? session.status : (sessionStatus ?? null)
          setSessionStatus(nextStatus)
          if (nextStatus === 'ended') {
            syncSessionState(session)
          }
        }
      } catch {
        // Keep polling quietly; transient read failures should not interrupt the call UX.
      }
    }

    void refreshStatus()
    const interval = setInterval(() => {
      void refreshStatus()
    }, 3000)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [callStarted, sessionId, sessionStatus, sessionType, syncSessionState])

  const isTextSession = sessionType === 'text'
  const sttCommitProgress = Math.min(1, Math.max(0, sttCommitRemainingMs / speechFinalizeDelayMs))

  const todayStr = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  // AI state label shown in the voice panel
  const aiStateLabel = assistantSpeaking
    ? 'Speaking'
    : isProcessing
      ? 'Thinking...'
      : isListening
        ? 'Listening'
        : ''
  const aiStateColor = assistantSpeaking ? 'green' : isProcessing ? 'blue' : 'dimmed'
  // The session page is always dark-9 — use reliable palette tokens that never depend on the user's theme profile.
  const userBubbleBackground = 'var(--mantine-color-blue-9)'
  const userBubbleTextColor = 'var(--mantine-color-blue-1)'
  const assistantBubbleBackground = 'var(--mantine-color-dark-5)'
  const assistantBubbleTextColor = 'var(--mantine-color-gray-3)'

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
  const latestNextStep = toolEvents.findLast((e) => e.tool === 'propose_next_step')

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
      <Modal
        opened={resumePromptOpen}
        onClose={() => {}}
        title="Resume previous progress?"
        centered
        closeOnClickOutside={false}
        closeOnEscape={false}
        withCloseButton={false}
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            You already have an in-progress session with saved turns.
          </Text>
          <Text size="sm" c="dimmed">
            Choose <strong>Resume</strong> to continue where you left off, or{' '}
            <strong>Start Over</strong> to create a brand new iteration from scratch.
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={handleResumeSession} disabled={startOverLoading}>
              Resume
            </Button>
            <Button color="brand" onClick={handleStartOver} loading={startOverLoading}>
              Start Over
            </Button>
          </Group>
        </Stack>
      </Modal>
      <Modal
        opened={callModalOpen && sessionType === 'phone'}
        onClose={() => setCallModalOpen(false)}
        title={phoneVerification?.verified ? 'Start phone call' : 'Verify your phone number'}
        centered
      >
        <Stack gap="md">
          {phoneVerificationLoading ? (
            <Group justify="center" py="md">
              <Loader size="sm" />
            </Group>
          ) : phoneVerification?.verified ? (
            <>
              <Text size="sm" c="dimmed">
                Your verified number will be used for this phone session.
              </Text>
              <TextInput
                label="Verified phone number"
                value={phoneVerification.phoneNumber ?? phoneNumber}
                readOnly
                disabled
              />
              {callError && (
                <Text size="sm" c="red">
                  {callError}
                </Text>
              )}
              <Group justify="flex-end">
                <Button variant="default" onClick={() => setCallModalOpen(false)}>
                  Not now
                </Button>
                <Button onClick={handleStartPhoneCall} loading={callLoading}>
                  Start call
                </Button>
              </Group>
            </>
          ) : (
            <>
              <Text size="sm" c="dimmed">
                Add the phone number you want us to call, then verify it from the automated code
                call before starting this session.
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
              {phoneVerification?.pendingPhoneNumber && (
                <>
                  <Text size="sm" c="dimmed">
                    We’ve already sent a verification call to {phoneVerification.pendingPhoneNumber}
                    .
                  </Text>
                  <TextInput
                    label="Verification code"
                    placeholder="123456"
                    value={verificationCode}
                    onChange={(event) => {
                      setVerificationCode(event.currentTarget.value)
                      if (callError) {
                        setCallError(null)
                      }
                    }}
                    type="tel"
                    autoComplete="one-time-code"
                  />
                </>
              )}
              {callError && (
                <Text size="sm" c="red">
                  {callError}
                </Text>
              )}
              <Group justify="space-between">
                <Button variant="default" onClick={() => setCallModalOpen(false)}>
                  Not now
                </Button>
                <Group justify="flex-end">
                  {phoneVerification?.pendingPhoneNumber ? (
                    <>
                      <Button
                        variant="default"
                        onClick={handleResendPhoneVerification}
                        loading={phoneVerificationActionLoading}
                      >
                        Resend code
                      </Button>
                      <Button
                        onClick={handleVerifyPhoneCode}
                        loading={phoneVerificationActionLoading}
                      >
                        Verify number
                      </Button>
                    </>
                  ) : (
                    <Button
                      onClick={handleRequestPhoneVerification}
                      loading={phoneVerificationActionLoading}
                    >
                      Send verification call
                    </Button>
                  )}
                </Group>
              </Group>
            </>
          )}
        </Stack>
      </Modal>

      {/* Top Bar */}
      <Box
        style={{
          backgroundColor: 'var(--mantine-color-dark-8)',
          padding: '16px 32px',
          borderBottom: '1px solid var(--mantine-color-dark-6)',
          flexShrink: 0,
        }}
      >
        <Group justify="space-between">
          <Group gap="sm" align="center">
            <Avatar size={44} radius="xl" src={personaImageUrl ?? undefined} />
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
          <Group gap="xl">
            <Text size="xl" fw={700} c="white">
              {formatTime(time)}
            </Text>
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
            <Text c="dimmed">{todayStr}</Text>
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
                  {phoneVerification?.verified ? 'Start call' : 'Verify phone'}
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
              <ActionIcon size="lg" variant="subtle" color="white">
                <Avatar size="sm" src={personaImageUrl ?? undefined} />
              </ActionIcon>
            </Group>
          </Group>
        </Group>
      </Box>

      {/* Main Content */}
      <Box p="xl" style={{ display: 'flex', gap: 24, flex: 1, overflow: 'hidden' }}>
        {hintsEnabled ? (
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
        ) : (
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
        )}

        <Box
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: 24,
            overflow: 'hidden',
          }}
        >
          {isTextSession ? (
            <Paper
              withBorder
              radius="lg"
              p="xl"
              style={{
                backgroundColor: 'var(--pitch-surface-bg)',
                display: 'flex',
                flexDirection: 'column',
                flex: 1,
                overflow: 'hidden',
              }}
            >
              <Group justify="space-between" mb="md">
                <Title order={4}>Conversation</Title>
                <Badge size="sm" variant="light">
                  {messages.length} messages
                </Badge>
              </Group>
              {/* Objection badges — shown when AI raises an objection */}
              {activeObjections.length > 0 && (
                <Stack gap={4} mb="sm">
                  {activeObjections.slice(-3).map((e) => (
                    <Box
                      key={e.id}
                      style={{
                        backgroundColor: 'var(--mantine-color-orange-9)',
                        borderRadius: 8,
                        padding: '6px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <Text size="xs" c="orange.2" fw={600}>
                        ⚠{' '}
                        {String(e.args.type ?? 'objection')
                          .replace('_', ' ')
                          .toUpperCase()}{' '}
                        OBJECTION
                      </Text>
                      <Text size="xs" c="orange.3">
                        — {String(e.args.text ?? '')}
                      </Text>
                    </Box>
                  ))}
                </Stack>
              )}
              <ScrollArea style={{ flex: 1 }} offsetScrollbars scrollbarSize={6}>
                <Stack gap="lg" px="xs" pb="md">
                  {messages.length === 0 ? (
                    <Text c="dimmed" size="sm" ta="center">
                      No messages yet. Start the conversation!
                    </Text>
                  ) : (
                    messages.map((msg) => {
                      const isUser = msg.role === 'user'
                      return (
                        <Box
                          key={msg.id}
                          style={{
                            display: 'flex',
                            justifyContent: isUser ? 'flex-end' : 'flex-start',
                          }}
                        >
                          <Box
                            style={{
                              maxWidth: '72%',
                              backgroundColor: isUser
                                ? userBubbleBackground
                                : assistantBubbleBackground,
                              borderRadius: 18,
                              padding: '12px 14px',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
                            }}
                          >
                            <Text
                              size="sm"
                              style={{
                                whiteSpace: 'pre-wrap',
                                color: isUser ? userBubbleTextColor : assistantBubbleTextColor,
                              }}
                            >
                              {msg.text}
                            </Text>
                            <Text size="xs" c="dimmed" mt={6} ta={isUser ? 'right' : 'left'}>
                              {msg.timestamp.toLocaleTimeString()}
                            </Text>
                          </Box>
                        </Box>
                      )
                    })
                  )}
                </Stack>
              </ScrollArea>
              {/* Propose next step card — shown when AI proposes a concrete next step */}
              {latestNextStep && (
                <Box
                  mt="sm"
                  style={{
                    backgroundColor: 'var(--mantine-color-dark-6)',
                    borderRadius: 10,
                    padding: '8px 14px',
                    borderLeft: '3px solid var(--mantine-color-teal-6)',
                  }}
                >
                  <Text size="xs" c="teal.4" fw={600}>
                    📅 Buyer proposed next step
                  </Text>
                  <Text size="xs" c="gray.3" mt={2}>
                    {String(latestNextStep.args.action ?? '')} —{' '}
                    {String(latestNextStep.args.timeframe ?? '')}
                  </Text>
                </Box>
              )}
              <Paper
                withBorder
                radius="md"
                p="sm"
                mt="md"
                style={{ backgroundColor: 'var(--pitch-surface-bg)' }}
              >
                <Group gap="xs" align="flex-end">
                  <TextInput
                    placeholder="Type your message..."
                    value={textInput}
                    onChange={(e) => {
                      setTextInput(e.target.value)
                      scheduleIdleHints()
                    }}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendText()}
                    style={{ flex: 1 }}
                    disabled={!isConnected || sessionStatus === 'ended'}
                  />
                  <ActionIcon
                    size="lg"
                    variant="filled"
                    color="brand"
                    onClick={handleSendText}
                    disabled={!textInput.trim() || !isConnected || sessionStatus === 'ended'}
                  >
                    <IconSend size={20} />
                  </ActionIcon>
                </Group>
              </Paper>
            </Paper>
          ) : (
            <>
              <Paper
                withBorder
                radius="lg"
                p="xl"
                style={{
                  backgroundColor: 'var(--pitch-surface-bg)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  flex: 1,
                }}
              >
                <Box style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <Avatar size={120} radius="md" src={personaImageUrl ?? undefined} />
                </Box>

                <Box
                  style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    flex: 1,
                  }}
                >
                  {isVideoSession ? (
                    <Box
                      style={{
                        width: 420,
                        height: 420,
                        borderRadius: 24,
                        overflow: 'hidden',
                        backgroundColor: 'black',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Box style={{ position: 'relative', width: '100%', height: '100%' }}>
                        {avatarVideoUrl ? (
                          <video
                            key={`${avatarVideoUrl}:${avatarVideoJobId ?? 'no-job'}`}
                            ref={videoRef}
                            src={avatarVideoUrl}
                            poster={personaImageUrl ?? undefined}
                            autoPlay
                            playsInline
                            muted
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : (
                          <Stack
                            gap="xs"
                            align="center"
                            justify="center"
                            style={{
                              width: '100%',
                              height: '100%',
                              padding: 24,
                              background:
                                'radial-gradient(circle at top, rgba(255,255,255,0.18), transparent 50%), #050505',
                            }}
                          >
                            {personaImageUrl && (
                              <Avatar
                                size={144}
                                radius="xl"
                                src={personaImageUrl}
                                style={{
                                  border: '2px solid rgba(255,255,255,0.12)',
                                  boxShadow: '0 18px 48px rgba(0,0,0,0.35)',
                                }}
                              />
                            )}
                            <Badge
                              color={avatarVideoStatus === 'failed' ? 'red' : 'blue'}
                              variant="light"
                              tt="uppercase"
                            >
                              Avatar
                            </Badge>
                            <Text c="white" fw={600} ta="center">
                              {avatarVideoStatus === 'failed'
                                ? 'Avatar video unavailable'
                                : avatarVideoStatus === 'ready'
                                  ? 'Latest avatar clip ready'
                                  : avatarVideoStatus === 'idle'
                                    ? 'Avatar video will appear after the first reply'
                                    : 'Rendering avatar response'}
                            </Text>
                            <Text c="dimmed" size="sm" ta="center">
                              {avatarVideoStatus === 'failed'
                                ? (avatarVideoError ??
                                  'The assistant will continue with audio only.')
                                : avatarVideoStatus === 'idle'
                                  ? 'The conversation starts with low-latency audio, then each AI reply is rendered as a matching avatar clip.'
                                  : 'Audio plays immediately while the avatar video renders in the background.'}
                            </Text>
                          </Stack>
                        )}
                        <Group
                          gap="xs"
                          style={{
                            position: 'absolute',
                            top: 14,
                            left: 14,
                            zIndex: 2,
                          }}
                        >
                          <Badge
                            color={
                              avatarVideoStatus === 'failed'
                                ? 'red'
                                : avatarVideoStatus === 'ready'
                                  ? 'green'
                                  : 'blue'
                            }
                            variant="filled"
                          >
                            {avatarVideoStatus === 'ready'
                              ? 'Ready'
                              : avatarVideoStatus === 'failed'
                                ? 'Failed'
                                : avatarVideoStatus === 'idle'
                                  ? 'Waiting'
                                  : 'Rendering'}
                          </Badge>
                          {avatarVideoProvider && (
                            <Badge variant="light" color="gray">
                              {avatarVideoProvider}
                            </Badge>
                          )}
                        </Group>
                        <VisualStateOverlay
                          visualState={visualState}
                          isReady={poseIsReady}
                          visible={process.env.NODE_ENV === 'development'}
                        />
                      </Box>
                    </Box>
                  ) : (
                    <Box
                      style={{
                        width: 400,
                        height: 400,
                        borderRadius: '50%',
                        border: '2px solid var(--mantine-color-gray-3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 4,
                        padding: 60,
                      }}
                    >
                      {isListening || isProcessing ? (
                        [...Array(15)].map((_, i) => (
                          <Box
                            key={i}
                            style={{
                              width: 6,
                              height: `${Math.random() * 100 + 20}%`,
                              backgroundColor: 'var(--pitch-accent-strong)',
                              borderRadius: 3,
                              animation: isProcessing ? 'pulse 1s infinite' : 'none',
                            }}
                          />
                        ))
                      ) : (
                        <Text c="dimmed" size="sm" ta="center">
                          {isSttSupported
                            ? isSttPermissionBlocked
                              ? 'Enable microphone permission, then click microphone'
                              : 'Click microphone or type to start conversation'
                            : 'Type to start conversation'}
                        </Text>
                      )}
                    </Box>
                  )}
                </Box>

                {/* AI state indicator */}
                <Text ta="center" c={aiStateColor} fw={500} size="sm" style={{ minHeight: 20 }}>
                  {aiStateLabel}
                </Text>

                {/* Control Buttons */}
                <Group justify="center" gap="xl">
                  <ActionIcon
                    size={80}
                    radius="xl"
                    variant="filled"
                    color="red"
                    style={{
                      border: '4px solid white',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                      cursor: 'pointer',
                    }}
                    onClick={handleHangUp}
                    title="End call and return to sessions"
                  >
                    <IconPhone size={32} />
                  </ActionIcon>
                  <ActionIcon
                    size={80}
                    radius="xl"
                    variant="filled"
                    color={assistantSpeaking ? 'orange' : 'dark'}
                    style={{
                      border: '4px solid white',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                      cursor: assistantSpeaking ? 'pointer' : 'default',
                    }}
                    onClick={() => {
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
                    }}
                    title={
                      assistantSpeaking
                        ? 'Stop audio'
                        : currentAudioUrl
                          ? 'Play latest audio'
                          : isProcessing
                            ? 'Interrupt conversation'
                            : 'Pause (not active)'
                    }
                  >
                    <IconPlayerPause size={32} />
                  </ActionIcon>
                  <ActionIcon
                    size={80}
                    radius="xl"
                    variant="filled"
                    color={isListening ? 'red' : 'dark'}
                    style={{
                      border: '4px solid white',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    }}
                    onClick={handleMicrophoneClick}
                    disabled={!isSttSupported || !isConnected || sessionStatus === 'ended'}
                    title={
                      sessionStatus === 'ended'
                        ? 'Session has ended'
                        : !isSttSupported
                          ? 'Speech recognition not supported'
                          : isSttPermissionBlocked
                            ? 'Microphone permission blocked. Allow access and try again.'
                            : !isConnected
                              ? 'Connecting...'
                              : isListening
                                ? 'Stop listening'
                                : 'Start listening'
                    }
                  >
                    <IconMicrophone size={32} />
                  </ActionIcon>
                </Group>
              </Paper>

              {/* Text Input */}
              <Paper
                withBorder
                radius="lg"
                p="md"
                style={{ backgroundColor: 'var(--pitch-surface-bg)' }}
              >
                <Group gap="xs" align="flex-end">
                  <TextInput
                    placeholder="Type your message..."
                    value={textInput}
                    onChange={(e) => {
                      setTextInput(e.target.value)
                      scheduleIdleHints()
                    }}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendText()}
                    style={{ flex: 1 }}
                    disabled={!isConnected || sessionStatus === 'ended'}
                  />
                  <ActionIcon
                    size="lg"
                    variant="filled"
                    color="brand"
                    onClick={handleSendText}
                    disabled={!textInput.trim() || !isConnected || sessionStatus === 'ended'}
                  >
                    <IconSend size={20} />
                  </ActionIcon>
                </Group>
                {(interimTranscript || transcript) && (
                  <Text size="sm" c="dimmed" mt="xs">
                    Listening: {interimTranscript || transcript}
                  </Text>
                )}
                {sttError && (
                  <Text size="xs" c="red" mt="xs">
                    STT: {sttError}
                  </Text>
                )}
                {sttCommitRemainingMs > 0 && (
                  <Box mt="xs">
                    <Text size="xs" c="dimmed" mb={6}>
                      Sending to AI in {(sttCommitRemainingMs / 1000).toFixed(1)}s
                    </Text>
                    <Box
                      style={{
                        position: 'relative',
                        height: 6,
                        borderRadius: 999,
                        backgroundColor: 'var(--mantine-color-gray-2)',
                        overflow: 'hidden',
                      }}
                    >
                      <Box
                        style={{
                          position: 'absolute',
                          top: 0,
                          bottom: 0,
                          left: 0,
                          width: `${sttCommitProgress * 50}%`,
                          backgroundColor: 'var(--pitch-accent-strong)',
                          transition: 'width 50ms linear',
                        }}
                      />
                      <Box
                        style={{
                          position: 'absolute',
                          top: 0,
                          bottom: 0,
                          right: 0,
                          width: `${sttCommitProgress * 50}%`,
                          backgroundColor: 'var(--pitch-accent-strong)',
                          transition: 'width 50ms linear',
                        }}
                      />
                    </Box>
                  </Box>
                )}
              </Paper>

              {/* Transcript */}
              <Paper
                withBorder
                radius="lg"
                p="lg"
                style={{
                  backgroundColor: 'var(--pitch-surface-bg)',
                  display: 'flex',
                  flexDirection: 'column',
                  flex: 1,
                  minHeight: 260,
                }}
              >
                <Group justify="space-between" mb="md">
                  <Group gap="xs">
                    <Title order={5}>Transcript</Title>
                    <Badge size="sm" variant="light">
                      {messages.length}
                    </Badge>
                  </Group>
                  {sessionStatus === 'ended' && (
                    <Badge size="sm" color="red" variant="light">
                      Ended
                    </Badge>
                  )}
                </Group>
                {/* Objection badges — shown when AI raises an objection */}
                {activeObjections.length > 0 && (
                  <Stack gap={4} mb="sm">
                    {activeObjections.slice(-3).map((e) => (
                      <Box
                        key={e.id}
                        style={{
                          backgroundColor: 'var(--mantine-color-orange-9)',
                          borderRadius: 8,
                          padding: '6px 12px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <Text size="xs" c="orange.2" fw={600}>
                          ⚠{' '}
                          {String(e.args.type ?? 'objection')
                            .replace('_', ' ')
                            .toUpperCase()}{' '}
                          OBJECTION
                        </Text>
                        <Text size="xs" c="orange.3">
                          — {String(e.args.text ?? '')}
                        </Text>
                      </Box>
                    ))}
                  </Stack>
                )}
                <ScrollArea style={{ flex: 1 }} offsetScrollbars scrollbarSize={6}>
                  <Stack gap="sm" pr="sm">
                    {messages.length === 0 ? (
                      <Text c="dimmed" size="sm" ta="center">
                        No messages yet. Start the conversation!
                      </Text>
                    ) : (
                      messages.map((msg) => {
                        const isUser = msg.role === 'user'
                        return (
                          <Box
                            key={msg.id}
                            style={{
                              display: 'flex',
                              justifyContent: isUser ? 'flex-end' : 'flex-start',
                            }}
                          >
                            <Box
                              style={{
                                maxWidth: '78%',
                                backgroundColor: isUser
                                  ? userBubbleBackground
                                  : assistantBubbleBackground,
                                borderRadius: 16,
                                padding: '10px 12px',
                              }}
                            >
                              <Text
                                size="sm"
                                style={{
                                  whiteSpace: 'pre-wrap',
                                  color: isUser ? userBubbleTextColor : assistantBubbleTextColor,
                                }}
                              >
                                {msg.text}
                              </Text>
                              <Text size="xs" c="dimmed" mt={6} ta={isUser ? 'right' : 'left'}>
                                {msg.timestamp.toLocaleTimeString()}
                              </Text>
                            </Box>
                          </Box>
                        )
                      })
                    )}
                  </Stack>
                </ScrollArea>
                {/* Propose next step card — shown when AI proposes a concrete next step */}
                {latestNextStep && (
                  <Box
                    mt="sm"
                    style={{
                      backgroundColor: 'var(--mantine-color-dark-6)',
                      borderRadius: 10,
                      padding: '8px 14px',
                      borderLeft: '3px solid var(--mantine-color-teal-6)',
                    }}
                  >
                    <Text size="xs" c="teal.4" fw={600}>
                      📅 Buyer proposed next step
                    </Text>
                    <Text size="xs" c="gray.3" mt={2}>
                      {String(latestNextStep.args.action ?? '')} —{' '}
                      {String(latestNextStep.args.timeframe ?? '')}
                    </Text>
                  </Box>
                )}
              </Paper>
            </>
          )}
        </Box>

        {timelineEnabled ? (
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
        ) : (
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
        )}
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
