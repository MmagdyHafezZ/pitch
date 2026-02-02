'use client'
import { ActionIcon, Box, Stack, Tooltip, Text } from '@mantine/core'
import { useRouter } from 'next/navigation'

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

  const handleTeamClick = (id: string) => {
    onSelectTeam(id)
  }

  const handleCreateTeam = () => {
    router.push('/studio/team-config?mode=create')
  }

  return (
    <Box
      style={{
        width: 60,
        height: '100%',
        background: 'var(--pitch-nav-bg, var(--mantine-color-nav-9))',
        borderTopRightRadius: 24,
        borderBottomRightRadius: 24,
        border: '1px solid var(--pitch-nav-text-dim)',
        display: 'flex',
        flexDirection: 'column',
        padding: '8px 4px',
      }}
    >
      {/* Scrollable content area (teams + plus) */}
      <Box
        style={{
          flex: 1,
          width: '100%',
          overflowY: 'auto',
          overflowX: 'hidden',
          paddingTop: 11,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <Stack
          gap={6}
          style={{
            width: '100%',
            alignItems: 'center',
            justifyContent: 'flex-start',
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
                  color={isActive ? 'brand' : 'white'}
                  onClick={() => handleTeamClick(team.id)}
                  style={{
                    width: 36,
                    height: 36,
                    border: isActive
                      ? '2px solid var(--pitch-accent-strong)'
                      : '1px solid var(--pitch-nav-text-dim)',
                    background: isActive
                      ? 'var(--pitch-accent-strong)'
                      : 'var(--pitch-nav-accent-soft)',
                    color: isActive ? 'var(--pitch-nav-text)' : 'var(--pitch-nav-text-dim)',
                  }}
                >
                  <Text
                    fw={700}
                    size="sm"
                    c={isActive ? 'var(--pitch-nav-text)' : 'var(--pitch-nav-text-dim)'}
                  >
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
              border: '1px solid var(--pitch-nav-text-dim)',
              background: 'var(--pitch-nav-accent-soft)',
              marginTop: 8,
            }}
            onClick={handleCreateTeam}
          >
            <Text fw={700} size="sm" c="var(--pitch-nav-text)">
              +
            </Text>
          </ActionIcon>
        </Stack>
      </Box>
    </Box>
  )
}
