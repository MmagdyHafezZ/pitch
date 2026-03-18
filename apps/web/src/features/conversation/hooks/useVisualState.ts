import { useEffect, useRef, useCallback, useState } from 'react'
import { useCameraDetection } from './useCameraDetection'
import type { PoseLandmark, WorldLandmark } from './usePoseLandmarker'
import type { FaceBlendshape } from './useFaceLandmarker'
import { conversationService } from '../services/conversation.service'
import {
  type VisualState,
  type PostureState,
  type GazeState,
  type MovementLevel,
  type MovementType,
  type HeadMotion,
  type EmotionState,
  UNKNOWN_VISUAL_STATE,
} from '../types/visual-state.types'

interface UseVisualStateOptions {
  sessionId: string
  videoRef: React.RefObject<HTMLVideoElement | null>
  enabled?: boolean
  /** Minimum ms between sends. Default 300 ms (~3 Hz). */
  sendIntervalMs?: number
  /** After this many ms of present=false, fire onUserAbsent. Default 8 s. */
  absenceTimeoutMs?: number
  onUserAbsent?: () => void
  onUserReturned?: () => void
}

// Rolling-window sizes — calibrated to useCameraDetection's inference rates:
//   Pose: ~20 fps (POSE_INTERVAL_MS = 50)
//   Face: ~10 fps (FACE_INTERVAL_MS = 100)
const MOTION_WINDOW = 20 // ~1 s of nose history at 20 fps (nod/shake detection)
const ATTENTION_WINDOW = 200 // ~10 s of gaze history at 20 fps

const isFaceBlendshape = (value: unknown): value is FaceBlendshape => {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return typeof record.categoryName === 'string' && typeof record.score === 'number'
}

const normalizeBlendshapes = (input: unknown): FaceBlendshape[] => {
  if (Array.isArray(input) && input.every(isFaceBlendshape)) {
    return input
  }

  if (input && typeof input === 'object') {
    const categories = (input as { categories?: unknown }).categories
    if (Array.isArray(categories) && categories.every(isFaceBlendshape)) {
      return categories
    }
  }

  return []
}

