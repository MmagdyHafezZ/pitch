import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ConversationStartPayload } from '../types/conversation.types'

export type VoiceTurnPhase =
  | 'awaiting_first_user'
  | 'assistant_opening_pending'
  | 'assistant_thinking'
  | 'assistant_speaking'
  | 'user_listening'
  | 'user_silence_window'
  | 'user_send_countdown'
  | 'user_committing'
  | 'ended'

type VoiceTurnMessage = {
  id?: string
  role: 'user' | 'assistant'
  text: string
}

type VoiceTurnMicPermission = 'unknown' | 'granted' | 'denied'

interface UseVoiceTurnControllerOptions {
  enabled: boolean
  sessionStatus: string | null
  sessionName?: string | null
  personaName?: string | null
  isConnected: boolean
  isConnecting: boolean
  isProcessing: boolean
  assistantSpeaking: boolean
  isListening: boolean
  isSttSupported: boolean
  isSttPermissionBlocked: boolean
  microphonePermission: VoiceTurnMicPermission
  transcript: string
  interimTranscript: string
  messages: VoiceTurnMessage[]
  entryDecisionLoading: boolean
  resumePromptOpen: boolean
  prelaunchModalOpen: boolean
  postSilenceSendDelayMs?: number | null
  assistantFirstTurnDelayMs?: number
  silenceDetectMs?: number
  commitVisualSettleMs?: number
  startAssistantTurn: (options?: Partial<ConversationStartPayload>) => void
  onCommitUserTurn: (text: string) => void
  interrupt: () => Promise<void> | void
  stopAudio: () => void
  requestMicrophoneAccess: () => Promise<boolean>
  startListening: () => Promise<boolean>
  stopListening: () => void
  resetTranscript: () => void
}

interface UseVoiceTurnControllerResult {
  phase: VoiceTurnPhase
  liveTranscript: string
  interimDisplayTranscript: string
  pendingTranscript: string
  sttCommitRemainingMs: number
  sttCommitProgress: number
  handleMicrophoneClick: () => Promise<void>
  resetController: () => void
}

const DEFAULT_ASSISTANT_FIRST_TURN_DELAY_MS = 3000
const DEFAULT_USER_SILENCE_DETECT_MS = 3000
const DEFAULT_POST_SILENCE_SEND_DELAY_MS = 4000
const DEFAULT_COMMIT_VISUAL_SETTLE_MS = 140

type CountdownStage = 'silence' | 'send' | null

const normalizeDelayMs = (value: number | null | undefined, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.round(value) : fallback

const sanitizeInterimTranscript = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) {
    return ''
  }

  if (
    trimmed === 'Processing…' ||
    trimmed.startsWith('Loading speech engine') ||
    trimmed.startsWith('Loading model')
  ) {
    return ''
  }

  return trimmed
}

const combineTranscriptDraft = (finalText: string, interimText: string) => {
  const finalDraft = finalText.trim()
  const interimDraft = interimText.trim()

  if (!finalDraft) return interimDraft
  if (!interimDraft) return finalDraft

  const finalLower = finalDraft.toLowerCase()
  const interimLower = interimDraft.toLowerCase()

  if (interimLower === finalLower || interimLower.startsWith(finalLower)) {
    return interimDraft
  }

  if (finalLower.startsWith(interimLower)) {
    return finalDraft
  }

  return `${finalDraft} ${interimDraft}`.trim()
}

export const buildAssistantOpeningStarterPrompt = (input: {
  sessionName?: string | null
  personaName?: string | null
}) => {
  const personaPrompt = input.personaName
    ? `Introduce yourself naturally as ${input.personaName} in-role.`
    : 'Introduce yourself naturally in-role.'
  const sessionPrompt = input.sessionName
    ? `Briefly explain this is a PITCH practice session for "${input.sessionName}".`
    : 'Briefly explain this is a PITCH practice session.'

  return [
    'Open the first turn of the session now.',
    personaPrompt,
    sessionPrompt,
    'Then transition directly into the scenario and start the conversation.',
    'Stay fully in character, keep it concise, and avoid sounding like a system message.',
  ].join(' ')
}

