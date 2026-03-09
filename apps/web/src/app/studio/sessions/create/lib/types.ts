export interface SessionConfigForm {
  multiTurnEnabled: boolean
  accent: string
  tone: string
  speechRate: string
  responseLength?: string
  patienceLevel?: string
  initiativeLevel?: string
  difficulty: number
  durationMinutes?: number
  aiRole?: string
  userRole?: string
  [key: string]: any
}

export interface PersonaTraits {
  role?: string
  level?: string
  personality?: string
  background?: string
  tone?: string
  patience?: string
  communicationStyle?: string
  voiceProfile?: string
  voice?: {
    provider?: string
    voiceName?: string
    language?: string
    model?: string
  }
  avatar?: {
    source?: string
    label?: string
    imageUrl?: string
    previewVideoUrl?: string
    heygenAvatarId?: string
    liveAvatarId?: string
    liveAvatarName?: string
    avatarStyle?: string
    backgroundColor?: string
    gender?: 'female' | 'male' | 'neutral' | string
    track?: string
  }
  audioPreview?: {
    provider?: string
    voiceName?: string
    text?: string
  }
  archetype?: string
  rarity?: string
  rarityColor?: string
  signatureTraits?: string[]
  highlights?: string[]
  metrics?: Record<string, number> | Array<{ label: string; value: number }>
}

export interface Persona {
  id: string
  name: string
  orgId: string
  traits?: PersonaTraits | null
}
