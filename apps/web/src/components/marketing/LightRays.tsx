'use client'

import { useEffect, useRef } from 'react'
import { Mesh, Program, Renderer, Triangle } from 'ogl'
import styles from './LightRays.module.css'

const DEFAULT_COLOR = '#ffffff'
const OUTSIDE_OFFSET = 0.2

type RaysOrigin =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'left'
  | 'right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right'

interface LightRaysProps {
  raysOrigin?: RaysOrigin
  raysColor?: string
  raysSpeed?: number
  lightSpread?: number
  rayLength?: number
  pulsating?: boolean
  fadeDistance?: number
  saturation?: number
  followMouse?: boolean
  mouseInfluence?: number
  noiseAmount?: number
  distortion?: number
  className?: string
}

interface LightRaysUniforms {
  iTime: { value: number }
  iResolution: { value: [number, number] }
  rayPos: { value: [number, number] }
  rayDir: { value: [number, number] }
  raysColor: { value: [number, number, number] }
  raysSpeed: { value: number }
  lightSpread: { value: number }
  rayLength: { value: number }
  pulsating: { value: number }
  fadeDistance: { value: number }
  saturation: { value: number }
  mousePos: { value: [number, number] }
  mouseInfluence: { value: number }
  noiseAmount: { value: number }
  distortion: { value: number }
}

const vertexShader = `
attribute vec2 position;
varying vec2 vUv;

void main() {
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}
`

const fragmentShader = `
precision highp float;

uniform float iTime;
uniform vec2 iResolution;
uniform vec2 rayPos;
uniform vec2 rayDir;
uniform vec3 raysColor;
uniform float raysSpeed;
uniform float lightSpread;
uniform float rayLength;
uniform float pulsating;
uniform float fadeDistance;
uniform float saturation;
uniform vec2 mousePos;
uniform float mouseInfluence;
uniform float noiseAmount;
uniform float distortion;

varying vec2 vUv;

float noise(vec2 st) {
  return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

vec2 safeNormalize(vec2 value) {
  float magnitude = max(length(value), 0.0001);
  return value / magnitude;
}

float rayStrength(
  vec2 raySource,
  vec2 rayRefDirection,
  vec2 coord,
  float seedA,
  float seedB,
  float speed
) {
  vec2 sourceToCoord = coord - raySource;
  vec2 dirNorm = safeNormalize(sourceToCoord);
  float cosAngle = dot(dirNorm, rayRefDirection);

  float distortedAngle =
    cosAngle + distortion * sin(iTime * 2.0 + length(sourceToCoord) * 0.01) * 0.2;

  float spreadFactor = pow(max(distortedAngle, 0.0), 1.0 / max(lightSpread, 0.001));
  float distance = length(sourceToCoord);
  float maxDistance = iResolution.x * rayLength;
  float lengthFalloff = clamp((maxDistance - distance) / maxDistance, 0.0, 1.0);
  float fadeFalloff = clamp(
    (iResolution.x * fadeDistance - distance) / (iResolution.x * fadeDistance),
    0.5,
    1.0
  );
  float pulse = pulsating > 0.5 ? (0.8 + 0.2 * sin(iTime * speed * 3.0)) : 1.0;

  float baseStrength = clamp(
    (0.45 + 0.15 * sin(distortedAngle * seedA + iTime * speed)) +
      (0.3 + 0.2 * cos(-distortedAngle * seedB + iTime * speed)),
    0.0,
    1.0
  );

  return baseStrength * lengthFalloff * fadeFalloff * spreadFactor * pulse;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 coord = vec2(fragCoord.x, iResolution.y - fragCoord.y);
  vec2 finalRayDir = rayDir;

  if (mouseInfluence > 0.0) {
    vec2 mouseScreenPos = mousePos * iResolution.xy;
    vec2 mouseDirection = safeNormalize(mouseScreenPos - rayPos);
    finalRayDir = safeNormalize(mix(rayDir, mouseDirection, mouseInfluence));
  }

  float rays1 = rayStrength(rayPos, finalRayDir, coord, 36.2214, 21.11349, 1.5 * raysSpeed);
  float rays2 = rayStrength(rayPos, finalRayDir, coord, 22.3991, 18.0234, 1.1 * raysSpeed);
  float rays3 = rayStrength(rayPos, finalRayDir, coord, 13.8472, 31.2211, 0.85 * raysSpeed);

  float beam = clamp(rays1 * 0.58 + rays2 * 0.42 + rays3 * 0.26, 0.0, 1.0);
  beam = pow(beam, 0.82);

  float radialDistance = length((coord - rayPos) / max(iResolution.xy, vec2(1.0)));
  float sourceGlow = exp(-radialDistance * 7.5) * 0.65;
  float shaftGlow = smoothstep(0.12, 0.92, beam) * 0.18;

  fragColor = vec4(vec3(beam + sourceGlow * 0.35 + shaftGlow), 1.0);

  if (noiseAmount > 0.0) {
    float n = noise(coord * 0.01 + iTime * 0.1);
    fragColor.rgb *= (1.0 - noiseAmount + noiseAmount * n);
  }

  float brightness = 1.0 - (coord.y / iResolution.y);
  float verticalFocus = smoothstep(1.0, 0.05, coord.y / iResolution.y);
  fragColor.x *= 0.18 + brightness * 0.82 + verticalFocus * 0.18;
  fragColor.y *= 0.28 + brightness * 0.72 + verticalFocus * 0.22;
  fragColor.z *= 0.46 + brightness * 0.58 + verticalFocus * 0.28;

  if (saturation != 1.0) {
    float gray = dot(fragColor.rgb, vec3(0.299, 0.587, 0.114));
    fragColor.rgb = mix(vec3(gray), fragColor.rgb, saturation);
  }

  vec3 tint = mix(vec3(1.0), raysColor, 0.82);
  fragColor.rgb *= tint * 1.72;
  fragColor.rgb += raysColor * sourceGlow * 0.28;
}

void main() {
  vec4 color;
  mainImage(color, gl_FragCoord.xy);
  gl_FragColor = color;
}
`

