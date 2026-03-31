import { useMemo } from 'react'
import { useWebSpeechSTT, type UseSTTOptions } from './useWebSpeechSTT'
import { useWhisperSTT } from './useWhisperSTT'

export type { UseSTTOptions as UseSpeechToTextOptions }

/**
 * Selects the best STT engine for the current browser:
 *  - iOS (iPhone/iPad/iPod): Web Speech API is unreliable → Whisper (client-side ONNX)
 *  - No Web Speech API support: → Whisper
 *  - Otherwise: → Web Speech API (unchanged desktop behaviour)
 *
 * Both hooks are always called (Rules of Hooks); the inactive one returns no-ops.
 */
export function useSpeechToText(options: UseSTTOptions = {}) {
  const useWhisper = useMemo(() => {
    if (typeof window === 'undefined') return false
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent)
    const hasWebSpeechAPI = !!(
      (window as Window & typeof globalThis).SpeechRecognition ||
      (window as Window & typeof globalThis).webkitSpeechRecognition
    )
    return isIOS || !hasWebSpeechAPI
  }, [])

  const webSpeech = useWebSpeechSTT({ ...options, enabled: !useWhisper })
  const whisper = useWhisperSTT({ ...options, enabled: useWhisper })

  return useWhisper ? whisper : webSpeech
}
