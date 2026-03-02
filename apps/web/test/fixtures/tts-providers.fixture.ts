export const mockTtsProviders = [
  {
    name: 'elevenlabs',
    description: 'ElevenLabs',
    voices: ['Rachel', 'Adam', 'Sarah', 'Antoni', 'Bella'],
    models: [],
  },
  {
    name: 'melotts',
    description: 'MeloTTS',
    voices: ['EN-US-1', 'EN-GB-1', 'EN-AU-1'],
    models: [],
  },
  {
    name: 'openai',
    description: 'OpenAI text-to-speech',
    voices: ['alloy', 'ash', 'coral'],
    models: ['gpt-4o-mini-tts', 'tts-1', 'tts-1-hd'],
  },
]

export const mockTtsProvidersEmpty: any[] = []
