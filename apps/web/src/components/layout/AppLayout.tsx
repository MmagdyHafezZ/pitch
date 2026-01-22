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

  return (
    <AppShell
      layout="alt"
      withBorder={false}
      header={{ height: 60 }}
      navbar={{ width: 300, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      styles={{
        header: {
          background: '#0f172a',
        },
        navbar: {
          background: '#0f172a',
        },
        main: {
          background: '#0f172a',
        },
      }}
      padding={0}
    >
      <AppShell.Header>{header}</AppShell.Header>
      <AppShell.Navbar p={0}>{navbar}</AppShell.Navbar>
      <AppShell.Main>
        <Box
          style={{
            minHeight: `calc(100vh - ${rem(60)})`,
            padding: rem(24),
            background:
              'linear-gradient(180deg, rgba(241, 245, 249, 0.9) 0%, rgba(248, 250, 252, 0.98) 100%)',
            borderTop: '1px solid #e2e8f0',
            borderLeft: '1px solid #e2e8f0',
            borderTopLeftRadius: rem(50),
            // borderBottomLeftRadius: rem(50),
          }}
        >
          {children}
        </Box>
      </AppShell.Main>
    </AppShell>
  )
}