const hexToRgb = (hex: string): [number, number, number] => {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return match
    ? [parseInt(match[1], 16) / 255, parseInt(match[2], 16) / 255, parseInt(match[3], 16) / 255]
    : [1, 1, 1]
}

const getAnchorAndDirection = (
  origin: RaysOrigin,
  width: number,
  height: number
): { anchor: [number, number]; direction: [number, number] } => {
  switch (origin) {
    case 'top-left':
      return { anchor: [0, -OUTSIDE_OFFSET * height], direction: [0, 1] }
    case 'top-right':
      return { anchor: [width, -OUTSIDE_OFFSET * height], direction: [0, 1] }
    case 'left':
      return { anchor: [-OUTSIDE_OFFSET * width, 0.5 * height], direction: [1, 0] }
    case 'right':
      return { anchor: [(1 + OUTSIDE_OFFSET) * width, 0.5 * height], direction: [-1, 0] }
    case 'bottom-left':
      return { anchor: [0, (1 + OUTSIDE_OFFSET) * height], direction: [0, -1] }
    case 'bottom-center':
      return { anchor: [0.5 * width, (1 + OUTSIDE_OFFSET) * height], direction: [0, -1] }
    case 'bottom-right':
      return { anchor: [width, (1 + OUTSIDE_OFFSET) * height], direction: [0, -1] }
    case 'top-center':
    default:
      return { anchor: [0.5 * width, -OUTSIDE_OFFSET * height], direction: [0, 1] }
  }
}

