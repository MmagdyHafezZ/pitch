import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { STT_DISABLED_RETURN, type UseSTTOptions, type UseSTTReturn } from './useWebSpeechSTT'

// ---------------------------------------------------------------------------
// VAD (Voice Activity Detection) parameters
// These control the sensitivity and timing of speech detection.
// ---------------------------------------------------------------------------

// TODO: Tune these values for your use case.
// See comments below for trade-offs.

/**
 * RMS energy threshold (0–255 scale, matching getByteFrequencyData output).
 *
 * Trade-off:
 *  - Lower (e.g. 8): Catches quiet speech, but more sensitive to ambient noise.
 *  - Higher (e.g. 25): More noise-resistant, but may miss soft voices or whispers.
 *
 * Recommended starting point: 12 for a quiet office, 18 for a noisy environment.
 */
const ENERGY_THRESHOLD = 12

/**
 * How long (ms) the user must speak before we start capturing audio.
 * Prevents very short noise bursts (keyboard clicks, pops) from triggering capture.
 *
 * Trade-off:
 *  - Shorter (e.g. 150ms): More responsive, but may false-trigger.
 *  - Longer (e.g. 500ms): Misses short affirmations ("yes", "ok", "no").
 */
const MIN_SPEECH_DURATION_MS = 300

/**
 * How long (ms) of silence after speech before we flush the audio to Whisper.
 *
 * Trade-off:
 *  - Shorter (e.g. 400ms): Faster response, but may cut off mid-sentence pauses.
 *  - Longer (e.g. 2000ms): Captures full thoughts, but adds perceptible latency.
 */
const SILENCE_DURATION_MS = 1000

/**
 * MediaRecorder chunk interval (ms). Smaller = smoother VAD, but more overhead.
 */
const RECORDER_TIMESLICE_MS = 250

/**
 * AnalyserNode polling interval for energy measurement (ms).
 */
const VAD_POLL_INTERVAL_MS = 100

// ---------------------------------------------------------------------------

type WorkerResponse =
  | { type: 'loading'; progress: number; message: string }
  | { type: 'ready' }
  | { type: 'result'; text: string }
  | { type: 'error'; message: string }

function resampleTo16kHz(buffer: AudioBuffer): Float32Array {
  const inputData = buffer.getChannelData(0)
  const inputRate = buffer.sampleRate
  const outputRate = 16000

  if (inputRate === outputRate) return inputData

  const ratio = inputRate / outputRate
  const outputLength = Math.round(inputData.length / ratio)
  const output = new Float32Array(outputLength)

  for (let i = 0; i < outputLength; i++) {
    const srcIdx = i * ratio
    const lo = Math.floor(srcIdx)
    const hi = Math.min(lo + 1, inputData.length - 1)
    const frac = srcIdx - lo
    output[i] = inputData[lo] * (1 - frac) + inputData[hi] * frac
  }

  return output
}

function computeRmsEnergy(dataArray: Uint8Array): number {
  let sum = 0
  for (let i = 0; i < dataArray.length; i++) {
    sum += dataArray[i] * dataArray[i]
  }
  return Math.sqrt(sum / dataArray.length)
}

