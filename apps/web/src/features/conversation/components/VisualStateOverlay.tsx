'use client'

import { memo } from 'react'
import type { VisualState } from '../types/visual-state.types'

// Static look-up tables hoisted outside the component — never re-allocated.
const EMOTION_COLOR: Record<string, string> = {
  happy: '#86efac',
  surprised: '#fde68a',
  neutral: '#f3f4f6',
  frustrated: '#fb923c',
  sad: '#93c5fd',
  angry: '#fca5a5',
  unknown: '#6b7280',
}

interface Props {
  visualState: VisualState
  isReady: boolean
  visible?: boolean
}

/**
 * VisualStateOverlay
 *
 * Debug component that renders the live VisualState in the corner of the
 * camera preview. Use it to calibrate heuristics during development.
 *
 * Calibration checklist:
 *   □ Lean forward  → posture: leaning_in
 *   □ Sit straight  → posture: upright
 *   □ Lean back     → posture: leaning_back
 *   □ Look left     → gaze: left
 *   □ Look right    → gaze: right
 *   □ Look down     → gaze: down
 *   □ Nod           → headMotion: nodding
 *   □ Shake head    → headMotion: shaking
 *   □ Hold gaze 10s → attention: rising toward 100
 *   □ Look away 10s → attention: dropping toward 0
 *   □ Walk away     → present: no, attention resets
 *   □ Smile         → emotion: happy
 *   □ Frown/brow up → emotion: sad
 *   □ Brow furrow   → emotion: frustrated / angry
 *   □ Eyes wide + jaw open → emotion: surprised
 */
export const VisualStateOverlay = memo(function VisualStateOverlay({
  visualState,
  isReady,
  visible = true,
}: Props) {
  if (!visible) return null

  const { present, posture, gaze, movement, movementType, headMotion, attention, emotion } =
    visualState

  const engagement = deriveEngagementLabel(visualState)
  const engagementColor = engagement.includes('HIGH')
    ? '#22c55e'
    : engagement.includes('LOW')
      ? '#ef4444'
      : '#facc15'

  const attentionDisplay = attention < 0 ? '—' : `${attention}%`
  const attentionColor =
    attention < 0
      ? '#6b7280'
      : attention >= 60
        ? '#86efac'
        : attention >= 35
          ? '#fde68a'
          : '#fca5a5'

  const headMotionColor =
    headMotion === 'nodding' ? '#86efac' : headMotion === 'shaking' ? '#fca5a5' : '#f3f4f6'

  return (
    <div
      style={{
        position: 'absolute',
        top: 8,
        left: 8,
        background: 'rgba(0,0,0,0.75)',
        color: '#fff',
        fontSize: 11,
        fontFamily: 'monospace',
        padding: '6px 10px',
        borderRadius: 6,
        lineHeight: 1.7,
        pointerEvents: 'none',
        zIndex: 10,
        minWidth: 180,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: isReady ? '#22c55e' : '#6b7280',
            flexShrink: 0,
          }}
        />
        <span style={{ color: '#9ca3af', fontSize: 10 }}>
          {isReady ? 'pose + face AI active' : 'loading…'}
        </span>
      </div>

      <Row label="present" value={present ? 'yes' : 'no'} color={present ? '#86efac' : '#fca5a5'} />
      <Row label="posture" value={posture} />
      <Row label="gaze" value={gaze} />
      <Row label="movement" value={movement} />
      <Row label="move type" value={movementType} />
      <Row label="head" value={headMotion} color={headMotionColor} />
      <Row label="emotion" value={emotion} color={EMOTION_COLOR[emotion] ?? '#f3f4f6'} />
      <Row label="attention" value={attentionDisplay} color={attentionColor} />

      <div style={{ marginTop: 5, fontSize: 10, color: engagementColor, fontWeight: 600 }}>
        {engagement}
      </div>
    </div>
  )
})

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
      <span style={{ color: '#9ca3af' }}>{label}</span>
      <span style={{ color: color ?? '#f3f4f6' }}>{value}</span>
    </div>
  )
}

function deriveEngagementLabel(state: VisualState): string {
  if (!state.present) return 'Engagement: LOW (absent)'

  const attention = state.attention ?? -1
  const hasAttention = attention >= 0

  if (
    (state.posture === 'leaning_in' || state.posture === 'upright') &&
    state.gaze === 'camera' &&
    (!hasAttention || attention >= 55)
  )
    return 'Engagement: HIGH'

  if (
    state.posture === 'leaning_back' &&
    state.movement === 'low' &&
    state.gaze !== 'camera' &&
    (!hasAttention || attention < 40)
  )
    return 'Engagement: LOW'

  if (hasAttention && attention < 30) return 'Engagement: LOW'

  return 'Engagement: MEDIUM'
}
