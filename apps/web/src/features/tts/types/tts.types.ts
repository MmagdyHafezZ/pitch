export interface TtsProvider {
  name: string
  description?: string
  voices: string[]
  models?: string[]
}

export interface VoicesResponse {
  provider: string
  voices: string[]
  models?: string[]
}

export interface SpeakRequest {
  text: string
  provider: string
  voice: string
  model?: string
}
