import { getAccentColors } from '../accent'
import {
  getReadableTextColor,
  getReadableMutedColor,
  getAccentStrong,
  mixColors,
  setColorLightness,
  isLightColor,
} from '../contrast'

describe('accent.ts - getAccentColors', () => {
  it('returns accent and accentStrong for valid hex (light scheme)', () => {
    const result = getAccentColors('#228be6', 'light')
    expect(result.accent).toBe('#228be6')
    expect(result.accentStrong).toMatch(/^#[0-9a-f]{6}$/)
    expect(result.accentStrong).not.toBe('#228be6')
  })

  it('returns accent and accentStrong for valid hex (dark scheme)', () => {
    const result = getAccentColors('#228be6', 'dark')
    expect(result.accent).toBe('#228be6')
    expect(result.accentStrong).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('returns same value for both when color is invalid', () => {
    const result = getAccentColors('not-a-color', 'light')
    expect(result.accent).toBe('not-a-color')
    expect(result.accentStrong).toBe('not-a-color')
  })

  it('handles rgb() input', () => {
    const result = getAccentColors('rgb(34, 139, 230)', 'light')
    expect(result.accent).toBe('rgb(34, 139, 230)')
    expect(result.accentStrong).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('handles shorthand hex', () => {
    const result = getAccentColors('#f00', 'light')
    expect(result.accentStrong).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('handles empty string', () => {
    const result = getAccentColors('', 'light')
    expect(result.accent).toBe('')
    expect(result.accentStrong).toBe('')
  })
})

describe('contrast.ts - getReadableTextColor', () => {
  it('returns black for light backgrounds', () => {
    expect(getReadableTextColor('#ffffff')).toBe('var(--mantine-color-black)')
    expect(getReadableTextColor('#f1f3f5')).toBe('var(--mantine-color-black)')
  })

  it('returns white for dark backgrounds', () => {
    expect(getReadableTextColor('#000000')).toBe('var(--mantine-color-white)')
    expect(getReadableTextColor('#0f172a')).toBe('var(--mantine-color-white)')
  })

  it('returns black for invalid color', () => {
    expect(getReadableTextColor('')).toBe('var(--mantine-color-black)')
    expect(getReadableTextColor('invalid')).toBe('var(--mantine-color-black)')
  })

  it('handles rgb() input', () => {
    expect(getReadableTextColor('rgb(255, 255, 255)')).toBe('var(--mantine-color-black)')
    expect(getReadableTextColor('rgb(0, 0, 0)')).toBe('var(--mantine-color-white)')
  })

  it('handles shorthand hex', () => {
    expect(getReadableTextColor('#fff')).toBe('var(--mantine-color-black)')
    expect(getReadableTextColor('#000')).toBe('var(--mantine-color-white)')
  })
})

describe('contrast.ts - getReadableMutedColor', () => {
  it('returns white muted for dark backgrounds', () => {
    expect(getReadableMutedColor('#000000')).toBe('rgba(255, 255, 255, 0.78)')
  })

  it('returns black muted for light backgrounds', () => {
    expect(getReadableMutedColor('#ffffff')).toBe('rgba(0, 0, 0, 0.72)')
  })
})

describe('contrast.ts - getAccentStrong', () => {
  it('returns darker variant for light scheme', () => {
    const result = getAccentStrong('#228be6', 'light')
    expect(result).toMatch(/^#[0-9a-f]{6}$/)
    expect(result).not.toBe('#228be6')
  })

  it('returns lighter variant for dark scheme', () => {
    const result = getAccentStrong('#228be6', 'dark')
    expect(result).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('returns input for invalid color', () => {
    expect(getAccentStrong('invalid', 'light')).toBe('invalid')
  })

  it('handles rgb() input', () => {
    const result = getAccentStrong('rgb(34, 139, 230)', 'light')
    expect(result).toMatch(/^#[0-9a-f]{6}$/)
  })
})

describe('contrast.ts - mixColors', () => {
  it('mixes two colors at 50%', () => {
    const result = mixColors('#000000', '#ffffff')
    expect(result).toMatch(/^#[0-9a-f]{6}$/)
    // Should be roughly gray
    expect(result).toMatch(/^#[78][0-9a-f][78][0-9a-f][78][0-9a-f]$/)
  })

  it('mixes at 0% returns first color', () => {
    const result = mixColors('#ff0000', '#0000ff', 0)
    expect(result).toBe('#ff0000')
  })

  it('mixes at 100% returns second color', () => {
    const result = mixColors('#ff0000', '#0000ff', 1)
    expect(result).toBe('#0000ff')
  })

  it('returns first color if second is invalid', () => {
    expect(mixColors('#ff0000', 'invalid')).toBe('#ff0000')
  })

  it('returns first color if first is invalid', () => {
    expect(mixColors('invalid', '#ff0000')).toBe('invalid')
  })
})

describe('contrast.ts - setColorLightness', () => {
  it('sets lightness to 50% for a hex color', () => {
    const result = setColorLightness('#228be6', 0.5)
    expect(result).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('sets lightness to 0 (black)', () => {
    const result = setColorLightness('#228be6', 0)
    expect(result).toBe('#000000')
  })

  it('sets lightness to 1 (white)', () => {
    const result = setColorLightness('#228be6', 1)
    expect(result).toBe('#ffffff')
  })

  it('returns input for invalid color', () => {
    expect(setColorLightness('invalid', 0.5)).toBe('invalid')
  })

  it('clamps out-of-range lightness', () => {
    const result = setColorLightness('#228be6', 1.5)
    expect(result).toBe('#ffffff')
  })
})

describe('contrast.ts - isLightColor', () => {
  it('returns true for white', () => {
    expect(isLightColor('#ffffff')).toBe(true)
  })

  it('returns false for black', () => {
    expect(isLightColor('#000000')).toBe(false)
  })

  it('returns true for light colors', () => {
    expect(isLightColor('#f1f3f5')).toBe(true)
    expect(isLightColor('#fff4e6')).toBe(true)
  })

  it('returns false for dark colors', () => {
    expect(isLightColor('#0f172a')).toBe(false)
    expect(isLightColor('#2b1b17')).toBe(false)
  })

  it('returns true for invalid input (fallback)', () => {
    expect(isLightColor('')).toBe(true)
    expect(isLightColor('not-a-color')).toBe(true)
  })

  it('handles rgb() input', () => {
    expect(isLightColor('rgb(255, 255, 255)')).toBe(true)
    expect(isLightColor('rgb(0, 0, 0)')).toBe(false)
  })

  it('handles rgba() input', () => {
    expect(isLightColor('rgba(255, 255, 255, 1)')).toBe(true)
  })

  it('handles shorthand hex', () => {
    expect(isLightColor('#fff')).toBe(true)
    expect(isLightColor('#000')).toBe(false)
  })
})
