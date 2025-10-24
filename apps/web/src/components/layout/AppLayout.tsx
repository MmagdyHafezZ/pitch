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
      layout="alt"
      withBorder={false}
      header={{ height: 60 }}
      footer={{ height: 60 }}
      navbar={{ width: 300, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding="md"
    >
      <AppShell.Header>{header}</AppShell.Header>
      <AppShell.Navbar p="sm">{navbar}</AppShell.Navbar>
      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  )
}
