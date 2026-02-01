'use client'

import { AppShell, Box, rem } from '@mantine/core'
import { ReactNode } from 'react'
import { useDisclosure } from '@mantine/hooks'

type Props = {
  header: ReactNode
  navbar: ReactNode
  children: ReactNode
}

export function AppLayout({ header, navbar, children }: Props) {
  const [opened, { toggle }] = useDisclosure()
  const headerHeight = '3.7em'
  const curveRadius = rem(36)

  return (
    <AppShell
      withBorder={false}
      header={{ height: headerHeight }}
      navbar={{ width: 300, breakpoint: 'md', collapsed: { mobile: !opened } }}
      styles={{
        header: {
          background: 'var(--pitch-nav-bg, var(--mantine-color-dark-9))',
        },
        navbar: {
          background: 'var(--pitch-nav-bg, var(--mantine-color-dark-9))',
        },
        main: {
          background: 'var(--pitch-app-bg, var(--pitch-surface-bg, var(--mantine-color-dark-9)))',
          height: `calc(100vh - ${headerHeight})`,
          overflow: 'hidden',
        },
      }}
      padding={0}
    >
      <AppShell.Header>{header}</AppShell.Header>
      <AppShell.Navbar>{navbar}</AppShell.Navbar>
      <AppShell.Main>
        <Box
          style={{
            position: 'relative',
            height: '100%',
            width: '100%',
            overflow: 'hidden',
            background: 'var(--pitch-app-bg, var(--pitch-surface-bg, var(--mantine-color-body)))',
          }}
        >
          <Box
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'var(--pitch-window-gradient, var(--pitch-surface-bg, var(--mantine-color-body)))',
              borderTop: '1px solid var(--mantine-color-default-border)',
              borderLeft: '1px solid var(--mantine-color-default-border)',
              borderTopLeftRadius: curveRadius,
              pointerEvents: 'none',
            }}
          />
          <Box
            style={{
              position: 'relative',
              height: '100%',
              overflow: 'auto',
              padding: rem(16),
              borderTopLeftRadius: curveRadius,
              overflowX: 'hidden',
              background: 'var(--pitch-app-bg, var(--pitch-surface-bg, var(--mantine-color-body)))',
            }}
          >
            {children}
          </Box>
        </Box>
      </AppShell.Main>
    </AppShell>
  )
}
