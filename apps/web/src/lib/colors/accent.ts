'use client'

type Rgb = { r: number; g: number; b: number }

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value))

const hexToRgb = (hex: string): Rgb | null => {
  const cleaned = hex.replace('#', '').trim()
  if (cleaned.length === 3) {
    const r = parseInt(cleaned[0] + cleaned[0], 16)
    const g = parseInt(cleaned[1] + cleaned[1], 16)
    const b = parseInt(cleaned[2] + cleaned[2], 16)
    return { r, g, b }
  }
  if (cleaned.length === 6) {
    const r = parseInt(cleaned.slice(0, 2), 16)
    const g = parseInt(cleaned.slice(2, 4), 16)
    const b = parseInt(cleaned.slice(4, 6), 16)
    return { r, g, b }
  }
  return null
}

const rgbStringToRgb = (value: string): Rgb | null => {
  const match = value.match(/rgba?\(([^)]+)\)/i)
  if (!match) {
    return null
  }
  const parts = match[1]
    .split(',')
    .map((part) => part.trim())
    .map((part) => Number(part))

  if (parts.length < 3 || parts.some((part) => Number.isNaN(part))) {
    return null
  }
  return { r: parts[0], g: parts[1], b: parts[2] }
}

const parseColor = (color: string): Rgb | null => {
  if (!color) {
    return null
  }
  if (color.startsWith('#')) {
    return hexToRgb(color)
  }
  if (color.startsWith('rgb')) {
    return rgbStringToRgb(color)
  }
  return null
}

const rgbToHsl = ({ r, g, b }: Rgb) => {
  const rNorm = r / 255
  const gNorm = g / 255
  const bNorm = b / 255
  const max = Math.max(rNorm, gNorm, bNorm)
  const min = Math.min(rNorm, gNorm, bNorm)
  const delta = max - min

  let h = 0
  if (delta !== 0) {
    if (max === rNorm) {
      h = ((gNorm - bNorm) / delta) % 6
    } else if (max === gNorm) {
      h = (bNorm - rNorm) / delta + 2
    } else {
      h = (rNorm - gNorm) / delta + 4
    }
    h *= 60
    if (h < 0) h += 360
  }

  const l = (max + min) / 2
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1))

  return { h, s, l }
}

const hslToRgb = (h: number, s: number, l: number): Rgb => {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  let r = 0
  let g = 0
  let b = 0

  if (h >= 0 && h < 60) {
    r = c
    g = x
  } else if (h >= 60 && h < 120) {
    r = x
    g = c
  } else if (h >= 120 && h < 180) {
    g = c
    b = x
  } else if (h >= 180 && h < 240) {
    g = x
    b = c
  } else if (h >= 240 && h < 300) {
    r = x
    b = c
  } else {
    r = c
    b = x
  }

  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  }
}

const rgbToHex = ({ r, g, b }: Rgb) =>
  `#${[r, g, b]
    .map((value) => {
      const hex = value.toString(16)
      return hex.length === 1 ? `0${hex}` : hex
    })
    .join('')}`

export const getAccentColors = (accent: string, scheme: 'light' | 'dark') => {
  const rgb = parseColor(accent)
  if (!rgb) {
    return {
      accent,
      accentStrong: accent,
    }
  }

  const { h, s, l } = rgbToHsl(rgb)

  if (scheme === 'light') {
    const strong = hslToRgb(h, clamp(s + 0.15), clamp(l - 0.12))
    return { accent, accentStrong: rgbToHex(strong) }
  }

  const strong = hslToRgb(h, clamp(s + 0.1), clamp(l + 0.08))
  return { accent, accentStrong: rgbToHex(strong) }
}
