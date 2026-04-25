import type { Persona, PersonaTraits } from './types'

export interface PabloVideoPresenterVoiceConfig {
  provider: string
  voiceName: string
  language: string
  model?: string
}

export const PABLO_VIDEO_PRESENTER_VOICE: PabloVideoPresenterVoiceConfig = {
  provider: 'elevenlabs',
  voiceName: 'George - Warm, Captivating Storyteller',
  language: 'en-US',
}

export const PABLO_VIDEO_PRESENTER_TRAITS: PersonaTraits = {
  role: 'Video Presenter',
  level: 'Locked',
  personality: 'Warm and animated presenter for guided video sessions.',
  tone: 'Encouraging and upbeat',
  communicationStyle: 'Guided and visual',
  voiceProfile: `ElevenLabs / ${PABLO_VIDEO_PRESENTER_VOICE.voiceName}`,
  voice: PABLO_VIDEO_PRESENTER_VOICE,
  avatar: {
    imageUrl: '/pablo_happy.png',
  },
  archetype: 'Studio Host',
  rarity: 'Locked',
  rarityColor: 'yellow',
  signatureTraits: ['Always on camera', 'Guided practice', 'Video-first delivery'],
}

export const PABLO_VIDEO_PRESENTER_PERSONA: Persona = {
  id: 'video-presenter-pablo',
  orgId: 'system',
  name: 'Pablo',
  traits: PABLO_VIDEO_PRESENTER_TRAITS,
}

export const buildPabloVideoPresenterConfig = () => ({
  id: 'pablo',
  name: PABLO_VIDEO_PRESENTER_PERSONA.name,
  avatarImageUrl: PABLO_VIDEO_PRESENTER_TRAITS.avatar?.imageUrl ?? null,
})
