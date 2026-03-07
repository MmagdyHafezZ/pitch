'use client'
import { AppLayout } from '@/components/layout/AppLayout'
import { AppSidebar } from '@/components/ui/AppSideBar'
import { AppTopBar } from '@/components/ui/AppTopBar'
import { TeamSideBar } from '@/components/ui/TeamSideBar'
import { useTeams } from '@/features/teams/hooks/useTeams'
import { useAuthStore } from '@/features/auth/stores/auth.store'
import { Box } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { modals } from '@mantine/modals'
import { useState, useEffect, useMemo, Suspense } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

export default function ClientLayerComponent({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState<
    'Home' | 'Sessions' | 'Teams' | 'Analytics' | 'Settings' | 'Team Config'
  >('Home')
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date())
  const { teams, activeTeamId, setActiveTeamId, fetchUserTeams, leaveTeam } = useTeams()
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const user = useAuthStore((state) => state.user)

  // Guard: redirect to onboarding if user is loaded but hasn't completed it
  useEffect(() => {
    if (user && !user.settings?.onboarding?.completed) {
      router.replace('/onboarding')
    }
  }, [user, router])

  const [tabsByPage, setTabsByPage] = useState<
    Record<'Home' | 'Sessions' | 'Teams' | 'Analytics' | 'Settings', string>
  >({
    Home: 'All',
    Sessions: 'All',
    Teams: 'All',
    Analytics: 'Overview',
    Settings: '',
  })

  const handleTabChange = (page: 'Home' | 'Sessions' | 'Teams' | 'Analytics' | 'Settings') => {
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
    }
  }

  const pageInfo = useMemo(() => {
    if (!pathname) {
      return { page: 'Home' as const, nav: 'Home' as const }
    }
    if (pathname.startsWith('/studio/sessions')) {
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
    return { page: 'Home' as const, nav: 'Home' as const }
  }, [pathname])

  const sessionFilter = searchParams.get('filter') ?? 'All'
  const analyticsTab = searchParams.get('tab') ?? 'Personal'
  const selectedTab =
    pageInfo.page === 'Sessions'
      ? sessionFilter
      : pageInfo.page === 'Analytics'
        ? analyticsTab
        : tabsByPage[pageInfo.page]

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
  return (
    <AppLayout
      header={
        <Suspense fallback={<Box style={{ height: '100%' }} />}>
          <AppTopBar
            currentPage={pageInfo.page}
            searchPlaceholder="Search"
            teamName={activeTeam?.name ?? 'PITCH'}
            selectedTab={selectedTab}
            onTabChange={handleTabChange(pageInfo.page)}
          />
        </Suspense>
      }
      navbar={
        <Box h="100%" style={{ display: 'flex', flexDirection: 'row' }}>
          <TeamSideBar
            teams={teamsForSidebar}
            activeTeamId={activeTeamId}
            onSelectTeam={handleSelectTeam}
            onLeaveTeam={handleLeaveTeam}
          />
          <AppSidebar
            active={active}
            setActive={setActive}
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            showTeamConfig={canAccessTeamConfig}
          />
        </Box>
      }
    >
      {children}
    </AppLayout>
  )
}
