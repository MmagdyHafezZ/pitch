import type { LLMProvidersResponse } from '@/features/sessions/types/sessions.types'

export const mockLLMProviders: LLMProvidersResponse = {
  providers: [
    {
      name: 'openai',
      enabled: true,
      models: ['gpt-4o', 'gpt-4o-mini'],
      modelDetails: [
        {
          name: 'gpt-4o',
          pricing: {
            inputTokensPerMillion: 5.0,
            outputTokensPerMillion: 15.0,
          },
          maxTokens: 128000,
          maxOutputTokens: 4096,
          supportsStreaming: true,
          supportsTools: true,
          supportsVision: true,
          supportsAudio: false,
          supportedModalities: ['text', 'image'],
        },
        {
          name: 'gpt-4o-mini',
          pricing: {
            inputTokensPerMillion: 0.15,
            outputTokensPerMillion: 0.6,
          },
          maxTokens: 128000,
          maxOutputTokens: 4096,
          supportsStreaming: true,
          supportsTools: true,
          supportsVision: true,
          supportsAudio: false,
          supportedModalities: ['text', 'image'],
        },
      ],
    },
    {
      name: 'watsonx',
      enabled: true,
      models: ['granite-13b'],
      modelDetails: [
        {
          name: 'granite-13b',
          pricing: {
            inputTokensPerMillion: 0,
            outputTokensPerMillion: 0,
          },
          maxTokens: 8192,
          maxOutputTokens: 2048,
          supportsStreaming: false,
          supportsTools: false,
          supportsVision: false,
          supportsAudio: false,
          supportedModalities: ['text'],
        },
      ],
    },
  ],
}

export const mockLLMProvidersEmpty: LLMProvidersResponse = {
  providers: [],
}

export const mockLLMProvidersDisabled: LLMProvidersResponse = {
  providers: [
    {
      name: 'openai',
      enabled: false,
      models: [],
      modelDetails: [],
    },
  ],
}