export function useVisualState({
  sessionId,
  videoRef,
  enabled = true,
  sendIntervalMs = 300,
  absenceTimeoutMs = 8000,
  onUserAbsent,
  onUserReturned,
}: UseVisualStateOptions) {
  // Per-frame computation refs
  const lastSentRef = useRef<{ state: VisualState; at: number } | null>(null)
  const prevNoseRef = useRef<{ x: number; y: number } | null>(null)
  const movingAvgRef = useRef<number[]>([])

  // Temporal-smoothing windows (7-frame majority vote)
  const postureWindowRef = useRef<PostureState[]>([])
  const gazeWindowRef = useRef<GazeState[]>([])

  // Head-motion: 1 s of nose {x,y} for nod/shake analysis
  const noseHistoryRef = useRef<Array<{ x: number; y: number }>>([])
  // Attention: 10 s of smoothed gaze labels
  const gazeHistoryRef = useRef<GazeState[]>([])

  // Movement-type refs: compare head vs torso vs hands frame-to-frame
  const prevShoulderRef = useRef<{ x: number; y: number } | null>(null)
  const shoulderAvgRef = useRef<number[]>([])
  const prevWristRef = useRef<{ lx: number; ly: number; rx: number; ry: number } | null>(null)
  const wristAvgRef = useRef<number[]>([])

  // Emotion: 15-frame majority-vote window (~500 ms at 30 fps)
  const emotionWindowRef = useRef<EmotionState[]>([])
  const latestEmotionRef = useRef<EmotionState>('unknown')

  // Absence tracking
  const absenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isAbsentRef = useRef(false)
  const onUserAbsentRef = useRef(onUserAbsent)
  const onUserReturnedRef = useRef(onUserReturned)
  useEffect(() => {
    onUserAbsentRef.current = onUserAbsent
  }, [onUserAbsent])
  useEffect(() => {
    onUserReturnedRef.current = onUserReturned
  }, [onUserReturned])

  const [currentState, setCurrentState] = useState<VisualState>(UNKNOWN_VISUAL_STATE)

  const clearAbsenceTimer = useCallback(() => {
    if (absenceTimerRef.current) {
      clearTimeout(absenceTimerRef.current)
      absenceTimerRef.current = null
    }
  }, [])

  const resetBuffers = useCallback(() => {
    prevNoseRef.current = null
    movingAvgRef.current = []
    postureWindowRef.current = []
    gazeWindowRef.current = []
    noseHistoryRef.current = []
    prevShoulderRef.current = null
    shoulderAvgRef.current = []
    prevWristRef.current = null
    wristAvgRef.current = []
    emotionWindowRef.current = []
    // Intentionally do NOT clear gazeHistoryRef here — the attention score
    // should survive brief detection gaps (blink, slight head turn, etc.).
    // It resets only when the person is confirmed absent (see handleLandmarks).
  }, [])

  const handleLandmarks = useCallback(
    (landmarks: PoseLandmark[] | null, worldLandmarks: WorldLandmark[] | null) => {
      // ── Person absent ───────────────────────────────────────────────────────
      if (!landmarks || !worldLandmarks) {
        resetBuffers()

        if (absenceTimeoutMs > 0 && !absenceTimerRef.current && !isAbsentRef.current) {
          absenceTimerRef.current = setTimeout(() => {
            isAbsentRef.current = true
            absenceTimerRef.current = null
            gazeHistoryRef.current = [] // full reset on confirmed long absence
            onUserAbsentRef.current?.()
          }, absenceTimeoutMs)
        }

        const last = lastSentRef.current
        const now = Date.now()
        if (!last || last.state.present || now - last.at >= sendIntervalMs) {
          setCurrentState(UNKNOWN_VISUAL_STATE)
          conversationService.sendVisualState(sessionId, UNKNOWN_VISUAL_STATE)
          lastSentRef.current = { state: UNKNOWN_VISUAL_STATE, at: now }
        }
        return
      }

      // ── Person present ──────────────────────────────────────────────────────
      clearAbsenceTimer()
      if (isAbsentRef.current) {
        isAbsentRef.current = false
        onUserReturnedRef.current?.()
      }

      const raw = computeVisualState(
        landmarks,
        worldLandmarks,
        prevNoseRef,
        movingAvgRef,
        prevShoulderRef,
        shoulderAvgRef,
        prevWristRef,
        wristAvgRef
      )

      if (!raw.present) {
        // Landmarks exist but nose confidence is too low — treat as soft-absent
        // without triggering the full absence timer.
        setCurrentState(UNKNOWN_VISUAL_STATE)
        return
      }

      // ── Posture / gaze smoothing (7-frame majority vote) ───────────────────
      const pWin = postureWindowRef.current
      pWin.push(raw.posture)
      if (pWin.length > 7) pWin.shift()

      const gWin = gazeWindowRef.current
      gWin.push(raw.gaze)
      if (gWin.length > 7) gWin.shift()

      const smoothedPosture = majority(pWin, raw.posture)
      const smoothedGaze = majority(gWin, raw.gaze)

      // ── Head motion (nod / shake) ──────────────────────────────────────────
      const nose = landmarks[0] // NOSE index
      const noseHist = noseHistoryRef.current
      noseHist.push({ x: nose.x, y: nose.y })
      if (noseHist.length > MOTION_WINDOW) noseHist.shift()
      const headMotion = detectHeadMotion(noseHist)

      // ── Attention score ────────────────────────────────────────────────────
      const gazeHist = gazeHistoryRef.current
      gazeHist.push(smoothedGaze)
      if (gazeHist.length > ATTENTION_WINDOW) gazeHist.shift()
      const attention =
        gazeHist.length >= 30
          ? Math.round((gazeHist.filter((g) => g === 'camera').length / gazeHist.length) * 100)
          : -1 // not enough history yet

      const state: VisualState = {
        ...raw,
        posture: smoothedPosture,
        gaze: smoothedGaze,
        headMotion,
        attention,
        emotion: latestEmotionRef.current,
        // movementType is already on raw (computed inside computeVisualState)
      }

      setCurrentState(state)

      // ── Throttled send ─────────────────────────────────────────────────────
      const now = Date.now()
      const last = lastSentRef.current
      // Hard cap outbound visual-state updates to at most one every sendIntervalMs.
      if (last && now - last.at < sendIntervalMs) {
        return
      }
      if (
        last &&
        last.state.present === state.present &&
        last.state.posture === state.posture &&
        last.state.gaze === state.gaze &&
        last.state.movement === state.movement &&
        last.state.movementType === state.movementType &&
        last.state.headMotion === state.headMotion &&
        last.state.emotion === state.emotion &&
        Math.abs((last.state.attention ?? -1) - state.attention) < 5 // allow 5% drift before re-send
      ) {
        return
      }

      conversationService.sendVisualState(sessionId, state)
      lastSentRef.current = { state, at: now }
    },
    [sessionId, sendIntervalMs, absenceTimeoutMs, clearAbsenceTimer, resetBuffers]
  )

  // ── Emotion from Face Landmarker blendshapes ─────────────────────────────
  const handleBlendshapes = useCallback((blendshapes: FaceBlendshape[] | null) => {
    // Face not detected — don't overwrite the window; let last known emotion
    // persist until the 15-frame window naturally fills with new classifications.
    if (!blendshapes) return
    const normalizedBlendshapes = normalizeBlendshapes(blendshapes)
    if (normalizedBlendshapes.length === 0) return
    const raw = classifyEmotion(normalizedBlendshapes)
    const win = emotionWindowRef.current
    win.push(raw)
    if (win.length > 15) win.shift()
    latestEmotionRef.current = majority(win, raw)
  }, [])

  // ── Single RAF loop for both models (shared WASM, throttled) ─────────────
  const { poseReady, faceReady } = useCameraDetection({
    videoRef,
    enabled,
    onPoseLandmarks: handleLandmarks,
    onFaceBlendshapes: handleBlendshapes,
  })
  const isReady = poseReady || faceReady

  useEffect(() => {
    if (!enabled) {
      clearAbsenceTimer()
      isAbsentRef.current = false
      resetBuffers()
      gazeHistoryRef.current = []
      emotionWindowRef.current = []
      latestEmotionRef.current = 'unknown'
      lastSentRef.current = null
      setCurrentState(UNKNOWN_VISUAL_STATE)
      conversationService.sendVisualState(sessionId, UNKNOWN_VISUAL_STATE)
    }
  }, [enabled, sessionId, clearAbsenceTimer, resetBuffers])

  useEffect(() => () => clearAbsenceTimer(), [clearAbsenceTimer])

  return { isReady, currentState }
}

