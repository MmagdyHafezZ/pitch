import { useEffect, useRef, useState, useCallback } from 'react'

/**
 * Normalized image-space landmark (x, y ∈ [0,1], z normalized depth).
 * Use these for 2D screen-space calculations (gaze, movement).
 */
export interface PoseLandmark {
  x: number
  y: number
  z: number
  visibility?: number
}

/**
 * World-space landmark in metric units (meters), hip-midpoint as origin.
 * Use these for 3D depth/posture analysis — far more reliable than normalized Z.
 */
export interface WorldLandmark {
  x: number
  y: number
  z: number
  visibility?: number
}

interface UsePoseLandmarkerOptions {
  videoRef: React.RefObject<HTMLVideoElement | null>
  enabled?: boolean
  /**
   * Called every detection frame.
   * Both arguments are null when no person is detected in the frame —
   * use this to immediately clear "present" state rather than waiting for a timeout.
   */
  onLandmarks?: (landmarks: PoseLandmark[] | null, worldLandmarks: WorldLandmark[] | null) => void
}

interface UsePoseLandmarkerReturn {
  isReady: boolean
  landmarks: PoseLandmark[] | null
}

// Full model: better landmark precision, especially for Z-depth and ear visibility.
// ~10 MB vs Lite's ~3 MB; runs fine at webcam frame rates on any modern laptop.
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task'
const WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'

/**
 * usePoseLandmarker
 *
 * Loads the MediaPipe Pose Landmarker Full model (WebAssembly, on-device) and
 * drives a requestAnimationFrame loop that feeds each video frame through it.
 *
 * Key API contract:
 *  - onLandmarks(null, null)   → no person in frame (fire every absent frame)
 *  - onLandmarks(lm, wlm)     → person detected; lm = normalized, wlm = world (meters)
 */
export function usePoseLandmarker({
  videoRef,
  enabled = true,
  onLandmarks,
}: UsePoseLandmarkerOptions): UsePoseLandmarkerReturn {
  const [isReady, setIsReady] = useState(false)
  const [landmarks, setLandmarks] = useState<PoseLandmark[] | null>(null)

  const landmarkerRef = useRef<any>(null)
  const rafIdRef = useRef<number | null>(null)
  const onLandmarksRef = useRef(onLandmarks)

  useEffect(() => {
    onLandmarksRef.current = onLandmarks
  }, [onLandmarks])

  // ── Initialize PoseLandmarker ─────────────────────────────────────────────
  useEffect(() => {
    if (!enabled) return

    let cancelled = false

    async function init() {
      try {
        const { FilesetResolver, PoseLandmarker } = await import('@mediapipe/tasks-vision')
        const vision = await FilesetResolver.forVisionTasks(WASM_URL)

        const landmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MODEL_URL },
          runningMode: 'VIDEO',
          numPoses: 1,
          // 0.5 detection/presence — reduces false positives ("present" with nobody visible).
          // Tracking can be slightly lower so we don't drop a real person mid-session.
          minPoseDetectionConfidence: 0.5,
          minPosePresenceConfidence: 0.5,
          minTrackingConfidence: 0.4,
        })

        if (!cancelled) {
          landmarkerRef.current = landmarker
          setIsReady(true)
        } else {
          landmarker.close()
        }
      } catch (err) {
        if (!cancelled) {
          console.error('[usePoseLandmarker] Failed to load MediaPipe:', err)
        }
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

    // Kick play() if srcObject was assigned after mount (autoPlay doesn't re-fire)
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

    if (result.landmarks && result.landmarks.length > 0) {
      const lm = result.landmarks[0] as PoseLandmark[]
      const wlm = (result.worldLandmarks?.[0] ?? []) as WorldLandmark[]
      setLandmarks(lm)
      onLandmarksRef.current?.(lm, wlm)
    } else {
      // Explicit null signal every absent frame — consumers must not infer
      // "still present" from silence when nobody is in view.
      setLandmarks(null)
      onLandmarksRef.current?.(null, null)
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

  return { isReady, landmarks }
}
