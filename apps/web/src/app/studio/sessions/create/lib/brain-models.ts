import type { LLMProvider } from '@/features/sessions/hooks/useLLMProviders'

const EXCLUDED_MODEL_PATTERNS = [
  /audio/i,
  /realtime/i,
  /transcribe/i,
  /tts/i,
  /speech/i,
  /whisper/i,
  /moderation/i,
  /embedding/i,
  /omni-moderation/i,
]

const PREFERRED_MODEL_NAMES = [
  'gpt-5.2',
  'gpt-5.2-chat-latest',
  'gpt-5.2-mini',
  'gpt-5',
  'gpt-5-chat-latest',
  'gpt-5-mini',
  'o3',
  'o4-mini',
  'gpt-4.1',
  'gpt-4.1-mini',
  'gpt-4o',
  'gpt-4o-mini',
]

export const isBrainCompatibleModel = (model: LLMProvider['modelDetails'][number]) => {
  if (!model.supportedModalities.includes('text')) {
    return false
  }

  return !EXCLUDED_MODEL_PATTERNS.some((pattern) => pattern.test(model.name))
}

export const getBrainCompatibleModels = (provider?: LLMProvider | null) => {
  if (!provider) {
    return []
  }

  return provider.modelDetails.filter(isBrainCompatibleModel)
}

export const getPreferredBrainModel = (provider?: LLMProvider | null) => {
  const models = getBrainCompatibleModels(provider)
  if (models.length === 0) {
    return null
  }

  for (const preferredName of PREFERRED_MODEL_NAMES) {
    const match = models.find((model) => model.name === preferredName)
    if (match) {
      return match
    }
  }

  return models[0]
}
