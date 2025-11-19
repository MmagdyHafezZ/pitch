'use client'

import { Group, Button, Title, Paper, Text, Stack, Anchor, Divider, Box } from '@mantine/core'
import { useState } from 'react'

import { AppLayout } from '@/components/layout/AppLayout'
import { AppSidebar } from '@/components/ui/AppSideBar'
import { AppTopBar } from '@/components/ui/AppTopBar'
import { TeamSideBar, TeamInfo } from '@/components/ui/TeamSideBar'
import { useTeams } from '@/features/teams/hooks/useTeams'

export default function TeamsPage() {
  const [active, setActive] = useState('Teams')
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date())

  const { teams, activeTeamId, setActiveTeamId } = useTeams()

  return (
    <AppLayout
      header={<AppTopBar showSearch searchPlaceholder="Search" />}
      navbar={
        <Box h="100%" style={{ display: 'flex', flexDirection: 'row' }}>
          {teams.length > 1 && (
            <TeamSideBar teams={teams} activeTeamId={activeTeamId} onSelectTeam={setActiveTeamId} />
          )}
          <AppSidebar
            active={active}
            setActive={setActive}
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
          />
        </Box>
      }
    >
      {/* page padding */}
      <Box px="xl" py="lg">
        {/* main white card */}
        <Paper p="xl" radius="md" shadow="xs" withBorder>
          {/* header: title / description / link + button */}
          <Group justify="space-between" align="flex-start">
            <Stack gap={4}>
              <Title order={2}>Teams</Title>
              <Text size="sm" c="dimmed">
                Join a team to start your learning journey.
              </Text>
              <Anchor size="sm" fw={500}>
                Your Teams
              </Anchor>
            </Stack>

            <Button size="sm" radius="xl">
              Create a team
            </Button>
          </Group>

          <Divider my="md" />
        </Paper>
      </Box>
    </AppLayout>
  )
}
