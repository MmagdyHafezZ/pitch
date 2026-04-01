'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
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
  RingProgress,
  Tooltip,
  Progress,
  ThemeIcon,
  Divider,
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
  IconSettings,
  IconX,
  IconTarget,
  IconTrophy,
  IconRefresh,
  IconCheck,
} from '@tabler/icons-react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import {
  useConversation,
  useVisualState,
  CameraEngagementIndicator,
  useVoiceTurnController,
} from '@/features/conversation'
import { type GlobeState } from '@/features/conversation/components/GlobeVisualizer'
import VoiceOrbSession from '@/features/conversation/components/VoiceOrbSession'
import { useAudioLevel } from '@/features/conversation/hooks/useAudioLevel'
import { CoachChatWidget } from '@/components/ui/CoachChatWidget'
import { SettingsModal } from '@/components/ui/SettingsModal'
import { useAuthStore } from '@/features/auth'
import { useSpeechToText } from '@/features/stt'
import { API_CONFIG, api } from '@/lib/client'
import { notifications } from '@mantine/notifications'
import type { SessionType } from '@/features/sessions'
import type { SessionAttachment } from '@/features/sessions/types/sessions.types'
import { UploadSection } from '@/app/studio/sessions/create/components/UploadSection'
import { useInvalidateCoinsBalance } from '@/features/coins/hooks/useCoinsBalance'

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
type PhoneRetakeChoice = 'undecided' | 'saved' | 'different'

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
  audioUrl?: string
}

interface CoachStarterPrompt {
  key: string
  message: string
  open?: boolean
  hidden?: boolean
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

const SESSION_TIMER_STORAGE_PREFIX = 'pitch-live-session-timer:'

const PHONE_TERMINAL_STATUSES = new Set(['ended', 'failed', 'busy', 'no-answer', 'canceled'])

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const normalizeSessionStatus = (session: unknown): string | null => {
  if (!isRecord(session)) {
    return null
  }

  const currentIteration = isRecord(session.currentIteration) ? session.currentIteration : null
  const iterationStatus =
    currentIteration && typeof currentIteration.status === 'string'
      ? currentIteration.status.trim().toLowerCase()
      : null

  if (iterationStatus === 'completed') {
    return 'ended'
  }

  if (typeof session.status !== 'string') {
    return null
  }

  return session.status.trim().toLowerCase()
}

const readCurrentIterationId = (session: unknown): string | null => {
  if (!isRecord(session)) return null
  const currentIteration = isRecord(session.currentIteration) ? session.currentIteration : null
  return currentIteration && typeof currentIteration.id === 'string' ? currentIteration.id : null
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

const readVideoPresenter = (session: unknown) => {
  if (!isRecord(session)) {
    return {
      name: null,
      avatarImageUrl: null,
    }
  }

  const sessionConfig = isRecord(session.sessionConfig) ? session.sessionConfig : {}
  const videoConfig = isRecord(sessionConfig.video) ? sessionConfig.video : {}
  const presenter = isRecord(videoConfig.presenter) ? videoConfig.presenter : null

  return {
    name:
      (presenter && typeof presenter.name === 'string' ? presenter.name : null) ??
      (typeof videoConfig.presenterName === 'string' ? videoConfig.presenterName : null),
    avatarImageUrl:
      (presenter && typeof presenter.avatarImageUrl === 'string'
        ? presenter.avatarImageUrl
        : null) ??
      (typeof videoConfig.avatarImageUrl === 'string' ? videoConfig.avatarImageUrl : null),
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

const isSessionAttachment = (value: unknown): value is SessionAttachment =>
  isRecord(value) &&
  typeof value.bucket === 'string' &&
  typeof value.key === 'string' &&
  typeof value.filename === 'string' &&
  typeof value.contentType === 'string' &&
  typeof value.size === 'number' &&
  Number.isFinite(value.size) &&
  typeof value.uploadedAt === 'string'

const readSessionAttachments = (session: Record<string, unknown> | null): SessionAttachment[] => {
  if (!session) return []

  const sessionConfig = isRecord(session.sessionConfig) ? session.sessionConfig : {}
  const attachments = sessionConfig.attachments
  if (!Array.isArray(attachments)) return []

  return attachments.filter(isSessionAttachment)
}

const mergeSessionAttachments = (
  existing: SessionAttachment[],
  incoming: SessionAttachment[]
): SessionAttachment[] => {
  const byKey = new Map<string, SessionAttachment>()

  for (const attachment of [...existing, ...incoming]) {
    byKey.set(`${attachment.bucket}:${attachment.key}`, attachment)
  }

  return [...byKey.values()]
}

type EntryFlowMode = 'auto' | 'resume'

type TimelineStage = {
  order: number
  label: string
  description?: string
  estimatedDuration?: number
  active: boolean
  completed: boolean
}

const clampProgress = (value: unknown): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0
  }

  return Math.max(0, Math.min(100, Math.round(value)))
}

const readText = (...values: unknown[]): string | undefined => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim()
    }
  }

  return undefined
}

const normalizeTimelinePlan = (
  rawStages: unknown
): Array<{ order: number; label: string; description?: string; estimatedDuration?: number }> => {
  if (!Array.isArray(rawStages)) {
    return []
  }

  return rawStages
    .map((stage, index) => {
      if (typeof stage === 'string') {
        const label = stage.trim()
        return label
          ? {
              order: index + 1,
              label,
            }
          : null
      }

      if (!isRecord(stage)) {
        return null
      }

      const label = readText(stage.label, stage.name, stage.title, `Stage ${index + 1}`)
      if (!label) {
        return null
      }

      const description = readText(stage.description, stage.goal, stage.summary)
      const estimatedDuration =
        typeof stage.estimatedDuration === 'number' && Number.isFinite(stage.estimatedDuration)
          ? stage.estimatedDuration
          : typeof stage.duration === 'number' && Number.isFinite(stage.duration)
            ? stage.duration
            : undefined

      return {
        order: index + 1,
        label,
        description,
        estimatedDuration,
      }
    })
    .filter(
      (
        stage
      ): stage is {
        order: number
        label: string
        description?: string
        estimatedDuration?: number
      } => Boolean(stage)
    )
}

const extractTimelinePlanFromSession = (
  session: Record<string, unknown> | null
): Array<{ order: number; label: string; description?: string; estimatedDuration?: number }> => {
  if (!session) {
    return []
  }

  const sessionConfig = isRecord(session.sessionConfig) ? session.sessionConfig : {}
  const scenario = isRecord(session.scenario) ? session.scenario : {}
  const scenarioConfig = isRecord(scenario.config) ? scenario.config : {}
  const embeddedScenario = isRecord(sessionConfig.scenario) ? sessionConfig.scenario : {}

  const sources = [
    scenarioConfig.stages,
    scenarioConfig.phases,
    scenarioConfig.plan,
    embeddedScenario.stages,
    embeddedScenario.phases,
    embeddedScenario.plan,
    sessionConfig.stages,
  ]

  for (const source of sources) {
    const normalized = normalizeTimelinePlan(source)
    if (normalized.length > 0) {
      return normalized
    }
  }

  return []
}

const buildTimelineStages = (
  plannedStages: unknown,
  progress: unknown,
  totalTurns: unknown,
  fallbackSession: Record<string, unknown> | null
): TimelineStage[] => {
  const normalizedProgress = clampProgress(progress)
  const normalizedTotalTurns =
    typeof totalTurns === 'number' && Number.isFinite(totalTurns) ? Math.max(0, totalTurns) : 0
  const plan =
    normalizeTimelinePlan(plannedStages).length > 0
      ? normalizeTimelinePlan(plannedStages)
      : extractTimelinePlanFromSession(fallbackSession)

  if (plan.length === 0) {
    return []
  }

  const activeIndex =
    normalizedTotalTurns === 0
      ? 0
      : Math.min(plan.length - 1, Math.floor((normalizedProgress / 100) * plan.length))

  return plan.map((stage, index) => ({
    ...stage,
    active: index === activeIndex,
    completed: normalizedTotalTurns > 0 && index < activeIndex,
  }))
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

const parseTimestampMs = (value: unknown): number | null => {
  if (typeof value !== 'string' || !value.trim()) {
    return null
  }

  const parsed = new Date(value).getTime()
  return Number.isNaN(parsed) ? null : parsed
}

const getSessionTimerStorageKey = (sessionId: string, iterationId: string | null) =>
  `${SESSION_TIMER_STORAGE_PREFIX}${sessionId}:${iterationId ?? 'session'}`

const readPersistedSessionStartMs = (
  sessionId: string,
  iterationId: string | null
): number | null => {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const rawValue = window.sessionStorage.getItem(
      getSessionTimerStorageKey(sessionId, iterationId)
    )
    if (!rawValue) {
      return null
    }

    const parsed = Number(rawValue)
    return Number.isFinite(parsed) ? parsed : null
  } catch {
    return null
  }
}

