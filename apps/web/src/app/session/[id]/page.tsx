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
  Select,
  ScrollArea,
  Loader,
  Modal,
  Button,
  useMantineColorScheme,
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
import { useSpeechToText } from '@/features/stt'
import { api } from '@/lib/client'
import { notifications } from '@mantine/notifications'
import type { SessionType } from '@/features/sessions'

export default function LiveSessionPage() {
  const { colorScheme } = useMantineColorScheme()
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
  const [hintsEnabled, setHintsEnabled] = useState(false)
  const [timelineEnabled, setTimelineEnabled] = useState(false)
  const [callStarted, setCallStarted] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [phoneNumber, setPhoneNumber] = useState('')
  const [callProvider, setCallProvider] = useState('twilio')
  const [callModalOpen, setCallModalOpen] = useState(false)
  const [callLoading, setCallLoading] = useState(false)
  const [callError, setCallError] = useState<string | null>(null)
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
  const cameraStreamRef = useRef<MediaStream | null>(null)
  // Hidden video fed to MediaPipe — for video sessions it shares the same stream;
  // for all other session types a separate pose-only camera stream is used.
  const poseVideoRef = useRef<HTMLVideoElement | null>(null)
  const poseCameraStreamRef = useRef<MediaStream | null>(null)
  const [visualEnabled, setVisualEnabled] = useState(true)
  const speechFinalizeDelayMs = sessionType === 'voice' || sessionType === 'video' ? 250 : 1500

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
    hangUp,
    interrupt,
    stopAudio,
    replayAudio,
  } = useConversation({
    sessionId,
    autoConnect: true,
    onError: () => {},
  })

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

  // For video sessions, reuse the already-playing visible video directly — no stream sync needed.
  // For all other session types, use the hidden poseVideoRef which gets its own camera stream.
  const poseActiveRef = sessionType === 'video' ? videoRef : poseVideoRef

  const { isReady: poseIsReady, currentState: visualState } = useVisualState({
    sessionId,
    videoRef: poseActiveRef,
    enabled: visualEnabled && isConnected,
    onUserAbsent: () => {},
  })

  useEffect(() => {
    const interval = setInterval(() => {
      setTime((prev) => prev + 1)
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!sessionId) return

    const loadSession = async () => {
      try {
        const session = await api.sessions.getById(sessionId)
        const config = (session?.sessionConfig as Record<string, any>) ?? {}
        setIsMultiTurn(Boolean(config.multiTurnEnabled))
        setSessionType(session?.type ?? null)
        setSessionStatus(session?.status ?? null)
        setSessionName((session as any)?.name ?? (session as any)?.scenario?.name ?? '')
        setPersonaName((session as any)?.persona?.name ?? null)
        const resolvedPhoneNumber =
          typeof config.phoneNumber === 'string'
            ? config.phoneNumber
            : typeof config.phone?.number === 'string'
              ? config.phone.number
              : ''
        setPhoneNumber(resolvedPhoneNumber)
        const resolvedProvider =
          typeof config.phoneProvider === 'string'
            ? config.phoneProvider
            : typeof config.phone?.provider === 'string'
              ? config.phone.provider
              : 'twilio'
        setCallProvider(
          resolvedProvider === 'vapi' || resolvedProvider === 'twilio' ? resolvedProvider : 'twilio'
        )
        setCallModalOpen(session?.type === 'phone' && session?.status !== 'ended')
      } catch {
        setIsMultiTurn(false)
      }
    }

    void loadSession()
  }, [sessionId])

  useEffect(() => {
    if (sessionType !== 'video') {
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((track) => track.stop())
        cameraStreamRef.current = null
      }
      setCameraError(null)
      return
    }

    let cancelled = false
    const requestCamera = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError('Camera access is not supported in this browser.')
        return
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        cameraStreamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }
        setCameraError(null)
      } catch {
        if (!cancelled) {
          setCameraError('Camera access denied. Please allow access to continue.')
        }
      }
    }

    void requestCamera()

    return () => {
      cancelled = true
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((track) => track.stop())
        cameraStreamRef.current = null
      }
    }
  }, [sessionType])

  // Pose-only camera for non-video session types.
  // For video sessions, useVisualState reads the visible videoRef directly (no hidden stream needed).
  // sessionType === null means it hasn't loaded yet — wait before requesting camera.
  useEffect(() => {
    if (sessionType === 'video' || sessionType === null) return

    if (!visualEnabled || !isConnected) {
      poseCameraStreamRef.current?.getTracks().forEach((t) => t.stop())
      poseCameraStreamRef.current = null
      if (poseVideoRef.current) poseVideoRef.current.srcObject = null
      return
    }

    let cancelled = false
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
        if (poseVideoRef.current) {
          poseVideoRef.current.srcObject = stream
          poseVideoRef.current.play().catch(() => {})
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
      if (poseVideoRef.current) poseVideoRef.current.srcObject = null
    }
  }, [visualEnabled, isConnected, sessionType])

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

    if (isAudioPlaying || isProcessing) {
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
    if (isAudioPlaying && isListening) {
      stopListening()
    }
  }, [isAudioPlaying, isListening, stopListening])

  useEffect(() => {
    const isVoiceOrVideo = sessionType === 'voice' || sessionType === 'video'
    const canAutoResumeMic = hasUserEnabledMicRef.current || microphonePermission === 'granted'
    if (
      previousAudioPlayingRef.current &&
      !isAudioPlaying &&
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
    previousAudioPlayingRef.current = isAudioPlaying
  }, [
    isAudioPlaying,
    sessionType,
    microphonePermission,
    isSttSupported,
    isSttPermissionBlocked,
    isConnected,
    sessionStatus,
    isListening,
    startListening,
  ])

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

  const isTextSession = sessionType === 'text'
  const isVideoSession = sessionType === 'video'
  const sttCommitProgress = Math.min(1, Math.max(0, sttCommitRemainingMs / speechFinalizeDelayMs))

  const todayStr = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  // AI state label shown in the voice panel
  const aiStateLabel = isAudioPlaying
    ? 'Speaking'
    : isProcessing
      ? 'Thinking...'
      : isListening
        ? 'Listening'
        : ''
  const aiStateColor = isAudioPlaying ? 'green' : isProcessing ? 'blue' : 'dimmed'
  const assistantBubbleBackground =
    colorScheme === 'dark' ? 'var(--mantine-color-dark-6)' : 'var(--mantine-color-gray-1)'
  const assistantBubbleTextColor =
    colorScheme === 'dark' ? 'var(--mantine-color-gray-0)' : 'var(--mantine-color-dark-9)'

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
        opened={callModalOpen && sessionType === 'phone'}
        onClose={() => setCallModalOpen(false)}
        title="Start phone call"
        centered
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            We’ll call this number to start your phone session.
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
          <Stack gap={2}>
            <Text fw={600} size="lg" c="white">
              {sessionName || 'Live Session'}
            </Text>
            {personaName && (
              <Text size="xs" c="dimmed">
                with {personaName}
              </Text>
            )}
          </Stack>
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
              <CameraEngagementIndicator
                isActive={visualEnabled}
                isReady={poseIsReady}
                onToggle={() => setVisualEnabled((v) => !v)}
              />
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
              <ActionIcon size="lg" variant="subtle" color="white">
                <Avatar size="sm" />
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
                                ? 'var(--pitch-accent-soft)'
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
                                color: isUser
                                  ? 'var(--pitch-surface-text)'
                                  : assistantBubbleTextColor,
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
                  <Avatar size={120} radius="md" />
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
                      {cameraError ? (
                        <Text c="red" size="sm" ta="center" px="lg">
                          {cameraError}
                        </Text>
                      ) : (
                        <Box style={{ position: 'relative', width: '100%', height: '100%' }}>
                          <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                          <VisualStateOverlay
                            visualState={visualState}
                            isReady={poseIsReady}
                            visible={process.env.NODE_ENV === 'development'}
                          />
                        </Box>
                      )}
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
                    color={isAudioPlaying ? 'orange' : 'dark'}
                    style={{
                      border: '4px solid white',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                      cursor: isAudioPlaying ? 'pointer' : 'default',
                    }}
                    onClick={() => {
                      if (isAudioPlaying) {
                        stopAudio()
                      } else if (currentAudioUrl) {
                        replayAudio()
                      } else if (isProcessing) {
                        interrupt()
                      }
                    }}
                    title={
                      isAudioPlaying
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
                                  ? 'var(--pitch-accent-soft)'
                                  : assistantBubbleBackground,
                                borderRadius: 16,
                                padding: '10px 12px',
                              }}
                            >
                              <Text
                                size="sm"
                                style={{
                                  whiteSpace: 'pre-wrap',
                                  color: isUser
                                    ? 'var(--pitch-surface-text)'
                                    : assistantBubbleTextColor,
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

      {/* Hidden MediaPipe pose video — used for non-video sessions only.
          Video sessions read the visible videoRef directly (no stream sync required).
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
    </Box>
  )
}
