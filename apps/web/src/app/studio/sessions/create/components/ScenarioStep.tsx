'use client'

import { useEffect, useState, type KeyboardEvent } from 'react'
import {
  Alert,
  Badge,
  Button,
  Divider,
  Grid,
  Group,
  Loader,
  NumberInput,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  TextInput,
  Textarea,
  ThemeIcon,
  Title,
} from '@mantine/core'
import {
  IconArrowRight,
  IconCheck,
  IconCircleCheck,
  IconDeviceFloppy,
  IconFileText,
  IconPencil,
  IconPlus,
  IconSearch,
  IconSparkles,
} from '@tabler/icons-react'
import { ScenarioEditorFields } from '@/features/scenarios/components/ScenarioEditorFields'
import type {
  EditableScenarioDraft,
  Scenario,
  ScenarioListScope,
} from '@/features/scenarios/types/scenario.types'
import { getScenarioSummary } from '@/features/scenarios/utils/scenario-editor'
import classes from '../create-session.module.css'

interface ScenarioStepProps {
  teams: Array<{ id: string; name: string }>
  savedScenariosLoading: boolean
  savedScenarios: Scenario[]
  scenarioScope: ScenarioListScope
  onScenarioScopeChange: (scope: ScenarioListScope) => void
  scenarioSearchQuery: string
  onScenarioSearchQueryChange: (value: string) => void
  scenarioWorkspaceId: string | null
  onScenarioWorkspaceChange: (value: string | null) => void
  selectedScenarioId: string | null
  onSelectSavedScenario: (id: string | null) => void
  onOpenGenerator: () => void
  drafts: EditableScenarioDraft[]
  activeDraftId: string | null
  selectedDraftId: string | null
  onSelectDraft: (draftId: string) => void
  onChangeActiveDraft: (value: EditableScenarioDraft) => void
  onUseActiveDraft: () => void
  onSaveActiveDraft: () => void
  onCreateDraft: () => void
  isSavingDraft: boolean
  scenarioTopic: string
  setScenarioTopic: (value: string) => void
  scenarioObjective: string
  setScenarioObjective: (value: string) => void
  scenarioContext: string
  setScenarioContext: (value: string) => void
  aiRole: string
  setAiRole: (value: string) => void
  userRole: string
  setUserRole: (value: string) => void
  durationMinutes: number
  setDurationMinutes: (value: number) => void
  scenarioCount: number
  setScenarioCount: (value: number) => void
  onGenerate: () => void
  isGenerating: boolean
  allowTeamVisibility: boolean
  errors: Record<string, string>
}

