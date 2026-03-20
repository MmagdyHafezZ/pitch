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
  ScrollArea,
  Loader,
  Modal,
  Button,
  Checkbox,
} from '@mantine/core'
import {
  IconAlertTriangle,
  IconArrowRight,
  IconCircleCheck,
  IconClock,
  IconDeviceMobile,
  IconEdit,
  IconMessage2,
  IconPhone,
  IconSparkles,
} from '@tabler/icons-react'
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

interface PhoneVerificationState {
  verified: boolean
  phoneNumber?: string | null
  verifiedAt?: string | null
  temporaryVerifiedPhoneNumber?: string | null
  temporaryVerifiedAt?: string | null
  pendingPhoneNumber?: string | null
  pendingExpiresAt?: string | null
  resendAvailableAt?: string | null
  remainingAttempts?: number
  remainingSends?: number
}

type EntryPromptMode = 'resume' | 'retake'

interface PhoneCallRuntimeState {
  callId: string | null
  provider: string | null
  controlUrl: string | null
  listenUrl: string | null
  status: string | null
  startedAt: string | null
  endedAt: string | null
  endedReason: string | null
  endRequestedAt: string | null
  endRequestedReason: string | null
}

interface TranscriptMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  timestamp: Date
}

const EMPTY_PHONE_CALL_RUNTIME: PhoneCallRuntimeState = {
  callId: null,
  provider: null,
  controlUrl: null,
  listenUrl: null,
  status: null,
  startedAt: null,
  endedAt: null,
  endedReason: null,
  endRequestedAt: null,
  endRequestedReason: null,
}

const PHONE_TERMINAL_STATUSES = new Set(['ended', 'failed', 'busy', 'no-answer', 'canceled'])

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const normalizeSessionStatus = (session: unknown): string | null => {
  if (!isRecord(session) || typeof session.status !== 'string') {
    return null
  }

  return session.status.trim().toLowerCase()
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

const normalizePhoneRuntimeStatus = (status: string | null | undefined) =>
  typeof status === 'string' && status.trim().length > 0 ? status.trim().toLowerCase() : null

const isPhoneCallActive = (runtime: PhoneCallRuntimeState) =>
  Boolean(
    runtime.callId &&
      !PHONE_TERMINAL_STATUSES.has(normalizePhoneRuntimeStatus(runtime.status) ?? '')
  )

const readPhoneCallRuntime = (session: unknown): PhoneCallRuntimeState => {
  if (!isRecord(session)) {
    return EMPTY_PHONE_CALL_RUNTIME
  }

  const sessionConfig = isRecord(session.sessionConfig) ? session.sessionConfig : {}
  const phoneConfig = isRecord(sessionConfig.phone) ? sessionConfig.phone : {}
  const runtime = isRecord(phoneConfig.runtime) ? phoneConfig.runtime : {}

  return {
    callId: typeof runtime.callId === 'string' ? runtime.callId : null,
    provider: typeof runtime.provider === 'string' ? runtime.provider : null,
    controlUrl: typeof runtime.controlUrl === 'string' ? runtime.controlUrl : null,
    listenUrl: typeof runtime.listenUrl === 'string' ? runtime.listenUrl : null,
    status: typeof runtime.status === 'string' ? runtime.status : null,
    startedAt: typeof runtime.startedAt === 'string' ? runtime.startedAt : null,
    endedAt: typeof runtime.endedAt === 'string' ? runtime.endedAt : null,
    endedReason: typeof runtime.endedReason === 'string' ? runtime.endedReason : null,
    endRequestedAt: typeof runtime.endRequestedAt === 'string' ? runtime.endRequestedAt : null,
    endRequestedReason:
      typeof runtime.endRequestedReason === 'string' ? runtime.endRequestedReason : null,
  }
}

const readTimelineConversationHistory = (timeline: unknown): TranscriptMessage[] => {
  if (!isRecord(timeline) || !Array.isArray(timeline.conversationHistory)) {
    return []
  }

  return timeline.conversationHistory
    .map((turn, index) => {
      if (!isRecord(turn)) {
        return null
      }

      const text = typeof turn.text === 'string' ? turn.text : ''
      const rawRole = typeof turn.role === 'string' ? turn.role.trim().toLowerCase() : ''
      const role: 'user' | 'assistant' = rawRole === 'user' ? 'user' : 'assistant'
      const id =
        typeof turn.id === 'string'
          ? turn.id
          : typeof turn.order === 'number'
            ? `turn_${turn.order}`
            : `turn_${index}`
      const timestampValue =
        typeof turn.createdAt === 'string' ? new Date(turn.createdAt) : new Date()

      return {
        id,
        role,
        text,
        timestamp: Number.isNaN(timestampValue.getTime()) ? new Date() : timestampValue,
      }
    })
    .filter((turn): turn is TranscriptMessage => Boolean(turn))
}

const buildTimelineState = (timeline: unknown) => {
  if (!isRecord(timeline) || !Array.isArray(timeline.plannedStages)) {
    return {
      progress: 0,
      stages: [] as Array<{
        order: number
        label: string
        description?: string
        active: boolean
        completed: boolean
      }>,
    }
  }

  const plannedStages = timeline.plannedStages
  const progress = typeof timeline.currentProgress === 'number' ? timeline.currentProgress : 0
  const totalTurns = typeof timeline.total === 'number' ? timeline.total : 0

  if (plannedStages.length === 0) {
    return { progress: 0, stages: [] }
  }

  const currentStageIndex = Math.min(
    plannedStages.length - 1,
    Math.floor((progress / 100) * plannedStages.length)
  )

  const stages = plannedStages.map((stage, index) => {
    const entry = isRecord(stage) ? stage : {}
    return {
      order: typeof entry.order === 'number' ? entry.order : index + 1,
      label:
        typeof entry.label === 'string'
          ? entry.label
          : typeof stage === 'string'
            ? stage
            : `Stage ${index + 1}`,
      description: typeof entry.description === 'string' ? entry.description : undefined,
      active: index === currentStageIndex && totalTurns > 0,
      completed: index < currentStageIndex,
    }
  })

  return { progress, stages }
}

const getPhoneStatusLabel = (
  runtime: PhoneCallRuntimeState,
  sessionStatus: string | null,
  callStarted: boolean
) => {
  if (sessionStatus === 'ended') return 'Ended'

  switch (normalizePhoneRuntimeStatus(runtime.status)) {
    case 'queued':
      return 'Queued'
    case 'ringing':
      return 'Ringing'
    case 'in-progress':
      return 'Live'
    case 'answered':
      return 'Connected'
    case 'busy':
      return 'Busy'
    case 'no-answer':
      return 'No answer'
    case 'failed':
      return 'Failed'
    case 'canceled':
      return 'Canceled'
    case 'ended':
      return 'Ended'
    default:
      return callStarted ? 'Dialing' : 'Ready'
  }
}

const getPhoneStatusColor = (
  runtime: PhoneCallRuntimeState,
  sessionStatus: string | null,
  callStarted: boolean
) => {
  if (sessionStatus === 'ended') return 'gray'

  switch (normalizePhoneRuntimeStatus(runtime.status)) {
    case 'queued':
    case 'ringing':
      return 'blue'
    case 'in-progress':
    case 'answered':
      return 'green'
    case 'busy':
    case 'no-answer':
      return 'orange'
    case 'failed':
    case 'canceled':
      return 'red'
    case 'ended':
      return 'gray'
    default:
      return callStarted ? 'blue' : 'gray'
  }
}

const getPhoneStatusCopy = (
  runtime: PhoneCallRuntimeState,
  sessionStatus: string | null,
  callStarted: boolean
) => {
  if (sessionStatus === 'ended') {
    return runtime.endedReason
      ? `This phone session has ended: ${runtime.endedReason}.`
      : 'This phone session has ended.'
  }

  switch (normalizePhoneRuntimeStatus(runtime.status)) {
    case 'queued':
      return 'The call is queued with the provider and should start dialing shortly.'
    case 'ringing':
      return 'We are dialing now. Answer your phone to begin the conversation.'
    case 'in-progress':
    case 'answered':
      return 'The live transcript will update automatically as each turn lands.'
    case 'busy':
      return 'The line was busy. You can retry the call when you are ready.'
    case 'no-answer':
      return 'The call was not answered. Start another attempt whenever you want.'
    case 'failed':
      return 'The call failed before it could connect. Double-check the number and try again.'
    case 'canceled':
      return 'The call was canceled before it connected.'
    case 'ended':
      return 'The phone call has wrapped up.'
    default:
      return callStarted
        ? 'The call has been requested. We will show the transcript here as soon as turns arrive.'
        : 'Verify a number, place the call, and use the center panel to follow the transcript in real time.'
  }
}

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

const formatCountdownClock = (totalSeconds: number) => {
  const safeSeconds = Math.max(0, totalSeconds)
  const minutes = Math.floor(safeSeconds / 60)
  const seconds = safeSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

const formatMessageTime = (value: Date) =>
  value.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  })

