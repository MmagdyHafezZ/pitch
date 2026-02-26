import { useState, useEffect, useRef, useCallback } from 'react'

interface UseSpeechToTextOptions {
  lang?: string
  continuous?: boolean
  interimResults?: boolean
  maxAlternatives?: number
  onError?: (error: string) => void
  onResult?: (transcript: string, isFinal: boolean) => void
  onSpeechEnd?: () => void
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList
  resultIndex: number
}

interface SpeechRecognitionResultList {
  length: number
  item(index: number): SpeechRecognitionResult
  [index: number]: SpeechRecognitionResult
}

interface SpeechRecognitionResult {
  isFinal: boolean
  length: number
  item(index: number): SpeechRecognitionAlternative
  [index: number]: SpeechRecognitionAlternative
}

interface SpeechRecognitionAlternative {
  transcript: string
  confidence: number
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string
  message: string
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  maxAlternatives: number
  start(): void
  stop(): void
  abort(): void
  onaudiostart: ((this: SpeechRecognition, ev: Event) => any) | null
  onaudioend: ((this: SpeechRecognition, ev: Event) => any) | null
  onend: ((this: SpeechRecognition, ev: Event) => any) | null
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null
  onnomatch: ((this: SpeechRecognition, ev: Event) => any) | null
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null
  onsoundstart: ((this: SpeechRecognition, ev: Event) => any) | null
  onsoundend: ((this: SpeechRecognition, ev: Event) => any) | null
  onspeechstart: ((this: SpeechRecognition, ev: Event) => any) | null
  onspeechend: ((this: SpeechRecognition, ev: Event) => any) | null
  onstart: ((this: SpeechRecognition, ev: Event) => any) | null
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition
    webkitSpeechRecognition: new () => SpeechRecognition
  }
}

