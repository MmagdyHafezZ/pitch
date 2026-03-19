'use client'

import type { CSSProperties } from 'react'
import { useEffect, useState } from 'react'
import { useMotionValueEvent, useReducedMotion, useSpring } from 'framer-motion'
import styles from './Counter.module.css'

export interface CounterProps {
  value: number
  decimals?: number
  prefix?: string
  suffix?: string
  startValue?: number
  animateOnMount?: boolean
  delayMs?: number
  grouping?: boolean
  fontSize?: number
  padding?: number
  gap?: number
  borderRadius?: number
  horizontalPadding?: number
  textColor?: string
  fontWeight?: CSSProperties['fontWeight']
  gradientHeight?: number
  gradientFrom?: string
  gradientTo?: string
  className?: string
  containerStyle?: CSSProperties
  counterStyle?: CSSProperties
  digitStyle?: CSSProperties
}

function formatNumber(value: number, decimals: number, grouping: boolean) {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: grouping,
  })
}

function roundForDisplay(value: number, decimals: number) {
  if (decimals === 0) {
    return Math.round(value)
  }

  const precision = 10 ** decimals
  return Math.round(value * precision) / precision
}

export function Counter({
  value,
  decimals = 0,
  prefix = '',
  suffix = '',
  startValue = 0,
  animateOnMount = true,
  delayMs = 140,
  grouping = true,
  fontSize = 100,
  textColor = 'inherit',
  fontWeight = 'inherit',
  className,
  containerStyle,
  counterStyle,
  digitStyle,
}: CounterProps) {
  const shouldReduceMotion = useReducedMotion() || false
  const initialValue = shouldReduceMotion || !animateOnMount ? value : startValue
  const [displayValue, setDisplayValue] = useState(() =>
    formatNumber(roundForDisplay(initialValue, decimals), decimals, grouping)
  )
  const spring = useSpring(initialValue, {
    stiffness: 88,
    damping: 22,
    mass: 0.72,
  })

  const accessibleValue = `${prefix}${formatNumber(value, decimals, grouping)}${suffix}`
  const wrapperClassName = className ? `${styles.wrapper} ${className}` : styles.wrapper
  const valueStyle: CSSProperties = {
    fontSize,
    color: textColor,
    fontWeight,
    ...counterStyle,
    ...digitStyle,
  }

  useMotionValueEvent(spring, 'change', (latest) => {
    setDisplayValue(formatNumber(roundForDisplay(latest, decimals), decimals, grouping))
  })

  useEffect(() => {
    if (shouldReduceMotion) {
      spring.jump(value)
      setDisplayValue(formatNumber(value, decimals, grouping))
      return
    }

    const timeoutId = window.setTimeout(() => {
      spring.set(value)
    }, delayMs)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [decimals, delayMs, grouping, shouldReduceMotion, spring, value])

  return (
    <span className={wrapperClassName} style={containerStyle}>
      <span className={styles.srOnly}>{accessibleValue}</span>
      {prefix ? (
        <span className={styles.affix} aria-hidden="true">
          {prefix}
        </span>
      ) : null}
      <span className={styles.value} aria-hidden="true" style={valueStyle}>
        {displayValue}
      </span>
      {suffix ? (
        <span className={styles.affix} aria-hidden="true">
          {suffix}
        </span>
      ) : null}
    </span>
  )
}
