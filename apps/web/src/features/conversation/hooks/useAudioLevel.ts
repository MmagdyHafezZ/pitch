import { useEffect, useRef } from 'react'

interface Options {
  audioElementRef: React.RefObject<HTMLAudioElement | null>
  assistantSpeaking: boolean
}

/**
 * Optionally taps the LLM's HTMLAudioElement through a Web Audio AnalyserNode
 * so callers can read frequency data each frame for visualisation.
 *
 * Audio-safety guarantee
 * ──────────────────────
 * createMediaElementSource() permanently reroutes an element's output through
 * the Web Audio graph.  If the AudioContext is suspended (which modern browsers
 * enforce until a user gesture), the captured audio goes NOWHERE — complete
 * silence.  To prevent this, we only capture the element when the context is
 * confirmed running.  If it is suspended, we skip capture and the element plays
 * natively (no visualisation for that speech, but audio is always audible).
 *
 * The context is unlocked the first time the user interacts with the page
 * (click or touchstart), which covers the mic-button tap or any other control.
 */
export function useAudioLevel({ audioElementRef, assistantSpeaking }: Options) {
  const ctxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)

  // ── Create AudioContext early and unlock it on first user gesture ───────────
  useEffect(() => {
    let ctx: AudioContext
    try {
      ctx = new AudioContext()
      ctxRef.current = ctx
    } catch {
      return
    }

    // Resume on the first user gesture — this is required in modern browsers
    // for the context to leave suspended state.
    const unlock = () => {
      if (ctx.state === 'suspended') void ctx.resume()
    }
    document.addEventListener('click', unlock, { once: true, passive: true })
    document.addEventListener('touchstart', unlock, { once: true, passive: true })
    document.addEventListener('keydown', unlock, { once: true, passive: true })

    return () => {
      analyserRef.current = null
      document.removeEventListener('click', unlock)
      document.removeEventListener('touchstart', unlock)
      document.removeEventListener('keydown', unlock)
      try {
        ctx.close()
      } catch {
        /* ignore */
      }
    }
  }, [])

  // ── Wire up the analyser when the assistant is speaking ────────────────────
  useEffect(() => {
    if (!assistantSpeaking) {
      analyserRef.current = null
      return
    }

    const el = audioElementRef.current
    const ctx = ctxRef.current
    if (!el || !ctx) return

    // CRITICAL: only intercept the element if the context is already running.
    // A suspended context makes the captured audio completely silent.
    if (ctx.state !== 'running') {
      // Queue a resume so the NEXT speech benefits from the analyser.
      void ctx.resume()
      return
    }

    let src: MediaElementAudioSourceNode
    try {
      src = ctx.createMediaElementSource(el)
    } catch {
      // Element was already captured by a previous context — audio plays
      // natively through that path; nothing to do here.
      return
    }

    const analyser = ctx.createAnalyser()
    analyser.fftSize = 512
    analyser.smoothingTimeConstant = 0.8
    analyserRef.current = analyser

    src.connect(analyser)
    analyser.connect(ctx.destination)

    return () => {
      analyserRef.current = null
      try {
        src.disconnect(analyser)
      } catch {
        /* ignore */
      }
      try {
        analyser.disconnect()
      } catch {
        /* ignore */
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assistantSpeaking])

  return analyserRef
}
