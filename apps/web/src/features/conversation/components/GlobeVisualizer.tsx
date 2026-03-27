'use client'

import { useEffect, useRef } from 'react'

export type GlobeState = 'idle' | 'listening' | 'processing' | 'speaking'

interface Props {
  state: GlobeState
  analyserRef?: React.RefObject<AnalyserNode | null>
  size?: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

// ── Color tokens per state ────────────────────────────────────────────────────
// Each state has 3 internal "liquid" colors + bg + glow

interface StateColors {
  bg: string // sphere background
  c1: string // liquid color 1
  c2: string // liquid color 2
  c3: string // liquid color 3
  glow: string // outer glow
}

const COLORS: Record<GlobeState, StateColors> = {
  idle: {
    bg: '#080818',
    c1: '#1e1b6b',
    c2: '#2d1f8a',
    c3: '#120e40',
    glow: '#5b52c8',
  },
  listening: {
    bg: '#040f0e',
    c1: '#064d3c',
    c2: '#0a7a60',
    c3: '#033328',
    glow: '#0dc4a0',
  },
  processing: {
    bg: '#0a0418',
    c1: '#3b1280',
    c2: '#5c1fa0',
    c3: '#1e0840',
    glow: '#8b3cf7',
  },
  speaking: {
    bg: '#020a1a',
    c1: '#0a2466',
    c2: '#1040a0',
    c3: '#041838',
    glow: '#1a6fe8',
  },
}

// ── Blob point — one control vertex on the morphing blob ─────────────────────

interface BlobPoint {
  baseAngle: number // fixed angle on circle
  freq1: number // primary oscillation frequency
  freq2: number // secondary oscillation frequency
  phase1: number // phase offsets for organic variety
  phase2: number
  currentR: number // current radius (lerped toward target)
  targetR: number // target radius this frame
}

function createPoints(n: number, baseR: number): BlobPoint[] {
  return Array.from({ length: n }, (_, i) => ({
    baseAngle: (i / n) * Math.PI * 2,
    freq1: 0.8 + Math.random() * 0.9,
    freq2: 1.4 + Math.random() * 1.2,
    phase1: Math.random() * Math.PI * 2,
    phase2: Math.random() * Math.PI * 2,
    currentR: baseR,
    targetR: baseR,
  }))
}

// ── Catmull-Rom spline through points (closed loop) ──────────────────────────

function catmullRomPath(ctx: CanvasRenderingContext2D, pts: Array<{ x: number; y: number }>) {
  const n = pts.length
  ctx.beginPath()
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n]
    const p1 = pts[i]
    const p2 = pts[(i + 1) % n]
    const p3 = pts[(i + 2) % n]

    // Cubic bezier control points from Catmull-Rom conversion
    const alpha = 0.5
    const cp1x = p1.x + ((p2.x - p0.x) * alpha) / 3
    const cp1y = p1.y + ((p2.y - p0.y) * alpha) / 3
    const cp2x = p2.x - ((p3.x - p1.x) * alpha) / 3
    const cp2y = p2.y - ((p3.y - p1.y) * alpha) / 3

    if (i === 0) ctx.moveTo(p1.x, p1.y)
    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y)
  }
  ctx.closePath()
}

// ── Component ─────────────────────────────────────────────────────────────────

const N_POINTS = 14 // control vertices on the blob

