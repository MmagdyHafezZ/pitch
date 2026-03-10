'use client'
import { ActionIcon, Box, Menu, Stack, Tooltip, Text } from '@mantine/core'
import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'

export type TeamInfo = {
  id: string
  name: string
  canLeave?: boolean
}

type TeamSideBarProps = {
  teams: TeamInfo[]
  activeTeamId: string | null
  onSelectTeam: (id: string) => void
  onLeaveTeam?: (team: TeamInfo) => void
  onNavigate?: () => void
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

export function TeamSideBar({
  teams,
  activeTeamId,
  onSelectTeam,
  onLeaveTeam,
  onNavigate,
}: TeamSideBarProps) {
  const router = useRouter()
  const [menuTeamId, setMenuTeamId] = useState<string | null>(null)
  const [hoveredTeamId, setHoveredTeamId] = useState<string | null>(null)
  const allowContextOpenRef = useRef(false)

  const handleTeamClick = (id: string) => {
    setMenuTeamId(null)
    onSelectTeam(id)
    onNavigate?.()
  }

  const handleCreateTeam = () => {
    router.push('/studio/team-config?mode=create')
    onNavigate?.()
  }

  return (
    <Box
      style={{
        width: 60,
        height: '100%',
        boxSizing: 'border-box',
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
            const showContextHint = team.canLeave && hoveredTeamId === team.id

            return (
              <Menu
                key={team.id}
                opened={menuTeamId === team.id}
                onChange={(opened) => {
                  if (!opened) {
                    setMenuTeamId(null)
                    allowContextOpenRef.current = false
                    return
                  }

                  // Prevent normal left-click on the menu target from opening the team actions menu.
                  if (!allowContextOpenRef.current) return

                  setMenuTeamId(team.id)
                  allowContextOpenRef.current = false
                }}
                position="right-start"
                withinPortal
                shadow="md"
                closeOnItemClick
              >
                <Menu.Target>
                  <span>
                    <Tooltip
                      label={team.canLeave ? `${team.name} (right-click for options)` : team.name}
                      position="right"
                      withArrow
                    >
                      <ActionIcon
                        radius="xl"
                        size="lg"
                        variant={isActive ? 'filled' : 'light'}
                        color={isActive ? 'brand' : 'white'}
                        onMouseEnter={() => setHoveredTeamId(team.id)}
                        onMouseLeave={() =>
                          setHoveredTeamId((current) => (current === team.id ? null : current))
                        }
                        onClick={() => handleTeamClick(team.id)}
                        onContextMenu={(event) => {
                          if (!team.canLeave || !onLeaveTeam) return
                          event.preventDefault()
                          allowContextOpenRef.current = true
                          setMenuTeamId(team.id)
                        }}
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
                          cursor: team.canLeave ? 'context-menu' : 'pointer',
                          boxShadow: showContextHint
                            ? '0 0 0 2px color-mix(in srgb, var(--pitch-accent-strong) 40%, transparent)'
                            : 'none',
                          transition: 'box-shadow 120ms ease',
                          position: 'relative',
                        }}
                      >
                        <Text
                          fw={700}
                          size="sm"
                          c={isActive ? 'var(--pitch-nav-text)' : 'var(--pitch-nav-text-dim)'}
                        >
                          {deriveInitials(team.name)}
                        </Text>
                        {showContextHint ? (
                          <Box
                            style={{
                              position: 'absolute',
                              right: -2,
                              bottom: -2,
                              width: 10,
                              height: 10,
                              borderRadius: '50%',
                              background: 'var(--pitch-accent-strong)',
                              border: '1px solid var(--pitch-nav-bg, var(--mantine-color-nav-9))',
                            }}
                          />
                        ) : null}
                      </ActionIcon>
                    </Tooltip>
                  </span>
                </Menu.Target>

                {team.canLeave && onLeaveTeam ? (
                  <Menu.Dropdown>
                    <Menu.Label>Team actions</Menu.Label>
                    <Menu.Item
                      color="red"
                      onClick={() => {
                        setMenuTeamId(null)
                        onLeaveTeam(team)
                      }}
                    >
                      Leave team
                    </Menu.Item>
                  </Menu.Dropdown>
                ) : null}
              </Menu>
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