export function LightRays({
  raysOrigin = 'top-center',
  raysColor = DEFAULT_COLOR,
  raysSpeed = 1,
  lightSpread = 1,
  rayLength = 2,
  pulsating = false,
  fadeDistance = 1,
  saturation = 1,
  followMouse = true,
  mouseInfluence = 0.1,
  noiseAmount = 0,
  distortion = 0,
  className = '',
}: LightRaysProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mouseRef = useRef({ x: 0.5, y: 0.5 })
  const smoothMouseRef = useRef({ x: 0.5, y: 0.5 })

  useEffect(() => {
    const container = containerRef.current

    if (!container || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return
    }

    let animationFrameId = 0
    let renderer: Renderer | null = null
    let isDisposed = false

    try {
      renderer = new Renderer({
        dpr: Math.min(window.devicePixelRatio, 2),
        alpha: true,
      })
    } catch {
      return
    }

    const gl = renderer.gl
    gl.canvas.style.width = '100%'
    gl.canvas.style.height = '100%'
    gl.canvas.style.display = 'block'

    while (container.firstChild) {
      container.removeChild(container.firstChild)
    }
    container.appendChild(gl.canvas)

    const uniforms: LightRaysUniforms = {
      iTime: { value: 0 },
      iResolution: { value: [1, 1] },
      rayPos: { value: [0, 0] },
      rayDir: { value: [0, 1] },
      raysColor: { value: hexToRgb(raysColor) },
      raysSpeed: { value: raysSpeed },
      lightSpread: { value: lightSpread },
      rayLength: { value: rayLength },
      pulsating: { value: pulsating ? 1 : 0 },
      fadeDistance: { value: fadeDistance },
      saturation: { value: saturation },
      mousePos: { value: [0.5, 0.5] },
      mouseInfluence: { value: mouseInfluence },
      noiseAmount: { value: noiseAmount },
      distortion: { value: distortion },
    }

    const geometry = new Triangle(gl)
    const program = new Program(gl, {
      vertex: vertexShader,
      fragment: fragmentShader,
      uniforms,
    })
    const scene = new Mesh(gl, { geometry, program })

    const updatePlacement = () => {
      if (!renderer) return

      renderer.dpr = Math.min(window.devicePixelRatio, 2)
      renderer.setSize(container.clientWidth, container.clientHeight)

      const width = container.clientWidth * renderer.dpr
      const height = container.clientHeight * renderer.dpr
      uniforms.iResolution.value = [width, height]

      const { anchor, direction } = getAnchorAndDirection(raysOrigin, width, height)
      uniforms.rayPos.value = anchor
      uniforms.rayDir.value = direction
    }

    const renderFrame = (time: number) => {
      if (isDisposed || !renderer) return

      uniforms.iTime.value = time * 0.001

      if (followMouse && mouseInfluence > 0) {
        smoothMouseRef.current.x = smoothMouseRef.current.x * 0.92 + mouseRef.current.x * (1 - 0.92)
        smoothMouseRef.current.y = smoothMouseRef.current.y * 0.92 + mouseRef.current.y * (1 - 0.92)
        uniforms.mousePos.value = [smoothMouseRef.current.x, smoothMouseRef.current.y]
      }

      renderer.render({ scene })
      animationFrameId = window.requestAnimationFrame(renderFrame)
    }

    const handleResize = () => {
      updatePlacement()
    }

    const handleMouseMove = (event: MouseEvent) => {
      const bounds = container.getBoundingClientRect()
      mouseRef.current = {
        x: (event.clientX - bounds.left) / bounds.width,
        y: (event.clientY - bounds.top) / bounds.height,
      }
    }

    updatePlacement()
    window.addEventListener('resize', handleResize)

    if (followMouse) {
      window.addEventListener('mousemove', handleMouseMove)
    }

    animationFrameId = window.requestAnimationFrame(renderFrame)

    return () => {
      isDisposed = true
      window.cancelAnimationFrame(animationFrameId)
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('mousemove', handleMouseMove)

      try {
        const loseContext = gl.getExtension('WEBGL_lose_context')
        loseContext?.loseContext()
      } catch {
        // Ignore browser-specific WebGL teardown errors.
      }

      if (gl.canvas.parentNode === container) {
        container.removeChild(gl.canvas)
      }
    }
  }, [
    distortion,
    fadeDistance,
    followMouse,
    lightSpread,
    mouseInfluence,
    noiseAmount,
    pulsating,
    rayLength,
    raysColor,
    raysOrigin,
    raysSpeed,
    saturation,
  ])

  return <div ref={containerRef} className={`${styles.container} ${className}`.trim()} />
}
