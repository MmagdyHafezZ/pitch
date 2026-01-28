export interface TtsProvider {
  name: string
  description?: string
  voices: string[]
}

export interface VoicesResponse {
  provider: string
  voices: string[]
}

export interface SpeakRequest {
  text: string
  provider: string
  voice: string
}
