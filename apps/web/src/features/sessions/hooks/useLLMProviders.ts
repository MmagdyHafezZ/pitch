import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/client'
import type { LLMProvidersResponse } from '../types/sessions.types'

//LLMProvider type
export type LLMProvider = {
  name: string
  enabled: boolean
  models: string[]
  modelDetails: {
    name: string
    pricing: {
      inputTokensPerMillion: number
      outputTokensPerMillion: number
      imageTokens?: number
      audioSecondsToTokens?: number
    }
    maxTokens: number
    maxOutputTokens?: number
    supportsStreaming: boolean
    supportsTools: boolean
    supportsVision: boolean
    supportsAudio: boolean
    supportedModalities: Array<'text' | 'image' | 'audio'>
  }[]
}

export const useLLMProviders = () => {
  return useQuery<LLMProvidersResponse>({
    queryKey: ['llm', 'providers'],
    queryFn: async () => {
      const response = await api.llm.getProviders()
      return response
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 3,
  })
}