// ── Landmark indices ──────────────────────────────────────────────────────────
const NOSE = 0
const LEFT_EYE_INNER = 1
const RIGHT_EYE_INNER = 4
const LEFT_EAR = 7
const RIGHT_EAR = 8
const LEFT_SHOULDER = 11
const RIGHT_SHOULDER = 12
const LEFT_WRIST = 15
const RIGHT_WRIST = 16
const LEFT_HIP = 23
const RIGHT_HIP = 24

const VIS_MIN = 0.4

function computeVisualState(
  landmarks: PoseLandmark[],
  worldLandmarks: WorldLandmark[],
  prevNoseRef: React.MutableRefObject<{ x: number; y: number } | null>,
  movingAvgRef: React.MutableRefObject<number[]>,
  prevShoulderRef: React.MutableRefObject<{ x: number; y: number } | null>,
  shoulderAvgRef: React.MutableRefObject<number[]>,
  prevWristRef: React.MutableRefObject<{ lx: number; ly: number; rx: number; ry: number } | null>,
  wristAvgRef: React.MutableRefObject<number[]>
): VisualState {
  if (!landmarks || landmarks.length < 25) {
    prevNoseRef.current = null
    movingAvgRef.current = []
    prevShoulderRef.current = null
    shoulderAvgRef.current = []
    prevWristRef.current = null
    wristAvgRef.current = []
    return UNKNOWN_VISUAL_STATE
  }

  const nose = landmarks[NOSE]
  if ((nose.visibility ?? 0) < 0.5) {
    prevNoseRef.current = null
    return UNKNOWN_VISUAL_STATE
  }

  const leftEyeInner = landmarks[LEFT_EYE_INNER]
  const rightEyeInner = landmarks[RIGHT_EYE_INNER]
  const leftShoulder = landmarks[LEFT_SHOULDER]
  const rightShoulder = landmarks[RIGHT_SHOULDER]
  const leftHip = landmarks[LEFT_HIP]
  const rightHip = landmarks[RIGHT_HIP]
  const leftEar = landmarks[LEFT_EAR]
  const rightEar = landmarks[RIGHT_EAR]
  const leftWrist = landmarks[LEFT_WRIST]
  const rightWrist = landmarks[RIGHT_WRIST]

  const wNose = worldLandmarks[NOSE]
  const wLeftShoulder = worldLandmarks[LEFT_SHOULDER]
  const wRightShoulder = worldLandmarks[RIGHT_SHOULDER]
  const wLeftHip = worldLandmarks[LEFT_HIP]
  const wRightHip = worldLandmarks[RIGHT_HIP]

  const shouldersVisible =
    (leftShoulder.visibility ?? 0) > VIS_MIN && (rightShoulder.visibility ?? 0) > VIS_MIN
  const hipsVisible = (leftHip.visibility ?? 0) > VIS_MIN && (rightHip.visibility ?? 0) > VIS_MIN

  // ── Posture ────────────────────────────────────────────────────────────────
  let posture: PostureState = 'unknown'

  if (shouldersVisible) {
    if (hipsVisible) {
      const torsoHeight = (wLeftHip.y + wRightHip.y) / 2 - (wLeftShoulder.y + wRightShoulder.y) / 2
      if (torsoHeight < 0.2) posture = 'leaning_in'
      else if (torsoHeight > 0.32) posture = 'leaning_back'
      else posture = 'upright'
    } else {
      // Desk/laptop: use metric Z. noseAheadOfShoulders = how far (m) nose
      // is in front of shoulders. Upright ≈ 0.15 m; lean-in > 0.22; lean-back < 0.08.
      const avgShoulderZ = (wLeftShoulder.z + wRightShoulder.z) / 2
      const noseAhead = avgShoulderZ - wNose.z
      if (noseAhead > 0.22) posture = 'leaning_in'
      else if (noseAhead < 0.08) posture = 'leaning_back'
      else posture = 'upright'
    }
  }

  // ── Gaze ───────────────────────────────────────────────────────────────────
  const earDiff = (leftEar.visibility ?? 0) - (rightEar.visibility ?? 0)
  const eyeMidY = (leftEyeInner.y + rightEyeInner.y) / 2
  const noseBelowEyes = nose.y - eyeMidY

  let gaze: GazeState
  if (noseBelowEyes > 0.16) gaze = 'down'
  else if (earDiff < -0.25) gaze = 'right'
  else if (earDiff > 0.25) gaze = 'left'
  else gaze = 'camera'

  // ── Head movement (5-frame rolling average of nose delta) ─────────────────
  const prevNose = prevNoseRef.current
  let headDelta = 0
  if (prevNose) {
    const dx = nose.x - prevNose.x
    const dy = nose.y - prevNose.y
    headDelta = Math.sqrt(dx * dx + dy * dy)
  }
  prevNoseRef.current = { x: nose.x, y: nose.y }

  const headBuf = movingAvgRef.current
  headBuf.push(headDelta)
  if (headBuf.length > 5) headBuf.shift()
  const avgHeadDelta = headBuf.reduce((a, b) => a + b, 0) / headBuf.length

  let movement: MovementLevel = 'low'
  if (avgHeadDelta > 0.02) movement = 'high'
  else if (avgHeadDelta > 0.007) movement = 'medium'

  // ── Shoulder (torso) movement ─────────────────────────────────────────────
  // When shoulders off-screen, fall back to nose so shoulderActive can't fire.
  const shoulderMidX = shouldersVisible ? (leftShoulder.x + rightShoulder.x) / 2 : nose.x
  const shoulderMidY = shouldersVisible ? (leftShoulder.y + rightShoulder.y) / 2 : nose.y
  const prevShoulder = prevShoulderRef.current
  let shoulderDelta = 0
  if (prevShoulder) {
    const dx = shoulderMidX - prevShoulder.x
    const dy = shoulderMidY - prevShoulder.y
    shoulderDelta = Math.sqrt(dx * dx + dy * dy)
  }
  prevShoulderRef.current = { x: shoulderMidX, y: shoulderMidY }

  const shoulderBuf = shoulderAvgRef.current
  shoulderBuf.push(shoulderDelta)
  if (shoulderBuf.length > 5) shoulderBuf.shift()
  const avgShoulderDelta = shoulderBuf.reduce((a, b) => a + b, 0) / shoulderBuf.length

  // ── Wrist movement ─────────────────────────────────────────────────────────
  const lwVis = (leftWrist.visibility ?? 0) > 0.3
  const rwVis = (rightWrist.visibility ?? 0) > 0.3
  const prevWrist = prevWristRef.current
  let wristDelta = 0
  if (prevWrist && (lwVis || rwVis)) {
    const ldx = lwVis ? leftWrist.x - prevWrist.lx : 0
    const ldy = lwVis ? leftWrist.y - prevWrist.ly : 0
    const rdx = rwVis ? rightWrist.x - prevWrist.rx : 0
    const rdy = rwVis ? rightWrist.y - prevWrist.ry : 0
    wristDelta = Math.max(Math.sqrt(ldx * ldx + ldy * ldy), Math.sqrt(rdx * rdx + rdy * rdy))
  }
  prevWristRef.current = { lx: leftWrist.x, ly: leftWrist.y, rx: rightWrist.x, ry: rightWrist.y }

  const wristBuf = wristAvgRef.current
  wristBuf.push(wristDelta)
  if (wristBuf.length > 5) wristBuf.shift()
  const avgWristDelta = wristBuf.reduce((a, b) => a + b, 0) / wristBuf.length

  // ── MovementType classification ────────────────────────────────────────────
  // Thresholds tuned for normalized [0,1] coords at typical webcam distance.
  const headActive = avgHeadDelta > 0.007 // same gate as movement 'medium'
  const shoulderActive = avgShoulderDelta > 0.005 && shouldersVisible
  const wristActive = avgWristDelta > 0.015 && (lwVis || rwVis)

  let movementType: MovementType = 'still'
  if (wristActive && (headActive || shoulderActive)) movementType = 'restless'
  else if (wristActive) movementType = 'gesturing'
  else if (shoulderActive) movementType = 'body_shift'
  else if (headActive) movementType = 'head_only'

  // headMotion, attention, and emotion are merged in by handleLandmarks
  return {
    present: true,
    posture,
    gaze,
    movement,
    movementType,
    headMotion: 'still',
    attention: -1,
    emotion: 'unknown',
  }
}

