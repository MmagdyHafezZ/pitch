import { normalizeLocale } from '../constants'
import { translateMessage, translatePhrase } from '../registry'

describe('i18n registry', () => {
  it('normalizes browser and short language codes to supported locales', () => {
    expect(normalizeLocale('es')).toBe('es-ES')
    expect(normalizeLocale('fr_CA')).toBe('fr-FR')
    expect(normalizeLocale('de-DE')).toBe('de-DE')
    expect(normalizeLocale('unknown')).toBe('en-US')
  })

  it('translates keyed messages with interpolation', () => {
    expect(translateMessage('de-DE', 'topbar.unreadCount', { count: 4 })).toBe('4 ungelesen')
  })

  it('translates legacy phrases while preserving surrounding whitespace', () => {
    expect(translatePhrase('es-ES', '  Create Session  ')).toBe('  Crear sesión  ')
    expect(translatePhrase('fr-FR', 'Search')).toBe('Rechercher')
  })
})
