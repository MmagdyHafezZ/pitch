export type PostureState = 'leaning_in' | 'upright' | 'leaning_back' | 'unknown'
export type GazeState = 'camera' | 'left' | 'right' | 'down' | 'unknown'
export type MovementLevel = 'low' | 'medium' | 'high'
/**
 * Emotion inferred from MediaPipe Face Landmarker blendshapes (52 AU scores).
 *
 * happy      → smile (AU12) + cheek squint (AU6) — Duchenne smile
 * sad        → lip-corner depressor (AU17) + inner brow raise (AU1)
 * angry      → brow lowerer (AU4) + nose wrinkler (AU9)
 * frustrated → brow lowerer (AU4) WITHOUT nose wrinkler — internalized
 * surprised  → upper lid raiser (AU5) + jaw drop (AU26)
 * neutral    → no dominant activation
 * unknown    → face not detected
 */
export type EmotionState =
  | 'happy'
  | 'sad'
  | 'angry'
  | 'frustrated'
  | 'surprised'
  | 'neutral'
  | 'unknown'
/**
 * What kind of movement is occurring, not just how much.
 *
 * still      → body is composed and not moving significantly
 * head_only  → head is moving (looking around) but torso is stable
 * gesturing  → hands/wrists are actively moving (animated, expressive)
 * body_shift → torso/shoulders are shifting (repositioning in seat)
 * restless   → high-frequency whole-body movement (fidgeting, anxious)
 */
export type MovementType = 'still' | 'head_only' | 'gesturing' | 'body_shift' | 'restless'
/**
 * Head gesture detected in the last ~1 second of nose-position history.
 * nodding  → buyer agrees / actively listening
 * shaking  → buyer objects or is uncertain
 * still    → no deliberate head gesture
 */
export type HeadMotion = 'nodding' | 'shaking' | 'still'

/**
 * Semantic summary of what the camera sees — computed entirely on the client
 * by MediaPipe Pose Landmarker and sent to the server at ~2–5 Hz.
 *
 * Wire payload is intentionally small (~6 fields / ~60 bytes).
 */
export interface VisualState {
  /** Whether a person is detected with confidence ≥ 0.5 */
  present: boolean
  /** Upper-body posture inferred from landmark depth analysis */
  posture: PostureState
  /** Head gaze direction from ear visibility asymmetry */
  gaze: GazeState
  /** Overall body movement energy level */
  movement: MovementLevel
  /** What part of the body is moving and how */
  movementType: MovementType
  /** Head gesture detected over the last ~1 second */
  headMotion: HeadMotion
  /**
   * Percentage (0–100) of the last ~10 seconds where gaze === 'camera'.
   * -1 when fewer than 30 samples have been collected (< ~1 second of data).
   */
  attention: number
  /**
   * Emotion inferred from MediaPipe Face Landmarker blendshapes.
   * 'unknown' when face is not detected or face model is still loading.
   */
  emotion: EmotionState
}

export const UNKNOWN_VISUAL_STATE: VisualState = {
  present: false,
  posture: 'unknown',
  gaze: 'unknown',
  movement: 'low',
  movementType: 'still',
  headMotion: 'still',
  attention: -1,
  emotion: 'unknown',
}
