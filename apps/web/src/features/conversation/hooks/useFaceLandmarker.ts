import { useEffect, useRef, useState, useCallback } from 'react'

/** A single blendshape category with its activation score [0–1]. */
export interface FaceBlendshape {
  categoryName: string
  score: number
}

interface UseFaceLandmarkerOptions {
  videoRef: React.RefObject<HTMLVideoElement | null>
  enabled?: boolean
  /**
   * Called every detection frame with the first detected face's blendshapes.
   * null when no face is detected — use this to immediately clear emotion state.
   */
  onBlendshapes?: (blendshapes: FaceBlendshape[] | null) => void
}

// Face Landmarker model includes blendshapes (52 ARKit-compatible Action Units).
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task'
const WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'

/**
 * useFaceLandmarker
 *
 * Loads MediaPipe Face Landmarker (on-device WebAssembly) and drives a
 * requestAnimationFrame loop that feeds each video frame through it.
 *
 * Key API contract:
 *  - onBlendshapes(null)        → no face in frame (fired every absent frame)
 *  - onBlendshapes(blendshapes) → face detected; blendshapes = 52 AU scores [0–1]
 *
 * Runs independently from usePoseLandmarker — both can share the same videoRef.
 */
export function useFaceLandmarker({
  videoRef,
  enabled = true,
  onBlendshapes,
}: UseFaceLandmarkerOptions): { isReady: boolean } {
  const [isReady, setIsReady] = useState(false)
  const landmarkerRef = useRef<any>(null)
  const rafIdRef = useRef<number | null>(null)
  const onBlendshapesRef = useRef(onBlendshapes)

  useEffect(() => {
    onBlendshapesRef.current = onBlendshapes
  }, [onBlendshapes])

  // ── Initialize FaceLandmarker ─────────────────────────────────────────────
  useEffect(() => {
    if (!enabled) return

    let cancelled = false

    async function init() {
      try {
        const { FilesetResolver, FaceLandmarker } = await import('@mediapipe/tasks-vision')
        const vision = await FilesetResolver.forVisionTasks(WASM_URL)

        const landmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MODEL_URL },
          runningMode: 'VIDEO',
          numFaces: 1,
          minFaceDetectionConfidence: 0.5,
          minFacePresenceConfidence: 0.5,
          minTrackingConfidence: 0.4,
          outputFaceBlendshapes: true, // required for emotion detection
        })

        if (!cancelled) {
          landmarkerRef.current = landmarker
          setIsReady(true)
        } else {
          landmarker.close()
        }
      } catch (err) {
        if (!cancelled) console.error('[useFaceLandmarker] Failed to load MediaPipe:', err)
      }
    }

    void init()

    return () => {
      cancelled = true
      if (landmarkerRef.current) {
        landmarkerRef.current.close()
        landmarkerRef.current = null
        setIsReady(false)
      }
    }
  }, [enabled])

  // ── rAF detection loop ────────────────────────────────────────────────────
  const runLoop = useCallback(() => {
    const video = videoRef.current
    const landmarker = landmarkerRef.current

    if (!video || !landmarker) {
      rafIdRef.current = requestAnimationFrame(runLoop)
      return
    }

    if (video.srcObject && video.paused) {
      video.play().catch(() => {})
      rafIdRef.current = requestAnimationFrame(runLoop)
      return
    }

    if (video.readyState < 2) {
      rafIdRef.current = requestAnimationFrame(runLoop)
      return
    }

    const nowMs = performance.now()
    const result = landmarker.detectForVideo(video, nowMs)

    if (result.faceBlendshapes && result.faceBlendshapes.length > 0) {
      onBlendshapesRef.current?.(result.faceBlendshapes[0] as FaceBlendshape[])
    } else {
      onBlendshapesRef.current?.(null)
    }

    rafIdRef.current = requestAnimationFrame(runLoop)
  }, [videoRef])

  useEffect(() => {
    if (!isReady || !enabled) return

    rafIdRef.current = requestAnimationFrame(runLoop)

    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current)
        rafIdRef.current = null
      }
    }
  }, [isReady, enabled, runLoop])

  return { isReady }
}
