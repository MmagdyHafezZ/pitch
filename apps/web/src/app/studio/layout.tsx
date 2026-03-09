'use client'
import { AppLayout } from '@/components/layout/AppLayout'
import { AppSidebar } from '@/components/ui/AppSideBar'
import { AppTopBar } from '@/components/ui/AppTopBar'
import { TeamSideBar } from '@/components/ui/TeamSideBar'
import { CoachChatWidget } from '@/components/ui/CoachChatWidget'
import { useTeams } from '@/features/teams/hooks/useTeams'
import { useAuthStore } from '@/features/auth/stores/auth.store'
import { Box } from '@mantine/core'
import { useState, useEffect, useMemo, Suspense } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

export default function ClientLayerComponent({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState<
    'Home' | 'Sessions' | 'Teams' | 'Analytics' | 'Settings' | 'Team Config' | 'Challenges'
  >('Home')
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date())
  const { teams, activeTeamId, setActiveTeamId, fetchUserTeams } = useTeams()
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
    Record<'Home' | 'Sessions' | 'Teams' | 'Analytics' | 'Challenges' | 'Settings', string>
  >({
    Home: 'All',
    Sessions: 'All',
    Teams: 'All',
    Analytics: 'Overview',
    Challenges: '',
    Settings: '',
  })

  const handleTabChange = (
    page: 'Home' | 'Sessions' | 'Teams' | 'Analytics' | 'Challenges' | 'Settings'
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
    return { page: 'Home' as const, nav: 'Home' as const }
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
    selectedTab = tabsByPage[pageInfo.page]
  }

  const activeTeam = useMemo(
    () => teams.find((t) => t.id === activeTeamId) ?? null,
    [teams, activeTeamId]
  )
  useEffect(() => {
    fetchUserTeams()
  }, [fetchUserTeams])
  useEffect(() => {
    if (active !== pageInfo.nav) {
      setActive(pageInfo.nav)
    }
  }, [active, pageInfo.nav])
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
        navbar={({ closeMobileNav }) => (
          <Box h="100%" style={{ display: 'flex', flexDirection: 'row' }}>
            <TeamSideBar
              teams={teams.map((t) => ({ id: t.id, name: t.name }))}
              activeTeamId={activeTeamId}
              onSelectTeam={setActiveTeamId}
              onNavigate={closeMobileNav}
            />
            <AppSidebar
              active={active}
              setActive={setActive}
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
              onNavigate={closeMobileNav}
            />
          </Box>
        )}
      >
        {children}
      </AppLayout>
      <CoachChatWidget context={{ page: pathname ?? undefined }} />
    </>
  )
}
