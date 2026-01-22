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
  const headerHeight = 60
  const navbarWidth = 300
  const cornerRadius = 50

  return (
    <AppShell
      layout="alt"
      withBorder={false}
      header={{ height: headerHeight }}
      navbar={{ width: navbarWidth, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      styles={{
        header: {
          background: '#0f172a',
        },
        navbar: {
          background: '#0f172a',
        },
        main: {
          background: '#0f172a',
          height: `calc(100vh - ${rem(headerHeight)})`,
          overflow: 'hidden',
        },
      }}
      padding={0}
    >
      <AppShell.Header>{header}</AppShell.Header>
      <AppShell.Navbar p={0}>{navbar}</AppShell.Navbar>
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
              borderTopLeftRadius: rem(cornerRadius),
              pointerEvents: 'none',
            }}
          />
          <Box
            style={{
              position: 'relative',
              height: '100%',
              overflow: 'auto',
              padding: rem(24),
              borderTopLeftRadius: rem(cornerRadius),
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
