'use client'

import { AppShell } from '@mantine/core'
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
      withBorder={false}
      header={{ height: '3.7em' }}
      navbar={{ width: 300, breakpoint: 'md', collapsed: { mobile: !opened } }}
      padding="md"
    >
      <AppShell.Header>{header}</AppShell.Header>
      <AppShell.Navbar>{navbar}</AppShell.Navbar>
      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  )
}
