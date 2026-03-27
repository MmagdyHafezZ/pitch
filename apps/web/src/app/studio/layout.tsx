'use client'
import { AppLayout } from '@/components/layout/AppLayout'
import { AppSidebar, type SidebarLink } from '@/components/ui/AppSideBar'
import { AppTopBar } from '@/components/ui/AppTopBar'
import { TeamSideBar } from '@/components/ui/TeamSideBar'
import { CoachChatWidget } from '@/components/ui/CoachChatWidget'
import { ProactiveCalendarNudge } from '@/features/proactive/ProactiveCalendarNudge'
import { useTeams } from '@/features/teams/hooks/useTeams'
import { useAuthStore } from '@/features/auth/stores/auth.store'
import { Box } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { modals } from '@mantine/modals'
import {
  IconActivityHeartbeat,
  IconArrowLeft,
  IconCreditCard,
  IconLayoutDashboard,
  IconServer,
  IconUser,
  IconUsersGroup,
} from '@tabler/icons-react'
import { useState, useEffect, useMemo, Suspense } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

const ADMIN_MAIN_LINKS: SidebarLink[] = [
  {
    icon: IconLayoutDashboard,
    label: 'Dashboard',
    href: '/studio/admin',
  },
  {
    icon: IconServer,
    label: 'System',
    href: '/studio/admin/system',
  },
  {
    icon: IconUser,
    label: 'Users',
    href: '/studio/admin/users',
  },
  {
    icon: IconUsersGroup,
    label: 'Teams',
    href: '/studio/admin/teams',
  },
  {
    icon: IconCreditCard,
    label: 'Plans',
    href: '/studio/admin/plans',
  },
  {
    icon: IconActivityHeartbeat,
    label: 'Sessions',
    href: '/studio/admin/sessions',
  },
]

const ADMIN_SECONDARY_LINKS: SidebarLink[] = [
  {
    icon: IconArrowLeft,
    label: 'Back to Workspace',
    href: '/studio/home',
  },
]

