import type { LocaleDictionary } from '../types'
import { enUS } from './en-US'

export const enGB: LocaleDictionary = {
  ...enUS,
  code: 'en-GB',
  label: 'English (UK)',
  nativeLabel: 'English (UK)',
  languageLabel: 'English (UK)',
  messages: {
    ...enUS.messages,
    'topbar.createSession': 'Create Session',
    'settings.language.description':
      'Choose the language used across PITCH and the default language for new training sessions.',
    'settings.language.defaultSessionDescription':
      'New sessions default to this language, and the simulation backend will use it unless a session overrides the conversation language explicitly.',
  },
  phrases: {
    ...enUS.phrases,
    Analytics: 'Analytics',
    'Color Mode': 'Colour Mode',
    'Choose if PITCH’s appearance should be light or dark, or follow your device’s settings.':
      'Choose whether PITCH’s appearance should be light or dark, or follow your device’s settings.',
    'Choose the language used across PITCH and as the default for new training sessions.':
      'Choose the language used across PITCH and the default for new training sessions.',
  },
}
