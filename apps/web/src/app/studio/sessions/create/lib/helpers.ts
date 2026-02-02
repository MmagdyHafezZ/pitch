import { PersonaTraits } from './types'

export const formatMetricLabel = (value: string) =>
  value
    .replace(/([A-Z])/g, ' $1')
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (char) => char.toUpperCase())

export const clampMetric = (value: number) => Math.max(0, Math.min(100, Math.round(value)))

export const normalizeMetrics = (traits?: PersonaTraits | null) => {
  if (!traits?.metrics) return []
  if (Array.isArray(traits.metrics)) {
    return traits.metrics
      .filter((metric) => Number.isFinite(metric.value))
      .map((metric) => ({
        label: metric.label,
        value: clampMetric(metric.value),
      }))
  }
  return Object.entries(traits.metrics)
    .filter(([, value]) => Number.isFinite(value))
    .map(([label, value]) => ({
      label: formatMetricLabel(label),
      value: clampMetric(value),
    }))
}

export const getRarityColor = (rarity?: string, override?: string) => {
  if (override) return override
  const value = rarity?.toLowerCase() ?? ''
  if (value.includes('legendary')) return 'yellow'
  if (value.includes('epic')) return 'grape'
  if (value.includes('rare')) return 'blue'
  return 'gray'
}

export const getVoiceProfile = (traits?: PersonaTraits | null) => {
  if (!traits) return 'Unassigned'
  if (traits.voiceProfile) return traits.voiceProfile
  if (traits.voice?.provider || traits.voice?.voiceName) {
    return `${traits.voice?.provider ?? 'Voice'} / ${traits.voice?.voiceName ?? 'Default'}`
  }
  return 'Unassigned'
}