export function useWhisperSTT(options: UseSTTOptions = {}): UseSTTReturn {
  const { onError, onResult, onSpeechEnd, enabled = false } = options

  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [errorCode, setErrorCode] = useState<string | null>(null)
  const [microphonePermission, setMicrophonePermission] = useState<
    'unknown' | 'granted' | 'denied'
  >('unknown')

  const workerRef = useRef<Worker | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const vadTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const speechStartTimeRef = useRef<number | null>(null)
  const lastSpeechTimeRef = useRef<number | null>(null)
  const isCapturingRef = useRef(false)
  const isListeningRef = useRef(false)
  const onResultRef = useRef(onResult)
  const onErrorRef = useRef(onError)
  const onSpeechEndRef = useRef(onSpeechEnd)

  useEffect(() => {
    onResultRef.current = onResult
  }, [onResult])
  useEffect(() => {
    onErrorRef.current = onError
  }, [onError])
  useEffect(() => {
    onSpeechEndRef.current = onSpeechEnd
  }, [onSpeechEnd])

  // Lazy-init worker only when Whisper engine is active
  const workerUrl = useMemo(() => {
    if (!enabled || typeof window === 'undefined') return null
    return new URL('../workers/whisper.worker.ts', import.meta.url)
  }, [enabled])

  useEffect(() => {
    if (!enabled || !workerUrl) return

    const worker = new Worker(workerUrl, { type: 'module' })
    workerRef.current = worker

    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const msg = event.data
      switch (msg.type) {
        case 'loading':
          setInterimTranscript(msg.message)
          break
        case 'ready':
          setInterimTranscript('')
          break
        case 'result': {
          const text = msg.text
          if (text) {
            setTranscript((prev) => prev + text + ' ')
            setInterimTranscript('')
            onResultRef.current?.(text, true)
            onSpeechEndRef.current?.()
          } else {
            setInterimTranscript('')
          }
          break
        }
        case 'error':
          setError(msg.message)
          onErrorRef.current?.(msg.message)
          setInterimTranscript('')
          break
      }
    }

    worker.onerror = (evt) => {
      const message = evt.message || 'Whisper worker error'
      setError(message)
      onErrorRef.current?.(message)
    }

    return () => {
      worker.terminate()
      workerRef.current = null
    }
  }, [enabled, workerUrl])

  const stopVAD = useCallback(() => {
    if (vadTimerRef.current !== null) {
      clearInterval(vadTimerRef.current)
      vadTimerRef.current = null
    }
  }, [])

  const flushAudio = useCallback(async () => {
    if (chunksRef.current.length === 0) return

    const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
    chunksRef.current = []
    isCapturingRef.current = false
    setInterimTranscript('Processing…')

    try {
      const arrayBuffer = await blob.arrayBuffer()
      const audioCtx = new AudioContext({ sampleRate: 16000 })
      const decoded = await audioCtx.decodeAudioData(arrayBuffer)
      await audioCtx.close()

      const float32 = resampleTo16kHz(decoded)

      if (workerRef.current) {
        workerRef.current.postMessage({ type: 'transcribe', audio: float32, sampleRate: 16000 }, [
          float32.buffer,
        ])
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Audio decode failed'
      setError(message)
      setInterimTranscript('')
      onErrorRef.current?.(message)
    }
  }, [])

  const startVAD = useCallback(() => {
    if (!analyserRef.current) return

    const analyser = analyserRef.current
    const dataArray = new Uint8Array(analyser.frequencyBinCount)
    let silenceStart: number | null = null

    vadTimerRef.current = setInterval(() => {
      if (!isListeningRef.current) return

      analyser.getByteFrequencyData(dataArray)
      const energy = computeRmsEnergy(dataArray)
      const now = Date.now()
      const isSpeech = energy > ENERGY_THRESHOLD

      if (isSpeech) {
        lastSpeechTimeRef.current = now
        if (speechStartTimeRef.current === null) {
          speechStartTimeRef.current = now
        }
        silenceStart = null

        // Only start capturing once minimum speech duration is met
        const speechDuration = now - (speechStartTimeRef.current ?? now)
        if (!isCapturingRef.current && speechDuration >= MIN_SPEECH_DURATION_MS) {
          isCapturingRef.current = true
        }
      } else {
        // No speech — track silence duration
        if (silenceStart === null && lastSpeechTimeRef.current !== null) {
          silenceStart = now
        }

        const speechWasLongEnough =
          speechStartTimeRef.current !== null &&
          (lastSpeechTimeRef.current ?? 0) - speechStartTimeRef.current >= MIN_SPEECH_DURATION_MS

        const silenceLongEnough = silenceStart !== null && now - silenceStart >= SILENCE_DURATION_MS

        if (isCapturingRef.current && speechWasLongEnough && silenceLongEnough) {
          // Flush accumulated audio to Whisper
          speechStartTimeRef.current = null
          lastSpeechTimeRef.current = null
          silenceStart = null
          void flushAudio()
        }
      }
    }, VAD_POLL_INTERVAL_MS)
  }, [flushAudio])

  const teardown = useCallback(() => {
    stopVAD()

    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      try {
        recorderRef.current.stop()
      } catch {}
    }
    recorderRef.current = null

    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {})
      audioCtxRef.current = null
    }
    analyserRef.current = null

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }

    chunksRef.current = []
    isCapturingRef.current = false
    speechStartTimeRef.current = null
    lastSpeechTimeRef.current = null
  }, [stopVAD])

  const requestMicrophoneAccess = useCallback(async () => {
    if (!enabled || typeof navigator === 'undefined') return false
    if (microphonePermission === 'granted') return true
    if (!navigator.mediaDevices?.getUserMedia) {
      const message = 'Microphone access is not supported in this browser'
      setErrorCode('audio-capture')
      setError(message)
      onErrorRef.current?.(message)
      return false
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach((t) => t.stop())
      setMicrophonePermission('granted')
      setError(null)
      setErrorCode(null)
      return true
    } catch {
      const message =
        'Microphone permission is blocked. Allow microphone access in your browser settings.'
      setMicrophonePermission('denied')
      setErrorCode('not-allowed')
      setError(message)
      onErrorRef.current?.(message)
      return false
    }
  }, [enabled, microphonePermission])

  const startListening = useCallback(async () => {
    if (!enabled) return false
    if (isListeningRef.current) return true

    setError(null)
    setErrorCode(null)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      setMicrophonePermission('granted')

      const audioCtx = new AudioContext()
      audioCtxRef.current = audioCtx

      const source = audioCtx.createMediaStreamSource(stream)
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)
      analyserRef.current = analyser

      const recorder = new MediaRecorder(stream)
      recorderRef.current = recorder

      recorder.ondataavailable = (evt) => {
        if (evt.data.size > 0 && isCapturingRef.current) {
          chunksRef.current.push(evt.data)
        }
      }

      recorder.start(RECORDER_TIMESLICE_MS)

      isListeningRef.current = true
      setIsListening(true)
      startVAD()
      return true
    } catch (err) {
      const message =
        err instanceof Error && err.name === 'NotAllowedError'
          ? 'Microphone permission is blocked. Allow microphone access in your browser settings.'
          : 'Failed to access microphone'
      setMicrophonePermission('denied')
      setErrorCode('not-allowed')
      setError(message)
      onErrorRef.current?.(message)
      return false
    }
  }, [enabled, startVAD])

  const stopListening = useCallback(() => {
    isListeningRef.current = false
    setIsListening(false)
    setInterimTranscript('')
    teardown()
  }, [teardown])

  const toggleListening = useCallback(() => {
    if (isListeningRef.current) {
      stopListening()
    } else {
      void startListening()
    }
  }, [startListening, stopListening])

  const resetTranscript = useCallback(() => {
    setTranscript('')
    setInterimTranscript('')
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isListeningRef.current = false
      teardown()
    }
  }, [teardown])

  if (!enabled) return STT_DISABLED_RETURN

  return {
    isListening,
    transcript,
    interimTranscript,
    error,
    errorCode,
    isSupported: true,
    microphonePermission,
    isPermissionBlocked:
      microphonePermission === 'denied' ||
      errorCode === 'not-allowed' ||
      errorCode === 'service-not-allowed',
    startListening,
    stopListening,
    toggleListening,
    resetTranscript,
    requestMicrophoneAccess,
  }
}
