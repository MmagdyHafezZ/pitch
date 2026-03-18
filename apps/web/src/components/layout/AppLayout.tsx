'use client'

import { AppShell, Box, rem } from '@mantine/core'
import { ReactNode } from 'react'
import { useMediaQuery } from '@mantine/hooks'
import classes from './app-layout.module.css'

type Props = {
  header: ReactNode
  navbar: ReactNode
  children: ReactNode
  navbarOpened?: boolean
}

export function AppLayout({ header, navbar, children, navbarOpened = false }: Props) {
  const isMobile = useMediaQuery('(max-width: 48em)')
  const currentPage = typeof window !== 'undefined' ? window.location.pathname : ''
  const mobileBaseHeaderHeight =
    currentPage === '/studio/sessions'
      ? rem(180)
      : currentPage === '/studio/team-config'
        ? rem(150)
        : rem(68)
  const headerHeight = isMobile
    ? `calc(${mobileBaseHeaderHeight} + env(safe-area-inset-top, 0px))`
    : rem(60)
  const curveRadius = rem(18)

  return (
    <AppShell
      withBorder={false}
      header={{ height: headerHeight }}
      navbar={{ width: 300, breakpoint: 'md', collapsed: { mobile: !navbarOpened } }}
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
      <AppShell.Header>{header}</AppShell.Header>
      <AppShell.Navbar>{navbar}</AppShell.Navbar>
      <AppShell.Main>
        <Box className={classes.surface} style={{ ['--studio-shell-radius' as any]: curveRadius }}>
          <div className={classes.mesh} />
          <div className={`${classes.glowOrb} ${classes.orbA}`} />
          <div className={`${classes.glowOrb} ${classes.orbB}`} />
          <Box className={classes.content}>{children}</Box>
        </Box>
      </AppShell.Main>
    </AppShell>
  )
}
