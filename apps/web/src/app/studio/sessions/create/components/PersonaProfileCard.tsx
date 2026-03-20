'use client'

import { ActionIcon, Badge } from '@mantine/core'
import { IconInfoCircle, IconUser, IconX } from '@tabler/icons-react'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import type { CSSProperties, KeyboardEvent, PointerEvent } from 'react'
import type { Persona, PersonaTraits } from '../lib/types'
import styles from './persona-profile-card.module.css'

interface PersonaMetric {
  label: string
  value: number
}

interface PersonaProfileCardProps {
  persona: Persona
  avatarUrl?: string
  archetype: string
  rarity: string
  rarityColor: string
  voiceProfile: string
  metrics: PersonaMetric[]
  signatureTraits: string[]
  isPreviewLoading: boolean
  isPreviewPlaying: boolean
  infoOpen: boolean
  onInfoToggle: () => void
  onPreviewAudio: () => void
  onSelect: () => void
}

const clamp = (value: number, min = 0, max = 100) => Math.min(Math.max(value, min), max)

const resolveMantineColor = (value: string, shade: number, fallback: string) => {
  if (!value) return fallback
  if (
    value.startsWith('#') ||
    value.startsWith('rgb') ||
    value.startsWith('hsl') ||
    value.startsWith('var(')
  ) {
    return value
  }
  return `var(--mantine-color-${value}-${shade})`
}

