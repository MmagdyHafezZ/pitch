import { useQuery } from '@tanstack/react-query'
import { TtsService } from '../services/tts.service'

export function useTtsProviders() {
  const {
    data: providers,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['tts', 'providers'],
    queryFn: () => TtsService.listProviders(),
    staleTime: 1000 * 60 * 10,
  })

  return {
    providers: providers || [],
    loading: isLoading,
    error: error instanceof Error ? error.message : null,
    refetch,
  }
}
