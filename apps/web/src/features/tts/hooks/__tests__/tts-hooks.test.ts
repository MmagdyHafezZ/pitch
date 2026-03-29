import { renderHook, waitFor } from '@testing-library/react'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useTtsProviders } from '../useTtsProviders'
import { useTtsVoices } from '../useTtsVoices'
import { TtsService } from '../../services/tts.service'

jest.mock('../../services/tts.service', () => ({
  TtsService: {
    listProviders: jest.fn(),
    getVoices: jest.fn(),
  },
}))

const mockedTts = TtsService as jest.Mocked<typeof TtsService>

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children)
}

beforeEach(() => jest.clearAllMocks())

describe('useTtsProviders', () => {
  it('returns providers on success', async () => {
    const providers = [{ name: 'openai', voices: ['alloy'], description: 'OpenAI TTS' }]
    mockedTts.listProviders.mockResolvedValue(providers)

    const { result } = renderHook(() => useTtsProviders(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.providers).toEqual(providers)
    expect(result.current.error).toBeNull()
  })

  it('returns empty array initially', () => {
    mockedTts.listProviders.mockReturnValue(new Promise(() => {}))

    const { result } = renderHook(() => useTtsProviders(), { wrapper: createWrapper() })

    expect(result.current.providers).toEqual([])
    expect(result.current.loading).toBe(true)
  })

  it('returns error message on failure', async () => {
    mockedTts.listProviders.mockRejectedValue(new Error('Network error'))

    const { result } = renderHook(() => useTtsProviders(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.error).toBe('Network error'))
    expect(result.current.providers).toEqual([])
  })

  it('provides a refetch function', async () => {
    mockedTts.listProviders.mockResolvedValue([])

    const { result } = renderHook(() => useTtsProviders(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(typeof result.current.refetch).toBe('function')
  })
})

describe('useTtsVoices', () => {
  it('returns voices for a given provider', async () => {
    const response = { provider: 'openai', voices: ['alloy', 'ash'] }
    mockedTts.getVoices.mockResolvedValue(response)

    const { result } = renderHook(() => useTtsVoices('openai'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.voices).toEqual(['alloy', 'ash'])
    expect(result.current.error).toBeNull()
  })

  it('does not fetch when provider is null', () => {
    const { result } = renderHook(() => useTtsVoices(null), {
      wrapper: createWrapper(),
    })

    expect(mockedTts.getVoices).not.toHaveBeenCalled()
    expect(result.current.voices).toEqual([])
  })

  it('returns empty voices array initially', () => {
    mockedTts.getVoices.mockReturnValue(new Promise(() => {}))

    const { result } = renderHook(() => useTtsVoices('openai'), {
      wrapper: createWrapper(),
    })

    expect(result.current.voices).toEqual([])
  })

  it('returns error message on failure', async () => {
    mockedTts.getVoices.mockRejectedValue(new Error('Provider not found'))

    const { result } = renderHook(() => useTtsVoices('bad'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.error).toBe('Provider not found'))
    expect(result.current.voices).toEqual([])
  })

  it('provides a refetch function', async () => {
    mockedTts.getVoices.mockResolvedValue({ provider: 'openai', voices: [] })

    const { result } = renderHook(() => useTtsVoices('openai'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(typeof result.current.refetch).toBe('function')
  })
})
