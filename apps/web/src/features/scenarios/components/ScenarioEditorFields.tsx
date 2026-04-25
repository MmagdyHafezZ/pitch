'use client'

import type { KeyboardEvent } from 'react'
import {
  Accordion,
  ActionIcon,
  Button,
  Group,
  NumberInput,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  TagsInput,
  Text,
  TextInput,
  Textarea,
} from '@mantine/core'
import { IconPlus, IconTrash } from '@tabler/icons-react'
import type {
  EditableScenarioDraft,
  ScenarioConfig,
  ScenarioVisibility,
} from '../types/scenario.types'
import { normalizeScenarioConfig } from '../utils/scenario-editor'

interface ScenarioEditorFieldsProps {
  value: EditableScenarioDraft
  onChange: (value: EditableScenarioDraft) => void
  readOnly?: boolean
  allowTeamVisibility?: boolean
}

const DIFFICULTY_OPTIONS = [
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
]

const LANGUAGE_OPTIONS = [
  { value: 'en-US', label: 'English (US)' },
  { value: 'en-GB', label: 'English (UK)' },
  { value: 'es-ES', label: 'Spanish' },
  { value: 'fr-FR', label: 'French' },
  { value: 'de-DE', label: 'German' },
]

const getVisibilityOptions = (allowTeamVisibility: boolean) => {
  const base: Array<{ value: ScenarioVisibility; label: string }> = [
    { value: 'PRIVATE', label: 'Private' },
    { value: 'PUBLIC', label: 'Public' },
  ]

  if (allowTeamVisibility) {
    base.splice(1, 0, { value: 'TEAM', label: 'Team' })
  }

  return base
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const pickDraftString = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined

export function ScenarioEditorFields({
  value,
  onChange,
  readOnly = false,
  allowTeamVisibility = false,
}: ScenarioEditorFieldsProps) {
  const rawConfig = isRecord(value.config) ? (value.config as ScenarioConfig) : {}
  const rawRoles = isRecord(rawConfig.roles) ? rawConfig.roles : {}
  const config = normalizeScenarioConfig(rawConfig)
  const stages = (
    Array.isArray(rawConfig.stages) && rawConfig.stages.length > 0
      ? rawConfig.stages
      : config.stages
  ).map((stage, index) => {
    if (isRecord(stage)) {
      const fallback = config.stages[index] ?? { title: `Stage ${index + 1}`, goal: '' }
      return {
        title: pickDraftString(stage.title) ?? fallback.title,
        goal: pickDraftString(stage.goal) ?? fallback.goal,
      }
    }

    return config.stages[index] ?? { title: `Stage ${index + 1}`, goal: '' }
  })

  const stopFieldKeyPropagation = (
    event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    event.stopPropagation()
  }

  const updateDraft = (patch: Partial<EditableScenarioDraft>) => {
    onChange({
      ...value,
      ...patch,
    })
  }

  const updateConfig = (patch: Partial<ScenarioConfig>) => {
    updateDraft({
      config: {
        ...rawConfig,
        ...patch,
      },
    })
  }

  const updateRoles = (patch: Record<string, unknown>) => {
    updateConfig({
      roles: {
        ...rawRoles,
        ...patch,
      },
    })
  }

  const updateStage = (index: number, patch: { title?: string; goal?: string }) => {
    const nextStages = stages.map((stage, stageIndex) =>
      stageIndex === index ? { ...stage, ...patch } : stage
    )
    updateConfig({ stages: nextStages })
  }

  const addStage = () => {
    updateConfig({
      stages: [...stages, { title: `Stage ${stages.length + 1}`, goal: '' }],
    })
  }

  const removeStage = (index: number) => {
    const nextStages = stages.filter((_, stageIndex) => stageIndex !== index)
    updateConfig({
      stages: nextStages.length > 0 ? nextStages : [{ title: 'Stage 1', goal: '' }],
    })
  }

  return (
    <Accordion defaultValue="core" variant="separated">
      <Accordion.Item value="core">
        <Accordion.Control>Basics</Accordion.Control>
        <Accordion.Panel>
          <Stack gap="md">
            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
              <TextInput
                label="Scenario name"
                value={value.name}
                onChange={(event) => updateDraft({ name: event.currentTarget.value })}
                placeholder="Quarter-end renewal call"
                disabled={readOnly}
              />
              <Select
                label="Access"
                data={getVisibilityOptions(allowTeamVisibility)}
                value={value.visibility}
                onChange={(nextValue) =>
                  updateDraft({ visibility: (nextValue as ScenarioVisibility | null) ?? 'PRIVATE' })
                }
                disabled={readOnly}
              />
            </SimpleGrid>

            <Textarea
              label="Description"
              value={value.description ?? ''}
              onChange={(event) => updateDraft({ description: event.currentTarget.value })}
              onKeyDown={stopFieldKeyPropagation}
              placeholder="A realistic summary of the meeting and why it matters."
              minRows={2}
              disabled={readOnly}
            />

            <Textarea
              label="Objective"
              value={pickDraftString(rawConfig.objective) ?? config.objective ?? ''}
              onChange={(event) => updateConfig({ objective: event.currentTarget.value })}
              onKeyDown={stopFieldKeyPropagation}
              placeholder="What should the learner accomplish?"
              minRows={2}
              disabled={readOnly}
            />

            <Textarea
              label="Background"
              value={
                pickDraftString(rawConfig.background) ??
                pickDraftString(rawConfig.context) ??
                config.background ??
                config.context ??
                ''
              }
              onChange={(event) =>
                updateConfig({
                  background: event.currentTarget.value,
                  context: event.currentTarget.value,
                })
              }
              onKeyDown={stopFieldKeyPropagation}
              placeholder="Company context, timeline pressure, decision criteria, and practical constraints."
              minRows={4}
              disabled={readOnly}
            />
          </Stack>
        </Accordion.Panel>
      </Accordion.Item>

      <Accordion.Item value="roles">
        <Accordion.Control>People and timing</Accordion.Control>
        <Accordion.Panel>
          <Stack gap="md">
            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
              <TextInput
                label="Your role"
                value={pickDraftString(rawRoles.user) ?? config.roles?.user ?? ''}
                onChange={(event) => updateRoles({ user: event.currentTarget.value })}
                onKeyDown={stopFieldKeyPropagation}
                placeholder="Account executive"
                disabled={readOnly}
              />
              <TextInput
                label="Counterpart role"
                value={pickDraftString(rawRoles.assistant) ?? config.roles?.assistant ?? ''}
                onChange={(event) => updateRoles({ assistant: event.currentTarget.value })}
                onKeyDown={stopFieldKeyPropagation}
                placeholder="VP of Finance"
                disabled={readOnly}
              />
            </SimpleGrid>

            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
              <Select
                label="Difficulty"
                data={DIFFICULTY_OPTIONS}
                value={config.difficulty ?? 'medium'}
                onChange={(nextValue) => updateConfig({ difficulty: nextValue ?? 'medium' })}
                disabled={readOnly}
              />
              <NumberInput
                label="Duration (minutes)"
                value={config.durationMinutes ?? 20}
                onChange={(nextValue) => updateConfig({ durationMinutes: Number(nextValue) || 20 })}
                min={5}
                max={120}
                step={5}
                disabled={readOnly}
              />
            </SimpleGrid>

            <Select
              label="Language"
              data={LANGUAGE_OPTIONS}
              value={config.language ?? 'en-US'}
              onChange={(nextValue) => updateConfig({ language: nextValue ?? 'en-US' })}
              disabled={readOnly}
            />
          </Stack>
        </Accordion.Panel>
      </Accordion.Item>

      <Accordion.Item value="advanced">
        <Accordion.Control>Advanced</Accordion.Control>
        <Accordion.Panel>
          <Stack gap="md">
            <TagsInput
              label="Tags"
              value={config.tags ?? []}
              onChange={(nextValue) => updateConfig({ tags: nextValue })}
              acceptValueOnBlur
              disabled={readOnly}
              placeholder="Add tags"
            />

            <TagsInput
              label="Constraints"
              value={config.constraints ?? []}
              onChange={(nextValue) => updateConfig({ constraints: nextValue })}
              acceptValueOnBlur
              disabled={readOnly}
              placeholder="Budget freeze, skeptical executive, short meeting"
            />

            <TagsInput
              label="Success criteria"
              value={config.successCriteria ?? []}
              onChange={(nextValue) => updateConfig({ successCriteria: nextValue })}
              acceptValueOnBlur
              disabled={readOnly}
              placeholder="Secure next step, confirm timeline, uncover blocker"
            />

            <TagsInput
              label="Stakes"
              value={config.stakes ?? []}
              onChange={(nextValue) => updateConfig({ stakes: nextValue })}
              acceptValueOnBlur
              disabled={readOnly}
              placeholder="Renewal at risk, champion credibility, quarter deadline"
            />

            <Stack gap="xs">
              <Group justify="space-between" align="center">
                <Text fw={600}>Stages</Text>
                {!readOnly && (
                  <Button
                    size="xs"
                    variant="light"
                    leftSection={<IconPlus size={14} />}
                    onClick={addStage}
                  >
                    Add stage
                  </Button>
                )}
              </Group>
              <Stack gap="sm">
                {stages.map((stage, index) => (
                  <Paper key={`${stage.title}-${index}`} withBorder radius="md" p="sm">
                    <Stack gap="sm">
                      <Group justify="space-between" align="center">
                        <Text size="sm" fw={600}>
                          Stage {index + 1}
                        </Text>
                        {!readOnly && stages.length > 1 && (
                          <ActionIcon
                            color="red"
                            variant="light"
                            onClick={() => removeStage(index)}
                            aria-label={`Remove stage ${index + 1}`}
                          >
                            <IconTrash size={14} />
                          </ActionIcon>
                        )}
                      </Group>
                      <TextInput
                        label="Stage title"
                        value={stage.title}
                        onChange={(event) =>
                          updateStage(index, { title: event.currentTarget.value })
                        }
                        disabled={readOnly}
                      />
                      <Textarea
                        label="Stage goal"
                        minRows={2}
                        value={stage.goal}
                        onChange={(event) =>
                          updateStage(index, { goal: event.currentTarget.value })
                        }
                        disabled={readOnly}
                      />
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            </Stack>
          </Stack>
        </Accordion.Panel>
      </Accordion.Item>
    </Accordion>
  )
}
