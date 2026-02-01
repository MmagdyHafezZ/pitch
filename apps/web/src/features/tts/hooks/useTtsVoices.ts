import { useQuery } from '@tanstack/react-query'
import { TtsService } from '../services/tts.service'

export function useTtsVoices(provider: string | null) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['tts', 'voices', provider],
    queryFn: () => TtsService.getVoices(provider!),
    enabled: !!provider,
    staleTime: 1000 * 60 * 10,
  })

  return {
    voices: data?.voices || [],
    loading: isLoading,
    error: error instanceof Error ? error.message : null,
    refetch,
  }
}