function HintsSidebar({
  hintsEnabled,
  hints,
  hintsError,
  width = 220,
  onShow,
  onHide,
}: {
  hintsEnabled: boolean
  hints: string[]
  hintsError: string | null
  width?: number | string
  onShow: () => void
  onHide: () => void
}) {
  if (hintsEnabled) {
    return (
      <Paper
        withBorder
        radius="lg"
        p="lg"
        style={{
          width,
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
          <Button size="xs" variant="subtle" color="gray" onClick={onHide}>
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
    )
  }

  return (
    <Box
      style={{
        width,
        display: 'flex',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <Button variant="light" color="brand" onClick={onShow}>
        Show hints
      </Button>
    </Box>
  )
}

function TimelineSidebar({
  timelineEnabled,
  timelineStages,
  currentProgress,
  timelineError,
  width = 200,
  onShow,
  onHide,
}: {
  timelineEnabled: boolean
  timelineStages: Array<{
    order: number
    label: string
    description?: string
    active: boolean
    completed: boolean
  }>
  currentProgress: number
  timelineError: string | null
  width?: number | string
  onShow: () => void
  onHide: () => void
}) {
  if (timelineEnabled) {
    return (
      <Paper
        withBorder
        radius="lg"
        p="lg"
        style={{
          width,
          backgroundColor: 'var(--pitch-surface-bg)',
          height: 'fit-content',
          flexShrink: 0,
        }}
      >
        <Group justify="space-between" mb="xl">
          <Title order={4}>Timeline</Title>
          <Button size="xs" variant="subtle" color="gray" onClick={onHide}>
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
    )
  }

  return (
    <Box
      style={{
        width,
        display: 'flex',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <Button variant="light" color="brand" onClick={onShow}>
        Show timeline
      </Button>
    </Box>
  )
}

function PhoneResumePromptCard({
  entryPromptMode,
  startOverLoading,
  onResume,
  onStartOver,
}: {
  entryPromptMode: EntryPromptMode
  startOverLoading: boolean
  onResume: () => void
  onStartOver: () => void
}) {
  const isRetakePrompt = entryPromptMode === 'retake'

  return (
    <Paper
      withBorder
      radius="xl"
      p="lg"
      style={{
        background:
          'linear-gradient(180deg, color-mix(in srgb, var(--pitch-surface-bg) 92%, white 8%) 0%, var(--pitch-surface-bg) 100%)',
        borderColor: 'color-mix(in srgb, var(--mantine-color-brand-6) 28%, transparent)',
      }}
    >
      <Stack gap="sm">
        <Group gap="xs">
          <IconSparkles size={18} color="var(--mantine-color-brand-5)" />
          <Text size="xs" fw={700} tt="uppercase" c="dimmed">
            Session checkpoint
          </Text>
        </Group>
        <Title order={4}>
          {isRetakePrompt ? 'Retake this phone session?' : 'Resume previous phone progress?'}
        </Title>
        <Text size="sm" c="dimmed">
          {isRetakePrompt
            ? 'This session already ended. Start a fresh call-ready run with the same setup whenever you want.'
            : 'You have saved turns from an earlier attempt. Continue that session or start again from a clean slate.'}
        </Text>
        <Group justify="flex-end" mt="xs">
          {!isRetakePrompt && (
            <Button variant="default" onClick={onStartOver} loading={startOverLoading}>
              Start over
            </Button>
          )}
          <Button onClick={isRetakePrompt ? onStartOver : onResume} loading={startOverLoading}>
            {isRetakePrompt ? 'Retake session' : 'Resume'}
          </Button>
        </Group>
      </Stack>
    </Paper>
  )
}

function PhoneCallSetupCard({
  personaName,
  sessionStatus,
  phoneStatusLabel,
  phoneStatusColor,
  phoneStatusCopy,
  phoneVerificationLoading,
  phoneVerificationActionLoading,
  phoneVerification,
  phoneNumber,
  onPhoneNumberChange,
  callError,
  editingVerifiedPhone,
  activeVerifiedPhoneNumber,
  isTransientVerifiedPhone,
  verificationCode,
  onVerificationCodeChange,
  savePhoneForFutureUse,
  onSavePhoneForFutureUseChange,
  onRequestPhoneVerification,
  onResendPhoneVerification,
  onVerifyPhoneCode,
  onEditVerifiedPhone,
  onStartPhoneCall,
  callLoading,
  callStarted,
  phoneCallRuntime,
}: {
  personaName: string | null
  sessionStatus: string | null
  phoneStatusLabel: string
  phoneStatusColor: string
  phoneStatusCopy: string
  phoneVerificationLoading: boolean
  phoneVerificationActionLoading: boolean
  phoneVerification: PhoneVerificationState | null
  phoneNumber: string
  onPhoneNumberChange: (value: string) => void
  callError: string | null
  editingVerifiedPhone: boolean
  activeVerifiedPhoneNumber: string | null
  isTransientVerifiedPhone: boolean
  verificationCode: string
  onVerificationCodeChange: (value: string) => void
  savePhoneForFutureUse: boolean
  onSavePhoneForFutureUseChange: (value: boolean) => void
  onRequestPhoneVerification: () => void
  onResendPhoneVerification: () => void
  onVerifyPhoneCode: () => void
  onEditVerifiedPhone: () => void
  onStartPhoneCall: () => void
  callLoading: boolean
  callStarted: boolean
  phoneCallRuntime: PhoneCallRuntimeState
}) {
  const pendingPhoneNumber = phoneVerification?.pendingPhoneNumber ?? null
  const showVerificationStep = Boolean(pendingPhoneNumber) && editingVerifiedPhone
  const pendingExpiryMs = phoneVerification?.pendingExpiresAt
    ? new Date(phoneVerification.pendingExpiresAt).getTime() - Date.now()
    : null
  const resendAvailableMs = phoneVerification?.resendAvailableAt
    ? new Date(phoneVerification.resendAvailableAt).getTime() - Date.now()
    : null
  const verificationExpiresIn =
    pendingExpiryMs != null && pendingExpiryMs > 0
      ? formatCountdownClock(Math.ceil(pendingExpiryMs / 1000))
      : null
  const resendCooldownIn =
    resendAvailableMs != null && resendAvailableMs > 0
      ? formatCountdownClock(Math.ceil(resendAvailableMs / 1000))
      : null
  const hasVerifiedPhone = Boolean(activeVerifiedPhoneNumber)
  const canResendCode = Boolean(showVerificationStep && !resendCooldownIn)
  const canStartCall =
    hasVerifiedPhone && sessionStatus !== 'ended' && !callStarted && !editingVerifiedPhone

  return (
    <Paper
      withBorder
      radius="28px"
      p={0}
      style={{
        position: 'relative',
        overflow: 'hidden',
        background:
          'linear-gradient(160deg, color-mix(in srgb, var(--pitch-surface-bg) 84%, var(--pitch-app-bg) 16%) 0%, color-mix(in srgb, var(--pitch-surface-bg) 76%, var(--pitch-accent-soft) 24%) 100%)',
        borderColor: 'color-mix(in srgb, var(--pitch-accent-strong) 26%, transparent)',
        boxShadow: '0 26px 70px color-mix(in srgb, var(--mantine-color-dark-9) 58%, transparent)',
        color: 'var(--pitch-surface-text)',
      }}
    >
      <Box
        style={{
          position: 'absolute',
          top: -90,
          right: -30,
          width: 220,
          height: 220,
          borderRadius: '50%',
          background:
            'radial-gradient(circle, color-mix(in srgb, var(--pitch-accent-strong) 28%, transparent) 0%, transparent 72%)',
          pointerEvents: 'none',
        }}
      />
      <Box
        style={{
          position: 'absolute',
          bottom: -120,
          left: -40,
          width: 260,
          height: 260,
          borderRadius: '50%',
          background:
            'radial-gradient(circle, color-mix(in srgb, var(--pitch-selected) 20%, transparent) 0%, transparent 74%)',
          pointerEvents: 'none',
        }}
      />
      <Stack gap={0} style={{ position: 'relative' }}>
        <Box
          px="lg"
          py="lg"
          style={{
            borderBottom:
              '1px solid color-mix(in srgb, var(--pitch-surface-text-dim) 18%, transparent)',
            background:
              'linear-gradient(135deg, color-mix(in srgb, var(--pitch-app-bg) 72%, var(--pitch-info) 28%) 0%, color-mix(in srgb, var(--pitch-app-bg) 72%, var(--pitch-selected) 28%) 100%)',
          }}
        >
          <Stack gap="md">
            <Group justify="space-between" align="flex-start">
              <Stack gap={6}>
                <Group gap="xs">
                  <Badge
                    radius="xl"
                    variant="filled"
                    styles={{
                      root: {
                        background:
                          'linear-gradient(90deg, var(--pitch-accent) 0%, var(--pitch-accent-strong) 100%)',
                        color: 'var(--pitch-nav-text, white)',
                        letterSpacing: '0.08em',
                      },
                    }}
                  >
                    Phone call
                  </Badge>
                  <Badge color={phoneStatusColor} variant="light" radius="xl">
                    {phoneStatusLabel}
                  </Badge>
                </Group>
                <Stack gap={2}>
                  <Title order={2} c="var(--pitch-surface-text)" style={{ lineHeight: 1 }}>
                    Call setup
                  </Title>
                  <Text size="sm" c="var(--pitch-surface-text-dim)" maw={420}>
                    {personaName
                      ? `You’re about to get connected with ${personaName}. Verify the number, start the dial, and let the transcript take center stage.`
                      : 'Verify the number, launch the call, and let the transcript take center stage.'}
                  </Text>
                </Stack>
              </Stack>
              <Box
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 18,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background:
                    'linear-gradient(135deg, color-mix(in srgb, var(--pitch-info) 26%, transparent) 0%, color-mix(in srgb, var(--pitch-selected) 24%, transparent) 100%)',
                  border:
                    '1px solid color-mix(in srgb, var(--pitch-surface-text-dim) 18%, transparent)',
                  boxShadow:
                    'inset 0 1px 0 color-mix(in srgb, var(--pitch-surface-text) 8%, transparent)',
                }}
              >
                <IconSparkles size={22} color="var(--pitch-surface-text)" />
              </Box>
            </Group>

            <Paper
              withBorder
              radius="xl"
              p="md"
              style={{
                background:
                  'linear-gradient(135deg, color-mix(in srgb, var(--pitch-info) 14%, transparent) 0%, color-mix(in srgb, var(--pitch-accent) 8%, transparent) 100%)',
                borderColor: 'color-mix(in srgb, var(--pitch-border) 78%, transparent)',
                boxShadow:
                  'inset 0 1px 0 color-mix(in srgb, var(--pitch-surface-text) 5%, transparent)',
              }}
            >
              <Group align="flex-start" gap="sm" wrap="nowrap">
                <Box
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 14,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background:
                      'linear-gradient(135deg, color-mix(in srgb, var(--pitch-info) 26%, transparent) 0%, color-mix(in srgb, var(--pitch-success) 16%, transparent) 100%)',
                    flexShrink: 0,
                  }}
                >
                  <IconDeviceMobile size={18} color="var(--pitch-surface-text)" />
                </Box>
                <Stack gap={4}>
                  <Text size="xs" fw={700} tt="uppercase" c="var(--pitch-surface-text-dim)">
                    Live call status
                  </Text>
                  <Text size="sm" c="var(--pitch-surface-text)">
                    {phoneStatusCopy}
                  </Text>
                  {phoneCallRuntime.startedAt && (
                    <Group gap={6} align="center">
                      <IconClock size={13} color="var(--pitch-surface-text-dim)" />
                      <Text size="xs" c="var(--pitch-surface-text-dim)">
                        Started {formatDateTime(phoneCallRuntime.startedAt)}
                      </Text>
                    </Group>
                  )}
                </Stack>
              </Group>
            </Paper>
          </Stack>
        </Box>

        <Stack gap="md" p="lg">
          {phoneVerificationLoading ? (
            <Group gap="sm">
              <Loader size="sm" />
              <Text size="sm" c="dimmed">
                Loading your saved phone verification…
              </Text>
            </Group>
          ) : (
            <Stack gap="md">
              {activeVerifiedPhoneNumber && !editingVerifiedPhone ? (
                <Paper
                  withBorder
                  radius="xl"
                  p="md"
                  style={{
                    background:
                      'linear-gradient(135deg, color-mix(in srgb, var(--pitch-success) 14%, transparent) 0%, color-mix(in srgb, var(--pitch-info) 10%, transparent) 100%)',
                    borderColor: 'color-mix(in srgb, var(--pitch-success) 28%, transparent)',
                  }}
                >
                  <Stack gap="xs">
                    <Group justify="space-between" align="flex-start">
                      <Stack gap={4}>
                        <Group gap={6} align="center">
                          <IconCircleCheck size={16} color="var(--mantine-color-green-5)" />
                          <Text size="xs" fw={700} tt="uppercase" c="green">
                            Verified number
                          </Text>
                        </Group>
                        <Text fw={700} size="lg" c="var(--pitch-surface-text)">
                          {activeVerifiedPhoneNumber}
                        </Text>
                      </Stack>
                      <Button
                        size="compact-sm"
                        variant="subtle"
                        color="gray"
                        leftSection={<IconEdit size={14} />}
                        onClick={onEditVerifiedPhone}
                      >
                        Edit
                      </Button>
                    </Group>
                    {isTransientVerifiedPhone ? (
                      <Badge color="yellow" variant="light" radius="xl">
                        Verified for this call only
                      </Badge>
                    ) : (
                      <Text size="xs" c="dimmed">
                        Saved to your account for future phone sessions.
                      </Text>
                    )}
                  </Stack>
                </Paper>
              ) : !showVerificationStep ? (
                <Stack gap="xs">
                  <TextInput
                    label="Phone number"
                    placeholder="+15551234567"
                    value={phoneNumber}
                    onChange={(event) => onPhoneNumberChange(event.currentTarget.value)}
                    type="tel"
                    autoComplete="tel"
                    description="Enter the full phone number, including the country code, like +1 555 123 4567."
                    styles={{
                      input: {
                        background: 'var(--pitch-input-bg)',
                        borderColor: 'var(--pitch-border)',
                        color: 'var(--pitch-input-text)',
                        minHeight: 50,
                      },
                      label: { color: 'var(--pitch-surface-text)', marginBottom: 6 },
                      description: { color: 'var(--pitch-surface-text-dim)' },
                    }}
                  />
                  <Button
                    onClick={onRequestPhoneVerification}
                    loading={phoneVerificationActionLoading}
                    disabled={sessionStatus === 'ended'}
                    radius="xl"
                    size="md"
                    styles={{
                      root: {
                        background:
                          'linear-gradient(90deg, var(--pitch-accent) 0%, var(--pitch-accent-strong) 100%)',
                        boxShadow:
                          '0 16px 28px color-mix(in srgb, var(--pitch-accent-strong) 34%, transparent)',
                      },
                    }}
                  >
                    Text verification code
                  </Button>
                </Stack>
              ) : null}

              {showVerificationStep && (
                <Paper
                  withBorder
                  radius="xl"
                  p="md"
                  style={{
                    background:
                      'linear-gradient(135deg, color-mix(in srgb, var(--pitch-info) 10%, transparent) 0%, color-mix(in srgb, var(--pitch-selected) 8%, transparent) 100%)',
                    borderColor: 'color-mix(in srgb, var(--pitch-info) 24%, transparent)',
                  }}
                >
                  <Stack gap="sm">
                    <Text size="sm" fw={600} c="var(--pitch-surface-text)">
                      Enter the code we sent to {pendingPhoneNumber}
                    </Text>
                    <Group justify="space-between" align="center" gap="sm">
                      <Group gap={6} align="center">
                        <IconClock size={13} color="var(--pitch-surface-text-dim)" />
                        <Text
                          size="xs"
                          c={verificationExpiresIn ? 'var(--pitch-surface-text-dim)' : 'orange'}
                        >
                          {verificationExpiresIn
                            ? `Code expires in ${verificationExpiresIn}`
                            : 'Code expired. Request a new one.'}
                        </Text>
                      </Group>
                      <Button
                        size="compact-sm"
                        variant="subtle"
                        color="gray"
                        onClick={onResendPhoneVerification}
                        disabled={!canResendCode}
                        loading={phoneVerificationActionLoading && canResendCode}
                      >
                        {resendCooldownIn ? `Resend in ${resendCooldownIn}` : 'Resend code'}
                      </Button>
                    </Group>
                    <TextInput
                      label="Verification code"
                      placeholder="123456"
                      value={verificationCode}
                      onChange={(event) => onVerificationCodeChange(event.currentTarget.value)}
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      styles={{
                        input: {
                          background: 'var(--pitch-input-bg)',
                          borderColor: 'var(--pitch-border)',
                          color: 'var(--pitch-input-text)',
                          minHeight: 50,
                        },
                        label: { color: 'var(--pitch-surface-text)', marginBottom: 6 },
                      }}
                    />
                    <Checkbox
                      checked={savePhoneForFutureUse}
                      onChange={(event) =>
                        onSavePhoneForFutureUseChange(event.currentTarget.checked)
                      }
                      label="Save this number for future phone sessions"
                    />
                    <Group grow>
                      <Button onClick={onVerifyPhoneCode} loading={phoneVerificationActionLoading}>
                        Verify number
                      </Button>
                    </Group>
                    {(phoneVerification?.remainingAttempts != null ||
                      phoneVerification?.remainingSends != null) && (
                      <Text size="xs" c="dimmed">
                        {phoneVerification?.remainingAttempts != null
                          ? `${phoneVerification.remainingAttempts} code attempts left`
                          : ''}
                        {phoneVerification?.remainingAttempts != null &&
                        phoneVerification?.remainingSends != null
                          ? ' • '
                          : ''}
                        {phoneVerification?.remainingSends != null
                          ? `${phoneVerification.remainingSends} resends left`
                          : ''}
                      </Text>
                    )}
                  </Stack>
                </Paper>
              )}
            </Stack>
          )}

          {callError && (
            <Group gap="xs" align="flex-start" wrap="nowrap">
              <IconAlertTriangle
                size={16}
                color="var(--mantine-color-red-5)"
                style={{ marginTop: 2, flexShrink: 0 }}
              />
              <Text size="sm" c="red">
                {callError}
              </Text>
            </Group>
          )}

          <Group grow>
            <Button
              size="md"
              radius="xl"
              onClick={onStartPhoneCall}
              loading={callLoading}
              disabled={!canStartCall}
              leftSection={<IconPhone size={16} />}
              styles={{
                root: {
                  background: canStartCall
                    ? 'linear-gradient(90deg, var(--pitch-accent) 0%, var(--pitch-accent-strong) 100%)'
                    : 'var(--pitch-input-bg)',
                  color: canStartCall
                    ? 'var(--pitch-nav-text, white)'
                    : 'var(--pitch-surface-text-dim)',
                  border: canStartCall ? 'none' : '1px solid var(--pitch-border)',
                  boxShadow: canStartCall
                    ? '0 16px 32px color-mix(in srgb, var(--pitch-accent-strong) 36%, transparent)'
                    : 'none',
                },
              }}
            >
              {callStarted ? 'Call already in progress' : 'Start phone call'}
            </Button>
          </Group>
          {!canStartCall && (
            <Text size="xs" ta="center" c="var(--pitch-surface-text-dim)">
              Verify the code first to unlock dialing.
            </Text>
          )}
        </Stack>
      </Stack>
    </Paper>
  )
}

function PhoneTranscriptPanel({
  messages,
  error,
  phoneStatusLabel,
  phoneStatusColor,
  phoneStatusCopy,
  callStarted,
}: {
  messages: TranscriptMessage[]
  error: string | null
  phoneStatusLabel: string
  phoneStatusColor: string
  phoneStatusCopy: string
  callStarted: boolean
}) {
  const viewportRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!viewportRef.current) return
    viewportRef.current.scrollTo({
      top: viewportRef.current.scrollHeight,
      behavior: 'smooth',
    })
  }, [messages.length])

  return (
    <Paper
      withBorder
      radius="xl"
      p="lg"
      style={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background:
          'linear-gradient(180deg, color-mix(in srgb, var(--pitch-surface-bg) 93%, white 7%) 0%, var(--pitch-surface-bg) 100%)',
        borderColor: 'color-mix(in srgb, var(--mantine-color-brand-6) 18%, transparent)',
        boxShadow: '0 24px 60px color-mix(in srgb, var(--mantine-color-dark-9) 45%, transparent)',
      }}
    >
      <Stack gap={4} mb="md">
        <Group justify="space-between" align="flex-start">
          <Group gap="sm" align="center">
            <Box
              style={{
                width: 42,
                height: 42,
                borderRadius: 14,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background:
                  'color-mix(in srgb, var(--mantine-color-brand-6) 14%, var(--pitch-surface-bg))',
              }}
            >
              <IconMessage2 size={20} color="var(--mantine-color-brand-5)" />
            </Box>
            <Stack gap={2}>
              <Group gap="xs" align="center">
                <Title order={3}>Live transcript</Title>
                <Badge color={phoneStatusColor} variant="light" radius="sm">
                  {phoneStatusLabel}
                </Badge>
              </Group>
              <Text size="sm" c="dimmed">
                {phoneStatusCopy}
              </Text>
            </Stack>
          </Group>
          <Badge color="gray" variant="outline" radius="sm">
            {messages.length} turns
          </Badge>
        </Group>
      </Stack>

      <ScrollArea viewportRef={viewportRef} offsetScrollbars style={{ flex: 1, minHeight: 0 }}>
        <Stack gap="sm" pr="sm">
          {error && (
            <Paper
              withBorder
              radius="lg"
              p="md"
              style={{ borderColor: 'var(--mantine-color-red-4)' }}
            >
              <Group gap="xs" align="center">
                <IconAlertTriangle size={16} color="var(--mantine-color-red-5)" />
                <Text size="sm" c="red">
                  {error}
                </Text>
              </Group>
            </Paper>
          )}

          {messages.length === 0 ? (
            <Paper
              withBorder
              radius="xl"
              p="xl"
              style={{
                minHeight: 320,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                background:
                  'color-mix(in srgb, var(--mantine-color-dark-9) 12%, var(--pitch-surface-bg))',
              }}
            >
              <Stack align="center" gap="sm" maw={420}>
                <Box
                  style={{
                    width: 54,
                    height: 54,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background:
                      'color-mix(in srgb, var(--mantine-color-brand-6) 16%, var(--pitch-surface-bg))',
                  }}
                >
                  <IconDeviceMobile size={24} color="var(--mantine-color-brand-5)" />
                </Box>
                <Title order={4}>
                  {callStarted
                    ? 'Transcript is waiting for the first turn'
                    : 'Transcript will appear here'}
                </Title>
                <Text size="sm" c="dimmed">
                  {callStarted
                    ? 'As soon as the phone conversation begins, each turn will land in this feed automatically.'
                    : 'Verify the number and start the call when you are ready. This center panel is reserved for the transcript only.'}
                </Text>
              </Stack>
            </Paper>
          ) : (
            messages.map((message) => {
              const isUser = message.role === 'user'
              return (
                <Box
                  key={message.id}
                  style={{
                    display: 'flex',
                    justifyContent: isUser ? 'flex-end' : 'flex-start',
                  }}
                >
                  <Paper
                    withBorder
                    radius="xl"
                    p="md"
                    style={{
                      maxWidth: '82%',
                      background: isUser
                        ? 'color-mix(in srgb, var(--mantine-color-brand-6) 16%, var(--pitch-surface-bg))'
                        : 'color-mix(in srgb, var(--mantine-color-dark-9) 12%, var(--pitch-surface-bg))',
                      borderColor: isUser
                        ? 'color-mix(in srgb, var(--mantine-color-brand-5) 22%, transparent)'
                        : 'color-mix(in srgb, var(--mantine-color-dark-9) 18%, transparent)',
                    }}
                  >
                    <Group justify="space-between" gap="md" mb={6}>
                      <Badge color={isUser ? 'brand' : 'teal'} variant="light" radius="sm">
                        {isUser ? 'You' : 'AI'}
                      </Badge>
                      <Text size="xs" c="dimmed">
                        {formatMessageTime(message.timestamp)}
                      </Text>
                    </Group>
                    <Text size="sm" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                      {message.text.trim() || 'No transcript text was captured for this turn.'}
                    </Text>
                  </Paper>
                </Box>
              )
            })
          )}
        </Stack>
      </ScrollArea>
    </Paper>
  )
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
  const [phoneSetupModalOpen, setPhoneSetupModalOpen] = useState(false)
  const [phoneNumber, setPhoneNumber] = useState('')
  const [callLoading, setCallLoading] = useState(false)
  const [callError, setCallError] = useState<string | null>(null)
  const [phoneVerification, setPhoneVerification] = useState<PhoneVerificationState | null>(null)
  const [phoneVerificationLoading, setPhoneVerificationLoading] = useState(false)
  const [phoneVerificationActionLoading, setPhoneVerificationActionLoading] = useState(false)
  const [verificationCode, setVerificationCode] = useState('')
  const [savePhoneForFutureUse, setSavePhoneForFutureUse] = useState(true)
  const [transientVerifiedPhoneNumber, setTransientVerifiedPhoneNumber] = useState<string | null>(
    null
  )
  const [editingVerifiedPhone, setEditingVerifiedPhone] = useState(false)
  const [phoneCallRuntime, setPhoneCallRuntime] =
    useState<PhoneCallRuntimeState>(EMPTY_PHONE_CALL_RUNTIME)
  const [phoneTranscriptMessages, setPhoneTranscriptMessages] = useState<TranscriptMessage[]>([])
  const [phoneTranscriptError, setPhoneTranscriptError] = useState<string | null>(null)
  const [avatarVideoUrl, setAvatarVideoUrl] = useState<string | null>(null)
  const [avatarVideoStatus, setAvatarVideoStatus] = useState<AvatarVideoStatus>('idle')
  const [avatarVideoProvider, setAvatarVideoProvider] = useState<string | null>(null)
  const [avatarVideoError, setAvatarVideoError] = useState<string | null>(null)
  const [avatarVideoJobId, setAvatarVideoJobId] = useState<string | null>(null)
  const [autoConnectConversation, setAutoConnectConversation] = useState(false)
  const [resumePromptOpen, setResumePromptOpen] = useState(false)
  const [entryPromptMode, setEntryPromptMode] = useState<EntryPromptMode | null>(null)
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
  const sendMessageRef = useRef<(text: string) => void>(() => {})
  const resetTranscriptRef = useRef<() => void>(() => {})
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

  const clearSpeechFinalizeState = useCallback(() => {
    if (speechFinalizeTimerRef.current) {
      clearTimeout(speechFinalizeTimerRef.current)
      speechFinalizeTimerRef.current = null
    }
    if (speechFinalizeTickerRef.current) {
      clearInterval(speechFinalizeTickerRef.current)
      speechFinalizeTickerRef.current = null
    }
    setSttCommitRemainingMs(0)
  }, [])

  const flushSpeechBuffer = useCallback(() => {
    clearSpeechFinalizeState()
    const buffered = speechBufferRef.current.trim()
    if (sessionStatus !== 'ended' && buffered) {
      sendMessageRef.current(buffered)
      scheduleIdleHints()
    }
    speechBufferRef.current = ''
    resetTranscriptRef.current()
  }, [clearSpeechFinalizeState, scheduleIdleHints, sessionStatus])

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
  sendMessageRef.current = sendMessage

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
  resetTranscriptRef.current = resetTranscript

  const analyserRef = useAudioLevel({ audioElementRef, assistantSpeaking })

  const { isReady: poseIsReady, currentState: visualState } = useVisualState({
    sessionId,
    videoRef: poseVideoRef,
    enabled: isVideoSession && visualEnabled && isConnected,
    sendIntervalMs: 5000,
    onUserAbsent: () => {},
  })

  const isPhoneSession = sessionType === 'phone'
  const activeConversationMessages = isPhoneSession ? phoneTranscriptMessages : messages

  const syncSessionState = useCallback((session: any) => {
    const config = (session?.sessionConfig as Record<string, any>) ?? {}
    const avatarState = readAvatarVideoState(session)
    const phoneRuntime = readPhoneCallRuntime(session)
    const normalizedStatus = normalizeSessionStatus(session)
    const nextAvatarVideoUrl =
      session?.id && avatarState.status === 'ready' && avatarState.playbackToken
        ? buildSessionVideoStreamUrl(session.id, avatarState.playbackToken, avatarState.jobId)
        : avatarState.url

    setIsMultiTurn(Boolean(config.multiTurnEnabled))
    setSessionType(session?.type ?? null)
    setSessionStatus(normalizedStatus)
    setSessionName((session as any)?.name ?? (session as any)?.scenario?.name ?? '')
    setPersonaName((session as any)?.persona?.name ?? null)
    setAvatarVideoStatus(avatarState.status)
    setAvatarVideoProvider(avatarState.provider)
    setAvatarVideoError(avatarState.error)
    setAvatarVideoJobId(avatarState.jobId)
    setAvatarVideoUrl(nextAvatarVideoUrl)
    setPhoneCallRuntime(phoneRuntime)
    setCallStarted(session?.type === 'phone' ? isPhoneCallActive(phoneRuntime) : false)
  }, [])

  const applyTimelineResponse = useCallback((response: unknown) => {
    const { progress, stages } = buildTimelineState(response)
    setTimelineStages(stages)
    setCurrentProgress(progress)
    setTimelineError(null)
  }, [])

  const loadPhoneVerificationStatus = useCallback(async () => {
    setPhoneVerificationLoading(true)
    try {
      const status = (await api.users.getMyPhoneVerification()) as PhoneVerificationState
      setPhoneVerification(status)
      if (status.verified && status.phoneNumber) {
        setEditingVerifiedPhone(false)
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
    setEntryPromptMode(null)
    setEntryDecisionLoading(true)
    setStartOverLoading(false)
    setLoadedSessionRecord(null)
    setCallStarted(false)
    setPhoneSetupModalOpen(false)
    setCallLoading(false)
    setCallError(null)
    setPhoneVerification(null)
    setPhoneVerificationLoading(false)
    setPhoneVerificationActionLoading(false)
    setVerificationCode('')
    setSavePhoneForFutureUse(true)
    setTransientVerifiedPhoneNumber(null)
    setEditingVerifiedPhone(false)
    setPhoneCallRuntime(EMPTY_PHONE_CALL_RUNTIME)
    setPhoneTranscriptMessages([])
    setPhoneTranscriptError(null)
    setPhoneNumber('')

    const loadSession = async () => {
      try {
        const session = await api.sessions.getById(sessionId)
        if (cancelled) return

        const sessionRecord = isRecord(session) ? session : {}
        setLoadedSessionRecord(sessionRecord)
        const status = normalizeSessionStatus(session)
        const isPhoneSession = sessionRecord.type === 'phone'

        if (status === 'ended') {
          syncSessionState(session)
          setEntryPromptMode('retake')
          setResumePromptOpen(true)
          setAutoConnectConversation(false)
          return
        }

        syncSessionState(session)

        if (isPhoneSession) {
          setAutoConnectConversation(false)
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
          setEntryPromptMode('resume')
          setResumePromptOpen(true)
          setAutoConnectConversation(false)
        } else {
          setEntryPromptMode(null)
          setAutoConnectConversation(true)
        }
      } catch {
        if (cancelled) return
        setIsMultiTurn(false)
        setEntryPromptMode(null)
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

  useEffect(() => {
    if (sessionType !== 'phone') return
    if (autoConnectConversation) {
      setAutoConnectConversation(false)
    }
  }, [sessionType, autoConnectConversation])

  useEffect(() => {
    if (entryDecisionLoading) return
    if (sessionType !== 'phone') {
      setPhoneSetupModalOpen(false)
      return
    }
    if (sessionStatus === 'ended' || resumePromptOpen || entryPromptMode) {
      setPhoneSetupModalOpen(false)
      return
    }
    if (!callStarted) {
      setPhoneSetupModalOpen(true)
    }
  }, [
    callStarted,
    entryDecisionLoading,
    entryPromptMode,
    resumePromptOpen,
    sessionStatus,
    sessionType,
  ])

  const handleResumeSession = useCallback(() => {
    setResumePromptOpen(false)
    setEntryPromptMode(null)
    if (sessionType !== 'phone') {
      setAutoConnectConversation(true)
    }
  }, [sessionType])

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
      setPhoneTranscriptMessages([])
      setPhoneTranscriptError(null)
      setCallStarted(false)
      setCallError(null)
      speechBufferRef.current = ''
      assistantInterruptTriggeredRef.current = false
      resetTranscript()

      setLoadedSessionRecord(restartedRecord)
      syncSessionState(restartedSession)
      setEntryPromptMode(null)

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
          applyTimelineResponse(response)
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
      if (restartedRecord.type === 'phone') {
        setAutoConnectConversation(false)
      } else {
        setAutoConnectConversation(true)
      }
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
    applyTimelineResponse,
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
    const pipVideoElement = userPipVideoRef.current
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
        if (pipVideoElement) {
          pipVideoElement.srcObject = stream
          pipVideoElement.play().catch(() => {})
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
      if (pipVideoElement) pipVideoElement.srcObject = null
    }
  }, [isVideoSession, visualEnabled, isConnected, sessionType])

  const handleRequestPhoneVerification = async () => {
    const nextPhoneNumber = phoneNumber.trim()
    if (!nextPhoneNumber) {
      setCallError('Enter the phone number you want to verify.')
      return
    }

    setPhoneVerificationActionLoading(true)
    setCallError(null)
    try {
      const status = (await api.users.requestPhoneVerification({
        phoneNumber: nextPhoneNumber,
      })) as PhoneVerificationState
      setPhoneVerification(status)
      setTransientVerifiedPhoneNumber(null)
      setEditingVerifiedPhone(true)
      setVerificationCode('')
      notifications.show({
        title: 'Verification code sent',
        message: `We texted a verification code to ${status.pendingPhoneNumber ?? nextPhoneNumber}.`,
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
      setTransientVerifiedPhoneNumber(null)
      setEditingVerifiedPhone(true)
      setVerificationCode('')
      notifications.show({
        title: 'Verification code resent',
        message: `We texted a fresh verification code to ${status.pendingPhoneNumber ?? phoneNumber}.`,
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
      setCallError('Enter the 6-digit verification code from the text message.')
      return
    }

    setPhoneVerificationActionLoading(true)
    setCallError(null)
    try {
      const status = (await api.users.verifyPhoneVerification({
        code: verificationCode.trim(),
        saveForFutureUse: savePhoneForFutureUse,
      })) as PhoneVerificationState
      setPhoneVerification(status)
      setEditingVerifiedPhone(false)
      setVerificationCode('')
      setTransientVerifiedPhoneNumber(
        savePhoneForFutureUse ? null : (status.temporaryVerifiedPhoneNumber ?? phoneNumber.trim())
      )
      if (status.phoneNumber) {
        setPhoneNumber(status.phoneNumber)
      }
      notifications.show({
        title: 'Phone verified',
        message: savePhoneForFutureUse
          ? `${status.phoneNumber ?? 'Your phone number'} is now ready for calling sessions.`
          : `${(status.temporaryVerifiedPhoneNumber ?? phoneNumber.trim()) || 'This phone number'} is verified for this call only.`,
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
    const activeVerifiedPhoneNumber = transientVerifiedPhoneNumber ?? phoneVerification?.phoneNumber
    if (!activeVerifiedPhoneNumber) {
      setCallError('Verify your phone number before starting the call.')
      return
    }

    setCallLoading(true)
    setCallError(null)
    try {
      await api.phoneCalls.start({
        sessionId,
        phoneNumber: activeVerifiedPhoneNumber,
      })
      setSessionStatus('active')
      notifications.show({
        title: 'Calling now',
        message: `We’re calling ${activeVerifiedPhoneNumber}. Answer your phone to begin.`,
        color: 'green',
      })
      setCallStarted(true)
      setPhoneSetupModalOpen(false)
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

  const handleEditVerifiedPhone = () => {
    setEditingVerifiedPhone(true)
    setVerificationCode('')
    setCallError(null)
    setSavePhoneForFutureUse(true)
    setTransientVerifiedPhoneNumber(null)
  }

  const handleClosePhoneSetupModal = () => {
    setPhoneSetupModalOpen(false)
    setCallError(null)
    setVerificationCode('')
    if (phoneVerification?.verified && phoneVerification.phoneNumber) {
      setPhoneNumber(phoneVerification.phoneNumber)
      setEditingVerifiedPhone(false)
    }
  }

  const activeVerifiedPhoneNumber =
    transientVerifiedPhoneNumber ?? phoneVerification?.phoneNumber ?? null
  const isTransientVerifiedPhone = Boolean(
    transientVerifiedPhoneNumber && transientVerifiedPhoneNumber !== phoneVerification?.phoneNumber
  )

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
    latestMessagesRef.current = activeConversationMessages.map((msg) => ({
      role: msg.role,
      text: msg.text,
    }))
  }, [activeConversationMessages])

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
    if (activeConversationMessages.length === 0) return
    if (isProcessing) return

    scheduleIdleHints(1200)
  }, [
    hintsEnabled,
    sessionStatus,
    activeConversationMessages.length,
    isProcessing,
    scheduleIdleHints,
  ])

  useEffect(() => {
    if (!sessionId || !timelineEnabled) {
      setTimelineStages([])
      setCurrentProgress(0)
      setTimelineError(null)
      return
    }
    if (sessionType === 'phone') return

    const loadTimeline = async () => {
      try {
        const response = await api.sessions.timeline(sessionId, 50)
        applyTimelineResponse(response)
      } catch (err) {
        setTimelineError('Unable to load timeline')
      }
    }

    void loadTimeline()
  }, [sessionId, timelineEnabled, sessionType, applyTimelineResponse])

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
    if (sessionType === 'phone') return
    if (!isMultiTurn || !isConnected) return
    if (activeConversationMessages.length > 0) return

    if (assistantStartTimerRef.current) {
      clearTimeout(assistantStartTimerRef.current)
    }
    assistantStartTimerRef.current = setTimeout(() => {
      startAssistantTurn()
    }, 600)
  }, [
    isMultiTurn,
    isConnected,
    activeConversationMessages.length,
    startAssistantTurn,
    sessionStatus,
    sessionType,
  ])

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
    if (sessionType !== 'phone') return
    if (!sessionId || sessionStatus === 'ended') return
    if (entryPromptMode === 'retake') return

    let cancelled = false
    const refreshPhoneState = async () => {
      try {
        const [session, timeline] = await Promise.all([
          api.sessions.getById(sessionId),
          api.sessions.timeline(sessionId, 200),
        ])
        if (cancelled) return
        syncSessionState(session)
        setPhoneTranscriptMessages(readTimelineConversationHistory(timeline))
        setPhoneTranscriptError(null)
        applyTimelineResponse(timeline)
      } catch {
        if (cancelled) return
        setPhoneTranscriptError('Unable to refresh the live transcript right now.')
      }
    }

    void refreshPhoneState()
    const interval = setInterval(() => {
      void refreshPhoneState()
    }, 3000)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [
    entryPromptMode,
    sessionId,
    sessionStatus,
    sessionType,
    syncSessionState,
    applyTimelineResponse,
  ])

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
    if (sessionType === 'phone') return
    if (messages.length > 0 && sessionId) {
      const loadTimeline = async () => {
        try {
          const response = await api.sessions.timeline(sessionId, 50)
          applyTimelineResponse(response)
        } catch {
          // Silently fail on updates
        }
      }

      void loadTimeline()
    }
  }, [messages.length, sessionId, timelineEnabled, sessionType, applyTimelineResponse])

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
    setCallStarted(false)
    router.push(`/session/${sessionId}/performance`)
  }, [clearSpeechFinalizeState, hangUp, isListening, router, sessionId, stopListening])

  useEffect(() => {
    if (sessionType === 'phone' && sessionStatus === 'ended' && entryPromptMode !== 'retake') {
      router.push(`/session/${sessionId}/performance`)
    }
  }, [entryPromptMode, sessionType, sessionStatus, sessionId, router])

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
  const phoneStatusLabel = getPhoneStatusLabel(phoneCallRuntime, sessionStatus, callStarted)
  const phoneStatusColor = getPhoneStatusColor(phoneCallRuntime, sessionStatus, callStarted)
  const phoneStatusCopy = getPhoneStatusCopy(phoneCallRuntime, sessionStatus, callStarted)

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
        opened={phoneSetupModalOpen && isPhoneSession}
        onClose={handleClosePhoneSetupModal}
        centered
        size="lg"
        withCloseButton={false}
        overlayProps={{
          backgroundOpacity: 0.72,
          blur: 10,
        }}
        styles={{
          body: {
            background: 'transparent',
            padding: 0,
          },
          content: {
            background: 'transparent',
            border: 'none',
            boxShadow: 'none',
          },
        }}
      >
        <PhoneCallSetupCard
          personaName={personaName}
          sessionStatus={sessionStatus}
          phoneStatusLabel={phoneStatusLabel}
          phoneStatusColor={phoneStatusColor}
          phoneStatusCopy={phoneStatusCopy}
          phoneVerificationLoading={phoneVerificationLoading}
          phoneVerificationActionLoading={phoneVerificationActionLoading}
          phoneVerification={phoneVerification}
          phoneNumber={phoneNumber}
          onPhoneNumberChange={(value) => {
            setPhoneNumber(value)
            if (callError) {
              setCallError(null)
            }
          }}
          callError={callError}
          editingVerifiedPhone={editingVerifiedPhone}
          activeVerifiedPhoneNumber={activeVerifiedPhoneNumber}
          isTransientVerifiedPhone={isTransientVerifiedPhone}
          verificationCode={verificationCode}
          onVerificationCodeChange={(value) => {
            setVerificationCode(value)
            if (callError) {
              setCallError(null)
            }
          }}
          savePhoneForFutureUse={savePhoneForFutureUse}
          onSavePhoneForFutureUseChange={setSavePhoneForFutureUse}
          onRequestPhoneVerification={handleRequestPhoneVerification}
          onResendPhoneVerification={handleResendPhoneVerification}
          onVerifyPhoneCode={handleVerifyPhoneCode}
          onEditVerifiedPhone={handleEditVerifiedPhone}
          onStartPhoneCall={handleStartPhoneCall}
          callLoading={callLoading}
          callStarted={callStarted}
          phoneCallRuntime={phoneCallRuntime}
        />
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
            {!isMobile && !isPhoneSession && (
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
              {!isPhoneSession && isConnecting && <Loader size="sm" color="white" />}
              {entryDecisionLoading && <Loader size="sm" color="white" />}
              {!isPhoneSession && conversationError && (
                <Text size="xs" c="red">
                  {conversationError}
                </Text>
              )}
              {!isPhoneSession && isConnected && !isConnecting && (
                <Box
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    backgroundColor: 'green',
                  }}
                />
              )}
              {isPhoneSession && (
                <>
                  <Badge color={phoneStatusColor} variant="light" radius="sm">
                    {phoneStatusLabel}
                  </Badge>
                  {sessionStatus !== 'ended' && (
                    <Button
                      size="xs"
                      variant="light"
                      color="blue"
                      onClick={() => setPhoneSetupModalOpen(true)}
                    >
                      {callStarted ? 'Call options' : 'Call setup'}
                    </Button>
                  )}
                </>
              )}
              {isVideoSession && (
                <CameraEngagementIndicator
                  isActive={visualEnabled}
                  isReady={poseIsReady}
                  onToggle={() => setVisualEnabled((v) => !v)}
                />
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
        {isPhoneSession ? (
          <>
            {!isMobile && (
              <HintsSidebar
                hintsEnabled={hintsEnabled}
                hints={hints}
                hintsError={hintsError}
                onShow={() => setHintsEnabled(true)}
                onHide={() => setHintsEnabled(false)}
              />
            )}

            <Box
              style={{
                flex: 1,
                minWidth: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: isMobile ? 12 : 24,
                overflow: 'hidden',
              }}
            >
              {isMobile && resumePromptOpen && entryPromptMode && (
                <PhoneResumePromptCard
                  entryPromptMode={entryPromptMode}
                  startOverLoading={startOverLoading}
                  onResume={handleResumeSession}
                  onStartOver={handleStartOver}
                />
              )}
              <PhoneTranscriptPanel
                messages={phoneTranscriptMessages}
                error={phoneTranscriptError}
                phoneStatusLabel={phoneStatusLabel}
                phoneStatusColor={phoneStatusColor}
                phoneStatusCopy={phoneStatusCopy}
                callStarted={callStarted}
              />
              {isMobile && (
                <Stack gap="md">
                  <HintsSidebar
                    hintsEnabled={hintsEnabled}
                    hints={hints}
                    hintsError={hintsError}
                    width="100%"
                    onShow={() => setHintsEnabled(true)}
                    onHide={() => setHintsEnabled(false)}
                  />
                  <TimelineSidebar
                    timelineEnabled={timelineEnabled}
                    timelineStages={timelineStages}
                    currentProgress={currentProgress}
                    timelineError={timelineError}
                    width="100%"
                    onShow={() => setTimelineEnabled(true)}
                    onHide={() => setTimelineEnabled(false)}
                  />
                </Stack>
              )}
            </Box>

            {!isMobile && (
              <TimelineSidebar
                timelineEnabled={timelineEnabled}
                timelineStages={timelineStages}
                currentProgress={currentProgress}
                timelineError={timelineError}
                onShow={() => setTimelineEnabled(true)}
                onHide={() => setTimelineEnabled(false)}
              />
            )}
          </>
        ) : (
          <>
            {!isMobile && (
              <HintsSidebar
                hintsEnabled={hintsEnabled}
                hints={hints}
                hintsError={hintsError}
                onShow={() => setHintsEnabled(true)}
                onHide={() => setHintsEnabled(false)}
              />
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
              <VoiceOrbSession
                mode={sessionType === 'text' ? 'text' : sessionType === 'video' ? 'video' : 'voice'}
                messages={messages}
                globeState={globeState}
                analyserRef={analyserRef}
                resumePromptOpen={resumePromptOpen}
                entryPromptMode={entryPromptMode}
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

            {!isMobile && (
              <TimelineSidebar
                timelineEnabled={timelineEnabled}
                timelineStages={timelineStages}
                currentProgress={currentProgress}
                timelineError={timelineError}
                onShow={() => setTimelineEnabled(true)}
                onHide={() => setTimelineEnabled(false)}
              />
            )}
          </>
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
          recentTurns: activeConversationMessages
            .slice(-6)
            .map((message) => ({ role: message.role, text: message.text })),
        }}
      />
    </Box>
  )
}