const writePersistedSessionStartMs = (
  sessionId: string,
  iterationId: string | null,
  startedAtMs: number
) => {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.sessionStorage.setItem(
      getSessionTimerStorageKey(sessionId, iterationId),
      String(startedAtMs)
    )
  } catch {
    // Ignore storage failures and fall back to in-memory state
  }
}

const clearPersistedSessionStartMs = (sessionId: string, iterationId: string | null) => {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.sessionStorage.removeItem(getSessionTimerStorageKey(sessionId, iterationId))
    // Legacy key cleanup from the old session-only timer implementation.
    window.sessionStorage.removeItem(`${SESSION_TIMER_STORAGE_PREFIX}${sessionId}`)
  } catch {
    // Ignore storage failures
  }
}

const readSessionEndedAtMs = (session: unknown): number | null => {
  if (!isRecord(session)) {
    return null
  }

  return (
    parseTimestampMs(session.endedAt) ?? parseTimestampMs(readPhoneCallRuntime(session).endedAt)
  )
}

const resolveSessionStartMs = (
  sessionId: string,
  session: unknown,
  history: TranscriptMessage[] = []
): number | null => {
  const persistedStartMs = readPersistedSessionStartMs(sessionId, readCurrentIterationId(session))
  const historyStartMs = history.length > 0 ? (history[0]?.timestamp.getTime() ?? null) : null
  const phoneStartMs = parseTimestampMs(readPhoneCallRuntime(session).startedAt)
  const candidates = [persistedStartMs, historyStartMs, phoneStartMs].filter(
    (value): value is number => value !== null
  )

  if (candidates.length === 0) {
    return null
  }

  return Math.min(...candidates)
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

type ReplayAudioConfig = {
  provider: string
  voice: string
  model?: string
}

const readReplayAudioConfigFromSession = (
  session: Record<string, unknown> | null
): ReplayAudioConfig | null => {
  if (!session) {
    return null
  }

  const sessionConfig = isRecord(session.sessionConfig) ? session.sessionConfig : {}
  const sessionVoice = isRecord(sessionConfig.voice) ? sessionConfig.voice : {}
  const persona = isRecord(session.persona) ? session.persona : {}
  const personaTraits = isRecord(persona.traits) ? persona.traits : {}
  const personaVoice = isRecord(personaTraits.voice) ? personaTraits.voice : {}
  const personaAudioPreview = isRecord(personaTraits.audioPreview) ? personaTraits.audioPreview : {}

  const provider = readText(
    sessionVoice.provider,
    sessionConfig.ttsProvider,
    personaVoice.provider,
    'elevenlabs'
  )
  const voice = readText(
    sessionVoice.voiceName,
    sessionVoice.voice,
    sessionConfig.ttsVoice,
    personaVoice.voiceName,
    personaAudioPreview.voiceName
  )
  const model = readText(sessionVoice.model, sessionConfig.ttsModel, personaVoice.model)

  if (!provider || !voice) {
    return null
  }

  return {
    provider: provider.toLowerCase(),
    voice,
    ...(model ? { model } : {}),
  }
}

const readPresenterTone = (session: Record<string, unknown> | null): string | null => {
  if (!session) {
    return null
  }

  const sessionConfig = isRecord(session.sessionConfig) ? session.sessionConfig : {}
  const persona = isRecord(session.persona) ? session.persona : {}
  const personaTraits = isRecord(persona.traits) ? persona.traits : {}

  return readText(sessionConfig.tone, personaTraits.tone) ?? null
}

const attachReplayAudioToLatestAssistantMessage = async (
  history: TranscriptMessage[],
  sessionRecord: Record<string, unknown> | null
): Promise<{ history: TranscriptMessage[]; replayReady: boolean }> => {
  if (history.length === 0) {
    return { history, replayReady: false }
  }

  let latestAssistantIndex = -1
  for (let i = history.length - 1; i >= 0; i -= 1) {
    if (history[i].role === 'assistant' && history[i].text.trim()) {
      latestAssistantIndex = i
      break
    }
  }

  console.debug(
    '[replayAudio] latestAssistantIndex',
    latestAssistantIndex,
    'history len',
    history.length
  )

  if (latestAssistantIndex === -1) {
    console.debug('[replayAudio] no assistant message found')
    return { history, replayReady: false }
  }

  if (history[latestAssistantIndex].audioUrl) {
    console.debug('[replayAudio] audioUrl already present, replayReady=true')
    return { history, replayReady: true }
  }

  const replayConfig = readReplayAudioConfigFromSession(sessionRecord)
  console.debug('[replayAudio] replayConfig', replayConfig)
  if (!replayConfig) {
    console.debug('[replayAudio] no voice config found in session — replayReady=false')
    return { history, replayReady: false }
  }

  try {
    console.debug(
      '[replayAudio] calling TTS for text:',
      history[latestAssistantIndex].text.slice(0, 80)
    )
    const blob = await api.tts.speak({
      text: history[latestAssistantIndex].text,
      provider: replayConfig.provider,
      voice: replayConfig.voice,
      ...(replayConfig.model ? { model: replayConfig.model } : {}),
    })
    console.debug('[replayAudio] TTS blob received, size', blob.size)
    const audioUrl = URL.createObjectURL(blob)
    const nextHistory = history.map((turn, index) =>
      index === latestAssistantIndex ? { ...turn, audioUrl } : turn
    )
    return { history: nextHistory, replayReady: true }
  } catch (error) {
    console.warn('[replayAudio] TTS call failed:', error)
    return { history, replayReady: false }
  }
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
  forceFreshPhoneEntry,
  activeVerifiedPhoneNumber,
  savedVerifiedPhoneNumber,
  isTransientVerifiedPhone,
  verificationCode,
  onVerificationCodeChange,
  savePhoneForFutureUse,
  onSavePhoneForFutureUseChange,
  onRequestPhoneVerification,
  onResendPhoneVerification,
  onVerifyPhoneCode,
  onEditVerifiedPhone,
  showRetakeSavedPhoneChoice,
  onUseSavedPhoneNumber,
  onUseDifferentPhoneNumber,
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
  forceFreshPhoneEntry: boolean
  activeVerifiedPhoneNumber: string | null
  savedVerifiedPhoneNumber: string | null
  isTransientVerifiedPhone: boolean
  verificationCode: string
  onVerificationCodeChange: (value: string) => void
  savePhoneForFutureUse: boolean
  onSavePhoneForFutureUseChange: (value: boolean) => void
  onRequestPhoneVerification: () => void
  onResendPhoneVerification: () => void
  onVerifyPhoneCode: () => void
  onEditVerifiedPhone: () => void
  showRetakeSavedPhoneChoice: boolean
  onUseSavedPhoneNumber: () => void
  onUseDifferentPhoneNumber: () => void
  onStartPhoneCall: () => void
  callLoading: boolean
  callStarted: boolean
  phoneCallRuntime: PhoneCallRuntimeState
}) {
  const pendingPhoneNumber = phoneVerification?.pendingPhoneNumber ?? null
  const showVerificationStep =
    Boolean(pendingPhoneNumber) && editingVerifiedPhone && !forceFreshPhoneEntry
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
    hasVerifiedPhone &&
    sessionStatus !== 'ended' &&
    !callStarted &&
    !editingVerifiedPhone &&
    !showRetakeSavedPhoneChoice
  const startCallHelperText = callStarted
    ? 'A phone call is already in progress.'
    : showRetakeSavedPhoneChoice
      ? 'Choose whether to reuse your saved number or verify a different one.'
      : sessionStatus === 'ended'
        ? 'This session has already ended.'
        : 'Verify the code first to unlock dialing.'

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
              {showRetakeSavedPhoneChoice ? (
                <Paper
                  withBorder
                  radius="xl"
                  p="md"
                  style={{
                    background:
                      'linear-gradient(135deg, color-mix(in srgb, var(--pitch-selected) 14%, transparent) 0%, color-mix(in srgb, var(--pitch-info) 10%, transparent) 100%)',
                    borderColor: 'color-mix(in srgb, var(--pitch-selected) 26%, transparent)',
                  }}
                >
                  <Stack gap="md">
                    <Stack gap={4}>
                      <Text size="xs" fw={700} tt="uppercase" c="var(--pitch-surface-text-dim)">
                        Retake setup
                      </Text>
                      <Text fw={700} size="lg" c="var(--pitch-surface-text)">
                        Which number should we use for this retake?
                      </Text>
                      <Text size="sm" c="var(--pitch-surface-text-dim)">
                        Use your already verified number, or switch to a different number for this
                        attempt.
                      </Text>
                    </Stack>
                    <Group grow>
                      <Button
                        radius="xl"
                        onClick={onUseSavedPhoneNumber}
                        styles={{
                          root: {
                            background:
                              'linear-gradient(90deg, var(--pitch-accent) 0%, var(--pitch-accent-strong) 100%)',
                            boxShadow:
                              '0 16px 28px color-mix(in srgb, var(--pitch-accent-strong) 32%, transparent)',
                          },
                        }}
                      >
                        Use saved phone number
                      </Button>
                      <Button
                        radius="xl"
                        onClick={onUseDifferentPhoneNumber}
                        styles={{
                          root: {
                            background:
                              'linear-gradient(90deg, color-mix(in srgb, var(--pitch-selected) 24%, var(--pitch-surface-bg)) 0%, color-mix(in srgb, var(--pitch-accent-soft) 26%, var(--pitch-surface-bg)) 100%)',
                            color: 'var(--pitch-surface-text)',
                            border:
                              '1px solid color-mix(in srgb, var(--pitch-selected) 42%, transparent)',
                            boxShadow:
                              '0 12px 24px color-mix(in srgb, var(--pitch-selected) 18%, transparent), inset 0 1px 0 color-mix(in srgb, var(--pitch-surface-text) 8%, transparent)',
                          },
                        }}
                      >
                        Use a different number
                      </Button>
                    </Group>
                  </Stack>
                </Paper>
              ) : activeVerifiedPhoneNumber && !editingVerifiedPhone ? (
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

          {!showRetakeSavedPhoneChoice && (
            <>
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
                  {startCallHelperText}
                </Text>
              )}
            </>
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
  const params = useParams()
  const searchParams = useSearchParams()
  const sessionId = params.id as string
  const router = useRouter()
  const entrySource = searchParams.get('entry')
  const isMobile = useMediaQuery('(max-width: 768px)')
  const invalidateCoinsBalance = useInvalidateCoinsBalance()
  const userSettings = useAuthStore((state) => state.user?.settings)
  const configuredVoiceSendDelayMs =
    isRecord(userSettings) &&
    isRecord(userSettings.voiceVideo) &&
    typeof userSettings.voiceVideo.speechSendDelayMs === 'number'
      ? userSettings.voiceVideo.speechSendDelayMs
      : undefined
  const [time, setTime] = useState(0)
  const [sessionStartMs, setSessionStartMs] = useState<number | null>(null)
  const [sessionEndMs, setSessionEndMs] = useState<number | null>(null)
  const [sessionDuration, setSessionDuration] = useState(0) // total seconds; 0 = no limit
  const [successModalOpen, setSuccessModalOpen] = useState(false)
  const [finalScore, setFinalScore] = useState<number | null>(null)
  const [timeAtSuccess, setTimeAtSuccess] = useState<number | null>(null)
  const successTriggeredRef = useRef(false)
  const [textInput, setTextInput] = useState('')
  const [hints, setHints] = useState<string[]>([])
  const [timelineStages, setTimelineStages] = useState<TimelineStage[]>([])
  const [currentProgress, setCurrentProgress] = useState(0)
  const [hintsError, setHintsError] = useState<string | null>(null)
  const [timelineError, setTimelineError] = useState<string | null>(null)
  const [timelineLoading, setTimelineLoading] = useState(false)
  const [sessionType, setSessionType] = useState<SessionType | null>(null)
  const [sessionStatus, setSessionStatus] = useState<string | null>(null)
  const [sessionName, setSessionName] = useState<string>('')
  const [personaName, setPersonaName] = useState<string | null>(null)
  const [personaAvatarImageUrl, setPersonaAvatarImageUrl] = useState<string | null>(null)
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
  const [forceFreshPhoneEntry, setForceFreshPhoneEntry] = useState(false)
  const [phoneSetupRetakeMode, setPhoneSetupRetakeMode] = useState(entrySource === 'retake')
  const [phoneRetakeChoice, setPhoneRetakeChoice] = useState<PhoneRetakeChoice>('saved')
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
  const [conversationConnectKey, setConversationConnectKey] = useState(0)
  const [resumePromptOpen, setResumePromptOpen] = useState(false)
  const [entryPromptMode, setEntryPromptMode] = useState<EntryPromptMode | null>(null)
  const [entryDecisionLoading, setEntryDecisionLoading] = useState(true)
  const [startOverLoading, setStartOverLoading] = useState(false)
  const [loadedSessionRecord, setLoadedSessionRecord] = useState<Record<string, unknown> | null>(
    null
  )
  // Keep a ref always in sync with loadedSessionRecord so useCallback functions
  // (like loadTimeline) can read the latest value without listing it as a dep.
  // Updated every render — always current when async code reads it.
  const loadedSessionRecordRef = useRef<Record<string, unknown> | null>(null)
  loadedSessionRecordRef.current = loadedSessionRecord
  const presenterTone = useMemo(() => readPresenterTone(loadedSessionRecord), [loadedSessionRecord])
  const [sessionAttachments, setSessionAttachments] = useState<SessionAttachment[]>([])
  const [sessionSettingsOpen, setSessionSettingsOpen] = useState(false)
  const [launchAttachments, setLaunchAttachments] = useState<SessionAttachment[]>([])
  const [launchAttachmentsUploading, setLaunchAttachmentsUploading] = useState(false)
  const [launchAttachmentErrors, setLaunchAttachmentErrors] = useState(false)
  const [prelaunchModalOpen, setPrelaunchModalOpen] = useState(false)
  const [prelaunchSaving, setPrelaunchSaving] = useState(false)
  const [pendingEntryMode, setPendingEntryMode] = useState<EntryFlowMode | null>(null)
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestMessagesRef = useRef<Array<{ role: 'user' | 'assistant'; text: string }>>([])
  const hintsRequestSeqRef = useRef(0)
  const coachHelpPromptSeqRef = useRef(0)
  const timeoutEndTriggeredRef = useRef(false)
  const [isMultiTurn, setIsMultiTurn] = useState(false)
  const [coachStarter, setCoachStarter] = useState<CoachStarterPrompt | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const lastAssistantMessageIdRef = useRef<string | null>(null)
  // Hidden pose camera feed used by MediaPipe across session types.
  const poseVideoRef = useRef<HTMLVideoElement | null>(null)
  // Visible PiP camera feed shown in the Zoom-like video layout.
  const userPipVideoRef = useRef<HTMLVideoElement | null>(null)
  const poseCameraStreamRef = useRef<MediaStream | null>(null)
  const [visualEnabled, setVisualEnabled] = useState(true)
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
    disconnect,
    stopAudio,
    replayAudio,
    clearMessages,
    hydrateMessages,
    clearHangupRequest,
    clearToolEvents,
    toolEvents,
    coachingTip,
    clearCoachingTip,
    audioElementRef,
  } = useConversation({
    sessionId,
    autoConnect: autoConnectConversation,
    autoConnectKey: conversationConnectKey,
    audioOutput: 'browser',
    onError: () => {},
  })
  const assistantSpeaking = isAudioPlaying
  const currentIterationId = readCurrentIterationId(loadedSessionRecord)

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
  })

  const handleCommittedVoiceTurn = useCallback(
    (text: string) => {
      if (sessionStatus === 'ended') {
        return
      }

      sendMessage(text)
      scheduleIdleHints()
    },
    [scheduleIdleHints, sendMessage, sessionStatus]
  )

  const {
    phase: voiceTurnPhase,
    interimDisplayTranscript,
    pendingTranscript,
    sttCommitRemainingMs,
    sttCommitProgress,
    handleMicrophoneClick,
    resetController: resetVoiceTurnController,
  } = useVoiceTurnController({
    enabled: sessionType === 'voice' || sessionType === 'video',
    sessionStatus,
    sessionName,
    personaName,
    isConnected,
    isConnecting,
    isProcessing,
    assistantSpeaking,
    isListening,
    isSttSupported,
    isSttPermissionBlocked,
    microphonePermission,
    transcript,
    interimTranscript,
    messages,
    entryDecisionLoading,
    resumePromptOpen,
    prelaunchModalOpen,
    postSilenceSendDelayMs: configuredVoiceSendDelayMs,
    startAssistantTurn,
    onCommitUserTurn: handleCommittedVoiceTurn,
    interrupt,
    stopAudio,
    requestMicrophoneAccess,
    startListening,
    stopListening,
    resetTranscript,
  })

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

  const syncSessionClock = useCallback(
    (session: unknown, history: TranscriptMessage[] = []) => {
      const nextSessionStartMs = resolveSessionStartMs(sessionId, session, history)
      const nextSessionEndMs = readSessionEndedAtMs(session)
      const iterationId = readCurrentIterationId(session)

      if (nextSessionStartMs !== null) {
        setSessionStartMs(nextSessionStartMs)
        writePersistedSessionStartMs(sessionId, iterationId, nextSessionStartMs)
      } else {
        setSessionStartMs(null)
      }

      setSessionEndMs(nextSessionEndMs)
    },
    [sessionId]
  )

  const ensureSessionClockStarted = useCallback(
    (startedAtMs = Date.now()) => {
      const iterationId = readCurrentIterationId(loadedSessionRecordRef.current)
      setSessionStartMs((current) => {
        if (current !== null) {
          return current
        }

        writePersistedSessionStartMs(sessionId, iterationId, startedAtMs)
        return startedAtMs
      })
      setSessionEndMs(null)
    },
    [sessionId]
  )

  const resetSessionClock = useCallback(() => {
    const iterationId = readCurrentIterationId(loadedSessionRecordRef.current)
    setSessionStartMs(null)
    setSessionEndMs(null)
    clearPersistedSessionStartMs(sessionId, iterationId)
  }, [sessionId])

  const syncSessionState = useCallback(
    (session: any, history: TranscriptMessage[] = []) => {
      const config = (session?.sessionConfig as Record<string, any>) ?? {}
      const avatarState = readAvatarVideoState(session)
      const videoPresenter = readVideoPresenter(session)
      const phoneRuntime = readPhoneCallRuntime(session)
      const normalizedStatus = normalizeSessionStatus(session)
      const nextAvatarVideoUrl =
        session?.id && avatarState.status === 'ready' && avatarState.playbackToken
          ? buildSessionVideoStreamUrl(session.id, avatarState.playbackToken, avatarState.jobId)
          : avatarState.url
      const rawDuration =
        typeof config.durationMinutes === 'number'
          ? config.durationMinutes
          : typeof config.duration === 'number'
            ? config.duration
            : 0

      if (rawDuration > 0) {
        setSessionDuration(rawDuration * 60)
      }

      setIsMultiTurn(Boolean(config.multiTurnEnabled))
      setSessionType(session?.type ?? null)
      setSessionStatus(normalizedStatus)
      setSessionName((session as any)?.name ?? (session as any)?.scenario?.name ?? '')
      setPersonaName((session as any)?.persona?.name ?? videoPresenter.name ?? null)
      setPersonaAvatarImageUrl(
        (session as any)?.persona?.traits?.avatar?.imageUrl ?? videoPresenter.avatarImageUrl ?? null
      )
      setAvatarVideoStatus(avatarState.status)
      setAvatarVideoProvider(avatarState.provider)
      setAvatarVideoError(avatarState.error)
      setAvatarVideoJobId(avatarState.jobId)
      setAvatarVideoUrl(nextAvatarVideoUrl)
      setPhoneCallRuntime(phoneRuntime)
      setCallStarted(session?.type === 'phone' ? isPhoneCallActive(phoneRuntime) : false)
      syncSessionClock(session, history)
    },
    [syncSessionClock]
  )

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
        setForceFreshPhoneEntry(false)
        setPhoneNumber(status.phoneNumber)
      } else if (status.pendingPhoneNumber) {
        setEditingVerifiedPhone(true)
        setForceFreshPhoneEntry(false)
        setPhoneNumber(status.pendingPhoneNumber)
      } else {
        setEditingVerifiedPhone(false)
        setForceFreshPhoneEntry(false)
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

  const loadTimeline = useCallback(
    async (limit = 50, sessionRecord?: Record<string, unknown> | null) => {
      if (!sessionId) {
        return { totalTurns: 0, stages: [] as TimelineStage[] }
      }

      setTimelineLoading(true)

      try {
        const response = await api.sessions.timeline(sessionId, limit)
        const stages = buildTimelineStages(
          response?.plannedStages,
          response?.currentProgress,
          response?.total,
          sessionRecord ?? loadedSessionRecordRef.current
        )

        setTimelineStages(stages)
        setTimelineError(null)

        return {
          totalTurns: typeof response?.total === 'number' ? response.total : 0,
          stages,
          conversationHistory: Array.isArray(response?.conversationHistory)
            ? response.conversationHistory
            : [],
        }
      } catch {
        const stages = buildTimelineStages(
          [],
          0,
          0,
          sessionRecord ?? loadedSessionRecordRef.current
        )
        setTimelineStages(stages)
        setTimelineError('Unable to load timeline')
        return {
          totalTurns: 0,
          stages,
          conversationHistory: [],
        }
      } finally {
        setTimelineLoading(false)
      }
    },
    [sessionId]
  )

  const requestConversationConnect = useCallback(() => {
    ensureSessionClockStarted()
    setAutoConnectConversation(true)
    setConversationConnectKey((current) => current + 1)
  }, [ensureSessionClockStarted])

  const pauseConversationConnect = useCallback(() => {
    setAutoConnectConversation(false)
  }, [])

  const completeEntryFlow = useCallback(
    (mode: EntryFlowMode, sessionRecord?: Record<string, unknown> | null) => {
      const effectiveRecord = sessionRecord ?? loadedSessionRecord
      const effectiveType =
        typeof effectiveRecord?.type === 'string' ? effectiveRecord.type : sessionType
      const effectiveStatus = normalizeSessionStatus(effectiveRecord) ?? sessionStatus

      setPrelaunchModalOpen(false)
      setPendingEntryMode(null)
      setPhoneSetupModalOpen(effectiveType === 'phone' && effectiveStatus !== 'ended')

      if (mode === 'resume') {
        setResumePromptOpen(true)
        pauseConversationConnect()
        return
      }

      setResumePromptOpen(false)
      requestConversationConnect()
    },
    [
      loadedSessionRecord,
      pauseConversationConnect,
      requestConversationConnect,
      sessionStatus,
      sessionType,
    ]
  )

  const handleSkipPrelaunch = useCallback(() => {
    if (!pendingEntryMode || launchAttachmentsUploading || prelaunchSaving) {
      return
    }

    setLaunchAttachments([])
    setLaunchAttachmentErrors(false)
    completeEntryFlow(pendingEntryMode)
  }, [completeEntryFlow, launchAttachmentsUploading, pendingEntryMode, prelaunchSaving])

  const handleContinueFromPrelaunch = useCallback(async () => {
    if (
      !pendingEntryMode ||
      !loadedSessionRecord ||
      launchAttachmentsUploading ||
      launchAttachmentErrors ||
      prelaunchSaving
    ) {
      return
    }

    setPrelaunchSaving(true)

    try {
      if (launchAttachments.length > 0) {
        const currentConfig = isRecord(loadedSessionRecord.sessionConfig)
          ? loadedSessionRecord.sessionConfig
          : {}
        const mergedAttachments = mergeSessionAttachments(sessionAttachments, launchAttachments)
        const updatedSession = await api.sessions.update(sessionId, {
          sessionConfig: {
            ...currentConfig,
            attachments: mergedAttachments,
          },
        })
        const updatedRecord = isRecord(updatedSession) ? updatedSession : loadedSessionRecord

        setLoadedSessionRecord(updatedRecord)
        setSessionAttachments(readSessionAttachments(updatedRecord))
        syncSessionState(updatedSession)
        completeEntryFlow(pendingEntryMode, updatedRecord)
        return
      }

      completeEntryFlow(pendingEntryMode)
    } catch (error) {
      notifications.show({
        title: 'Unable to save documents',
        message:
          error instanceof Error ? error.message : 'The session context could not be updated.',
        color: 'red',
      })
    } finally {
      setPrelaunchSaving(false)
    }
  }, [
    completeEntryFlow,
    launchAttachmentErrors,
    launchAttachments,
    launchAttachmentsUploading,
    loadedSessionRecord,
    pendingEntryMode,
    prelaunchSaving,
    sessionAttachments,
    sessionId,
    syncSessionState,
  ])

  useEffect(() => {
    if (sessionStartMs === null) {
      setTime(0)
      return
    }

    const updateElapsedTime = () => {
      const effectiveEndMs = sessionEndMs ?? Date.now()
      const elapsedSeconds = Math.max(0, Math.floor((effectiveEndMs - sessionStartMs) / 1000))
      setTime(elapsedSeconds)
    }

    updateElapsedTime()

    if (sessionEndMs !== null) {
      return
    }

    const interval = setInterval(updateElapsedTime, 1000)
    return () => clearInterval(interval)
  }, [sessionEndMs, sessionStartMs])

  useEffect(() => {
    if (!sessionId) return

    let cancelled = false
    pauseConversationConnect()
    resetVoiceTurnController()
    hydrateMessages([])
    setResumePromptOpen(false)
    setEntryPromptMode(null)
    setEntryDecisionLoading(true)
    setStartOverLoading(false)
    setLoadedSessionRecord(null)
    setSessionAttachments([])
    setLaunchAttachments([])
    setLaunchAttachmentsUploading(false)
    setLaunchAttachmentErrors(false)
    setPrelaunchModalOpen(false)
    setPrelaunchSaving(false)
    setPendingEntryMode(null)
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
    setForceFreshPhoneEntry(false)
    setPhoneSetupRetakeMode(entrySource === 'retake')
    setPhoneRetakeChoice(entrySource === 'retake' ? 'undecided' : 'saved')
    setPhoneCallRuntime(EMPTY_PHONE_CALL_RUNTIME)
    setPhoneTranscriptMessages([])
    setPhoneTranscriptError(null)
    setPhoneNumber('')
    setSessionStartMs(null)
    setSessionEndMs(null)

    const loadSession = async () => {
      try {
        const session = await api.sessions.getById(sessionId)
        if (cancelled) return

        let effectiveSession = session
        let effectiveSessionRecord = isRecord(session) ? session : {}
        let effectiveStatus = normalizeSessionStatus(session)
        let isPhoneSession = effectiveSessionRecord.type === 'phone'
        let effectivePersistedSessionStartMs = readPersistedSessionStartMs(
          sessionId,
          readCurrentIterationId(effectiveSessionRecord)
        )

        setLoadedSessionRecord(effectiveSessionRecord)
        setSessionAttachments(readSessionAttachments(effectiveSessionRecord))

        if (effectiveStatus === 'ended') {
          try {
            const restartedSession = await api.sessions.restart(sessionId, {
              reason: 'restart_from_scratch',
            })
            if (cancelled) return

            effectiveSession = restartedSession
            effectiveSessionRecord = isRecord(restartedSession) ? restartedSession : {}
            effectiveStatus = normalizeSessionStatus(restartedSession)
            isPhoneSession = effectiveSessionRecord.type === 'phone'
            effectivePersistedSessionStartMs = null

            clearPersistedSessionStartMs(sessionId, readCurrentIterationId(session))
            setSessionStartMs(null)
            setSessionEndMs(null)
            setLoadedSessionRecord(effectiveSessionRecord)
            setSessionAttachments(readSessionAttachments(effectiveSessionRecord))
            setResumePromptOpen(false)
            setEntryPromptMode(null)

            if (isPhoneSession) {
              setPhoneSetupRetakeMode(true)
              setPhoneRetakeChoice('undecided')
            }
          } catch {
            if (cancelled) return
            syncSessionState(session)
            setEntryPromptMode('retake')
            setResumePromptOpen(true)
            setAutoConnectConversation(false)
            return
          }
        }

        if (effectiveStatus === 'ended') {
          syncSessionState(effectiveSession)
          setEntryPromptMode('retake')
          setResumePromptOpen(true)
          setAutoConnectConversation(false)
          return
        }

        syncSessionState(effectiveSession)

        if (isPhoneSession) {
          setAutoConnectConversation(false)
          return
        }

        let hasExistingProgress = false
        let timelineHistory: TranscriptMessage[] = []
        try {
          const timeline = await loadTimeline(200, effectiveSessionRecord)
          if (cancelled) return
          const totalTurns = timeline.totalTurns
          const history = Array.isArray(timeline.conversationHistory)
            ? timeline.conversationHistory
            : []
          timelineHistory = readTimelineConversationHistory({
            conversationHistory: history,
          })
          syncSessionState(effectiveSession, timelineHistory)
          hasExistingProgress = totalTurns > 0 || history.length > 0
        } catch {
          hasExistingProgress = false
        }

        if (cancelled) return

        const shouldAutoResume =
          hasExistingProgress ||
          effectivePersistedSessionStartMs !== null ||
          timelineHistory.length > 0

        console.debug('[replayAudio] shouldAutoResume', shouldAutoResume, {
          hasExistingProgress,
          timerMs: effectivePersistedSessionStartMs,
          historyLen: timelineHistory.length,
          sessionType: effectiveSessionRecord.type,
        })

        let replayReady = false
        if (shouldAutoResume) {
          const replayHydration = await attachReplayAudioToLatestAssistantMessage(
            timelineHistory,
            effectiveSessionRecord
          )
          if (cancelled) return
          timelineHistory = replayHydration.history
          replayReady = replayHydration.replayReady
        }

        console.debug(
          '[replayAudio] replayReady',
          replayReady,
          '→ autoPlayLatestAudio',
          shouldAutoResume && replayReady
        )

        hydrateMessages(timelineHistory, {
          autoPlayLatestAudio: shouldAutoResume && replayReady,
        })

        if (shouldAutoResume) {
          setEntryPromptMode(null)
          setResumePromptOpen(false)
          requestConversationConnect()
        } else {
          setPendingEntryMode('auto')
          setPrelaunchModalOpen(true)
          setEntryPromptMode(null)
        }
      } catch {
        if (cancelled) return
        setIsMultiTurn(false)
        setEntryPromptMode(null)
        requestConversationConnect()
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
  }, [
    entrySource,
    hydrateMessages,
    loadTimeline,
    pauseConversationConnect,
    resetVoiceTurnController,
    requestConversationConnect,
    sessionId,
    syncSessionState,
  ])

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

  const handleStartOver = useCallback(async () => {
    if (!loadedSessionRecord || startOverLoading) return

    setStartOverLoading(true)
    try {
      await interrupt()
      disconnect()
      stopAudio()

      const restartedSession = await api.sessions.restart(sessionId, {
        reason: 'restart_from_scratch',
      })
      const restartedRecord = isRecord(restartedSession) ? restartedSession : {}

      resetSessionClock()
      clearMessages()
      hydrateMessages([])
      clearToolEvents()
      clearCoachingTip()
      clearHangupRequest()
      successTriggeredRef.current = false
      setFinalScore(null)
      setTimeAtSuccess(null)
      setTime(0)
      setTextInput('')
      setHints([])
      setHintsError(null)
      setTimelineStages([])
      setTimelineError(null)
      setPhoneTranscriptMessages([])
      setPhoneTranscriptError(null)
      setCallStarted(false)
      setCallError(null)
      setForceFreshPhoneEntry(false)
      resetVoiceTurnController()

      setLoadedSessionRecord(restartedRecord)
      syncSessionState(restartedSession)
      setEntryPromptMode(null)

      if (timelineEnabled) {
        await loadTimeline(50, restartedRecord)
      }

      notifications.show({
        title: 'Started a new iteration',
        message: 'You are now in a fresh iteration of this session.',
        color: 'green',
      })
      setResumePromptOpen(false)
      if (restartedRecord.type === 'phone') {
        setPhoneSetupRetakeMode(true)
        setPhoneRetakeChoice('undecided')
        setAutoConnectConversation(false)
      } else {
        setPhoneSetupRetakeMode(false)
        setPhoneRetakeChoice('saved')
        requestConversationConnect()
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
    clearCoachingTip,
    clearToolEvents,
    disconnect,
    interrupt,
    loadedSessionRecord,
    requestConversationConnect,
    resetVoiceTurnController,
    resetSessionClock,
    sessionId,
    startOverLoading,
    stopAudio,
    syncSessionState,
    loadTimeline,
    timelineEnabled,
    hydrateMessages,
  ])

  const handleResumeSession = useCallback(() => {
    if (normalizeSessionStatus(loadedSessionRecord) === 'ended') {
      void handleStartOver()
      return
    }

    setResumePromptOpen(false)
    setEntryPromptMode(null)
    if (sessionType !== 'phone') {
      requestConversationConnect()
    }
  }, [handleStartOver, loadedSessionRecord, requestConversationConnect, sessionType])

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
      setForceFreshPhoneEntry(false)
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
      setForceFreshPhoneEntry(false)
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
      setForceFreshPhoneEntry(false)
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
      setPhoneSetupRetakeMode(false)
      setPhoneRetakeChoice('saved')
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
    setForceFreshPhoneEntry(true)
    setPhoneRetakeChoice('different')
    setVerificationCode('')
    setCallError(null)
    setSavePhoneForFutureUse(true)
    setTransientVerifiedPhoneNumber(null)
    setPhoneNumber('')
  }

  const handleClosePhoneSetupModal = () => {
    setPhoneSetupModalOpen(false)
    setCallError(null)
    setVerificationCode('')
    if (phoneVerification?.verified && phoneVerification.phoneNumber) {
      setPhoneNumber(phoneVerification.phoneNumber)
      setEditingVerifiedPhone(false)
      setForceFreshPhoneEntry(false)
    }
  }

  const handleUseSavedPhoneNumber = () => {
    const savedPhoneNumber = phoneVerification?.verified
      ? (phoneVerification.phoneNumber ?? null)
      : null
    setPhoneRetakeChoice('saved')
    setEditingVerifiedPhone(false)
    setForceFreshPhoneEntry(false)
    setVerificationCode('')
    setCallError(null)
    if (savedPhoneNumber) {
      setPhoneNumber(savedPhoneNumber)
    }
  }

  const handleUseDifferentPhoneNumber = () => {
    setPhoneRetakeChoice('different')
    setEditingVerifiedPhone(true)
    setForceFreshPhoneEntry(true)
    setVerificationCode('')
    setCallError(null)
    setSavePhoneForFutureUse(true)
    setTransientVerifiedPhoneNumber(null)
    setPhoneNumber('')
  }

  const savedVerifiedPhoneNumber =
    phoneVerification?.verified && phoneVerification.phoneNumber
      ? phoneVerification.phoneNumber
      : null
  const activeVerifiedPhoneNumber =
    transientVerifiedPhoneNumber ?? phoneVerification?.phoneNumber ?? null
  const isTransientVerifiedPhone = Boolean(
    transientVerifiedPhoneNumber && transientVerifiedPhoneNumber !== phoneVerification?.phoneNumber
  )
  const showRetakeSavedPhoneChoice = Boolean(
    phoneSetupRetakeMode &&
      savedVerifiedPhoneNumber &&
      phoneRetakeChoice === 'undecided' &&
      !forceFreshPhoneEntry
  )

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handleSendText = () => {
    if (sessionStatus === 'ended') return
    if (textInput.trim() && isConnected) {
      resetVoiceTurnController()
      sendMessage(textInput.trim())
      setTextInput('')
      scheduleIdleHints()
    }
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

  const handleTurnHelp = useCallback(
    (turn: TranscriptMessage) => {
      const trimmedTurnText = turn.text.trim()
      if (!trimmedTurnText) {
        return
      }

      const isAssistantTurn = turn.role === 'assistant'

      const recentWindow = activeConversationMessages
        .slice(-6)
        .map((message) => `${message.role === 'assistant' ? 'AI' : 'Me'}: ${message.text.trim()}`)
        .filter((line) => line.length > 0)
        .join('\n')

      const promptParts = [
        isAssistantTurn
          ? 'Help me answer this simulation turn clearly and persuasively.'
          : 'Help me improve and follow up on this simulation turn clearly and persuasively.',
        `${isAssistantTurn ? 'AI turn' : 'My last turn'}: "${trimmedTurnText}"`,
        'Give me:',
        '1) one short response I can say right now,',
        '2) one stronger response with concrete detail,',
        '3) one follow-up question I can ask back.',
        recentWindow ? `Recent turns:\n${recentWindow}` : '',
      ]

      const keySuffix = ++coachHelpPromptSeqRef.current
      setCoachStarter({
        key: `turn-help:${turn.id}:${keySuffix}`,
        message: promptParts.filter(Boolean).join('\n\n'),
        open: true,
        hidden: true,
      })
    },
    [activeConversationMessages]
  )

  useEffect(() => {
    latestMessagesRef.current = activeConversationMessages.map((msg) => ({
      role: msg.role,
      text: msg.text,
    }))
  }, [activeConversationMessages])

  useEffect(() => {
    if (!sessionId || !hintsEnabled || !currentIterationId) {
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
        const response = await api.hints.history(sessionId, 1, undefined, currentIterationId)
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
  }, [currentIterationId, hintsEnabled, scheduleIdleHints, sessionId])

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
      setTimelineError(null)
      return
    }
    if (sessionType === 'phone') return

    void loadTimeline(50)
  }, [loadTimeline, sessionId, timelineEnabled, sessionType])

  useEffect(() => {
    return () => {
      hintsRequestSeqRef.current += 1
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current)
      }
      resetVoiceTurnController()
      poseCameraStreamRef.current?.getTracks().forEach((t) => t.stop())
      poseCameraStreamRef.current = null
    }
  }, [resetVoiceTurnController])

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
        const history = readTimelineConversationHistory(timeline)
        syncSessionState(session, history)
        setPhoneTranscriptMessages(history)
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
      void loadTimeline(50)
    }
  }, [loadTimeline, messages.length, sessionId, timelineEnabled, sessionType])

  const performHangUp = useCallback(
    async (options?: { reason?: string; forcePerformanceRoute?: boolean }) => {
      const endReason = options?.reason ?? (sessionType === 'phone' ? 'hangup' : 'user_hangup')
      const forcePerformanceRoute = options?.forcePerformanceRoute ?? false

      resetVoiceTurnController()

      try {
        if (sessionType === 'phone' && phoneCallRuntime.callId) {
          try {
            await api.phoneCalls.end({
              sessionId,
              reason: endReason,
            })
          } catch (err) {
            const message = err instanceof Error ? err.message : ''
            if (!message.includes('No active phone call is registered')) {
              throw err
            }
          }
        }

        const hasConversation = activeConversationMessages.length > 0
        const sessionAlreadyEnded = normalizeSessionStatus(loadedSessionRecord) === 'ended'

        if (!sessionAlreadyEnded && (hasConversation || sessionType === 'phone')) {
          const endedSession = await api.sessions.end(sessionId, {
            reason: endReason,
          })
          invalidateCoinsBalance()
          const endedRecord = isRecord(endedSession) ? endedSession : loadedSessionRecord
          setLoadedSessionRecord(endedRecord)
          syncSessionState(endedRecord)
        } else if (sessionType === 'phone') {
          setSessionStatus('ended')
          setCallStarted(false)
        }

        hangUp()
        if (forcePerformanceRoute || hasConversation || sessionType === 'phone') {
          router.push(`/session/${sessionId}/performance`)
        } else {
          window.history.back()
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Unable to finish or hang up the session.'
        notifications.show({
          title: 'Hang up failed',
          message,
          color: 'red',
        })
        console.warn('Failed to hang up session', err)
      }
    },
    [
      hangUp,
      invalidateCoinsBalance,
      activeConversationMessages.length,
      loadedSessionRecord,
      phoneCallRuntime.callId,
      resetVoiceTurnController,
      router,
      sessionId,
      sessionType,
      syncSessionState,
    ]
  )

  const handleHangUp = useCallback(async () => {
    await performHangUp()
  }, [performHangUp])

  useEffect(() => {
    const hasDurationLimit = sessionDuration > 0
    const isExpired = hasDurationLimit && time >= sessionDuration
    const canAutoEnd =
      !entryDecisionLoading && !prelaunchModalOpen && !resumePromptOpen && sessionStatus !== 'ended'

    if (!isExpired || !canAutoEnd) {
      if (!isExpired) {
        timeoutEndTriggeredRef.current = false
      }
      return
    }

    if (timeoutEndTriggeredRef.current) {
      return
    }

    timeoutEndTriggeredRef.current = true
    void performHangUp({
      reason: 'timeout',
      forcePerformanceRoute: true,
    })
  }, [
    entryDecisionLoading,
    performHangUp,
    prelaunchModalOpen,
    resumePromptOpen,
    sessionDuration,
    sessionStatus,
    time,
  ])

  useEffect(() => {
    if (sessionType === 'phone' && sessionStatus === 'ended' && entryPromptMode !== 'retake') {
      router.push(`/session/${sessionId}/performance`)
    }
  }, [entryPromptMode, sessionType, sessionStatus, sessionId, router])

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
  const hasUserTurnInCurrentIteration = activeConversationMessages.some(
    (message) => message.role === 'user'
  )
  const latestMoodEvent = toolEvents.findLast((e) => e.tool === 'update_mood')
  const currentMood =
    hasUserTurnInCurrentIteration && latestMoodEvent ? (latestMoodEvent.args.mood as string) : null
  const currentEmotion =
    hasUserTurnInCurrentIteration && latestMoodEvent
      ? (latestMoodEvent.args.emotion as string | undefined)
      : undefined
  const presenterIsFrustrated = currentMood === 'frustrated' || currentEmotion === 'frustrated'
  const moodDotColor =
    currentMood === 'interested' || currentMood === 'satisfied'
      ? 'green'
      : currentMood === 'skeptical'
        ? 'orange'
        : currentMood === 'impatient' || currentMood === 'frustrated'
          ? 'red'
          : 'gray'

  const latestPersuasionEvent = toolEvents.findLast((e) => e.tool === 'update_persuasion_score')
  const currentPersuasionScore =
    hasUserTurnInCurrentIteration && latestPersuasionEvent
      ? Math.min(100, Math.max(0, Number(latestPersuasionEvent.args.score)))
      : null
  const persuasionReasoning =
    hasUserTurnInCurrentIteration && latestPersuasionEvent
      ? (latestPersuasionEvent.args.reasoning as string)
      : null

  const EMOTION_EMOJI: Record<string, string> = {
    neutral: '😐',
    happy: '😊',
    excited: '🤩',
    curious: '🤔',
    surprised: '😮',
    confused: '😕',
    skeptical: '🤨',
    nervous: '😰',
    bored: '😒',
    frustrated: '😤',
    angry: '😠',
    sad: '😔',
    impressed: '🌟',
  }

  const renderTimelineContent = () => {
    const completedCount = timelineStages.filter((s) => s.completed).length

    return (
      <Stack gap={0}>
        {/* Status line */}
        {timelineLoading ? (
          <Loader size="xs" color="dimmed" mb="md" />
        ) : timelineError ? (
          <Text size="xs" c="red.4" mb="md">
            {timelineError}
          </Text>
        ) : !timelineLoading && timelineStages.length === 0 ? (
          <Text size="xs" c="dimmed" mb="md">
            No plan available yet.
          </Text>
        ) : timelineStages.length > 0 ? (
          <Text size="xs" c="dimmed" mb="lg">
            {completedCount} of {timelineStages.length} completed
          </Text>
        ) : null}

        {/* Timeline */}
        {timelineStages.map((stage, index) => {
          const isFirst = index === 0
          const isLast = index === timelineStages.length - 1
          const prevCompleted = index > 0 && timelineStages[index - 1].completed

          // Spine segment colors
          const topColor = isFirst
            ? 'transparent'
            : prevCompleted
              ? '#4f83cc'
              : 'rgba(255,255,255,0.1)'
          const bottomColor = isLast
            ? 'transparent'
            : stage.completed
              ? '#4f83cc'
              : 'rgba(255,255,255,0.1)'

          // Node appearance
          const nodeSize = stage.active ? 22 : stage.completed ? 18 : 12
          const nodeOffset = (22 - nodeSize) / 2 // keeps spine centered

          return (
            <Box key={`${stage.order}-${stage.label}`} style={{ display: 'flex', gap: 14 }}>
              {/* ── Spine column ── */}
              <Box
                style={{
                  width: 22,
                  flexShrink: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                }}
              >
                {/* top segment */}
                <Box
                  style={{
                    width: 2,
                    height: isFirst ? 12 : 16,
                    background: topColor,
                    borderRadius: 1,
                    flexShrink: 0,
                  }}
                />

                {/* node */}
                <Box
                  style={{
                    position: 'relative',
                    flexShrink: 0,
                    marginLeft: nodeOffset,
                    marginRight: nodeOffset,
                  }}
                >
                  {/* active glow ring */}
                  {stage.active ? (
                    <Box
                      style={{
                        position: 'absolute',
                        inset: -5,
                        borderRadius: '50%',
                        border: '1.5px solid rgba(79,131,204,0.35)',
                        animation: 'pulse 2s infinite',
                      }}
                    />
                  ) : null}

                  <Box
                    style={{
                      width: nodeSize,
                      height: nodeSize,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      // completed: solid green fill
                      // active: solid blue fill
                      // pending: dim outline only
                      background: stage.completed
                        ? '#22c55e'
                        : stage.active
                          ? '#4f83cc'
                          : 'transparent',
                      border: stage.completed
                        ? 'none'
                        : stage.active
                          ? 'none'
                          : '1.5px solid rgba(255,255,255,0.2)',
                    }}
                  >
                    {stage.completed ? <IconCheck size={10} color="white" strokeWidth={3} /> : null}
                  </Box>
                </Box>

                {/* bottom segment */}
                <Box
                  style={{
                    width: 2,
                    flex: 1,
                    minHeight: isLast ? 12 : 24,
                    background: bottomColor,
                    borderRadius: 1,
                    flexShrink: 0,
                  }}
                />
              </Box>

              {/* ── Content column ── */}
              <Box
                style={{
                  flex: 1,
                  minWidth: 0,
                  paddingTop: isFirst ? 4 : 8,
                  paddingBottom: isLast ? 4 : 8,
                }}
              >
                <Group justify="space-between" align="flex-start" wrap="nowrap" gap={6}>
                  <Text
                    size="sm"
                    fw={stage.active ? 600 : 400}
                    c={
                      stage.completed
                        ? 'rgba(255,255,255,0.3)'
                        : stage.active
                          ? 'white'
                          : 'rgba(255,255,255,0.4)'
                    }
                    style={{ lineHeight: 1.35 }}
                  >
                    {stage.label}
                  </Text>
                  {stage.estimatedDuration && !stage.completed ? (
                    <Text
                      size="xs"
                      c="rgba(255,255,255,0.2)"
                      style={{ flexShrink: 0, lineHeight: 1.4, marginTop: 1 }}
                    >
                      {stage.estimatedDuration}m
                    </Text>
                  ) : null}
                </Group>
                {stage.active && stage.description ? (
                  <Text size="xs" c="dimmed" mt={4} style={{ lineHeight: 1.55 }}>
                    {stage.description}
                  </Text>
                ) : null}
              </Box>
            </Box>
          )
        })}
      </Stack>
    )
  }

  const persuasionColor =
    currentPersuasionScore === null
      ? 'gray'
      : currentPersuasionScore >= 70
        ? 'green'
        : currentPersuasionScore >= 40
          ? 'yellow'
          : 'red'

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

  // Detect persuasion = 100 → compute score + show success modal
  useEffect(() => {
    if (currentPersuasionScore === null || currentPersuasionScore < 100) return
    if (successTriggeredRef.current) return
    successTriggeredRef.current = true

    const elapsed = time
    const total = sessionDuration > 0 ? sessionDuration : 600 // fallback 10 min
    const timeRemaining = Math.max(0, total - elapsed)
    const speedRatio = timeRemaining / total
    const score = Math.round(65 + speedRatio * 35)

    setTimeAtSuccess(elapsed)
    setFinalScore(score)
    setSuccessModalOpen(true)
    stopAudio()
  }, [currentPersuasionScore, time, sessionDuration, stopAudio])

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
        opened={prelaunchModalOpen}
        onClose={() => {}}
        title="Add documents before you start"
        centered
        size="lg"
        withCloseButton={false}
        closeOnClickOutside={false}
        closeOnEscape={false}
        zIndex={1100000}
        overlayProps={{ backgroundOpacity: 0.8, blur: 12 }}
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            Would you like to upload documents into this session&apos;s context before the
            simulation begins? These files stay attached to the session so you can launch with the
            right background material.
          </Text>

          {sessionAttachments.length > 0 ? (
            <Stack gap="xs">
              <Text size="sm" fw={600}>
                Already attached
              </Text>
              <Group gap="xs">
                {sessionAttachments.map((attachment) => (
                  <Badge
                    key={`${attachment.bucket}:${attachment.key}`}
                    variant="light"
                    color="blue"
                  >
                    {attachment.filename}
                  </Badge>
                ))}
              </Group>
            </Stack>
          ) : null}

          <UploadSection
            sessionDraftId={sessionId}
            onAttachmentsChange={setLaunchAttachments}
            onUploadingChange={setLaunchAttachmentsUploading}
            onHasErrorsChange={setLaunchAttachmentErrors}
          />

          <Group justify="flex-end">
            <Button
              variant="default"
              onClick={handleSkipPrelaunch}
              disabled={launchAttachmentsUploading || prelaunchSaving}
            >
              Skip for now
            </Button>
            <Button
              onClick={() => void handleContinueFromPrelaunch()}
              loading={prelaunchSaving}
              disabled={launchAttachmentsUploading || launchAttachmentErrors}
            >
              Continue
            </Button>
          </Group>
        </Stack>
      </Modal>

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
          forceFreshPhoneEntry={forceFreshPhoneEntry}
          activeVerifiedPhoneNumber={activeVerifiedPhoneNumber}
          savedVerifiedPhoneNumber={savedVerifiedPhoneNumber}
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
          showRetakeSavedPhoneChoice={showRetakeSavedPhoneChoice}
          onUseSavedPhoneNumber={handleUseSavedPhoneNumber}
          onUseDifferentPhoneNumber={handleUseDifferentPhoneNumber}
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

      {/* ── Success Modal ───────────────────────────────────────────── */}
      <Modal
        opened={successModalOpen}
        onClose={() => {}}
        withCloseButton={false}
        closeOnClickOutside={false}
        closeOnEscape={false}
        centered
        size="sm"
        radius="lg"
        styles={{
          content: { background: 'var(--mantine-color-dark-7)', overflow: 'hidden' },
        }}
      >
        <Stack align="center" gap="md" py="sm">
          {/* Trophy icon */}
          <ThemeIcon
            size={72}
            radius="xl"
            variant="gradient"
            gradient={{ from: 'yellow.5', to: 'orange.5', deg: 135 }}
          >
            <IconTrophy size={38} />
          </ThemeIcon>

          <Stack gap={4} align="center">
            <Title order={2} ta="center">
              You did it!
            </Title>
            <Text c="dimmed" ta="center" size="sm">
              You successfully convinced the AI
              {personaName ? ` — ${personaName}` : ''}.
            </Text>
          </Stack>

          <Divider w="100%" />

          {/* Score ring */}
          <Stack align="center" gap={6}>
            <RingProgress
              size={120}
              thickness={10}
              roundCaps
              sections={[
                {
                  value: finalScore ?? 0,
                  color:
                    (finalScore ?? 0) >= 90 ? 'green' : (finalScore ?? 0) >= 75 ? 'teal' : 'yellow',
                },
              ]}
              label={
                <Stack gap={0} align="center">
                  <Text fw={800} size="xl" lh={1}>
                    {finalScore ?? 0}
                  </Text>
                  <Text size="xs" c="dimmed">
                    / 100
                  </Text>
                </Stack>
              }
            />
            <Text fw={600} size="md" ta="center">
              {(finalScore ?? 0) >= 95
                ? 'Perfect — lightning fast!'
                : (finalScore ?? 0) >= 85
                  ? 'Excellent — very convincing!'
                  : (finalScore ?? 0) >= 75
                    ? 'Great work!'
                    : 'Good job — you got there!'}
            </Text>
          </Stack>

          {/* Speed bar */}
          {sessionDuration > 0 && timeAtSuccess !== null && (
            <Box w="100%">
              <Group justify="space-between" mb={4}>
                <Text size="xs" c="dimmed">
                  Time used
                </Text>
                <Text size="xs" fw={600}>
                  {formatTime(timeAtSuccess)} / {formatTime(sessionDuration)}
                </Text>
              </Group>
              <Progress
                value={(timeAtSuccess / sessionDuration) * 100}
                color={
                  timeAtSuccess / sessionDuration <= 0.4
                    ? 'green'
                    : timeAtSuccess / sessionDuration <= 0.7
                      ? 'yellow'
                      : 'orange'
                }
                size="sm"
                radius="xl"
              />
            </Box>
          )}

          <Divider w="100%" />

          <Group w="100%" grow>
            <Button
              variant="default"
              leftSection={<IconRefresh size={15} />}
              loading={startOverLoading}
              onClick={() => {
                setSuccessModalOpen(false)
                successTriggeredRef.current = false
                setFinalScore(null)
                setTimeAtSuccess(null)
                void handleStartOver()
              }}
            >
              New Round
            </Button>
            <Button
              variant="gradient"
              gradient={{ from: 'violet', to: 'blue', deg: 135 }}
              leftSection={<IconTrophy size={15} />}
              onClick={() => setSuccessModalOpen(false)}
            >
              Keep Going
            </Button>
          </Group>
        </Stack>
      </Modal>

      <SettingsModal
        opened={sessionSettingsOpen}
        onClose={() => setSessionSettingsOpen(false)}
        initialSection="Voice & Video"
      />

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
                </Group>
              )}
            </Stack>
          </Group>
          <Group gap={isMobile ? 'xs' : 'xl'} wrap="nowrap" style={{ flexShrink: 0 }}>
            <Text
              size={isMobile ? 'md' : 'xl'}
              fw={700}
              c={
                sessionDuration > 0 && time > sessionDuration * 0.85
                  ? 'red'
                  : sessionDuration > 0 && time > sessionDuration * 0.6
                    ? 'orange'
                    : 'white'
              }
            >
              {sessionDuration > 0
                ? formatTime(Math.max(0, sessionDuration - time))
                : formatTime(time)}
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
              {sessionType === 'phone' && sessionStatus !== 'ended' && !callStarted && (
                <Button
                  size="xs"
                  variant="light"
                  color="blue"
                  onClick={() => setPhoneSetupModalOpen(true)}
                >
                  Start call
                </Button>
              )}
              {isMobile && (
                <Button
                  size="xs"
                  variant="light"
                  color="brand"
                  onClick={() => setTimelineEnabled(true)}
                >
                  Timeline
                </Button>
              )}
              <Tooltip label="Audio & video settings">
                <ActionIcon
                  size="lg"
                  variant="subtle"
                  color="white"
                  onClick={() => setSessionSettingsOpen(true)}
                  title="Open voice and video settings"
                >
                  <IconSettings size={20} />
                </ActionIcon>
              </Tooltip>
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
                transcript={interimDisplayTranscript || pendingTranscript}
                interimTranscript={interimDisplayTranscript}
                pendingTranscript={pendingTranscript}
                voiceTurnPhase={voiceTurnPhase}
                sttError={sttError ?? null}
                sttCommitRemainingMs={sttCommitRemainingMs}
                sttCommitProgress={sttCommitProgress}
                textInput={textInput}
                currentAudioUrl={currentAudioUrl}
                audioElementRef={audioElementRef}
                isMobile={!!isMobile}
                activeObjections={activeObjections}
                latestNextStep={latestNextStep}
                onHangUp={handleHangUp}
                onPauseReplay={handlePauseReplay}
                onMicrophoneClick={handleMicrophoneClick}
                onSendText={handleSendText}
                onTextInputChange={setTextInput}
                onScheduleIdleHints={scheduleIdleHints}
                onTurnHelp={handleTurnHelp}
                isVideoSession={isVideoSession}
                avatarVideoUrl={avatarVideoUrl}
                avatarVideoJobId={avatarVideoJobId}
                avatarVideoStatus={avatarVideoStatus}
                avatarVideoProvider={avatarVideoProvider}
                avatarVideoError={avatarVideoError}
                personaAvatarImageUrl={personaAvatarImageUrl}
                presenterTone={presenterTone}
                presenterIsFrustrated={presenterIsFrustrated}
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

      <Modal
        opened={Boolean(isMobile && timelineEnabled)}
        onClose={() => setTimelineEnabled(false)}
        title="Timeline"
        centered
        fullScreen
      >
        {renderTimelineContent()}
      </Modal>

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

      {/* In-session proactive coaching tip — appears on stage transitions */}
      {coachingTip && (
        <Box
          style={{
            position: 'fixed',
            top: 72,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 400,
            width: 'min(460px, calc(100vw - 32px))',
            animation: 'coaching-tip-in 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
        >
          <style>{`
            @keyframes coaching-tip-in {
              from { opacity: 0; transform: translateX(-50%) translateY(-12px) scale(0.95); }
              to   { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
            }
          `}</style>
          <Paper withBorder shadow="lg" radius="md" px="md" py="sm">
            <Group gap="sm" wrap="nowrap" align="flex-start">
              <Box
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #7950f2, #4dabf7)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  marginTop: 2,
                }}
              >
                <IconSparkles size={15} color="white" />
              </Box>
              <Stack gap={2} style={{ flex: 1 }}>
                <Group gap={6} align="center">
                  <Text size="xs" fw={600} c="violet.6">
                    Coach tip
                  </Text>
                  <Badge size="xs" variant="light" color="violet">
                    {coachingTip.stage}
                  </Badge>
                </Group>
                <Text size="sm" lh={1.5}>
                  {coachingTip.tip}
                </Text>
              </Stack>
              <ActionIcon
                size="sm"
                variant="subtle"
                color="gray"
                onClick={clearCoachingTip}
                style={{ flexShrink: 0, marginTop: 2 }}
              >
                <IconX size={14} />
              </ActionIcon>
            </Group>
          </Paper>
        </Box>
      )}

      {/* AI State Panel — always visible on desktop */}
      {!isMobile && (
        <Box
          style={{
            position: 'fixed',
            bottom: 24,
            left: 24,
            zIndex: 300,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            width: 188,
          }}
        >
          {/* Emotion Box */}
          <Paper withBorder radius="md" px="sm" py="xs" shadow="sm">
            <Text
              size="xs"
              c="dimmed"
              fw={500}
              tt="uppercase"
              mb={6}
              style={{ letterSpacing: '0.04em' }}
            >
              AI Emotion
            </Text>
            <Group gap="xs" align="center" wrap="nowrap">
              <Text size="xl" style={{ lineHeight: 1, flexShrink: 0, transition: 'all 0.4s ease' }}>
                {EMOTION_EMOJI[currentEmotion ?? ''] ?? EMOTION_EMOJI[currentMood ?? ''] ?? '😐'}
              </Text>
              <Stack gap={2} style={{ minWidth: 0 }}>
                <Text
                  size="sm"
                  fw={600}
                  tt="capitalize"
                  c={(currentEmotion ?? currentMood) ? undefined : 'dimmed'}
                  style={{ lineHeight: 1.2, transition: 'all 0.4s ease' }}
                >
                  {currentEmotion ?? currentMood ?? 'Neutral'}
                </Text>
                {latestMoodEvent?.args.trigger ? (
                  <Text size="xs" c="dimmed" style={{ lineHeight: 1.3 }} lineClamp={2}>
                    {String(latestMoodEvent.args.trigger)}
                  </Text>
                ) : (
                  <Text size="xs" c="dimmed" style={{ lineHeight: 1.3 }}>
                    Waiting for response…
                  </Text>
                )}
              </Stack>
            </Group>
          </Paper>

          {/* Persuasion Meter */}
          <Tooltip
            label={persuasionReasoning ?? ''}
            disabled={!persuasionReasoning}
            position="right"
            multiline
            w={200}
          >
            <Paper
              withBorder
              radius="md"
              px="sm"
              py="xs"
              shadow="sm"
              style={{ cursor: persuasionReasoning ? 'help' : 'default' }}
            >
              <Group gap="xs" mb={6} align="center">
                <IconTarget size={12} color="var(--mantine-color-dimmed)" />
                <Text
                  size="xs"
                  c="dimmed"
                  fw={500}
                  tt="uppercase"
                  style={{ letterSpacing: '0.04em' }}
                >
                  Persuasion
                </Text>
              </Group>
              <Group gap="xs" align="center" wrap="nowrap">
                <RingProgress
                  size={52}
                  thickness={5}
                  roundCaps
                  sections={[
                    {
                      value: currentPersuasionScore ?? 0,
                      color: currentPersuasionScore !== null ? persuasionColor : 'gray',
                    },
                  ]}
                  label={
                    <Text
                      fw={700}
                      ta="center"
                      size="xs"
                      c={currentPersuasionScore !== null ? persuasionColor : 'dimmed'}
                    >
                      {currentPersuasionScore ?? '—'}
                    </Text>
                  }
                />
                <Text size="xs" c="dimmed" style={{ lineHeight: 1.3 }}>
                  {currentPersuasionScore === null
                    ? 'Waiting for response…'
                    : currentPersuasionScore >= 70
                      ? 'Almost convinced'
                      : currentPersuasionScore >= 40
                        ? 'On the fence'
                        : 'Not convinced'}
                </Text>
              </Group>
            </Paper>
          </Tooltip>
        </Box>
      )}

      <CoachChatWidget
        context={{
          page: 'session',
          sessionId,
          sessionName: sessionName || undefined,
          recentTurns: activeConversationMessages
            .slice(-6)
            .map((message) => ({ role: message.role, text: message.text })),
        }}
        starter={coachStarter ?? undefined}
      />
    </Box>
  )
}
