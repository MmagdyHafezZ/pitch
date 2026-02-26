import { useEffect, useRef, useCallback, useState } from 'react'
import type { PoseLandmark, WorldLandmark } from './usePoseLandmarker'
import type { FaceBlendshape } from './useFaceLandmarker'

// ── Model URLs ────────────────────────────────────────────────────────────────
const POSE_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task'
const FACE_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task'
const WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'

// ── Inference throttle (per model) ───────────────────────────────────────────
/**
 * Pose runs at ~20 fps — fast enough for gesture (nod/shake) and movement
 * tracking without overloading the GPU with full-resolution inference.
 */
const POSE_INTERVAL_MS = 50
/**
 * Face runs at ~10 fps — emotions change on a ~100-500ms timescale,
 * so halving the pose rate still gives smooth emotion classification.
 */
const FACE_INTERVAL_MS = 100

// ── Shared WASM singleton ─────────────────────────────────────────────────────
/**
 * FilesetResolver.forVisionTasks loads the MediaPipe WASM runtime (~10 MB).
 * Caching the Promise ensures it is fetched and compiled exactly once, even
 * when Pose and Face models initialise concurrently.
 */
let visionModulePromise: Promise<any> | null = null
function getVisionModule(): Promise<any> {
  if (!visionModulePromise) {
    visionModulePromise = import('@mediapipe/tasks-vision').then(({ FilesetResolver }) =>
      FilesetResolver.forVisionTasks(WASM_URL)
    )
  }
  return visionModulePromise
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface UseCameraDetectionOptions {
  videoRef: React.RefObject<HTMLVideoElement | null>
  enabled?: boolean
  /** Called at ~20 fps. Both args null when no person is detected. */
  onPoseLandmarks?: (
    landmarks: PoseLandmark[] | null,
    worldLandmarks: WorldLandmark[] | null
  ) => void
  /** Called at ~10 fps. null when no face is detected. */
  onFaceBlendshapes?: (blendshapes: FaceBlendshape[] | null) => void
}

export interface UseCameraDetectionReturn {
  /** True once the Pose Landmarker model is loaded and detecting. */
  poseReady: boolean
  /** True once the Face Landmarker model is loaded and detecting. */
  faceReady: boolean
}

/**
 * useCameraDetection
 *
 * Runs MediaPipe Pose Landmarker + Face Landmarker in a SINGLE rAF loop with
 * a shared WASM runtime — replacing two separate loops and two WASM loads.
 *
 * Performance characteristics:
 *  - WASM loaded once for both models (module-level singleton)
 *  - Both models initialised concurrently via Promise.all
 *  - Single RAF loop; each model has its own time gate (20/10 fps)
 *  - Graceful degradation: face failure does not block pose, and vice versa
 *
 * Replaces calling usePoseLandmarker + useFaceLandmarker separately.
 */
export function useCameraDetection({
  videoRef,
  enabled = true,
  onPoseLandmarks,
  onFaceBlendshapes,
}: UseCameraDetectionOptions): UseCameraDetectionReturn {
  const [poseReady, setPoseReady] = useState(false)
  const [faceReady, setFaceReady] = useState(false)

  const poseLandmarkerRef = useRef<any>(null)
  const faceLandmarkerRef = useRef<any>(null)
  const rafIdRef = useRef<number | null>(null)
  const lastPoseMsRef = useRef(0)
  const lastFaceMsRef = useRef(0)

  // Stable callback refs — updated on every render without recreating runLoop.
  const onPoseRef = useRef(onPoseLandmarks)
  const onFaceRef = useRef(onFaceBlendshapes)
  useEffect(() => {
    onPoseRef.current = onPoseLandmarks
  }, [onPoseLandmarks])
  useEffect(() => {
    onFaceRef.current = onFaceBlendshapes
  }, [onFaceBlendshapes])

  // ── Load both models ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled) return

    let cancelled = false

    async function init() {
      try {
        // Single WASM load for both models
        const [vision, { PoseLandmarker, FaceLandmarker }] = await Promise.all([
          getVisionModule(),
          import('@mediapipe/tasks-vision'),
        ])
        if (cancelled) return

        // Initialise both models concurrently — each gets its own instance
        const [poseResult, faceResult] = await Promise.allSettled([
          PoseLandmarker.createFromOptions(vision, {
            baseOptions: { modelAssetPath: POSE_MODEL_URL },
            runningMode: 'VIDEO',
            numPoses: 1,
            minPoseDetectionConfidence: 0.5,
            minPosePresenceConfidence: 0.5,
            minTrackingConfidence: 0.4,
          }),
          FaceLandmarker.createFromOptions(vision, {
            baseOptions: { modelAssetPath: FACE_MODEL_URL },
            runningMode: 'VIDEO',
            numFaces: 1,
            minFaceDetectionConfidence: 0.5,
            minFacePresenceConfidence: 0.5,
            minTrackingConfidence: 0.4,
            outputFaceBlendshapes: true,
          }),
        ])
        if (cancelled) {
          if (poseResult.status === 'fulfilled') poseResult.value.close()
          if (faceResult.status === 'fulfilled') faceResult.value.close()
          return
        }

        // Graceful degradation: one model failing doesn't block the other
        if (poseResult.status === 'fulfilled') {
          poseLandmarkerRef.current = poseResult.value
          setPoseReady(true)
        } else {
          console.error('[useCameraDetection] Pose model failed:', poseResult.reason)
        }
        if (faceResult.status === 'fulfilled') {
          faceLandmarkerRef.current = faceResult.value
          setFaceReady(true)
        } else {
          console.error('[useCameraDetection] Face model failed:', faceResult.reason)
        }
      } catch (err) {
        if (!cancelled) console.error('[useCameraDetection] Initialisation error:', err)
      }
    }

    void init()

    return () => {
      cancelled = true
      poseLandmarkerRef.current?.close()
      faceLandmarkerRef.current?.close()
      poseLandmarkerRef.current = null
      faceLandmarkerRef.current = null
      setPoseReady(false)
      setFaceReady(false)
    }
  }, [enabled])

  // ── Single rAF loop ───────────────────────────────────────────────────────
  const runLoop = useCallback(() => {
    rafIdRef.current = requestAnimationFrame(runLoop)

    const video = videoRef.current
    if (!video || video.readyState < 2) return
    if (video.paused && video.srcObject) {
      video.play().catch(() => {})
      return
    }

    const nowMs = performance.now()

    // Pose at ~20 fps
    if (poseLandmarkerRef.current && nowMs - lastPoseMsRef.current >= POSE_INTERVAL_MS) {
      lastPoseMsRef.current = nowMs
      const result = poseLandmarkerRef.current.detectForVideo(video, nowMs)
      if (result.landmarks?.length > 0) {
        onPoseRef.current?.(
          result.landmarks[0] as PoseLandmark[],
          (result.worldLandmarks?.[0] ?? []) as WorldLandmark[]
        )
      } else {
        onPoseRef.current?.(null, null)
      }
    }

    // Face at ~10 fps (every other pose frame)
    if (faceLandmarkerRef.current && nowMs - lastFaceMsRef.current >= FACE_INTERVAL_MS) {
      lastFaceMsRef.current = nowMs
      const result = faceLandmarkerRef.current.detectForVideo(video, nowMs)
      if (result.faceBlendshapes?.length > 0) {
        onFaceRef.current?.(result.faceBlendshapes[0] as FaceBlendshape[])
      } else {
        onFaceRef.current?.(null)
      }
    }
  }, [videoRef])

  // Start/stop the loop whenever readiness or enabled changes
  useEffect(() => {
    if (!enabled || (!poseReady && !faceReady)) return

    rafIdRef.current = requestAnimationFrame(runLoop)
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current)
        rafIdRef.current = null
      }
    }
  }, [poseReady, faceReady, enabled, runLoop])

  return { poseReady, faceReady }
}