/**
 * detectHeadMotion
 *
 * Analyses a 1-second nose position buffer for nod/shake patterns.
 *
 * Algorithm: count direction reversals (zero-crossings of velocity) in
 * Y (nod) and X (shake). A genuine gesture needs ≥2 reversals with
 * enough peak-to-peak amplitude to rule out micro-tremor.
 */
function detectHeadMotion(history: Array<{ x: number; y: number }>): HeadMotion {
  if (history.length < 10) return 'still'

  const ys = history.map((p) => p.y)
  const xs = history.map((p) => p.x)

  const yRange = Math.max(...ys) - Math.min(...ys)
  const xRange = Math.max(...xs) - Math.min(...xs)

  // Require enough amplitude to distinguish gesture from normal micro-movement
  const yReversals = yRange > 0.025 ? countReversals(ys) : 0
  const xReversals = xRange > 0.022 ? countReversals(xs) : 0

  if (yReversals >= 2) return 'nodding'
  if (xReversals >= 2) return 'shaking'
  return 'still'
}

/** Counts direction changes (velocity sign flips) in a position sequence. */
function countReversals(arr: number[]): number {
  let count = 0
  let prevDir = 0
  for (let i = 1; i < arr.length; i++) {
    const dir = Math.sign(arr[i] - arr[i - 1])
    if (dir !== 0) {
      if (prevDir !== 0 && dir !== prevDir) count++
      prevDir = dir
    }
  }
  return count
}

