'use client'

import {
  Stack,
  Group,
  Box,
  Title,
  Text,
  Paper,
  TextInput,
  Textarea,
  Select,
  Button,
  SimpleGrid,
  Badge,
  NumberInput,
} from '@mantine/core'
import { IconSparkles, IconWand, IconClock, IconTarget, IconNotes } from '@tabler/icons-react'
import classes from '../create-session.module.css'

export interface ScenarioOption {
  id: string
  name: string
  description?: string
  config?: Record<string, unknown>
}

interface ScenarioStepProps {
  scenariosLoading: boolean
  scenarios: ScenarioOption[]
  selectedScenarioId: string | null
  setSelectedScenarioId: (value: string | null) => void
  scenarioTopic: string
  setScenarioTopic: (value: string) => void
  scenarioObjective: string
  setScenarioObjective: (value: string) => void
  scenarioContext: string
  setScenarioContext: (value: string) => void
  aiRole: string
  setAiRole: (value: string) => void
  durationMinutes: number
  setDurationMinutes: (value: number) => void
  scenarioCount: number
  setScenarioCount: (value: number) => void
  onGenerate: () => void
  isGenerating: boolean
  errors?: Record<string, string>
}

export function ScenarioStep({
  scenariosLoading,
  scenarios,
  selectedScenarioId,
  setSelectedScenarioId,
  scenarioTopic,
  setScenarioTopic,
  scenarioObjective,
  setScenarioObjective,
  scenarioContext,
  setScenarioContext,
  aiRole,
  setAiRole,
  durationMinutes,
  setDurationMinutes,
  scenarioCount,
  setScenarioCount,
  onGenerate,
  isGenerating,
  errors,
}: ScenarioStepProps) {
  const selectedScenario = scenarios.find((scenario) => scenario.id === selectedScenarioId) ?? null

  return (
    <Stack gap="lg">
      <Group align="center" gap="sm">
        <Box className={classes.stepIcon}>
          <IconSparkles size={22} />
        </Box>
        <Box>
          <Title order={3}>Scenario & Topic</Title>
          <Text size="sm" c="dimmed">
            Define the session focus, generate a scenario, or pick one from your library.
          </Text>
        </Box>
      </Group>

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
        <Paper withBorder p="md" radius="lg" className={classes.scenarioCard}>
          <Stack gap="md">
            <Group justify="space-between">
              <Text fw={600}>Session topic</Text>
              <Badge size="xs" variant="light" color="blue">
                Required for generation
              </Badge>
            </Group>
            <TextInput
              label="Topic"
              placeholder="Q1 sales onboarding"
              value={scenarioTopic}
              onChange={(event) => setScenarioTopic(event.currentTarget.value)}
              leftSection={<IconTarget size={16} />}
            />
            {errors?.scenarioTopic && (
              <Text size="xs" c="red">
                {errors.scenarioTopic}
              </Text>
            )}
            <Textarea
              label="Objective"
              placeholder="What should the learner accomplish?"
              minRows={2}
              value={scenarioObjective}
              onChange={(event) => setScenarioObjective(event.currentTarget.value)}
            />
            <Textarea
              label="Context"
              placeholder="Add any background, constraints, or roleplay detail"
              minRows={3}
              value={scenarioContext}
              onChange={(event) => setScenarioContext(event.currentTarget.value)}
              leftSection={<IconNotes size={16} />}
            />
            <TextInput
              label="AI role in the simulation"
              placeholder="Customer / Partner / CTO"
              value={aiRole}
              onChange={(event) => setAiRole(event.currentTarget.value)}
            />
            <NumberInput
              label="Session length (minutes)"
              value={durationMinutes}
              onChange={(value) => setDurationMinutes(Number(value) || 0)}
              min={5}
              max={180}
              step={5}
              leftSection={<IconClock size={16} />}
            />
            {errors?.durationMinutes && (
              <Text size="xs" c="red">
                {errors.durationMinutes}
              </Text>
            )}
          </Stack>
        </Paper>

        <Paper withBorder p="md" radius="lg" className={classes.scenarioCard}>
          <Stack gap="md">
            <Group justify="space-between" align="center">
              <Text fw={600}>Scenario library</Text>
              <Button
                variant="light"
                color="blue"
                leftSection={<IconWand size={16} />}
                onClick={onGenerate}
                loading={isGenerating}
                disabled={!scenarioTopic.trim()}
              >
                Generate {scenarioCount}
              </Button>
            </Group>
            <NumberInput
              label="How many scenarios?"
              value={scenarioCount}
              onChange={(value) => setScenarioCount(Number(value) || 1)}
              min={1}
              max={5}
              step={1}
            />
            <Select
              label="Choose a scenario"
              placeholder={scenariosLoading ? 'Loading scenarios...' : 'Pick a scenario'}
              data={scenarios.map((scenario) => ({
                value: scenario.id,
                label: scenario.name,
              }))}
              value={selectedScenarioId}
              onChange={setSelectedScenarioId}
              searchable
              clearable
              disabled={scenariosLoading}
            />

            <Paper withBorder radius="md" p="md" className={classes.scenarioPreview}>
              {selectedScenario ? (
                <Stack gap="xs">
                  <Text fw={600}>{selectedScenario.name}</Text>
                  <Text size="sm" c="dimmed">
                    {selectedScenario.description ||
                      'No description provided. Generated scenario details will show here.'}
                  </Text>
                </Stack>
              ) : (
                <Stack gap="xs" align="center">
                  <IconSparkles size={18} />
                  <Text size="sm" c="dimmed" ta="center">
                    Generate a scenario or select one to preview the details.
                  </Text>
                </Stack>
              )}
            </Paper>
          </Stack>
        </Paper>
      </SimpleGrid>
    </Stack>
  )
}
