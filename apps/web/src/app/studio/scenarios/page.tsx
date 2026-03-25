'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Container,
  Grid,
  Group,
  Loader,
  Paper,
  Select,
  Stack,
  Tabs,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import {
  IconAlertCircle,
  IconArrowLeft,
  IconCopy,
  IconDeviceFloppy,
  IconPlayerPlay,
  IconSearch,
  IconTrash,
} from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/client'
import { useAuth } from '@/features/auth'
import { useTeams } from '@/features/teams'
import { ScenarioEditorFields } from '@/features/scenarios/components/ScenarioEditorFields'
import type {
  EditableScenarioDraft,
  Scenario,
  ScenarioListScope,
  ScenarioVisibility,
} from '@/features/scenarios/types/scenario.types'
import { draftFromScenario, getScenarioSummary } from '@/features/scenarios/utils/scenario-editor'

const normalizeVisibilityForWorkspace = (
  visibility: ScenarioVisibility,
  hasTeamWorkspace: boolean
): ScenarioVisibility => {
  if (visibility === 'TEAM' && !hasTeamWorkspace) {
    return 'PRIVATE'
  }

  return visibility
}

export default function ScenarioLibraryPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { teams, activeTeamId, fetchUserTeams } = useTeams()

  const [scope, setScope] = useState<ScenarioListScope>('mine')
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null)
  const [activeDraft, setActiveDraft] = useState<EditableScenarioDraft | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (user?.id) {
      fetchUserTeams()
    }
  }, [fetchUserTeams, user?.id])

  useEffect(() => {
    if (selectedWorkspaceId === null && activeTeamId) {
      setSelectedWorkspaceId(activeTeamId)
    }
  }, [activeTeamId, selectedWorkspaceId])

  const selectedScenario = scenarios.find((scenario) => scenario.id === selectedScenarioId) ?? null
  const summary = getScenarioSummary(selectedScenario)
  const canEdit = Boolean(
    selectedScenario?.permissions.canEdit && !selectedScenario.isReadonlyLegacy
  )
  const canDelete = Boolean(
    selectedScenario?.permissions.canDelete && !selectedScenario.isReadonlyLegacy
  )
  const canDuplicate = Boolean(selectedScenario?.permissions.canDuplicate)
  const workspaceOrgId = selectedWorkspaceId || user?.id || ''
  const allowTeamVisibility = Boolean(selectedWorkspaceId)

  const workspaceOptions = useMemo(
    () => [
      { value: '', label: 'Personal library' },
      ...teams.map((team) => ({ value: team.id, label: team.name })),
    ],
    [teams]
  )

  useEffect(() => {
    if (!user?.id) return

    if (scope === 'team' && !selectedWorkspaceId) {
      setScenarios([])
      setSelectedScenarioId(null)
      return
    }

    let cancelled = false
    const loadScenarios = async () => {
      setLoading(true)
      try {
        const response = await api.scenarios.list({
          scope,
          orgId: scope === 'public' ? undefined : selectedWorkspaceId || user.id,
          query: query.trim() || undefined,
        })

        if (!cancelled) {
          setScenarios(response.scenarios ?? [])
          setSelectedScenarioId((current) => {
            if (current && response.scenarios.some((scenario) => scenario.id === current)) {
              return current
            }
            return response.scenarios[0]?.id ?? null
          })
        }
      } catch (err) {
        if (!cancelled) {
          notifications.show({
            title: 'Load failed',
            message: err instanceof Error ? err.message : 'Unable to load the scenario library.',
            color: 'red',
          })
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadScenarios()
    return () => {
      cancelled = true
    }
  }, [query, scope, selectedWorkspaceId, user?.id])

  useEffect(() => {
    if (!selectedScenario) {
      setActiveDraft(null)
      return
    }

    setActiveDraft(draftFromScenario(selectedScenario, 'library'))
  }, [selectedScenario])

  const handleSaveChanges = async () => {
    if (!selectedScenario || !activeDraft) {
      return
    }

    if (!canEdit) {
      await handleSaveAsNew()
      return
    }

    setSaving(true)
    try {
      const updated = await api.scenarios.update(selectedScenario.id, {
        name: activeDraft.name,
        description: activeDraft.description ?? '',
        visibility: activeDraft.visibility,
        config: activeDraft.config ?? {},
      })

      setScenarios((current) =>
        current.map((scenario) => (scenario.id === updated.id ? updated : scenario))
      )
      setSelectedScenarioId(updated.id)
      setActiveDraft(draftFromScenario(updated, 'library'))

      notifications.show({
        title: 'Scenario updated',
        message: `${updated.name} has been saved.`,
        color: 'green',
      })
    } catch (err) {
      notifications.show({
        title: 'Save failed',
        message: err instanceof Error ? err.message : 'Unable to update this scenario.',
        color: 'red',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleSaveAsNew = async () => {
    if (!activeDraft || !workspaceOrgId) {
      return
    }

    setSaving(true)
    try {
      const created = await api.scenarios.create({
        orgId: workspaceOrgId,
        name: activeDraft.name,
        description: activeDraft.description ?? '',
        visibility: normalizeVisibilityForWorkspace(activeDraft.visibility, allowTeamVisibility),
        config: activeDraft.config ?? {},
      })

      setScope('mine')
      setScenarios((current) => [
        created,
        ...current.filter((scenario) => scenario.id !== created.id),
      ])
      setSelectedScenarioId(created.id)
      setActiveDraft(draftFromScenario(created, 'library'))

      notifications.show({
        title: 'Scenario saved',
        message: `${created.name} was added to your library.`,
        color: 'green',
      })
    } catch (err) {
      notifications.show({
        title: 'Save failed',
        message: err instanceof Error ? err.message : 'Unable to create an editable copy.',
        color: 'red',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedScenario || !canDelete) {
      return
    }

    setDeleting(true)
    try {
      await api.scenarios.delete(selectedScenario.id)
      setScenarios((current) => current.filter((scenario) => scenario.id !== selectedScenario.id))
      setSelectedScenarioId(null)
      setActiveDraft(null)

      notifications.show({
        title: 'Scenario deleted',
        message: `${selectedScenario.name} was removed from the library.`,
        color: 'green',
      })
    } catch (err) {
      notifications.show({
        title: 'Delete failed',
        message: err instanceof Error ? err.message : 'Unable to delete this scenario.',
        color: 'red',
      })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Box>
      <Container size="xl" py="xl">
        <Stack gap="lg">
          <Group align="flex-start" justify="space-between">
            <Group align="flex-start">
              <ActionIcon
                variant="subtle"
                size="lg"
                onClick={() => router.push('/studio/sessions')}
              >
                <IconArrowLeft size={20} />
              </ActionIcon>
              <Paper withBorder radius="xl" p="lg">
                <Stack gap={6}>
                  <Badge variant="light" color="blue">
                    Scenario Library
                  </Badge>
                  <Title order={1}>Manage reusable scenarios</Title>
                  <Text size="sm" c="dimmed">
                    Review saved scenarios, edit the ones you own, or create an editable copy when a
                    scenario is view-only.
                  </Text>
                </Stack>
              </Paper>
            </Group>
            <Button
              variant="light"
              leftSection={<IconPlayerPlay size={16} />}
              disabled={!selectedScenario}
              onClick={() => {
                if (selectedScenario) {
                  router.push(`/studio/sessions/create?scenarioId=${selectedScenario.id}`)
                }
              }}
            >
              Start session with this
            </Button>
          </Group>

          <Paper withBorder radius="xl" p="lg">
            <Stack gap="md">
              <Tabs
                value={scope}
                onChange={(value) => setScope((value as ScenarioListScope) ?? 'mine')}
              >
                <Tabs.List>
                  <Tabs.Tab value="mine">Mine</Tabs.Tab>
                  <Tabs.Tab value="team">Team</Tabs.Tab>
                  <Tabs.Tab value="public">Public</Tabs.Tab>
                </Tabs.List>
              </Tabs>

              <Group align="flex-end" grow>
                <Select
                  label="Workspace"
                  data={workspaceOptions}
                  value={selectedWorkspaceId ?? ''}
                  onChange={(value) => setSelectedWorkspaceId(value || null)}
                  disabled={scope === 'public'}
                />
                <TextInput
                  label="Search"
                  placeholder="Search name, description, or tags"
                  leftSection={<IconSearch size={16} />}
                  value={query}
                  onChange={(event) => setQuery(event.currentTarget.value)}
                />
              </Group>

              {scope === 'team' && !selectedWorkspaceId ? (
                <Alert color="yellow" variant="light">
                  Select a team workspace to browse team-shared scenarios.
                </Alert>
              ) : (
                <Grid gutter="md">
                  <Grid.Col span={{ base: 12, lg: 4 }}>
                    <Paper withBorder radius="lg" p="md" mih={560}>
                      <Stack gap="sm">
                        {loading ? (
                          <Group gap="sm">
                            <Loader size="sm" />
                            <Text size="sm" c="dimmed">
                              Loading scenarios...
                            </Text>
                          </Group>
                        ) : scenarios.length === 0 ? (
                          <Text size="sm" c="dimmed">
                            No scenarios matched this view.
                          </Text>
                        ) : (
                          scenarios.map((scenario) => {
                            const itemSummary = getScenarioSummary(scenario)
                            const isSelected = scenario.id === selectedScenarioId

                            return (
                              <Paper
                                key={scenario.id}
                                withBorder
                                radius="md"
                                p="md"
                                style={{
                                  cursor: 'pointer',
                                  borderColor: isSelected
                                    ? 'var(--mantine-color-blue-6)'
                                    : undefined,
                                }}
                                onClick={() => setSelectedScenarioId(scenario.id)}
                              >
                                <Stack gap="xs">
                                  <Group justify="space-between" align="flex-start">
                                    <Stack gap={2}>
                                      <Text fw={600}>{scenario.name}</Text>
                                      <Text size="sm" c="dimmed">
                                        {scenario.description ||
                                          itemSummary?.objective ||
                                          'Scenario'}
                                      </Text>
                                    </Stack>
                                    <Badge variant="outline" color="gray">
                                      {scenario.visibility.toLowerCase()}
                                    </Badge>
                                  </Group>
                                  {scenario.isReadonlyLegacy && (
                                    <Badge variant="light" color="yellow" w="fit-content">
                                      Older scenario: view only
                                    </Badge>
                                  )}
                                  {itemSummary?.background && (
                                    <Text size="xs" c="dimmed" lineClamp={2}>
                                      {itemSummary.background}
                                    </Text>
                                  )}
                                </Stack>
                              </Paper>
                            )
                          })
                        )}
                      </Stack>
                    </Paper>
                  </Grid.Col>

                  <Grid.Col span={{ base: 12, lg: 8 }}>
                    <Paper withBorder radius="lg" p="lg" mih={560}>
                      {!selectedScenario || !activeDraft ? (
                        <Stack justify="center" align="center" h="100%">
                          <Text c="dimmed">Select a scenario to inspect or edit it.</Text>
                        </Stack>
                      ) : (
                        <Stack gap="md">
                          <Group justify="space-between" align="flex-start">
                            <Stack gap={4}>
                              <Title order={3}>{selectedScenario.name}</Title>
                              <Group gap="xs">
                                <Badge variant="light" color="blue">
                                  {selectedScenario.visibility.toLowerCase()}
                                </Badge>
                                {selectedScenario.isReadonlyLegacy && (
                                  <Badge variant="light" color="yellow">
                                    Older scenario: view only
                                  </Badge>
                                )}
                                {!canEdit && (
                                  <Badge variant="outline" color="gray">
                                    Create a copy to edit
                                  </Badge>
                                )}
                              </Group>
                            </Stack>
                            <Group gap="sm">
                              {canDuplicate && (
                                <Button
                                  variant="default"
                                  leftSection={<IconCopy size={16} />}
                                  onClick={() => void handleSaveAsNew()}
                                  loading={saving}
                                >
                                  Create editable copy
                                </Button>
                              )}
                              {canDelete && (
                                <Button
                                  color="red"
                                  variant="light"
                                  leftSection={<IconTrash size={16} />}
                                  onClick={() => void handleDelete()}
                                  loading={deleting}
                                >
                                  Delete
                                </Button>
                              )}
                              <Button
                                leftSection={<IconDeviceFloppy size={16} />}
                                onClick={() => void handleSaveChanges()}
                                loading={saving}
                              >
                                {canEdit ? 'Save changes' : 'Create editable copy'}
                              </Button>
                            </Group>
                          </Group>

                          {!canEdit && (
                            <Alert
                              color="blue"
                              variant="light"
                              icon={<IconAlertCircle size={16} />}
                            >
                              You cannot edit this original scenario here. Creating an editable copy
                              saves a version you can change.
                            </Alert>
                          )}

                          {summary && (
                            <Group gap="xs">
                              <Badge variant="outline" color="gray">
                                {summary.durationMinutes} min
                              </Badge>
                              <Badge variant="outline" color="gray">
                                {summary.difficulty}
                              </Badge>
                              <Badge variant="outline" color="gray">
                                {summary.language}
                              </Badge>
                            </Group>
                          )}

                          <ScenarioEditorFields
                            value={activeDraft}
                            onChange={setActiveDraft}
                            readOnly={!canEdit}
                            allowTeamVisibility={allowTeamVisibility}
                          />
                        </Stack>
                      )}
                    </Paper>
                  </Grid.Col>
                </Grid>
              )}
            </Stack>
          </Paper>
        </Stack>
      </Container>
    </Box>
  )
}
