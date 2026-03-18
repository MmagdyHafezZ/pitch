'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import { Aurora } from '@/components/marketing/Aurora'
import styles from './page.module.css'

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const auroraPrimaryStops = ['#7cff67', '#B19EEF', '#5227FF'] as const
const auroraSecondaryStops = ['#B19EEF', '#5227FF', '#7cff67'] as const

export function LandingBackground() {
  const [scrollFade, setScrollFade] = useState(0)

  useEffect(() => {
    let animationFrameId = 0

    const updateFade = () => {
      animationFrameId = 0

      const scrollTop =
        window.scrollY ||
        window.pageYOffset ||
        document.documentElement.scrollTop ||
        document.body.scrollTop ||
        0
      const maxScroll = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1)
      const progress = clamp(scrollTop / maxScroll, 0, 1)
      const easedProgress = progress ** 1.18

      setScrollFade((current) =>
        Math.abs(current - easedProgress) < 0.01 ? current : easedProgress
      )
    }

    const scheduleUpdate = () => {
      if (animationFrameId !== 0) return
      animationFrameId = window.requestAnimationFrame(updateFade)
    }

    updateFade()
    window.addEventListener('scroll', scheduleUpdate, { passive: true })
    window.addEventListener('resize', scheduleUpdate)

    return () => {
      window.removeEventListener('scroll', scheduleUpdate)
      window.removeEventListener('resize', scheduleUpdate)
      if (animationFrameId !== 0) {
        window.cancelAnimationFrame(animationFrameId)
      }
    }
  }, [])

  const sceneStyle = {
    '--background-base-opacity': `${clamp(1 - scrollFade * 0.16, 0.82, 1)}`,
    '--background-aurora-primary-opacity': `${clamp(0.96 - scrollFade * 0.42, 0.42, 0.96)}`,
    '--background-aurora-secondary-opacity': `${clamp(0.62 - scrollFade * 0.34, 0.18, 0.62)}`,
    '--background-glow-opacity': `${clamp(0.66 - scrollFade * 0.44, 0.12, 0.66)}`,
    '--background-grid-opacity': `${clamp(0.05 - scrollFade * 0.032, 0.01, 0.05)}`,
    '--background-vignette-opacity': `${clamp(0.88 + scrollFade * 0.12, 0.88, 1)}`,
  } as CSSProperties

  return (
    <div className={styles.backgroundScene} style={sceneStyle} aria-hidden="true">
      <div className={styles.backgroundBase} />
      <div className={styles.backgroundAuroraField}>
        <Aurora
          className={styles.backgroundAuroraPrimary}
          colorStops={auroraPrimaryStops}
          amplitude={1.28}
          blend={0.94}
          speed={0.8}
        />
        <Aurora
          className={styles.backgroundAuroraSecondary}
          colorStops={auroraSecondaryStops}
          amplitude={1.12}
          blend={0.84}
          speed={0.56}
        />
      </div>
      <div className={styles.backgroundGlowTop} />
      <div className={styles.backgroundGlowBottom} />
      <div className={styles.backgroundGrid} />
      <div className={styles.backgroundVignette} />
    </div>
  )
}
