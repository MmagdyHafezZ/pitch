import { api } from '@/lib/client'
import type { TtsProvider, VoicesResponse, SpeakRequest } from '../types/tts.types'

export const TtsService = {
  listProviders(): Promise<TtsProvider[]> {
    return api.tts.listProviders()
  },

  getVoices(provider: string): Promise<VoicesResponse> {
    return api.tts.getVoices(provider)
  },

  speak(request: SpeakRequest): Promise<Blob> {
    return api.tts.speak(request)
  },
}