export function PersonaProfileCard({
  persona,
  avatarUrl,
  archetype,
  rarity,
  rarityColor,
  voiceProfile,
  metrics,
  signatureTraits,
  infoOpen,
  onInfoToggle,
  onSelect,
}: PersonaProfileCardProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const traits = (persona.traits ?? {}) as PersonaTraits
  const accentColor = useMemo(
    () => resolveMantineColor(rarityColor, 6, 'var(--mantine-color-blue-5)'),
    [rarityColor]
  )
  const accentGlow = useMemo(
    () => resolveMantineColor(rarityColor, 4, 'var(--mantine-color-cyan-4)'),
    [rarityColor]
  )
  const overlayMetrics = metrics.slice(0, 3)
  const overlaySummary =
    traits.background?.trim() ||
    traits.personality?.trim() ||
    'Configured persona ready for adaptive role-play and interruption-safe practice.'

  const applyPointerPosition = useCallback((clientX: number, clientY: number) => {
    const node = wrapperRef.current
    if (!node) return

    const rect = node.getBoundingClientRect()
    const percentX = clamp(((clientX - rect.left) / rect.width) * 100)
    const percentY = clamp(((clientY - rect.top) / rect.height) * 100)
    const rotateX = ((50 - percentY) / 7).toFixed(2)
    const rotateY = ((percentX - 50) / 6).toFixed(2)
    const shiftX = ((percentX - 50) / 10).toFixed(2)
    const shiftY = ((percentY - 50) / 12).toFixed(2)

    node.style.setProperty('--pc-pointer-x', `${percentX}%`)
    node.style.setProperty('--pc-pointer-y', `${percentY}%`)
    node.style.setProperty('--pc-rotate-x', `${rotateX}deg`)
    node.style.setProperty('--pc-rotate-y', `${rotateY}deg`)
    node.style.setProperty('--pc-shift-x', `${shiftX}px`)
    node.style.setProperty('--pc-shift-y', `${shiftY}px`)
  }, [])

  const resetPointerPosition = useCallback(() => {
    const node = wrapperRef.current
    if (!node) return

    node.style.setProperty('--pc-pointer-x', '50%')
    node.style.setProperty('--pc-pointer-y', '50%')
    node.style.setProperty('--pc-rotate-x', '0deg')
    node.style.setProperty('--pc-rotate-y', '0deg')
    node.style.setProperty('--pc-shift-x', '0px')
    node.style.setProperty('--pc-shift-y', '0px')
  }, [])

  useEffect(() => {
    resetPointerPosition()
  }, [resetPointerPosition])

  // Reset tilt before flipping so it doesn't interfere with the flip animation
  useEffect(() => {
    if (infoOpen) resetPointerPosition()
  }, [infoOpen, resetPointerPosition])

  const handlePointerEnter = (event: PointerEvent<HTMLDivElement>) => {
    if (infoOpen) return
    event.currentTarget.dataset.active = 'true'
    applyPointerPosition(event.clientX, event.clientY)
  }

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (infoOpen) return
    applyPointerPosition(event.clientX, event.clientY)
  }

  const handlePointerLeave = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.dataset.active = 'false'
    resetPointerPosition()
  }

  const handleRootKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.currentTarget !== event.target) return
    if (event.key !== 'Enter' && event.key !== ' ') return

    event.preventDefault()
    onSelect()
  }

  const cardStyle = {
    '--pc-accent': accentColor,
    '--pc-accent-glow': accentGlow,
  } as CSSProperties

  return (
    <div
      ref={wrapperRef}
      role="button"
      tabIndex={0}
      aria-label={`Select persona ${persona.name}`}
      data-open={infoOpen ? 'true' : 'false'}
      className={styles.cardWrapper}
      style={cardStyle}
      onClick={onSelect}
      onKeyDown={handleRootKeyDown}
      onPointerEnter={handlePointerEnter}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      onFocus={() => {
        const node = wrapperRef.current
        if (!node) return
        node.dataset.active = 'true'
      }}
      onBlur={() => {
        const node = wrapperRef.current
        if (!node) return
        node.dataset.active = 'false'
        resetPointerPosition()
      }}
    >
      <div className={styles.behindGlow} />
      <div className={`${styles.cardShell} ${infoOpen ? styles.cardShellFlipped : ''}`}>
        {/* ── FRONT FACE ── */}
        <div className={styles.card}>
          <div className={styles.cardBackdrop} />
          <div className={styles.cardGrid} />
          <div className={styles.cardShine} />
          <div className={styles.cardGlare} />

          <div className={styles.badgeRail}>
            <Badge size="xs" variant="filled" color="dark">
              {archetype}
            </Badge>
            <Badge size="xs" variant="outline" color={rarityColor}>
              {rarity}
            </Badge>
          </div>

          <ActionIcon
            size="md"
            radius="xl"
            variant="light"
            color="gray"
            className={styles.infoButton}
            aria-label={`Show persona details for ${persona.name}`}
            onClick={(event) => {
              event.stopPropagation()
              onInfoToggle()
            }}
          >
            <IconInfoCircle size={16} />
          </ActionIcon>

          <div className={styles.avatarStage}>
            <div className={styles.avatarHalo} />
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="" className={styles.avatarImage} />
            ) : (
              <div className={styles.avatarFallback}>
                <IconUser size={72} stroke={1.4} />
              </div>
            )}
          </div>

          <div className={styles.titleBlock}>
            <p className={styles.titleEyebrow}>{traits.role ?? 'AI Persona'}</p>
            <h3 className={styles.titleText}>{persona.name}</h3>
            <p className={styles.titleSub}>
              {traits.level ?? 'Expert'} ·{' '}
              {traits.communicationStyle ?? traits.tone ?? 'Adaptive style'}
            </p>
          </div>

          {signatureTraits.length > 0 && (
            <div className={styles.traitRail}>
              {signatureTraits.slice(0, 2).map((trait) => (
                <span key={trait} className={styles.traitPill}>
                  {trait}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* ── BACK FACE ── */}
        <div className={styles.cardBack} onClick={(event) => event.stopPropagation()}>
          <ActionIcon
            size="md"
            radius="xl"
            variant="light"
            color="gray"
            className={styles.backCloseButton}
            aria-label={`Hide persona details for ${persona.name}`}
            onClick={(event) => {
              event.stopPropagation()
              onInfoToggle()
            }}
          >
            <IconX size={16} />
          </ActionIcon>

          <div className={styles.overlayHeader}>
            <div>
              <p className={styles.overlayEyebrow}>Persona Intel</p>
              <h4 className={styles.overlayTitle}>{persona.name}</h4>
            </div>
            <Badge size="xs" variant="light" color={rarityColor}>
              {traits.level ?? 'Expert'}
            </Badge>
          </div>

          <p className={styles.overlaySummary}>{overlaySummary}</p>

          <div className={styles.overlayDetails}>
            <div className={styles.overlayDetailCard}>
              <span className={styles.overlayLabel}>Voice</span>
              <span className={styles.overlayValue}>{voiceProfile}</span>
            </div>
            <div className={styles.overlayDetailCard}>
              <span className={styles.overlayLabel}>Tone</span>
              <span className={styles.overlayValue}>
                {traits.tone ?? traits.communicationStyle ?? 'Adaptive'}
              </span>
            </div>
            <div className={styles.overlayDetailCard}>
              <span className={styles.overlayLabel}>Patience</span>
              <span className={styles.overlayValue}>{traits.patience ?? 'Balanced'}</span>
            </div>
            <div className={styles.overlayDetailCard}>
              <span className={styles.overlayLabel}>Provider</span>
              <span className={styles.overlayValue}>
                {traits.voice?.provider ?? 'Configured in studio'}
              </span>
            </div>
          </div>

          {signatureTraits.length > 0 && (
            <div className={styles.overlaySection}>
              <span className={styles.overlaySectionLabel}>Signature Traits</span>
              <div className={styles.overlayTraitRail}>
                {signatureTraits.slice(0, 4).map((trait) => (
                  <span key={trait} className={styles.overlayTraitPill}>
                    {trait}
                  </span>
                ))}
              </div>
            </div>
          )}

          {overlayMetrics.length > 0 && (
            <div className={styles.overlaySection}>
              <span className={styles.overlaySectionLabel}>Performance Bias</span>
              <div className={styles.metricStack}>
                {overlayMetrics.map((metric) => (
                  <div key={metric.label} className={styles.metricRow}>
                    <div className={styles.metricHeader}>
                      <span>{metric.label}</span>
                      <span>{metric.value}</span>
                    </div>
                    <div className={styles.metricTrack}>
                      <div className={styles.metricFill} style={{ width: `${metric.value}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
