'use client'

import { useEffect, useMemo } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import {
  AppShell,
  Box,
  NavLink,
  Title,
  Text,
  Group,
  ThemeIcon,
  Divider,
  Stack,
  Loader,
  Center,
  rem,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { useAuthStore } from '@/features/auth/stores/auth.store'
import {
  IconDashboard,
  IconCreditCard,
  IconUsers,
  IconUsersGroup,
  IconDeviceDesktopAnalytics,
  IconArrowLeft,
  IconShield,
} from '@tabler/icons-react'
import { useAdminStore } from './stores/admin.store'

const NAV_ITEMS = [
  { label: 'Overview', href: '/admin', icon: IconDashboard },
  { label: 'Plans', href: '/admin/plans', icon: IconCreditCard },
  { label: 'Users', href: '/admin/users', icon: IconUsers },
  { label: 'Teams', href: '/admin/teams', icon: IconUsersGroup },
  { label: 'Sessions', href: '/admin/sessions', icon: IconDeviceDesktopAnalytics },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const user = useAuthStore((s) => s.user)
  const [opened, { close }] = useDisclosure()
  const { isAdmin, checking, check } = useAdminStore()

  useEffect(() => {
    if (user && !user.settings?.onboarding?.completed) {
      router.replace('/onboarding')
    }
  }, [user, router])

  useEffect(() => {
    check()
  }, [check])

  // Once check is done and user is not admin, redirect
  useEffect(() => {
    if (!checking && isAdmin === false) {
      notifications.show({
        title: 'Access Denied',
        message: 'You do not have admin access.',
        color: 'red',
      })
      router.replace('/studio/home')
    }
  }, [checking, isAdmin, router])

  const activeItem = useMemo(() => {
    if (!pathname) return '/admin'
    const match = NAV_ITEMS.filter((item) => item.href !== '/admin').find((item) =>
      pathname.startsWith(item.href)
    )
    return match?.href ?? '/admin'
  }, [pathname])

  // Show loader while the admin check is in-flight or not yet resolved
  if (checking || isAdmin === null) {
    return (
      <Center h="100vh">
        <Loader size="lg" />
      </Center>
    )
  }

  // Non-admin: return null while redirect fires
  if (isAdmin === false) {
    return null
  }

  return (
    <AppShell
      withBorder={false}
      header={{ height: rem(60) }}
      navbar={{ width: 260, breakpoint: 'md', collapsed: { mobile: !opened } }}
      styles={{
        header: {
          background: 'var(--pitch-nav-bg, var(--mantine-color-dark-9))',
          borderBottom: '1px solid var(--mantine-color-dark-6)',
        },
        navbar: {
          background: 'var(--pitch-nav-bg, var(--mantine-color-dark-9))',
          borderRight: '1px solid var(--mantine-color-dark-6)',
        },
        main: {
          background: 'var(--pitch-app-bg, var(--mantine-color-body))',
        },
      }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group gap="sm">
            <ThemeIcon
              size="lg"
              radius="md"
              variant="gradient"
              gradient={{ from: 'red', to: 'orange' }}
            >
              <IconShield size={20} />
            </ThemeIcon>
            <Title order={4} c="white" fw={600}>
              PITCH Admin
            </Title>
          </Group>
          <Group
            gap={4}
            c="dimmed"
            style={{ cursor: 'pointer', fontSize: 'var(--mantine-font-size-sm)' }}
            onClick={() => router.push('/studio/home')}
          >
            <IconArrowLeft size={14} />
            Back to Studio
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="sm">
        <Stack gap={4}>
          <Text size="xs" c="dimmed" tt="uppercase" fw={700} px="sm" mb={4}>
            Management
          </Text>
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.href}
              label={item.label}
              leftSection={<item.icon size={18} />}
              active={activeItem === item.href}
              onClick={() => {
                router.push(item.href)
                close()
              }}
              variant="filled"
              styles={{
                root: {
                  borderRadius: 'var(--mantine-radius-md)',
                },
              }}
            />
          ))}
          <Divider my="sm" color="dark.6" />
          <NavLink
            label="Back to Studio"
            leftSection={<IconArrowLeft size={18} />}
            onClick={() => router.push('/studio/home')}
            styles={{
              root: {
                borderRadius: 'var(--mantine-radius-md)',
              },
            }}
          />
        </Stack>
      </AppShell.Navbar>

      <AppShell.Main>
        <Box maw={1400} mx="auto">
          {children}
        </Box>
      </AppShell.Main>
    </AppShell>
  )
}
