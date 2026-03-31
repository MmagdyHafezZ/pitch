export type PabloExpressionMode = 'normal' | 'mad'

export type PabloMorphState = {
  mad: number
  open_mouth: number
  open: number
  open_mad: number
}

const RUDE_KAREN_TONE = 'rude karen'

function normalizeLabel(value?: string | null): string | null {
  const normalized = value?.trim().toLowerCase()
  return normalized || null
}

export function getPabloExpressionMode({
  tone,
  isFrustrated = false,
}: {
  tone?: string | null
  isFrustrated?: boolean
} = {}): PabloExpressionMode {
  return isFrustrated || normalizeLabel(tone) === RUDE_KAREN_TONE ? 'mad' : 'normal'
}

export function getPabloMorphState(
  expressionMode: PabloExpressionMode,
  mouthOpen: boolean
): PabloMorphState {
  if (expressionMode === 'mad') {
    return {
      mad: 1,
      open_mouth: 0,
      open: 0,
      open_mad: mouthOpen ? 1 : 0,
    }
  }

  return {
    mad: 0,
    open_mouth: mouthOpen ? 1 : 0,
    open: mouthOpen ? 1 : 0,
    open_mad: 0,
  }
}