export default function ClientLayerComponent({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState<string>('Home')
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date())
  const {
    teams,
    activeTeamId,
    setActiveTeamId,
    fetchUserTeams,
    leaveTeam,
    loading: teamsLoading,
  } = useTeams()
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const isAdminRoute = Boolean(pathname?.startsWith('/studio/admin'))
  const isCreatingTeam = searchParams.get('mode') === 'create'
  const user = useAuthStore((state) => state.user)

  useEffect(() => {
    if (user && !user.settings?.onboarding?.completed) {
      router.replace('/onboarding')
    }
  }, [user, router])

  const [tabsByPage, setTabsByPage] = useState<
    Record<
      'Home' | 'Sessions' | 'Teams' | 'Analytics' | 'Challenges' | 'Settings' | 'Admin',
      string
    >
  >({
    Home: 'All',
    Sessions: 'All',
    Teams: 'All',
    Analytics: 'Overview',
    Challenges: '',
    Settings: '',
    Admin: '',
  })

  const handleTabChange = (
    page: 'Home' | 'Sessions' | 'Teams' | 'Analytics' | 'Challenges' | 'Settings' | 'Admin'
  ) => {
    return (tab: string) => {
      setTabsByPage((prev) => ({ ...prev, [page]: tab }))
      if (page === 'Sessions') {
        const params = new URLSearchParams(searchParams.toString())
        params.set('filter', tab)
        router.replace(`${pathname}?${params.toString()}`)
      }
      if (page === 'Analytics') {
        const params = new URLSearchParams(searchParams.toString())
        params.set('tab', tab)
        router.replace(`${pathname}?${params.toString()}`)
      }
      if (page === 'Challenges') {
        const params = new URLSearchParams(searchParams.toString())
        if (tab === 'All') {
          params.delete('period')
        } else {
          params.set('period', tab.toUpperCase())
        }
        const query = params.toString()
        router.replace(query ? `${pathname}?${query}` : pathname)
      }
    }
  }

  const pageInfo = useMemo(() => {
    if (!pathname) {
      return { page: 'Home' as const, nav: 'Home' as const }
    }
    if (pathname.startsWith('/studio/sessions')) {
      return { page: 'Sessions' as const, nav: 'Sessions' as const }
    }
    if (pathname.startsWith('/studio/scenarios')) {
      return { page: 'Sessions' as const, nav: 'Sessions' as const }
    }
    if (pathname.startsWith('/studio/analytics')) {
      return { page: 'Analytics' as const, nav: 'Analytics' as const }
    }
    if (pathname.startsWith('/studio/team-config')) {
      return { page: 'Teams' as const, nav: 'Team Config' as const }
    }
    if (pathname.startsWith('/studio/settings')) {
      return { page: 'Settings' as const, nav: 'Settings' as const }
    }
    if (pathname.startsWith('/studio/challenges')) {
      return { page: 'Challenges' as const, nav: 'Challenges' as const }
    }
    if (pathname.startsWith('/studio/admin')) {
      return { page: 'Admin' as const, nav: 'Admin' as const }
    }
    return { page: 'Home' as const, nav: 'Home' as const }
  }, [pathname])

  const adminSidebarLabel = useMemo(() => {
    if (!pathname || pathname === '/studio/admin') {
      return 'Dashboard'
    }
    if (pathname.startsWith('/studio/admin/system')) {
      return 'System'
    }
    if (pathname.startsWith('/studio/admin/users')) {
      return 'Users'
    }
    if (pathname.startsWith('/studio/admin/teams')) {
      return 'Teams'
    }
    if (pathname.startsWith('/studio/admin/plans')) {
      return 'Plans'
    }
    if (pathname.startsWith('/studio/admin/sessions')) {
      return 'Sessions'
    }
    return 'Dashboard'
  }, [pathname])

  const sessionFilter = searchParams.get('filter') ?? 'All'
  const analyticsTab = searchParams.get('tab') ?? 'Personal'
  const challengesPeriodRaw = searchParams.get('period')
  const challengesPeriod = challengesPeriodRaw
    ? challengesPeriodRaw.charAt(0).toUpperCase() + challengesPeriodRaw.slice(1).toLowerCase()
    : 'All'

  let selectedTab: string
  if (pageInfo.page === 'Sessions') {
    selectedTab = sessionFilter
  } else if (pageInfo.page === 'Analytics') {
    selectedTab = analyticsTab
  } else if (pageInfo.page === 'Challenges') {
    selectedTab = challengesPeriod
  } else {
    selectedTab = tabsByPage[pageInfo.page as keyof typeof tabsByPage] ?? ''
  }

  const activeTeam = useMemo(
    () => teams.find((t) => t.id === activeTeamId) ?? null,
    [teams, activeTeamId]
  )
  const teamsForSidebar = useMemo(() => {
    return teams.map((team) => {
      const membership = team.memberships?.find((member) => member.userId === user?.id)
      const canLeave = Boolean(
        membership && membership.isActive !== false && membership.role !== 'OWNER'
      )

      return {
        id: team.id,
        name: team.name,
        canLeave,
      }
    })
  }, [teams, user?.id])
  const canAccessTeamConfig = useMemo(() => {
    if (!user?.id) return false
    const membership = activeTeam?.memberships?.find((m) => m.userId === user.id)
    return membership?.role === 'OWNER' || membership?.role === 'ADMIN'
  }, [activeTeam?.memberships, user?.id])

  const handleLeaveTeam = (team: { id: string; name: string; canLeave?: boolean }) => {
    if (!user?.id) return
    modals.openConfirmModal({
      title: 'Leave team',
      centered: true,
      labels: {
        confirm: 'Leave team',
        cancel: 'Cancel',
      },
      confirmProps: { color: 'red' },
      children: `Are you sure you want to leave "${team.name}"?`,
      onConfirm: async () => {
        try {
          await leaveTeam(team.id, user.id)
          notifications.show({
            title: 'Left team',
            message: `You have left ${team.name}.`,
            color: 'teal',
          })
        } catch (error) {
          notifications.show({
            title: 'Failed to leave team',
            message: error instanceof Error ? error.message : 'Please try again.',
            color: 'red',
          })
        }
      },
    })
  }

  const handleSelectTeam = (teamId: string) => {
    if (teamId === activeTeamId) return

    setActiveTeamId(teamId)
    const nextTeam = teamsForSidebar.find((team) => team.id === teamId)
    if (!nextTeam) return

    notifications.show({
      title: 'Team switched',
      message: `Switched to ${nextTeam.name}.`,
      color: 'teal',
    })
  }

  useEffect(() => {
    fetchUserTeams()
  }, [fetchUserTeams])
  useEffect(() => {
    if (active !== pageInfo.nav) {
      setActive(pageInfo.nav)
    }
  }, [active, pageInfo.nav])

  useEffect(() => {
    if (!pathname?.startsWith('/studio/team-config')) return
    if (isCreatingTeam) return
    if (teamsLoading) return

    if (!activeTeam || !canAccessTeamConfig) {
      router.replace('/studio/home')
    }
  }, [activeTeam, canAccessTeamConfig, isCreatingTeam, pathname, router, teamsLoading])

  return (
    <>
      <AppLayout
        header={({ toggleMobileNav, mobileNavOpened }) => (
          <Suspense fallback={<Box style={{ height: '100%' }} />}>
            <AppTopBar
              currentPage={pageInfo.page}
              searchPlaceholder="Search"
              teamName={activeTeam?.name ?? 'PITCH'}
              selectedTab={selectedTab}
              onTabChange={handleTabChange(pageInfo.page)}
              onToggleMobileNav={toggleMobileNav}
              mobileNavOpened={mobileNavOpened}
            />
          </Suspense>
        )}
        navbar={({ closeMobileNav }) =>
          isAdminRoute ? (
            <AppSidebar
              active={adminSidebarLabel}
              setActive={setActive}
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
              showTeamConfig={false}
              showAdmin={false}
              showCalendar={false}
              mainLinks={ADMIN_MAIN_LINKS}
              secondaryLinks={ADMIN_SECONDARY_LINKS}
              onNavigate={closeMobileNav}
              teamId={activeTeamId}
            />
          ) : (
            <Box h="100%" style={{ display: 'flex', flexDirection: 'row' }}>
              <TeamSideBar
                teams={teamsForSidebar}
                activeTeamId={activeTeamId}
                onSelectTeam={handleSelectTeam}
                onLeaveTeam={handleLeaveTeam}
                onNavigate={closeMobileNav}
              />
              <AppSidebar
                active={active}
                setActive={setActive}
                selectedDate={selectedDate}
                setSelectedDate={setSelectedDate}
                showTeamConfig={canAccessTeamConfig}
                showAdmin={user?.isSystemAdmin === true}
                onNavigate={closeMobileNav}
              />
            </Box>
          )
        }
      >
        {children}
      </AppLayout>
      <CoachChatWidget
        context={{
          page: pathname ?? undefined,
          sessionId: pathname?.match(/^\/studio\/sessions\/([^/]+)$/)?.[1] ?? undefined,
        }}
      />
      <ProactiveCalendarNudge />
    </>
  )
}
