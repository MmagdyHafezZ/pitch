'use client'

import { ActionIcon, Box, Stack, Tooltip, Text, Menu } from '@mantine/core'
import { useRouter } from 'next/navigation'
import { useTeams } from '@/features/teams/hooks/useTeams'

export type TeamInfo = {
  id: string
  name: string
}

type TeamSideBarProps = {
  teams: TeamInfo[]
  activeTeamId: string | null
  onSelectTeam: (id: string) => void
}

function deriveInitials(name: string, max = 2): string {
  if (!name) return ''

  const cleaned = name.trim().replace(/\s+/g, ' ')
  if (!cleaned) return ''

  const parts = cleaned.split(/[\s-]+/)
  const letters = parts
    .map((word) => word[0])
    .filter(Boolean)
    .join('')
    .toUpperCase()

  return letters.slice(0, max)
}

export function TeamSideBar({ teams, activeTeamId, onSelectTeam }: TeamSideBarProps) {
  const router = useRouter()
  const { fetchTeamById, setActiveTeamId } = useTeams()

  const handleTeamClick = async (id: string) => {
    setActiveTeamId(id)
    await fetchTeamById(id)
    onSelectTeam(id)
  }

  const handleCreateTeam = () => {
    router.push('/new-team')
  }

  return (
    <Box
      style={{
        width: 60,
        height: '100%',
        background: 'var(--mantine-color-dark-9)',
        borderRadius: '16px 0 0 16px',
        borderTopLeftRadius: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '8px 4px',
      }}
    >
      <Stack
        gap={6}
        pt={11}
        style={{
          flex: 1,
          width: '100%',
          alignItems: 'center',
        }}
      >
        {teams.map((team) => {
          const isActive = team.id === activeTeamId

          return (
            <Tooltip key={team.id} label={team.name} position="right" withArrow>
              <ActionIcon
                radius="xl"
                size="lg"
                variant={isActive ? 'filled' : 'light'}
                color={isActive ? 'blue' : 'white'}
                onClick={() => handleTeamClick(team.id)}
                style={{
                  width: 36,
                  height: 36,
                  border: isActive ? '2px solid var(--mantine-color-blue-4)' : '1px solid #444',
                  background: isActive
                    ? 'var(--mantine-color-blue-6)'
                    : 'var(--mantine-color-dark-7)',
                }}
              >
                <Text fw={700} size="sm">
                  {deriveInitials(team.name)}
                </Text>
              </ActionIcon>
            </Tooltip>
          )
        })}

        <ActionIcon
          radius="xl"
          size="lg"
          variant="light"
          color="dark"
          style={{
            width: 36,
            height: 36,
            border: '1px solid #444',
            background: 'var(--mantine-color-dark-7)',
          }}
          onClick={handleCreateTeam}
        >
          <Text fw={700} size="sm" c="white">
            +
          </Text>
        </ActionIcon>
      </Stack>
    </Box>
  )
}