export function useVoiceTurnController(
  options: UseVoiceTurnControllerOptions
): UseVoiceTurnControllerResult {
  const {
    enabled,
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
    postSilenceSendDelayMs,
    assistantFirstTurnDelayMs = DEFAULT_ASSISTANT_FIRST_TURN_DELAY_MS,
    silenceDetectMs = DEFAULT_USER_SILENCE_DETECT_MS,
    commitVisualSettleMs = DEFAULT_COMMIT_VISUAL_SETTLE_MS,
    startAssistantTurn,
    onCommitUserTurn,
    interrupt,
    stopAudio,
    requestMicrophoneAccess,
    startListening,
    stopListening,
    resetTranscript,
  } = options

  const assistantOpeningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const countdownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const countdownTickerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const countdownDispatchRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const countdownStageRef = useRef<CountdownStage>(null)
  const userClaimedOpeningRef = useRef(false)
  const lastAutoMicMessageKeyRef = useRef<string | null>(null)
  const latestDraftRef = useRef('')
  const previousDraftRef = useRef('')
  const onCommitUserTurnRef = useRef(onCommitUserTurn)
  const micEnsurePromiseRef = useRef<Promise<boolean> | null>(null)

  const [isAssistantOpeningPending, setIsAssistantOpeningPending] = useState(false)
  const [countdownStage, setCountdownStage] = useState<CountdownStage>(null)
  const [countdownDurationMs, setCountdownDurationMs] = useState(0)
  const [sttCommitRemainingMs, setSttCommitRemainingMs] = useState(0)
  const [isCommitting, setIsCommitting] = useState(false)

  const normalizedPostSilenceSendDelayMs = normalizeDelayMs(
    postSilenceSendDelayMs,
    DEFAULT_POST_SILENCE_SEND_DELAY_MS
  )
  const visibleInterimTranscript = sanitizeInterimTranscript(interimTranscript)
  const liveTranscript = useMemo(
    () => combineTranscriptDraft(transcript, visibleInterimTranscript),
    [transcript, visibleInterimTranscript]
  )
  const isUserActivelySpeaking = visibleInterimTranscript.length > 0
  const lastMessage = messages[messages.length - 1] ?? null
  const lastMessageKey =
    lastMessage?.id ??
    (lastMessage ? `${messages.length}:${lastMessage.role}:${lastMessage.text}` : null)

  latestDraftRef.current = liveTranscript
  onCommitUserTurnRef.current = onCommitUserTurn

  const clearCountdown = useCallback(
    (options?: { includeCommitDispatch?: boolean; resetCommitting?: boolean }) => {
      const includeCommitDispatch = options?.includeCommitDispatch ?? true
      const resetCommitting = options?.resetCommitting ?? true

      if (countdownTimerRef.current) {
        clearTimeout(countdownTimerRef.current)
        countdownTimerRef.current = null
      }
      if (countdownTickerRef.current) {
        clearInterval(countdownTickerRef.current)
        countdownTickerRef.current = null
      }
      if (includeCommitDispatch && countdownDispatchRef.current) {
        clearTimeout(countdownDispatchRef.current)
        countdownDispatchRef.current = null
      }

      countdownStageRef.current = null
      setCountdownStage(null)
      setCountdownDurationMs(0)
      setSttCommitRemainingMs(0)
      if (resetCommitting) {
        setIsCommitting(false)
      }
    },
    []
  )

  const clearAssistantOpeningTimer = useCallback(() => {
    if (assistantOpeningTimerRef.current) {
      clearTimeout(assistantOpeningTimerRef.current)
      assistantOpeningTimerRef.current = null
    }
    setIsAssistantOpeningPending(false)
  }, [])

  const resetController = useCallback(() => {
    clearAssistantOpeningTimer()
    clearCountdown()
    userClaimedOpeningRef.current = false
    lastAutoMicMessageKeyRef.current = null
    previousDraftRef.current = ''
    micEnsurePromiseRef.current = null
    stopListening()
    resetTranscript()
  }, [clearAssistantOpeningTimer, clearCountdown, resetTranscript, stopListening])

  const commitDraft = useCallback(() => {
    const draftToCommit = latestDraftRef.current.trim()
    clearCountdown({
      includeCommitDispatch: false,
      resetCommitting: false,
    })

    if (!draftToCommit) {
      resetTranscript()
      return
    }

    stopListening()
    setIsCommitting(true)
    onCommitUserTurnRef.current(draftToCommit)
    countdownDispatchRef.current = setTimeout(() => {
      countdownDispatchRef.current = null
      resetTranscript()
      setIsCommitting(false)
    }, commitVisualSettleMs)
  }, [clearCountdown, commitVisualSettleMs, resetTranscript, stopListening])

  const startCountdown = useCallback(
    (stage: Exclude<CountdownStage, null>, durationMs: number, onComplete: () => void) => {
      clearCountdown()
      if (durationMs <= 0) {
        onComplete()
        return
      }

      countdownStageRef.current = stage
      setCountdownStage(stage)
      setCountdownDurationMs(durationMs)
      setSttCommitRemainingMs(durationMs)

      const startedAt = Date.now()
      countdownTickerRef.current = setInterval(() => {
        const remaining = Math.max(0, durationMs - (Date.now() - startedAt))
        setSttCommitRemainingMs(remaining)
        if (remaining === 0 && countdownTickerRef.current) {
          clearInterval(countdownTickerRef.current)
          countdownTickerRef.current = null
        }
      }, 50)

      countdownTimerRef.current = setTimeout(() => {
        if (countdownTickerRef.current) {
          clearInterval(countdownTickerRef.current)
          countdownTickerRef.current = null
        }
        countdownTimerRef.current = null
        setSttCommitRemainingMs(0)
        onComplete()
      }, durationMs)
    },
    [clearCountdown]
  )

  const ensureMicIsListening = useCallback(
    async (claimOpening: boolean) => {
      if (!enabled || !isConnected || sessionStatus === 'ended' || !isSttSupported) {
        return false
      }

      if (claimOpening) {
        userClaimedOpeningRef.current = true
      }

      if (micEnsurePromiseRef.current) {
        return micEnsurePromiseRef.current
      }

      const ensurePromise = (async () => {
        if (microphonePermission !== 'granted') {
          const permissionGranted = await requestMicrophoneAccess()
          if (!permissionGranted) {
            return false
          }
        }

        return startListening()
      })()

      micEnsurePromiseRef.current = ensurePromise
      return ensurePromise.finally(() => {
        if (micEnsurePromiseRef.current === ensurePromise) {
          micEnsurePromiseRef.current = null
        }
      })
    },
    [
      enabled,
      isConnected,
      isSttSupported,
      microphonePermission,
      requestMicrophoneAccess,
      sessionStatus,
      startListening,
    ]
  )

  const handleMicrophoneClick = useCallback(async () => {
    if (!enabled || !isConnected || sessionStatus === 'ended' || !isSttSupported) {
      return
    }

    clearAssistantOpeningTimer()

    if (isListening) {
      if (latestDraftRef.current.trim()) {
        commitDraft()
      } else {
        clearCountdown()
        stopListening()
      }
      return
    }

    if (assistantSpeaking || isProcessing) {
      clearCountdown()
      await interrupt()
      stopAudio()
      await ensureMicIsListening(true)
      return
    }

    clearCountdown()
    await ensureMicIsListening(true)
  }, [
    assistantSpeaking,
    clearAssistantOpeningTimer,
    clearCountdown,
    commitDraft,
    enabled,
    ensureMicIsListening,
    interrupt,
    isConnected,
    isListening,
    isProcessing,
    isSttSupported,
    sessionStatus,
    stopAudio,
    stopListening,
  ])

  useEffect(() => {
    if (!enabled || sessionStatus === 'ended') {
      clearAssistantOpeningTimer()
      clearCountdown()
      return
    }

    const shouldAutoOpen =
      isConnected &&
      !isConnecting &&
      !isProcessing &&
      !assistantSpeaking &&
      !entryDecisionLoading &&
      !resumePromptOpen &&
      !prelaunchModalOpen &&
      messages.length === 0 &&
      !isListening &&
      !liveTranscript.trim() &&
      !userClaimedOpeningRef.current

    if (!shouldAutoOpen) {
      clearAssistantOpeningTimer()
      return
    }

    if (assistantOpeningTimerRef.current) {
      return
    }

    setIsAssistantOpeningPending(true)
    assistantOpeningTimerRef.current = setTimeout(() => {
      assistantOpeningTimerRef.current = null
      setIsAssistantOpeningPending(false)
      startAssistantTurn({
        starterPrompt: buildAssistantOpeningStarterPrompt({
          sessionName,
          personaName,
        }),
      })
    }, assistantFirstTurnDelayMs)

    return () => {
      if (assistantOpeningTimerRef.current) {
        clearTimeout(assistantOpeningTimerRef.current)
        assistantOpeningTimerRef.current = null
      }
    }
  }, [
    assistantFirstTurnDelayMs,
    assistantSpeaking,
    clearAssistantOpeningTimer,
    clearCountdown,
    enabled,
    entryDecisionLoading,
    isConnected,
    isConnecting,
    isListening,
    isProcessing,
    liveTranscript,
    messages.length,
    personaName,
    prelaunchModalOpen,
    resumePromptOpen,
    sessionName,
    sessionStatus,
    startAssistantTurn,
  ])

  useEffect(() => {
    if (!enabled) {
      return
    }

    if (assistantSpeaking || isProcessing) {
      clearCountdown({
        includeCommitDispatch: !isCommitting,
        resetCommitting: !isCommitting,
      })
      if (isListening) {
        stopListening()
      }
      return
    }

    if (isCommitting && isListening) {
      stopListening()
    }
  }, [
    assistantSpeaking,
    clearCountdown,
    enabled,
    isCommitting,
    isListening,
    isProcessing,
    stopListening,
  ])

  useEffect(() => {
    if (!enabled || sessionStatus === 'ended') {
      clearCountdown()
      previousDraftRef.current = liveTranscript
      return
    }

    if (assistantSpeaking || isProcessing || isCommitting) {
      previousDraftRef.current = liveTranscript
      return
    }

    if (!isListening) {
      if (!liveTranscript.trim()) {
        clearCountdown()
      }
      previousDraftRef.current = liveTranscript
      return
    }

    const currentDraft = liveTranscript.trim()
    const previousDraft = previousDraftRef.current.trim()
    const draftChanged = currentDraft.length > 0 && currentDraft !== previousDraft
    previousDraftRef.current = liveTranscript

    if (!currentDraft) {
      clearCountdown()
      return
    }

    if (isUserActivelySpeaking) {
      clearCountdown()
      return
    }

    if (draftChanged) {
      startCountdown('silence', silenceDetectMs, () => {
        startCountdown('send', normalizedPostSilenceSendDelayMs, commitDraft)
      })
      return
    }

    if (countdownStageRef.current === null) {
      startCountdown('silence', silenceDetectMs, () => {
        startCountdown('send', normalizedPostSilenceSendDelayMs, commitDraft)
      })
    }
  }, [
    assistantSpeaking,
    clearCountdown,
    commitDraft,
    enabled,
    isCommitting,
    isListening,
    isProcessing,
    isUserActivelySpeaking,
    liveTranscript,
    normalizedPostSilenceSendDelayMs,
    sessionStatus,
    silenceDetectMs,
    startCountdown,
  ])

  useEffect(() => {
    if (!enabled) {
      lastAutoMicMessageKeyRef.current = null
      return
    }

    if (!lastMessage || lastMessage.role !== 'assistant') {
      lastAutoMicMessageKeyRef.current = null
      return
    }

    if (
      !isConnected ||
      sessionStatus === 'ended' ||
      assistantSpeaking ||
      isProcessing ||
      isListening ||
      isCommitting ||
      !isSttSupported ||
      isSttPermissionBlocked ||
      !lastMessageKey
    ) {
      return
    }

    if (lastAutoMicMessageKeyRef.current === lastMessageKey) {
      return
    }

    lastAutoMicMessageKeyRef.current = lastMessageKey
    void ensureMicIsListening(false)
  }, [
    assistantSpeaking,
    enabled,
    ensureMicIsListening,
    isConnected,
    isCommitting,
    isListening,
    isProcessing,
    isSttPermissionBlocked,
    isSttSupported,
    lastMessage,
    lastMessageKey,
    sessionStatus,
  ])

  useEffect(() => {
    return () => {
      clearAssistantOpeningTimer()
      clearCountdown()
      micEnsurePromiseRef.current = null
      stopListening()
      resetTranscript()
    }
  }, [clearAssistantOpeningTimer, clearCountdown, resetTranscript, stopListening])

  const phase: VoiceTurnPhase = useMemo(() => {
    if (sessionStatus === 'ended') {
      return 'ended'
    }

    if (!enabled) {
      return 'awaiting_first_user'
    }

    if (assistantSpeaking) {
      return 'assistant_speaking'
    }

    if (isProcessing) {
      return 'assistant_thinking'
    }

    if (isCommitting) {
      return 'user_committing'
    }

    if (countdownStage === 'send') {
      return 'user_send_countdown'
    }

    if (countdownStage === 'silence') {
      return 'user_silence_window'
    }

    if (isListening || lastMessage?.role === 'assistant') {
      return 'user_listening'
    }

    if (isAssistantOpeningPending) {
      return 'assistant_opening_pending'
    }

    return 'awaiting_first_user'
  }, [
    assistantSpeaking,
    countdownStage,
    enabled,
    isAssistantOpeningPending,
    isCommitting,
    isListening,
    isProcessing,
    lastMessage?.role,
    sessionStatus,
  ])

  const sttCommitProgress =
    countdownDurationMs > 0
      ? Math.min(1, Math.max(0, sttCommitRemainingMs / countdownDurationMs))
      : 0

  return {
    phase,
    liveTranscript,
    interimDisplayTranscript: phase === 'user_listening' ? liveTranscript : '',
    pendingTranscript:
      phase === 'user_silence_window' ||
      phase === 'user_send_countdown' ||
      phase === 'user_committing'
        ? liveTranscript
        : '',
    sttCommitRemainingMs,
    sttCommitProgress,
    handleMicrophoneClick,
    resetController,
  }
}
