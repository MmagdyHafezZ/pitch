'use client'
import { AppLayout } from '@/components/layout/AppLayout'
import { AppSidebar } from '@/components/ui/AppSideBar'
import { AppTopBar } from '@/components/ui/AppTopBar'
import { TeamSideBar } from '@/components/ui/TeamSideBar'
import { useTeams } from '@/features/teams/hooks/useTeams'
import { Box } from '@mantine/core'
import { useState, useEffect, useMemo, Suspense } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useMediaQuery } from '@mantine/hooks'

export default function ClientLayerComponent({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState<
    'Home' | 'Sessions' | 'Teams' | 'Analytics' | 'Settings' | 'Team Config'
  >('Home')
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date())
  const { teams, activeTeamId, setActiveTeamId, fetchUserTeams } = useTeams()
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const isMobile = useMediaQuery('(max-width: 768px)')
  const [navbarOpened, setNavbarOpened] = useState(false)

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
      if (page === 'Teams') {
        const params = new URLSearchParams(searchParams.toString())
        params.set('teamView', tab)
        router.push(`${pathname}?${params.toString()}`)
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
  const teamView = searchParams.get('teamView') ?? 'All'
  const selectedTab =
    pageInfo.page === 'Sessions'
      ? sessionFilter
      : pageInfo.page === 'Analytics'
        ? analyticsTab
        : pageInfo.page === 'Teams'
          ? teamView
          : tabsByPage[pageInfo.page]

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
  useEffect(() => {
    if (!isMobile) {
      setNavbarOpened(false)
    }
  }, [isMobile])
  return (
    <AppLayout
      navbarOpened={navbarOpened}
      header={
        <Suspense fallback={<Box style={{ height: '100%' }} />}>
          <AppTopBar
            currentPage={pageInfo.page}
            searchPlaceholder="Search"
            teamName={activeTeam?.name ?? 'PITCH'}
            selectedTab={selectedTab}
            onTabChange={handleTabChange(pageInfo.page)}
            mobileNavOpened={navbarOpened}
            onMobileNavToggle={() => setNavbarOpened((opened) => !opened)}
          />
        </Suspense>
      }
      navbar={
        <Box h="100%" style={{ display: 'flex', flexDirection: 'row' }}>
          <TeamSideBar
            teams={teams.map((t) => ({ id: t.id, name: t.name }))}
            activeTeamId={activeTeamId}
            onSelectTeam={(teamId) => {
              setActiveTeamId(teamId)
              if (isMobile) setNavbarOpened(false)
            }}
          />
          <AppSidebar
            active={active}
            setActive={(value) => {
              setActive(value)
              if (isMobile) setNavbarOpened(false)
            }}
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
          />
        </Box>
      }
    >
      {children}
    </AppLayout>
  )
}
