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
          background: 'var(--mantine-color-dark-9)',
        },
        navbar: {
          background: 'var(--mantine-color-dark-9)',
        },
        main: {
          background: 'var(--mantine-color-dark-9)',
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
          }}
        >
          <Box
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'linear-gradient(180deg, rgba(241, 245, 249, 0.9) 0%, rgba(248, 250, 252, 0.98) 100%)',
              borderTop: '1px solid #e2e8f0',
              borderLeft: '1px solid #e2e8f0',
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
            }}
          >
            {children}
          </Box>
        </Box>
      </AppShell.Main>
    </AppShell>
  )
}
