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
  Button,
  SimpleGrid,
  Badge,
  NumberInput,
} from '@mantine/core'
import {
  IconSparkles,
  IconWand,
  IconClock,
  IconTarget,
  IconNotes,
  IconSearch,
} from '@tabler/icons-react'
import classes from '../create-session.module.css'
import React from 'react'

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
  userRole: string
  setUserRole: (value: string) => void
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
  userRole,
  setUserRole,
  durationMinutes,
  setDurationMinutes,
  scenarioCount,
  setScenarioCount,
  onGenerate,
  isGenerating,
  errors,
}: ScenarioStepProps) {
  const selectedScenario = scenarios.find((scenario) => scenario.id === selectedScenarioId) ?? null
  const [scenarioQuery, setScenarioQuery] = React.useState('')
  const filteredScenarios = React.useMemo(() => {
    const query = scenarioQuery.trim().toLowerCase()
    if (!query) {
      return scenarios
    }

    return scenarios.filter((scenario) => {
      const name = scenario.name.toLowerCase()
      const description = scenario.description?.toLowerCase() ?? ''
      return name.includes(query) || description.includes(query)
    })
  }, [scenarios, scenarioQuery])

  React.useEffect(() => {
    if (!selectedScenarioId) {
      return
    }

    if (!scenarios.some((scenario) => scenario.id === selectedScenarioId)) {
      setSelectedScenarioId(null)
    }
  }, [scenarios, selectedScenarioId, setSelectedScenarioId])
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
              data-tour-id="create-session-topic"
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
              data-tour-id="create-session-objective"
            />
            <Textarea
              label="Context"
              placeholder="Add any background, constraints, or roleplay detail"
              minRows={3}
              value={scenarioContext}
              onChange={(event) => setScenarioContext(event.currentTarget.value)}
              leftSection={<IconNotes size={16} />}
              data-tour-id="create-session-context"
            />
            <TextInput
              label="AI role in the simulation"
              placeholder="Customer / Partner / CTO"
              value={aiRole}
              onChange={(event) => setAiRole(event.currentTarget.value)}
              data-tour-id="create-session-ai-role"
            />
            <TextInput
              label="Your role in the simulation"
              placeholder="Account executive / Founder / Sales rep"
              value={userRole}
              onChange={(event) => setUserRole(event.currentTarget.value)}
              data-tour-id="create-session-user-role"
            />
            <NumberInput
              label="Session length (minutes)"
              value={durationMinutes}
              onChange={(value) => setDurationMinutes(Number(value) || 0)}
              min={5}
              max={180}
              step={5}
              leftSection={<IconClock size={16} />}
              data-tour-id="create-session-duration"
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
                data-tour-id="create-session-generate"
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
            {/* // search scenarios list */}
            <TextInput
              placeholder="Search for specific scenario"
              leftSection={<IconSearch size={16} />}
              value={scenarioQuery}
              onChange={(event) => setScenarioQuery(event.currentTarget.value)}
              disabled={scenariosLoading}
            />
            <Text size="xs" c="dimmed">
              {scenariosLoading
                ? 'Loading scenarios...'
                : scenarios.length === 0
                  ? 'No scenarios available yet.'
                  : `Showing ${filteredScenarios.length} of ${scenarios.length} scenarios`}
            </Text>
            <Stack
              gap="xs"
              style={{
                overflowY: 'auto',
              }}
            >
              {scenariosLoading && scenarios.length === 0 ? (
                <Stack gap="xs" align="center">
                  <IconSparkles size={18} />
                  <Text size="sm" c="dimmed" ta="center">
                    Loading your scenarios...
                  </Text>
                </Stack>
              ) : filteredScenarios.length > 0 ? (
                filteredScenarios.map((scenario) =>
                  selectedScenario?.id === scenario.id ? (
                    <Paper
                      withBorder
                      radius="md"
                      p="md"
                      className={classes.scenarioPreviewSelected}
                      key={scenario.id}
                    >
                      <Text fw={600} mb="xs">
                        {scenario.name}
                      </Text>
                      <Text size="sm" c="dimmed">
                        {scenario.description || 'No description provided.'}
                      </Text>
                    </Paper>
                  ) : (
                    <Paper
                      withBorder
                      radius="md"
                      p="md"
                      key={scenario.id}
                      data-tour-id="create-session-scenario-item"
                      className={classes.scenarioPreview}
                      onClick={() => setSelectedScenarioId(scenario.id)}
                    >
                      <Text fw={600} mb="xs">
                        {scenario.name}
                      </Text>
                      <Text size="sm" c="dimmed">
                        {scenario.description || 'No description provided.'}
                      </Text>
                    </Paper>
                  )
                )
              ) : scenarioQuery.trim() ? (
                <Stack gap="xs" align="center">
                  <IconSparkles size={18} />
                  <Text size="sm" c="dimmed" ta="center">
                    No scenarios match {scenarioQuery.trim()}.
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
            </Stack>
          </Stack>
        </Paper>
      </SimpleGrid>
    </Stack>
  )
}
