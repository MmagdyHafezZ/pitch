'use client'
import { AppLayout } from '@/components/layout/AppLayout'
import { AppSidebar } from '@/components/ui/AppSideBar'
import { AppTopBar } from '@/components/ui/AppTopBar'
import { TeamSideBar } from '@/components/ui/TeamSideBar'
import { useAuth } from '@/features/auth'
import { useTeams } from '@/features/teams/hooks/useTeams'
import { Box } from '@mantine/core'
import { useRouter } from 'next/router'
import { useState, useEffect, useMemo } from 'react'

export default function ClientLayerComponent({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState('Home')
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date())

  const { teams, activeTeamId, setActiveTeamId, fetchUserTeams } = useTeams()

  const activeTeam = useMemo(
    () => teams.find((t) => t.id === activeTeamId) ?? null,
    [teams, activeTeamId]
  )
  useEffect(() => {
    fetchUserTeams()
  }, [fetchUserTeams])
  return (
    <AppLayout
      header={
        <AppTopBar showSearch searchPlaceholder="Search" teamName={activeTeam?.name ?? 'PITCH'} />
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
          />
        </Box>
      }
    >
      {children}
    </AppLayout>
  )
}
