/** @jest-environment jsdom */
import {
  formatMetricLabel,
  clampMetric,
  normalizeMetrics,
  getRarityColor,
  getVoiceProfile,
} from '../helpers'
import type { PersonaTraits } from '../types'

describe('formatMetricLabel', () => {
  it('splits camelCase into words and capitalises the first letter', () => {
    expect(formatMetricLabel('responseTime')).toBe('Response Time')
  })

  it('replaces hyphens with spaces', () => {
    expect(formatMetricLabel('response-time')).toBe('Response time')
  })

  it('replaces underscores with spaces', () => {
    expect(formatMetricLabel('response_time')).toBe('Response time')
  })

  it('collapses multiple spaces', () => {
    expect(formatMetricLabel('too   many   spaces')).toBe('Too many spaces')
  })

  it('capitalises a single lowercase word', () => {
    expect(formatMetricLabel('accuracy')).toBe('Accuracy')
  })

  it('handles already capitalised input', () => {
    expect(formatMetricLabel('Accuracy')).toBe('Accuracy')
  })

  it('handles empty string', () => {
    expect(formatMetricLabel('')).toBe('')
  })

  it('handles mixed separators', () => {
    expect(formatMetricLabel('my_camelCase-value')).toBe('My camel Case value')
  })
})

describe('clampMetric', () => {
  it('returns the value when within range', () => {
    expect(clampMetric(50)).toBe(50)
  })

  it('clamps below 0 to 0', () => {
    expect(clampMetric(-10)).toBe(0)
  })

  it('clamps above 100 to 100', () => {
    expect(clampMetric(150)).toBe(100)
  })

  it('rounds decimal values', () => {
    expect(clampMetric(33.7)).toBe(34)
    expect(clampMetric(33.3)).toBe(33)
  })

  it('handles 0 boundary', () => {
    expect(clampMetric(0)).toBe(0)
  })

  it('handles 100 boundary', () => {
    expect(clampMetric(100)).toBe(100)
  })
})

describe('normalizeMetrics', () => {
  it('returns empty array when traits is undefined', () => {
    expect(normalizeMetrics(undefined)).toEqual([])
  })

  it('returns empty array when traits is null', () => {
    expect(normalizeMetrics(null)).toEqual([])
  })

  it('returns empty array when metrics is missing', () => {
    expect(normalizeMetrics({} as PersonaTraits)).toEqual([])
  })

  it('handles array-based metrics', () => {
    const traits: PersonaTraits = {
      metrics: [
        { label: 'Speed', value: 80 },
        { label: 'Accuracy', value: 45.7 },
      ],
    }
    expect(normalizeMetrics(traits)).toEqual([
      { label: 'Speed', value: 80 },
      { label: 'Accuracy', value: 46 },
    ])
  })

  it('filters out non-finite values in array metrics', () => {
    const traits: PersonaTraits = {
      metrics: [
        { label: 'Speed', value: 80 },
        { label: 'Bad', value: NaN },
        { label: 'Inf', value: Infinity },
      ],
    }
    expect(normalizeMetrics(traits)).toEqual([{ label: 'Speed', value: 80 }])
  })

  it('handles record-based metrics', () => {
    const traits: PersonaTraits = {
      metrics: { responseTime: 60, accuracy: 90 },
    }
    expect(normalizeMetrics(traits)).toEqual([
      { label: 'Response Time', value: 60 },
      { label: 'Accuracy', value: 90 },
    ])
  })

  it('filters out non-finite values in record metrics', () => {
    const traits: PersonaTraits = {
      metrics: { good: 50, bad: NaN },
    }
    expect(normalizeMetrics(traits)).toEqual([{ label: 'Good', value: 50 }])
  })

  it('clamps record values outside 0-100', () => {
    const traits: PersonaTraits = {
      metrics: { low: -5, high: 200 },
    }
    expect(normalizeMetrics(traits)).toEqual([
      { label: 'Low', value: 0 },
      { label: 'High', value: 100 },
    ])
  })
})

describe('getRarityColor', () => {
  it('returns override when provided', () => {
    expect(getRarityColor('legendary', '#ff0000')).toBe('#ff0000')
  })

  it('returns yellow for legendary', () => {
    expect(getRarityColor('Legendary')).toBe('yellow')
  })

  it('returns grape for epic', () => {
    expect(getRarityColor('Epic')).toBe('grape')
  })

  it('returns blue for rare', () => {
    expect(getRarityColor('Rare')).toBe('blue')
  })

  it('returns gray for common / unknown', () => {
    expect(getRarityColor('common')).toBe('gray')
    expect(getRarityColor('unknown')).toBe('gray')
  })

  it('returns gray when rarity is undefined', () => {
    expect(getRarityColor(undefined)).toBe('gray')
  })

  it('is case-insensitive', () => {
    expect(getRarityColor('LEGENDARY')).toBe('yellow')
    expect(getRarityColor('ePiC')).toBe('grape')
  })
})

describe('getVoiceProfile', () => {
  it('returns "Unassigned" when traits is undefined', () => {
    expect(getVoiceProfile(undefined)).toBe('Unassigned')
  })

  it('returns "Unassigned" when traits is null', () => {
    expect(getVoiceProfile(null)).toBe('Unassigned')
  })

  it('returns voiceProfile when set', () => {
    expect(getVoiceProfile({ voiceProfile: 'Warm Female' })).toBe('Warm Female')
  })

  it('returns formatted voice provider/name', () => {
    expect(getVoiceProfile({ voice: { provider: 'ElevenLabs', voiceName: 'Rachel' } })).toBe(
      'ElevenLabs / Rachel'
    )
  })

  it('falls back to "Voice" when provider missing', () => {
    expect(getVoiceProfile({ voice: { voiceName: 'Rachel' } })).toBe('Voice / Rachel')
  })

  it('falls back to "Default" when voiceName missing', () => {
    expect(getVoiceProfile({ voice: { provider: 'ElevenLabs' } })).toBe('ElevenLabs / Default')
  })

  it('returns "Unassigned" when no voice info at all', () => {
    expect(getVoiceProfile({ tone: 'friendly' })).toBe('Unassigned')
  })
})
