'use client'
import { AppLayout } from '@/components/layout/AppLayout'
import { AppSidebar } from '@/components/ui/AppSideBar'
import { AppTopBar } from '@/components/ui/AppTopBar'
import { TeamSideBar } from '@/components/ui/TeamSideBar'
import { useAuth } from '@/features/auth'
import { useTeams } from '@/features/teams/hooks/useTeams'
import { Box } from '@mantine/core'
import { useState, useEffect, useMemo, Suspense } from 'react'
import { usePathname } from 'next/navigation'

export default function ClientLayerComponent({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState<
    'Home' | 'Sessions' | 'Teams' | 'Analytics' | 'Settings' | 'Team Config'
  >('Home')
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date())
  const { teams, activeTeamId, setActiveTeamId, fetchUserTeams } = useTeams()
  const { user } = useAuth()
  const pathname = usePathname()
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

  const activeTeam = useMemo(
    () => teams.find((t) => t.id === activeTeamId) ?? null,
    [teams, activeTeamId]
  )
  const canManageActiveTeam = useMemo(() => {
    if (!user || !activeTeam?.memberships?.length) return false

    const membership = activeTeam.memberships.find((m) => m.userId === user.id)
    return membership?.role === 'OWNER' || membership?.role === 'ADMIN'
  }, [activeTeam, user])
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
          />
        </Suspense>
      }
      navbar={
        <Box h="100%" style={{ display: 'flex', flexDirection: 'row' }}>
          <TeamSideBar
            teams={teams.map((t) => ({ id: t.id, name: t.name }))}
            activeTeamId={activeTeamId}
            onSelectTeam={setActiveTeamId}
          />
          <AppSidebar
            active={active}
            setActive={setActive}
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            showTeamConfig={canManageActiveTeam}
          />
        </Box>
      }
    >
      {children}
    </AppLayout>
  )
}
