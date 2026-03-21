'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion, type Transition } from 'framer-motion'
import styles from './PillNav.module.css'

interface PillNavItem {
  href: string
  label: string
  ariaLabel?: string
}

interface PillNavProps {
  items: PillNavItem[]
  className?: string
}

const SCROLL_OFFSET = 180

export function PillNav({ items, className }: PillNavProps) {
  const shouldReduceMotion = useReducedMotion() || false
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [activeHref, setActiveHref] = useState(items[0]?.href ?? '')
  const pillRefs = useRef<Array<HTMLAnchorElement | null>>([])
  const circleRefs = useRef<Array<HTMLSpanElement | null>>([])

  useEffect(() => {
    const layout = () => {
      pillRefs.current.forEach((pill, index) => {
        const circle = circleRefs.current[index]

        if (!pill || !circle) {
          return
        }

        const { width, height } = pill.getBoundingClientRect()
        const radius = ((width * width) / 4 + height * height) / (2 * height)
        const diameter = Math.ceil(2 * radius) + 2
        const delta =
          Math.ceil(radius - Math.sqrt(Math.max(0, radius * radius - (width * width) / 4))) + 1
        const originY = diameter - delta

        circle.style.setProperty('--circle-size', `${diameter}px`)
        circle.style.setProperty('--circle-bottom', `-${delta}px`)
        circle.style.setProperty('--circle-origin', `${originY}px`)
      })
    }

    layout()

    const onResize = () => layout()
    window.addEventListener('resize', onResize)
    document.fonts?.ready?.then(layout).catch(() => {})

    return () => {
      window.removeEventListener('resize', onResize)
    }
  }, [items])

  useEffect(() => {
    const anchorItems = items.filter((item) => item.href.startsWith('#'))

    if (!anchorItems.length) {
      return
    }

    const updateActiveHref = () => {
      const currentHash = window.location.hash
      const sectionItems = anchorItems
        .map((item) => ({
          href: item.href,
          section: document.getElementById(item.href.slice(1)),
        }))
        .filter(
          (item): item is { href: string; section: HTMLElement } =>
            item.section instanceof HTMLElement
        )

      let nextHref = anchorItems[0].href
      const marker = window.scrollY + SCROLL_OFFSET

      for (const item of sectionItems) {
        if (item.section.offsetTop <= marker) {
          nextHref = item.href
        }
      }

      if (currentHash && anchorItems.some((item) => item.href === currentHash)) {
        nextHref = currentHash
      }

      setActiveHref((previousHref) => (previousHref === nextHref ? previousHref : nextHref))
    }

    let frameId = 0
    const scheduleUpdate = () => {
      window.cancelAnimationFrame(frameId)
      frameId = window.requestAnimationFrame(updateActiveHref)
    }

    scheduleUpdate()
    window.addEventListener('scroll', scheduleUpdate, { passive: true })
    window.addEventListener('resize', scheduleUpdate)
    window.addEventListener('hashchange', scheduleUpdate)

    return () => {
      window.cancelAnimationFrame(frameId)
      window.removeEventListener('scroll', scheduleUpdate)
      window.removeEventListener('resize', scheduleUpdate)
      window.removeEventListener('hashchange', scheduleUpdate)
    }
  }, [items])

  const handleItemClick = (href: string) => {
    setActiveHref(href)
    setIsMobileMenuOpen(false)
  }

  const containerClassName = className ? `${styles.container} ${className}` : styles.container
  const mobileTransition: Transition = shouldReduceMotion
    ? { duration: 0 }
    : { duration: 0.18, ease: [0.22, 1, 0.36, 1] }

  return (
    <div className={containerClassName}>
      <nav className={styles.nav} aria-label="Landing sections">
        <div className={styles.desktopItems}>
          <ul className={styles.list}>
            {items.map((item, index) => {
              const pillClassName =
                activeHref === item.href ? `${styles.pill} ${styles.pillActive}` : styles.pill

              return (
                <li key={item.href} className={styles.item}>
                  <a
                    ref={(node) => {
                      pillRefs.current[index] = node
                    }}
                    href={item.href}
                    aria-label={item.ariaLabel ?? item.label}
                    aria-current={activeHref === item.href ? 'location' : undefined}
                    className={pillClassName}
                    onClick={() => handleItemClick(item.href)}
                  >
                    <span
                      ref={(node) => {
                        circleRefs.current[index] = node
                      }}
                      className={styles.hoverCircle}
                      aria-hidden="true"
                    />
                    <span className={styles.labelStack}>
                      <span className={styles.label}>{item.label}</span>
                    </span>
                  </a>
                </li>
              )
            })}
          </ul>
        </div>

        <button
          type="button"
          className={
            isMobileMenuOpen
              ? `${styles.mobileButton} ${styles.mobileButtonOpen}`
              : styles.mobileButton
          }
          aria-label={isMobileMenuOpen ? 'Close section menu' : 'Open section menu'}
          aria-expanded={isMobileMenuOpen}
          onClick={() => setIsMobileMenuOpen((current) => !current)}
        >
          <span className={styles.mobileButtonLines} aria-hidden="true">
            <span className={styles.mobileLine} />
            <span className={styles.mobileLine} />
          </span>
        </button>
      </nav>

      <AnimatePresence>
        {isMobileMenuOpen ? (
          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.98 }}
            transition={mobileTransition}
            className={styles.mobilePopover}
          >
            <ul className={styles.mobileList}>
              {items.map((item) => {
                const mobileLinkClassName =
                  activeHref === item.href
                    ? `${styles.mobileLink} ${styles.mobileLinkActive}`
                    : styles.mobileLink

                return (
                  <li key={item.href}>
                    <a
                      href={item.href}
                      aria-label={item.ariaLabel ?? item.label}
                      className={mobileLinkClassName}
                      onClick={() => handleItemClick(item.href)}
                    >
                      {item.label}
                    </a>
                  </li>
                )
              })}
            </ul>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
