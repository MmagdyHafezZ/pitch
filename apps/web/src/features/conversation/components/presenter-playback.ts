export type PresenterPlaybackMode = 'idle' | 'speaking' | 'listening'

interface PresenterPlaybackModeOptions {
  assistantSpeaking: boolean
  isListening: boolean
  isProcessing: boolean
  interimTranscript?: string | null
  sttCommitRemainingMs?: number
}

export function getPresenterPlaybackMode({
  assistantSpeaking,
  isListening,
  isProcessing,
  interimTranscript,
  sttCommitRemainingMs = 0,
}: PresenterPlaybackModeOptions): PresenterPlaybackMode {
  if (assistantSpeaking) {
    return 'speaking'
  }

  const hasActiveUserSpeech = Boolean(interimTranscript?.trim()) || sttCommitRemainingMs > 0
  if (hasActiveUserSpeech || (isListening && !isProcessing)) {
    return 'listening'
  }

  return 'idle'
}
