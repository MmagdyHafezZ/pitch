export interface SessionConfigForm {
  multiTurnEnabled: boolean
  accent: string
  tone: string
  speechRate: string
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
  voiceProfile?: string
  voice?: {
    provider?: string
    voiceName?: string
    language?: string
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