/** Returns the most-common item in arr; ties keep the first seen (hysteresis). */
function majority<T extends string>(arr: T[], fallback: T): T {
  if (arr.length === 0) return fallback
  const counts = new Map<T, number>()
  let best = arr[0]
  let bestCount = 0
  for (const item of arr) {
    const n = (counts.get(item) ?? 0) + 1
    counts.set(item, n)
    if (n > bestCount) {
      bestCount = n
      best = item
    }
  }
  return best
}

// ── Blendshape index cache ────────────────────────────────────────────────────
/**
 * MediaPipe returns blendshapes in the same order every frame for a given
 * model version. We build a name→index map once on first call and reuse it,
 * eliminating the per-frame Record<string,number> allocation entirely.
 */
let blendshapeIndexMap: Map<string, number> | null = null
function bsScore(shapes: FaceBlendshape[], name: string): number {
  if (!Array.isArray(shapes) || shapes.length === 0) {
    blendshapeIndexMap = null
    return 0
  }

  if (!blendshapeIndexMap) {
    blendshapeIndexMap = new Map(shapes.map((s, i) => [s.categoryName, i]))
  }
  const idx = blendshapeIndexMap.get(name)
  return idx !== undefined ? (shapes[idx]?.score ?? 0) : 0
}

/**
 * classifyEmotion
 *
 * Maps MediaPipe Face Landmarker blendshapes (52 ARKit-compatible Action Units,
 * each [0–1]) to a discrete EmotionState using composite FACS-inspired scores.
 *
 * Zero per-frame heap allocation — uses cached index lookups via bsScore().
 *
 * Priority: happy first so a Duchenne smile (which also widens eyes) is never
 * mis-classified as surprised.
 */
