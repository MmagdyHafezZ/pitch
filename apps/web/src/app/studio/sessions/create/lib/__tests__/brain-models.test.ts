import type { LLMProvider } from '@/features/sessions/hooks/useLLMProviders'
import {
  getBrainCompatibleModels,
  getPreferredBrainModel,
  isBrainCompatibleModel,
} from '../brain-models'

describe('brain-models', () => {
  const provider: LLMProvider = {
    name: 'openai',
    enabled: true,
    models: [
      'gpt-5.2',
      'gpt-4o-mini-tts',
      'gpt-4o-realtime-preview',
      'whisper-1',
      'o3',
      'gpt-4.1-mini',
    ],
    modelDetails: [
      {
        name: 'gpt-5.2',
        pricing: { inputTokensPerMillion: 1, outputTokensPerMillion: 2 },
        maxTokens: 128000,
        supportsStreaming: true,
        supportsTools: true,
        supportsVision: true,
        supportsAudio: false,
        supportedModalities: ['text', 'image'],
      },
      {
        name: 'gpt-4o-mini-tts',
        pricing: { inputTokensPerMillion: 1, outputTokensPerMillion: 2 },
        maxTokens: 128000,
        supportsStreaming: true,
        supportsTools: false,
        supportsVision: false,
        supportsAudio: true,
        supportedModalities: ['audio'],
      },
      {
        name: 'gpt-4o-realtime-preview',
        pricing: { inputTokensPerMillion: 1, outputTokensPerMillion: 2 },
        maxTokens: 128000,
        supportsStreaming: true,
        supportsTools: true,
        supportsVision: true,
        supportsAudio: true,
        supportedModalities: ['text', 'audio'],
      },
      {
        name: 'whisper-1',
        pricing: { inputTokensPerMillion: 1, outputTokensPerMillion: 2 },
        maxTokens: 128000,
        supportsStreaming: false,
        supportsTools: false,
        supportsVision: false,
        supportsAudio: true,
        supportedModalities: ['audio'],
      },
      {
        name: 'o3',
        pricing: { inputTokensPerMillion: 1, outputTokensPerMillion: 2 },
        maxTokens: 128000,
        supportsStreaming: true,
        supportsTools: true,
        supportsVision: true,
        supportsAudio: false,
        supportedModalities: ['text', 'image'],
      },
      {
        name: 'gpt-4.1-mini',
        pricing: { inputTokensPerMillion: 1, outputTokensPerMillion: 2 },
        maxTokens: 128000,
        supportsStreaming: true,
        supportsTools: true,
        supportsVision: true,
        supportsAudio: false,
        supportedModalities: ['text', 'image'],
      },
    ],
  }

  it('keeps only text-generation models suitable for the AI brain deck', () => {
    const compatible = getBrainCompatibleModels(provider).map((model) => model.name)

    expect(compatible).toEqual(['gpt-5.2', 'o3', 'gpt-4.1-mini'])
  })

  it('prefers the latest suitable OpenAI text model when available', () => {
    expect(getPreferredBrainModel(provider)?.name).toBe('gpt-5.2')
  })

  it('rejects excluded audio and realtime models', () => {
    expect(isBrainCompatibleModel(provider.modelDetails[1])).toBe(false)
    expect(isBrainCompatibleModel(provider.modelDetails[2])).toBe(false)
    expect(isBrainCompatibleModel(provider.modelDetails[3])).toBe(false)
  })
})
