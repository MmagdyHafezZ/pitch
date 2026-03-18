'use client'
import { ActionIcon, Box, Menu, Stack, Tooltip, Text } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import classes from './TeamSideBar.module.css'

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
  const isMobile = useMediaQuery('(max-width: 48em)')
  const [menuTeamId, setMenuTeamId] = useState<string | null>(null)
  const [hoveredTeamId, setHoveredTeamId] = useState<string | null>(null)
  const allowContextOpenRef = useRef(false)
  const teamButtonSize = isMobile ? 32 : 36

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
    <Box className={classes.shell}>
      {/* Scrollable content area (teams + plus) */}
      <Box className={classes.scrollArea}>
        <Stack gap={isMobile ? 4 : 6} className={classes.stack}>
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
                        variant="subtle"
                        className={`${classes.teamButton} ${isActive ? classes.teamButtonActive : ''}`}
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
                          width: teamButtonSize,
                          height: teamButtonSize,
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
                          className={`${classes.teamLabel} ${isActive ? classes.teamLabelActive : ''}`}
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
            variant="subtle"
            className={`${classes.teamButton} ${classes.createButton}`}
            style={{
              width: teamButtonSize,
              height: teamButtonSize,
            }}
            onClick={handleCreateTeam}
          >
            <Text fw={700} size="sm" className={classes.createLabel}>
              +
            </Text>
          </ActionIcon>
        </Stack>
      </Box>
    </Box>
  )
}
