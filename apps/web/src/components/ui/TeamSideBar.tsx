'use client'
import { ActionIcon, Box, Menu, Stack, Tooltip, Text } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { useRouter } from 'next/navigation'
import { DragEvent, useRef, useState } from 'react'
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
  onReorderTeams?: (teamIds: string[]) => void
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
  onReorderTeams,
  onLeaveTeam,
  onNavigate,
}: TeamSideBarProps) {
  const router = useRouter()
  const isMobile = useMediaQuery('(max-width: 48em)')
  const [menuTeamId, setMenuTeamId] = useState<string | null>(null)
  const [hoveredTeamId, setHoveredTeamId] = useState<string | null>(null)
  const [draggedTeamId, setDraggedTeamId] = useState<string | null>(null)
  const [dragTargetTeamId, setDragTargetTeamId] = useState<string | null>(null)
  const allowContextOpenRef = useRef(false)
  const lastDragEndedAtRef = useRef(0)
  const teamButtonSize = isMobile ? 32 : 36
  const canReorderTeams = teams.length > 1 && typeof onReorderTeams === 'function'

  const resetDragState = () => {
    setDraggedTeamId(null)
    setDragTargetTeamId(null)
    lastDragEndedAtRef.current = Date.now()
  }

  const handleReorder = (sourceTeamId: string, targetTeamId: string) => {
    if (!onReorderTeams || sourceTeamId === targetTeamId) return

    const sourceIndex = teams.findIndex((team) => team.id === sourceTeamId)
    const targetIndex = teams.findIndex((team) => team.id === targetTeamId)
    if (sourceIndex < 0 || targetIndex < 0) return

    const nextTeams = [...teams]
    const [movedTeam] = nextTeams.splice(sourceIndex, 1)
    nextTeams.splice(targetIndex, 0, movedTeam)
    onReorderTeams(nextTeams.map((team) => team.id))
  }

  const handleTeamClick = (id: string) => {
    if (Date.now() - lastDragEndedAtRef.current < 250) return

    setMenuTeamId(null)
    onSelectTeam(id)
    onNavigate?.()
  }

  const handleTeamDragStart = (event: DragEvent<HTMLButtonElement>, teamId: string) => {
    if (!canReorderTeams) return

    setMenuTeamId(null)
    setDraggedTeamId(teamId)
    setDragTargetTeamId(teamId)
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move'
      event.dataTransfer.setData('text/plain', teamId)
    }
  }

  const handleTeamDragOver = (event: DragEvent<HTMLButtonElement>, teamId: string) => {
    if (!canReorderTeams || !draggedTeamId || draggedTeamId === teamId) return

    event.preventDefault()
    if (dragTargetTeamId !== teamId) {
      setDragTargetTeamId(teamId)
    }
  }

  const handleTeamDrop = (event: DragEvent<HTMLButtonElement>, teamId: string) => {
    if (!canReorderTeams) return

    event.preventDefault()
    const sourceTeamId = draggedTeamId || event.dataTransfer?.getData('text/plain')
    if (sourceTeamId && sourceTeamId !== teamId) {
      handleReorder(sourceTeamId, teamId)
    }

    resetDragState()
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
            const isDragging = draggedTeamId === team.id
            const isDragTarget = dragTargetTeamId === team.id && draggedTeamId !== team.id
            const tooltipLabel = team.canLeave
              ? canReorderTeams
                ? `${team.name} (drag to reorder, right-click for options)`
                : `${team.name} (right-click for options)`
              : canReorderTeams
                ? `${team.name} (drag to reorder)`
                : team.name

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
                    <Tooltip label={tooltipLabel} position="right" withArrow>
                      <ActionIcon
                        aria-label={`Select team ${team.name}`}
                        radius="xl"
                        size="lg"
                        variant="subtle"
                        className={`${classes.teamButton} ${
                          isActive ? classes.teamButtonActive : ''
                        } ${isDragging ? classes.teamButtonDragging : ''} ${
                          isDragTarget ? classes.teamButtonDropTarget : ''
                        }`}
                        draggable={canReorderTeams}
                        aria-grabbed={isDragging}
                        onMouseEnter={() => setHoveredTeamId(team.id)}
                        onMouseLeave={() =>
                          setHoveredTeamId((current) => (current === team.id ? null : current))
                        }
                        onClick={() => handleTeamClick(team.id)}
                        onDragStart={(event) => handleTeamDragStart(event, team.id)}
                        onDragOver={(event) => handleTeamDragOver(event, team.id)}
                        onDragLeave={() => {
                          setDragTargetTeamId((current) => (current === team.id ? null : current))
                        }}
                        onDrop={(event) => handleTeamDrop(event, team.id)}
                        onDragEnd={resetDragState}
                        onContextMenu={(event) => {
                          if (!team.canLeave || !onLeaveTeam) return
                          event.preventDefault()
                          allowContextOpenRef.current = true
                          setMenuTeamId(team.id)
                        }}
                        style={{
                          width: teamButtonSize,
                          height: teamButtonSize,
                          cursor: canReorderTeams
                            ? isDragging
                              ? 'grabbing'
                              : 'grab'
                            : team.canLeave
                              ? 'context-menu'
                              : 'pointer',
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