export default function GlobeVisualizer({ state, analyserRef, size = 320 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const stateRef = useRef(state)
  const targetColRef = useRef({ ...COLORS[state] })

  stateRef.current = state
  targetColRef.current = COLORS[state]

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = size * dpr
    canvas.height = size * dpr
    canvas.style.width = `${size}px`
    canvas.style.height = `${size}px`
    ctx.scale(dpr, dpr)

    const cx = size / 2
    const cy = size / 2
    const R = size / 2 - 4 // slight padding for glow

    // Create blob control points
    const points = createPoints(N_POINTS, R * 0.68)

    // Liquid color layer orbiters — 3 colored radial gradients that slowly orbit
    // Each has an angle, orbital radius, and size
    const orbiters = [
      { angle: 0, speed: 0.007, orbitR: R * 0.3, blobR: R * 0.72 },
      { angle: (Math.PI * 2) / 3, speed: 0.005, orbitR: R * 0.25, blobR: R * 0.68 },
      { angle: (Math.PI * 4) / 3, speed: 0.009, orbitR: R * 0.28, blobR: R * 0.65 },
    ]

    let t = 0
    let smoothRms = 0

    // Colour lerp state (string hex → per-channel lerp)
    type ColKey = keyof StateColors
    const COL_KEYS: ColKey[] = ['bg', 'c1', 'c2', 'c3', 'glow']

    function parseHex(h: string): [number, number, number] {
      return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
    }
    function lerpHex(a: string, b: string, t: number): string {
      const [ar, ag, ab] = parseHex(a)
      const [br, bg, bb] = parseHex(b)
      const r = Math.round(lerp(ar, br, t))
        .toString(16)
        .padStart(2, '0')
      const g = Math.round(lerp(ag, bg, t))
        .toString(16)
        .padStart(2, '0')
      const bv = Math.round(lerp(ab, bb, t))
        .toString(16)
        .padStart(2, '0')
      return `#${r}${g}${bv}`
    }

    // Lerp the color object each frame
    const curCol: StateColors = { ...COLORS[state] }

    function draw() {
      ctx.clearRect(0, 0, size, size)

      t += 0.016

      // Lerp colours toward target
      const cf = 0.04
      for (const k of COL_KEYS) {
        curCol[k] = lerpHex(curCol[k], targetColRef.current[k], cf)
      }

      // Read audio level from LLM analyser
      const analyser = analyserRef?.current
      let rmsRaw = 0
      if (analyser) {
        const bins = analyser.frequencyBinCount
        const buf = new Uint8Array(bins)
        analyser.getByteFrequencyData(buf)
        // Focus on vocal range (roughly bins 4%–70% of spectrum)
        const lo = Math.floor(bins * 0.04)
        const hi = Math.floor(bins * 0.7)
        let sum = 0
        for (let i = lo; i < hi; i++) sum += buf[i] * buf[i]
        rmsRaw = Math.sqrt(sum / (hi - lo)) / 255
      }

      // Smooth RMS: fast attack, slow decay
      smoothRms = lerp(smoothRms, rmsRaw, rmsRaw > smoothRms ? 0.28 : 0.055)
      const lvl = clamp(smoothRms * 2.2, 0, 1) // scale so speech sits ~0.5–0.9

      // ── Update blob points ────────────────────────────────────────────────
      const idleDisp = R * 0.08 // resting displacement amplitude
      const audioDisp = R * 0.34 // extra displacement at full volume
      const baseR = R * 0.68 // resting radius

      for (const p of points) {
        const noise =
          Math.sin(t * p.freq1 + p.phase1) * 0.55 + Math.sin(t * p.freq2 + p.phase2) * 0.45
        p.targetR = baseR + noise * idleDisp + lvl * audioDisp * (0.6 + Math.abs(noise) * 0.8)
        // Lerp current toward target — fast attack, slower decay
        const lf = p.targetR > p.currentR ? 0.25 : 0.12
        p.currentR = lerp(p.currentR, p.targetR, lf)
      }

      // Build screen-space coordinates
      const blobPts = points.map((p) => ({
        x: cx + p.currentR * Math.cos(p.baseAngle),
        y: cy + p.currentR * Math.sin(p.baseAngle),
      }))

      // ── Draw outer glow (behind everything, no clip) ──────────────────────
      const maxBlobR = Math.max(...points.map((p) => p.currentR))
      const glowR = maxBlobR + 10 + lvl * 24

      ctx.save()
      catmullRomPath(ctx, blobPts)
      ctx.shadowColor = curCol.glow
      ctx.shadowBlur = 18 + lvl * 30
      ctx.fillStyle = curCol.glow + '00'
      ctx.fill()
      ctx.restore()

      // Also draw a soft halo circle for small sizes
      const haloGrad = ctx.createRadialGradient(cx, cy, maxBlobR * 0.9, cx, cy, glowR)
      haloGrad.addColorStop(
        0,
        curCol.glow +
          Math.round((0.18 + lvl * 0.32) * 255)
            .toString(16)
            .padStart(2, '0')
      )
      haloGrad.addColorStop(1, curCol.glow + '00')
      ctx.save()
      ctx.beginPath()
      ctx.arc(cx, cy, glowR, 0, Math.PI * 2)
      ctx.fillStyle = haloGrad
      ctx.fill()
      ctx.restore()

      // ── Clip to blob shape and fill interior ──────────────────────────────
      ctx.save()
      catmullRomPath(ctx, blobPts)
      ctx.clip()

      // Dark background
      ctx.fillStyle = curCol.bg
      ctx.fillRect(0, 0, size, size)

      // Orbiting liquid colour layers
      const colKeys = ['c1', 'c2', 'c3'] as const
      for (let i = 0; i < 3; i++) {
        const o = orbiters[i]
        o.angle += o.speed
        const ox = cx + Math.cos(o.angle) * o.orbitR
        const oy = cy + Math.sin(o.angle) * o.orbitR
        const r1 = o.blobR * 0.1
        const r2 = o.blobR * (1.0 + lvl * 0.35)

        const g = ctx.createRadialGradient(ox, oy, r1, ox, oy, r2)
        const baseAlpha = 0.45 + lvl * 0.3
        g.addColorStop(
          0,
          curCol[colKeys[i]] +
            Math.round(baseAlpha * 255)
              .toString(16)
              .padStart(2, '0')
        )
        g.addColorStop(
          0.55,
          curCol[colKeys[i]] +
            Math.round(baseAlpha * 0.4 * 255)
              .toString(16)
              .padStart(2, '0')
        )
        g.addColorStop(1, curCol[colKeys[i]] + '00')
        ctx.fillStyle = g
        ctx.fillRect(0, 0, size, size)
      }

      // Centre core bright spot
      const coreAlpha = 0.15 + lvl * 0.22
      const coreG = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.55)
      coreG.addColorStop(
        0,
        curCol.glow +
          Math.round((coreAlpha + 0.18) * 255)
            .toString(16)
            .padStart(2, '0')
      )
      coreG.addColorStop(
        0.4,
        curCol.glow +
          Math.round(coreAlpha * 0.5 * 255)
            .toString(16)
            .padStart(2, '0')
      )
      coreG.addColorStop(1, curCol.glow + '00')
      ctx.fillStyle = coreG
      ctx.fillRect(0, 0, size, size)

      // Specular highlight — top-left
      const specG = ctx.createRadialGradient(
        cx - R * 0.3,
        cy - R * 0.34,
        R * 0.02,
        cx - R * 0.1,
        cy - R * 0.1,
        R * 0.5
      )
      specG.addColorStop(0, `rgba(255,255,255,${(0.12 + lvl * 0.08).toFixed(3)})`)
      specG.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = specG
      ctx.fillRect(0, 0, size, size)

      ctx.restore()

      animRef.current = requestAnimationFrame(draw)
    }

    draw()
    return () => cancelAnimationFrame(animRef.current)
  }, [size]) // only restart canvas loop on size change; state travels via refs

  return (
    <canvas ref={canvasRef} style={{ borderRadius: '50%', display: 'block', userSelect: 'none' }} />
  )
}