export function useSpeechToText(options: UseSpeechToTextOptions = {}) {
  const {
    lang = 'en-US',
    continuous = true,
    interimResults = true,
    maxAlternatives = 1,
    onError,
    onResult,
    onSpeechEnd,
  } = options

  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [errorCode, setErrorCode] = useState<string | null>(null)
  const [isSupported, setIsSupported] = useState(true)
  const [microphonePermission, setMicrophonePermission] = useState<
    'unknown' | 'granted' | 'denied'
  >('unknown')

  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const isListeningRef = useRef(false)
  const shouldAutoRestartRef = useRef(true)
  const onResultRef = useRef(onResult)
  const onErrorRef = useRef(onError)
  const onSpeechEndRef = useRef(onSpeechEnd)

  const mapSpeechError = useCallback((code: string) => {
    switch (code) {
      case 'not-allowed':
      case 'service-not-allowed':
        return 'Microphone permission is blocked. Allow microphone access in your browser settings.'
      case 'audio-capture':
        return 'No microphone was found. Check your input device and OS permissions.'
      case 'network':
        return 'Speech recognition network issue. Check your connection and try again.'
      case 'no-speech':
        return 'No speech detected. Try speaking again.'
      case 'aborted':
        return 'Speech capture was interrupted. Please try again.'
      default:
        return code || 'Unknown error occurred'
    }
  }, [])

  useEffect(() => {
    isListeningRef.current = isListening
  }, [isListening])

  useEffect(() => {
    onResultRef.current = onResult
  }, [onResult])

  useEffect(() => {
    onErrorRef.current = onError
  }, [onError])

  useEffect(() => {
    onSpeechEndRef.current = onSpeechEnd
  }, [onSpeechEnd])

  useEffect(() => {
    if (typeof window === 'undefined') {
      setIsSupported(false)
      return
    }

    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition

    if (!SpeechRecognitionAPI) {
      setIsSupported(false)
      setError('Speech recognition is not supported in this browser')
      return
    }

    const recognition = new SpeechRecognitionAPI()
    recognition.continuous = continuous
    recognition.interimResults = interimResults
    recognition.lang = lang
    recognition.maxAlternatives = maxAlternatives

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimText = ''
      let finalText = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        const transcriptText = result[0].transcript

        if (result.isFinal) {
          finalText += transcriptText + ' '
        } else {
          interimText += transcriptText
        }
      }

      if (finalText) {
        setTranscript((prev) => prev + finalText)
        const trimmedFinal = finalText.trim()
        if (trimmedFinal) {
          onResultRef.current?.(trimmedFinal, true)
        }
      }

      if (interimText) {
        setInterimTranscript(interimText)
        onResultRef.current?.(interimText, false)
      }
    }

    recognition.onspeechend = () => {
      onSpeechEndRef.current?.()
    }

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      const code = event.error || 'Unknown error occurred'
      const errorMessage = mapSpeechError(code)
      setErrorCode(code)
      setError(errorMessage)
      onErrorRef.current?.(errorMessage)

      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setMicrophonePermission('denied')
        shouldAutoRestartRef.current = false
      }

      if (event.error === 'no-speech' || event.error === 'audio-capture') {
        return
      }

      setIsListening(false)
    }

    recognition.onend = () => {
      if (!shouldAutoRestartRef.current) {
        setIsListening(false)
        return
      }
      if (isListeningRef.current && continuous) {
        try {
          recognition.start()
        } catch (err) {
          setIsListening(false)
        }
      } else {
        setIsListening(false)
      }
    }

    recognitionRef.current = recognition

    return () => {
      if (recognition) {
        try {
          recognition.stop()
        } catch (err) {}
      }
    }
  }, [lang, continuous, interimResults, maxAlternatives, mapSpeechError])

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.permissions?.query) {
      return
    }

    let cancelled = false
    let statusRef: PermissionStatus | null = null
    const syncStatus = (state: PermissionState) => {
      if (cancelled) return
      if (state === 'granted') {
        setMicrophonePermission('granted')
      } else if (state === 'denied') {
        setMicrophonePermission('denied')
      } else {
        setMicrophonePermission('unknown')
      }
    }

    navigator.permissions
      .query({ name: 'microphone' as PermissionName })
      .then((status) => {
        if (cancelled) return
        statusRef = status
        syncStatus(status.state)
        status.onchange = () => syncStatus(status.state)
      })
      .catch(() => {})

    return () => {
      cancelled = true
      if (statusRef) {
        statusRef.onchange = null
      }
    }
  }, [])

  const requestMicrophoneAccess = useCallback(async () => {
    if (typeof navigator === 'undefined') return false
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
      stream.getTracks().forEach((track) => track.stop())
      setMicrophonePermission('granted')
      shouldAutoRestartRef.current = true
      setError(null)
      setErrorCode(null)
      return true
    } catch {
      const message =
        'Microphone permission is blocked. Allow microphone access in your browser settings.'
      setMicrophonePermission('denied')
      shouldAutoRestartRef.current = false
      setErrorCode('not-allowed')
      setError(message)
      onErrorRef.current?.(message)
      return false
    }
  }, [microphonePermission])

  const startListening = useCallback(async () => {
    if (!recognitionRef.current || !isSupported) {
      setError('Speech recognition is not available')
      return false
    }

    try {
      setError(null)
      setErrorCode(null)
      shouldAutoRestartRef.current = true
      setIsListening(true)
      recognitionRef.current.start()
      return true
    } catch (err) {
      if (err instanceof Error) {
        if (err.message.includes('already started')) {
          setIsListening(true)
          return true
        }
        const lowered = err.message.toLowerCase()
        const inferredCode =
          lowered.includes('not-allowed') || lowered.includes('permission')
            ? 'not-allowed'
            : 'start-failed'
        const message = mapSpeechError(inferredCode)
        setErrorCode(inferredCode)
        setError(message)
        onError?.(message)
      }
      setIsListening(false)
      return false
    }
  }, [isSupported, onError, mapSpeechError])

  const stopListening = useCallback(() => {
    if (!recognitionRef.current) return

    try {
      setIsListening(false)
      shouldAutoRestartRef.current = false
      recognitionRef.current.stop()
      setInterimTranscript('')
    } catch (err) {}
  }, [])

  const resetTranscript = useCallback(() => {
    setTranscript('')
    setInterimTranscript('')
  }, [])

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening()
    } else {
      void startListening()
    }
  }, [isListening, startListening, stopListening])

  return {
    isListening,
    transcript,
    interimTranscript,
    error,
    errorCode,
    isSupported,
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