function classifyEmotion(blendshapes: FaceBlendshape[]): EmotionState {
  const g = (name: string) => bsScore(blendshapes, name)

  // Raw signals
  const smile = (g('mouthSmileLeft') + g('mouthSmileRight')) / 2
  const squint = (g('cheekSquintLeft') + g('cheekSquintRight')) / 2
  const frown = (g('mouthFrownLeft') + g('mouthFrownRight')) / 2
  const browDown = (g('browDownLeft') + g('browDownRight')) / 2
  const browInner = g('browInnerUp')
  const browOuter = (g('browOuterUpLeft') + g('browOuterUpRight')) / 2
  const eyeWide = (g('eyeWideLeft') + g('eyeWideRight')) / 2
  const jawOpen = g('jawOpen')
  const sneer = (g('noseSneerLeft') + g('noseSneerRight')) / 2

  // Composite scores (FACS-inspired)
  const happyScore = smile * 0.65 + squint * 0.35 // AU12 + AU6
  const angryScore = browDown * 0.5 + sneer * 0.5 // AU4 + AU9
  const frustratedScore = Math.max(0, browDown - sneer * 1.5) // AU4 without AU9
  const sadScore = Math.max(0, (frown * 0.5 + browInner * 0.5) * (1 - smile * 2))
  const surprisedScore = eyeWide * 0.4 + jawOpen * 0.4 + browOuter * 0.2

  if (happyScore > 0.3) return 'happy'
  if (angryScore > 0.35) return 'angry'
  if (frustratedScore > 0.28) return 'frustrated'
  if (sadScore > 0.22) return 'sad'
  if (surprisedScore > 0.35) return 'surprised'
  return 'neutral'
}
