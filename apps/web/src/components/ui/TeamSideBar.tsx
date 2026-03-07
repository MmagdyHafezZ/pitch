'use client'
import { ActionIcon, Box, Menu, Stack, Tooltip, Text } from '@mantine/core'
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

export function TeamSideBar({ teams, activeTeamId, onSelectTeam, onLeaveTeam }: TeamSideBarProps) {
  const router = useRouter()
  const [menuTeamId, setMenuTeamId] = useState<string | null>(null)
  const allowContextOpenRef = useRef(false)

  const handleTeamClick = (id: string) => {
    setMenuTeamId(null)
    onSelectTeam(id)
  }

  const handleCreateTeam = () => {
    router.push('/studio/team-config?mode=create')
  }

  return (
    <Box className={classes.shell}>
      {/* Scrollable content area (teams + plus) */}
      <Box className={classes.scrollArea}>
        <Stack gap={6} className={classes.stack}>
          {teams.map((team) => {
            const isActive = team.id === activeTeamId

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
                        }}
                      >
                        <Text
                          fw={700}
                          size="sm"
                          className={`${classes.teamLabel} ${isActive ? classes.teamLabelActive : ''}`}
                        >
                          {deriveInitials(team.name)}
                        </Text>
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
              width: 36,
              height: 36,
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
