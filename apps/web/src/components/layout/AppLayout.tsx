'use client'

import { AppShell, Box, rem } from '@mantine/core'
import { ReactNode } from 'react'
import { useDisclosure, useMediaQuery } from '@mantine/hooks'
import Grainient from '@/components/Grainient'
import classes from './app-layout.module.css'

type ShellControls = {
  mobileNavOpened: boolean
  toggleMobileNav: () => void
  closeMobileNav: () => void
}

type ShellSlot = ReactNode | ((controls: ShellControls) => ReactNode)

type Props = {
  header: ShellSlot
  navbar: ShellSlot
  children: ReactNode
}

export function AppLayout({ header, navbar, children }: Props) {
  const isMobile = useMediaQuery('(max-width: 48em)')
  const [opened, { toggle, close }] = useDisclosure()
  const currentPage = typeof window !== 'undefined' ? window.location.pathname : ''
  const mobileBaseHeaderHeight =
    currentPage === '/studio/sessions'
      ? rem(180)
      : currentPage === '/studio/team-config'
        ? rem(150)
        : rem(100)
  const headerHeight = isMobile
    ? `calc(${mobileBaseHeaderHeight} + env(safe-area-inset-top, 0px))`
    : rem(60)
  const curveRadius = rem(18)
  const controls: ShellControls = {
    mobileNavOpened: opened,
    toggleMobileNav: toggle,
    closeMobileNav: close,
  }
  const headerNode = typeof header === 'function' ? header(controls) : header
  const navbarNode = typeof navbar === 'function' ? navbar(controls) : navbar

  return (
    <AppShell
      withBorder={false}
      header={{ height: headerHeight }}
      navbar={{ width: 300, breakpoint: 'md', collapsed: { mobile: !opened } }}
      styles={{
        header: {
          background:
            'var(--pitch-nav-bg, var(--mantine-color-nav-9, var(--mantine-color-dark-9)))',
        },
        navbar: {
          background:
            'var(--pitch-nav-bg, var(--mantine-color-nav-9, var(--mantine-color-dark-9)))',
        },
        main: {
          background:
            'var(--pitch-app-bg, var(--pitch-surface-bg, var(--mantine-color-surface-0, var(--mantine-color-body))))',
          height: `calc(100dvh - ${headerHeight})`,
          overflow: 'hidden',
        },
      }}
      padding={0}
    >
      <AppShell.Header>{headerNode}</AppShell.Header>
      <AppShell.Navbar>{navbarNode}</AppShell.Navbar>
      <AppShell.Main>
        <Box className={classes.surface} style={{ ['--studio-shell-radius' as any]: curveRadius }}>
          <div className={classes.grainientLayer} aria-hidden="true">
            <Grainient
              color1="var(--pitch-info, #4d5a8a)"
              color2="var(--pitch-selected, #2e3a67)"
              color3="var(--pitch-app-bg, #060c1e)"
              timeSpeed={0.45}
              colorBalance={0}
              warpStrength={1}
              warpFrequency={5}
              warpSpeed={4}
              warpAmplitude={50}
              blendAngle={0}
              blendSoftness={0.05}
              rotationAmount={500}
              noiseScale={2}
              grainAmount={0.1}
              grainScale={2}
              grainAnimated={false}
              contrast={1.5}
              gamma={1}
              saturation={1}
              centerX={0}
              centerY={0}
              zoom={0.5}
            />
          </div>
          <Box className={classes.content}>{children}</Box>
        </Box>
      </AppShell.Main>
    </AppShell>
  )
}
