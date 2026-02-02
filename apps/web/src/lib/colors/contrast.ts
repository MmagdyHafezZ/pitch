'use client'

const clamp = (value: number) => Math.min(1, Math.max(0, value))

const parseHexChannel = (hex: string) => {
  const value = parseInt(hex, 16)
  return Number.isNaN(value) ? 0 : value
}

const hexToRgb = (hex: string) => {
  const cleaned = hex.replace('#', '').trim()
  if (cleaned.length === 3) {
    const r = parseHexChannel(cleaned[0] + cleaned[0])
    const g = parseHexChannel(cleaned[1] + cleaned[1])
    const b = parseHexChannel(cleaned[2] + cleaned[2])
    return { r, g, b }
  }
  if (cleaned.length === 6) {
    const r = parseHexChannel(cleaned.slice(0, 2))
    const g = parseHexChannel(cleaned.slice(2, 4))
    const b = parseHexChannel(cleaned.slice(4, 6))
    return { r, g, b }
  }
  return null
}

const rgbStringToRgb = (value: string) => {
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

const relativeLuminance = (r: number, g: number, b: number) => {
  const toLinear = (channel: number) => {
    const srgb = clamp(channel / 255)
    return srgb <= 0.03928 ? srgb / 12.92 : Math.pow((srgb + 0.055) / 1.055, 2.4)
  }

  const rLin = toLinear(r)
  const gLin = toLinear(g)
  const bLin = toLinear(b)
  return 0.2126 * rLin + 0.7152 * gLin + 0.0722 * bLin
}

const parseColor = (color: string) => {
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

export const getReadableTextColor = (background: string) => {
  const rgb = parseColor(background)

  if (!rgb) {
    return 'var(--mantine-color-black)'
  }

  const luminance = relativeLuminance(rgb.r, rgb.g, rgb.b)
  return luminance > 0.45 ? 'var(--mantine-color-black)' : 'var(--mantine-color-white)'
}

export const getReadableMutedColor = (background: string) => {
  const readable = getReadableTextColor(background)
  return readable === 'var(--mantine-color-white)'
    ? 'rgba(255, 255, 255, 0.78)'
    : 'rgba(0, 0, 0, 0.72)'
}

type Rgb = { r: number; g: number; b: number }

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

const parseColorToRgb = (color: string): Rgb | null => {
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

export const getAccentStrong = (accent: string, scheme: 'light' | 'dark') => {
  const rgb = parseColorToRgb(accent)
  if (!rgb) {
    return accent
  }
  const { h, s, l } = rgbToHsl(rgb)
  if (scheme === 'light') {
    return rgbToHex(hslToRgb(h, clamp(s + 0.15), clamp(l - 0.12)))
  }
  return rgbToHex(hslToRgb(h, clamp(s + 0.1), clamp(l + 0.08)))
}

export const mixColors = (colorA: string, colorB: string, ratio = 0.5) => {
  const rgbA = parseColorToRgb(colorA)
  const rgbB = parseColorToRgb(colorB)
  if (!rgbA || !rgbB) {
    return colorA
  }
  const mixChannel = (a: number, b: number) => Math.round(a * (1 - ratio) + b * ratio)
  return rgbToHex({
    r: mixChannel(rgbA.r, rgbB.r),
    g: mixChannel(rgbA.g, rgbB.g),
    b: mixChannel(rgbA.b, rgbB.b),
  })
}

export const isLightColor = (background: string) => {
  const rgb = parseColorToRgb(background)
  if (!rgb) {
    return true
  }
  const luminance = relativeLuminance(rgb.r, rgb.g, rgb.b)
  return luminance > 0.5
}
