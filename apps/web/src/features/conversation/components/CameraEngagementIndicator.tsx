'use client'

interface Props {
  /** Whether visual body-language sensing is currently active */
  isActive: boolean
  /** Whether MediaPipe has finished loading and is running */
  isReady: boolean
  /** Toggle visual sensing on/off */
  onToggle: () => void
  className?: string
}

/**
 * CameraEngagementIndicator
 *
 * Small UX element that:
 *  - Shows a green/grey dot indicating whether body-language sensing is active
 *  - Allows the user to toggle it off (privacy control)
 *  - Shows a tooltip with a plain-language explanation of what it does
 *    (important for consent and trust)
 *
 * Usage:
 *   const [visualEnabled, setVisualEnabled] = useState(true)
 *   ...
 *   <CameraEngagementIndicator
 *     isActive={visualEnabled}
 *     isReady={isReady}
 *     onToggle={() => setVisualEnabled(v => !v)}
 *   />
 *
 * Notes:
 *  - No video is stored or transmitted — only a ~40-byte semantic JSON
 *    describing posture/gaze/movement is sent.
 *  - The LLM never sees raw video; it only sees a short natural-language
 *    sentence like "person is leaning in, looking at the camera".
 */
export function CameraEngagementIndicator({ isActive, isReady, onToggle, className }: Props) {
  const dotColor = !isActive ? '#6b7280' : isReady ? '#22c55e' : '#facc15'
  const label = !isActive
    ? 'Body language OFF'
    : isReady
      ? 'Body language ON'
      : 'Body language loading…'

  return (
    <button
      type="button"
      onClick={onToggle}
      title={
        isActive
          ? 'Body language sensing is ON. The AI reads your posture and gaze to adjust its responses. No video is stored. Click to turn off.'
          : 'Body language sensing is OFF. Click to let the AI read your posture and gaze to improve its responses.'
      }
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        background: 'transparent',
        border: '1px solid rgba(255,255,255,0.15)',
        borderRadius: 20,
        padding: '4px 10px',
        cursor: 'pointer',
        fontSize: 12,
        color: '#d1d5db',
        transition: 'opacity 0.15s',
      }}
      className={className}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: dotColor,
          flexShrink: 0,
          transition: 'background 0.3s',
          // Pulse animation when active and ready
          boxShadow: isActive && isReady ? `0 0 0 0 ${dotColor}` : 'none',
        }}
      />
      <span>{label}</span>
    </button>
  )
}