export function ScenarioStep({
  teams,
  savedScenariosLoading,
  savedScenarios,
  scenarioScope,
  onScenarioScopeChange,
  scenarioSearchQuery,
  onScenarioSearchQueryChange,
  scenarioWorkspaceId,
  onScenarioWorkspaceChange,
  selectedScenarioId,
  onSelectSavedScenario,
  onOpenGenerator,
  drafts,
  activeDraftId,
  selectedDraftId,
  onSelectDraft,
  onChangeActiveDraft,
  onUseActiveDraft,
  onSaveActiveDraft,
  onCreateDraft,
  isSavingDraft,
  scenarioTopic,
  setScenarioTopic,
  scenarioObjective,
  setScenarioObjective,
  scenarioContext,
  setScenarioContext,
  aiRole,
  setAiRole,
  userRole,
  setUserRole,
  durationMinutes,
  setDurationMinutes,
  scenarioCount,
  setScenarioCount,
  onGenerate,
  isGenerating,
  allowTeamVisibility,
  errors,
}: ScenarioStepProps) {
  const [showGenerator, setShowGenerator] = useState(
    !selectedScenarioId && !selectedDraftId && !activeDraftId
  )

  const activeDraft = drafts.find((d) => d.draftId === activeDraftId) ?? null
  const selectedSavedScenario = savedScenarios.find((s) => s.id === selectedScenarioId) ?? null
  const selectedDraft = drafts.find((d) => d.draftId === selectedDraftId) ?? null
  const selectedScenarioSummary = getScenarioSummary(selectedSavedScenario)
  const workspaceOptions = [
    { value: '', label: 'Personal' },
    ...teams.map((t) => ({ value: t.id, label: t.name })),
  ]

  useEffect(() => {
    if (activeDraft || selectedSavedScenario) setShowGenerator(false)
  }, [activeDraft, selectedSavedScenario])

  const handleOpenGenerator = () => {
    onOpenGenerator()
    setShowGenerator(true)
  }
  const handleSelectSavedScenario = (id: string | null) => {
    setShowGenerator(false)
    onSelectSavedScenario(id)
  }
  const handleSelectDraft = (draftId: string) => {
    setShowGenerator(false)
    onSelectDraft(draftId)
  }
  const handleCreateDraft = () => {
    setShowGenerator(false)
    onCreateDraft()
  }

  const stopFieldKeyPropagation = (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    e.stopPropagation()

  // ── Status badge ─────────────────────────────────────────────────────────
  const statusBadge = selectedDraft ? (
    <Badge variant="light" color="blue">
      Draft selected
    </Badge>
  ) : selectedSavedScenario ? (
    <Badge variant="light" color="teal">
      Scenario selected
    </Badge>
  ) : (
    <Badge variant="light" color="gray">
      Nothing selected
    </Badge>
  )

  return (
    <Stack gap="lg">
      {/* ── Step header ──────────────────────────────────────────────────── */}
      <Group justify="space-between" align="flex-start">
        <Stack gap={4}>
          <Title order={3}>Choose a Scenario</Title>
          <Text size="sm" c="dimmed">
            Pick from your library, generate new options with AI, or write one from scratch.
          </Text>
        </Stack>
        {statusBadge}
      </Group>

      <Grid gutter="md">
        {/* ── Left panel: library picker ───────────────────────────────── */}
        <Grid.Col span={{ base: 12, lg: 4 }}>
          <Paper
            withBorder
            radius="lg"
            p="md"
            className={classes.scenarioCard}
            style={{ height: '100%' }}
          >
            <Stack gap="sm" style={{ height: '100%' }}>
              {/* Scope tabs */}
              <Tabs
                value={scenarioScope}
                onChange={(v) => onScenarioScopeChange((v as ScenarioListScope) ?? 'mine')}
              >
                <Tabs.List grow>
                  <Tabs.Tab value="mine">Mine</Tabs.Tab>
                  <Tabs.Tab value="team">Team</Tabs.Tab>
                  <Tabs.Tab value="public">Public</Tabs.Tab>
                </Tabs.List>
              </Tabs>

              {/* Workspace — only relevant for team scope */}
              {scenarioScope === 'team' && (
                <Select
                  placeholder="Choose a workspace"
                  data={workspaceOptions}
                  value={scenarioWorkspaceId ?? ''}
                  onChange={(v) => onScenarioWorkspaceChange(v || null)}
                  size="sm"
                />
              )}

              {/* Search */}
              <TextInput
                placeholder="Search by name or topic…"
                leftSection={<IconSearch size={15} />}
                value={scenarioSearchQuery}
                onChange={(e) => onScenarioSearchQueryChange(e.currentTarget.value)}
                onKeyDown={stopFieldKeyPropagation}
                size="sm"
              />

              {/* Quick actions */}
              <SimpleGrid cols={2} spacing="xs">
                <Button
                  size="xs"
                  variant="light"
                  leftSection={<IconSparkles size={14} />}
                  onClick={handleOpenGenerator}
                >
                  Generate
                </Button>
                <Button
                  size="xs"
                  variant="default"
                  leftSection={<IconPencil size={14} />}
                  onClick={handleCreateDraft}
                >
                  Write one
                </Button>
              </SimpleGrid>

              <Divider />

              {/* Saved scenarios */}
              <Stack gap={4} style={{ flex: 1, minHeight: 0 }}>
                {savedScenariosLoading ? (
                  <Group gap="xs" py="xs">
                    <Loader size="xs" />
                    <Text size="sm" c="dimmed">
                      Loading…
                    </Text>
                  </Group>
                ) : scenarioScope === 'team' && !scenarioWorkspaceId ? (
                  <Text size="sm" c="dimmed" py="xs">
                    Select a workspace to browse team scenarios.
                  </Text>
                ) : savedScenarios.length === 0 ? (
                  <Text size="sm" c="dimmed" py="xs">
                    {scenarioSearchQuery
                      ? 'No scenarios match your search.'
                      : 'No saved scenarios here yet.'}
                  </Text>
                ) : (
                  <div className={classes.scenarioList}>
                    {savedScenarios.map((scenario, scenarioIdx) => {
                      const summary = getScenarioSummary(scenario)
                      const isSelected = scenario.id === selectedScenarioId
                      const isFirstNonSelected =
                        !isSelected &&
                        scenarioIdx === savedScenarios.findIndex((s) => s.id !== selectedScenarioId)

                      return (
                        <div
                          key={scenario.id}
                          className={`${classes.scenarioItem} ${isSelected ? classes.scenarioItemSelected : ''}`}
                          onClick={() => handleSelectSavedScenario(scenario.id)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ')
                              handleSelectSavedScenario(scenario.id)
                          }}
                          {...(isFirstNonSelected
                            ? { 'data-tour-id': 'create-session-scenario-item' }
                            : {})}
                        >
                          <Group justify="space-between" align="flex-start" gap="xs" wrap="nowrap">
                            <Stack gap={2} style={{ minWidth: 0, flex: 1 }}>
                              <Text fw={600} size="sm" lineClamp={1}>
                                {scenario.name}
                              </Text>
                              <Text size="xs" c="dimmed" lineClamp={2}>
                                {scenario.description || summary?.objective || 'Saved scenario'}
                              </Text>
                            </Stack>
                            {isSelected && (
                              <ThemeIcon
                                size="sm"
                                color="teal"
                                variant="light"
                                radius="xl"
                                style={{ flexShrink: 0, marginTop: 2 }}
                              >
                                <IconCheck size={11} />
                              </ThemeIcon>
                            )}
                          </Group>
                        </div>
                      )
                    })}
                  </div>
                )}
              </Stack>
            </Stack>
          </Paper>
        </Grid.Col>

        {/* ── Right panel: context-sensitive workspace ─────────────────── */}
        <Grid.Col span={{ base: 12, lg: 8 }}>
          <Paper
            withBorder
            radius="lg"
            p="xl"
            className={classes.scenarioCard}
            style={{ height: '100%' }}
          >
            {/* ── Editor: active draft open for editing ─────────────────── */}
            {activeDraft ? (
              <Stack gap="md" style={{ height: '100%' }}>
                <Group justify="space-between" align="flex-start">
                  <Stack gap={2}>
                    <Group gap="xs" align="center">
                      <IconFileText size={16} style={{ color: 'var(--mantine-color-dimmed)' }} />
                      <Text
                        size="xs"
                        c="dimmed"
                        fw={600}
                        tt="uppercase"
                        style={{ letterSpacing: '0.08em' }}
                      >
                        Editing draft
                      </Text>
                    </Group>
                    <Title order={4}>{activeDraft.name || 'Untitled scenario'}</Title>
                  </Stack>
                  {selectedDraft && (
                    <Badge variant="light" color="blue" leftSection={<IconCheck size={11} />}>
                      Selected for this session
                    </Badge>
                  )}
                </Group>

                {!selectedDraft && (
                  <Alert color="blue" variant="light" radius="md">
                    This draft is open for editing but not yet chosen for this session. Use the
                    button below when you are happy with it.
                  </Alert>
                )}

                <ScenarioEditorFields
                  value={activeDraft}
                  onChange={onChangeActiveDraft}
                  allowTeamVisibility={allowTeamVisibility}
                />

                <Group justify="flex-end" gap="sm" pt="xs">
                  <Button
                    variant="default"
                    leftSection={<IconDeviceFloppy size={16} />}
                    onClick={onSaveActiveDraft}
                    loading={isSavingDraft}
                  >
                    Save to library
                  </Button>
                  <Button leftSection={<IconCircleCheck size={16} />} onClick={onUseActiveDraft}>
                    Use this
                  </Button>
                </Group>
              </Stack>
            ) : selectedSavedScenario && selectedScenarioSummary ? (
              /* ── Preview: saved scenario selected ─────────────────────── */
              <Stack gap="lg">
                <Group justify="space-between" align="flex-start">
                  <Stack gap={4}>
                    <Group gap="xs" align="center">
                      <ThemeIcon size="xs" color="teal" variant="light" radius="xl">
                        <IconCheck size={10} />
                      </ThemeIcon>
                      <Text
                        size="xs"
                        c="teal"
                        fw={700}
                        tt="uppercase"
                        style={{ letterSpacing: '0.08em' }}
                      >
                        Selected for this session
                      </Text>
                    </Group>
                    <Title order={3}>{selectedSavedScenario.name}</Title>
                    {selectedScenarioSummary.description && (
                      <Text size="sm" c="dimmed">
                        {selectedScenarioSummary.description}
                      </Text>
                    )}
                  </Stack>
                  <Badge variant="outline" color="gray" size="sm">
                    {selectedSavedScenario.visibility.toLowerCase()}
                  </Badge>
                </Group>

                {/* Role row */}
                <div className={classes.scenarioRoleRow}>
                  <Stack gap={3} style={{ flex: 1 }}>
                    <Text
                      size="xs"
                      fw={700}
                      c="dimmed"
                      tt="uppercase"
                      style={{ letterSpacing: '0.1em' }}
                    >
                      You play
                    </Text>
                    <Text fw={600} size="sm">
                      {selectedScenarioSummary.userRole || 'Not specified'}
                    </Text>
                  </Stack>
                  <Text
                    size="xs"
                    c="dimmed"
                    fw={700}
                    tt="uppercase"
                    style={{ letterSpacing: '0.1em' }}
                  >
                    vs
                  </Text>
                  <Stack gap={3} style={{ flex: 1 }}>
                    <Text
                      size="xs"
                      fw={700}
                      c="dimmed"
                      tt="uppercase"
                      style={{ letterSpacing: '0.1em' }}
                    >
                      AI plays
                    </Text>
                    <Text fw={600} size="sm">
                      {selectedScenarioSummary.aiRole || 'Not specified'}
                    </Text>
                  </Stack>
                  <Stack gap={3} align="flex-end">
                    <Text size="xs" c="dimmed">
                      Duration
                    </Text>
                    <Text fw={600} size="sm">
                      {selectedScenarioSummary.durationMinutes} min
                    </Text>
                  </Stack>
                </div>

                {selectedScenarioSummary.objective && (
                  <Stack gap={4}>
                    <Text
                      size="xs"
                      fw={700}
                      c="dimmed"
                      tt="uppercase"
                      style={{ letterSpacing: '0.1em' }}
                    >
                      Objective
                    </Text>
                    <Text size="sm">{selectedScenarioSummary.objective}</Text>
                  </Stack>
                )}

                {selectedScenarioSummary.background && (
                  <Stack gap={4}>
                    <Text
                      size="xs"
                      fw={700}
                      c="dimmed"
                      tt="uppercase"
                      style={{ letterSpacing: '0.1em' }}
                    >
                      Background
                    </Text>
                    <Text size="sm" c="dimmed">
                      {selectedScenarioSummary.background}
                    </Text>
                  </Stack>
                )}

                {selectedScenarioSummary.tags.length > 0 && (
                  <Group gap="xs">
                    {selectedScenarioSummary.tags.map((tag) => (
                      <Badge key={tag} size="xs" variant="light" color="gray">
                        {tag}
                      </Badge>
                    ))}
                  </Group>
                )}

                <Divider />

                <Group justify="space-between" align="center">
                  <Text size="sm" c="dimmed">
                    Not the right fit?
                  </Text>
                  <Group gap="sm">
                    <Button
                      size="sm"
                      variant="default"
                      leftSection={<IconSparkles size={14} />}
                      onClick={handleOpenGenerator}
                    >
                      Generate options
                    </Button>
                    <Button
                      size="sm"
                      variant="default"
                      leftSection={<IconPlus size={14} />}
                      onClick={handleCreateDraft}
                    >
                      Create new
                    </Button>
                  </Group>
                </Group>
              </Stack>
            ) : showGenerator ? (
              /* ── Generator: AI scenario generation form ───────────────── */
              <Stack gap="lg">
                <Stack gap={4}>
                  <Title order={4}>Generate scenarios</Title>
                  <Text size="sm" c="dimmed">
                    Describe what to practice and we will draft a few ready-to-use options for you
                    to review.
                  </Text>
                </Stack>

                <TextInput
                  label="What do you want to practice?"
                  placeholder="e.g. Renewal call with procurement pushing for a 20% discount"
                  size="md"
                  value={scenarioTopic}
                  onChange={(e) => setScenarioTopic(e.currentTarget.value)}
                  onKeyDown={stopFieldKeyPropagation}
                  error={errors.scenarioTopic}
                  data-tour-id="create-session-topic"
                />

                <Textarea
                  label="Context"
                  description="Add urgency, company background, likely objections — anything that should make it feel realistic."
                  placeholder="e.g. The prospect is mid-contract and has signalled they may churn unless the price drops."
                  minRows={3}
                  value={scenarioContext}
                  onChange={(e) => setScenarioContext(e.currentTarget.value)}
                  onKeyDown={stopFieldKeyPropagation}
                  data-tour-id="create-session-context"
                />

                <Textarea
                  label="Learning objective"
                  description="Optional — what should the rep be able to do by the end?"
                  placeholder="e.g. Hold firm on pricing while preserving the relationship."
                  minRows={2}
                  value={scenarioObjective}
                  onChange={(e) => setScenarioObjective(e.currentTarget.value)}
                  onKeyDown={stopFieldKeyPropagation}
                  data-tour-id="create-session-objective"
                />

                <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
                  <TextInput
                    label="Your role"
                    description="Optional — who the rep plays"
                    placeholder="e.g. Account executive"
                    value={userRole}
                    onChange={(e) => setUserRole(e.currentTarget.value)}
                    onKeyDown={stopFieldKeyPropagation}
                    data-tour-id="create-session-user-role"
                  />
                  <TextInput
                    label="AI counterpart"
                    description="Optional — who the AI plays"
                    placeholder="e.g. VP of Finance"
                    value={aiRole}
                    onChange={(e) => setAiRole(e.currentTarget.value)}
                    onKeyDown={stopFieldKeyPropagation}
                    data-tour-id="create-session-ai-role"
                  />
                </SimpleGrid>

                <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
                  <NumberInput
                    label="Session length"
                    description="In minutes"
                    value={durationMinutes}
                    min={5}
                    max={180}
                    step={5}
                    error={errors.durationMinutes}
                    onChange={(v) => setDurationMinutes(Number(v) || 20)}
                  />
                  <NumberInput
                    label="Options to generate"
                    description="We'll draft this many variations"
                    value={scenarioCount}
                    min={1}
                    max={5}
                    onChange={(v) => setScenarioCount(Math.min(5, Math.max(1, Number(v) || 1)))}
                  />
                </SimpleGrid>

                <Group justify="flex-end" gap="sm" pt="xs">
                  <Button
                    variant="subtle"
                    leftSection={<IconPencil size={15} />}
                    onClick={handleCreateDraft}
                  >
                    Write one instead
                  </Button>
                  <Button
                    leftSection={<IconSparkles size={15} />}
                    rightSection={<IconArrowRight size={15} />}
                    onClick={onGenerate}
                    loading={isGenerating}
                    data-tour-id="create-session-generate"
                  >
                    Generate {scenarioCount > 1 ? `${scenarioCount} options` : 'scenario'}
                  </Button>
                </Group>
              </Stack>
            ) : (
              /* ── Empty state: nothing selected, not generating ───────── */
              <Stack justify="center" style={{ height: '100%', minHeight: 280 }} gap="xl">
                <Stack gap={4} align="center">
                  <Title order={4} ta="center">
                    How do you want to set the scene?
                  </Title>
                  <Text size="sm" c="dimmed" ta="center" maw={440}>
                    Pick from your library on the left, or start fresh below.
                  </Text>
                </Stack>
                <div className={classes.scenarioStartGrid}>
                  <button className={classes.scenarioStartCard} onClick={handleOpenGenerator}>
                    <ThemeIcon size={44} variant="light" color="violet" radius="xl">
                      <IconSparkles size={22} />
                    </ThemeIcon>
                    <Stack gap={4}>
                      <Text fw={700} size="md">
                        Generate with AI
                      </Text>
                      <Text size="sm" c="dimmed">
                        Describe the practice goal and we will draft a few polished options
                        instantly.
                      </Text>
                    </Stack>
                  </button>
                  <button className={classes.scenarioStartCard} onClick={handleCreateDraft}>
                    <ThemeIcon size={44} variant="light" color="gray" radius="xl">
                      <IconPencil size={22} />
                    </ThemeIcon>
                    <Stack gap={4}>
                      <Text fw={700} size="md">
                        Write one
                      </Text>
                      <Text size="sm" c="dimmed">
                        Start from scratch and shape every detail of the scenario yourself.
                      </Text>
                    </Stack>
                  </button>
                </div>
              </Stack>
            )}
          </Paper>
        </Grid.Col>
      </Grid>
    </Stack>
  )
}
