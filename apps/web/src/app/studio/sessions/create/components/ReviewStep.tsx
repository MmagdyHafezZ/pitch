'use client'

import { Stack, Group, Box, Title, Text, Paper, Badge, ThemeIcon } from '@mantine/core'
import { IconChecklist } from '@tabler/icons-react'
import { SessionType } from '@/features/sessions'
import { Persona } from '../lib/types'
import { getVoiceProfile } from '../lib/helpers'
import { LLMProvider } from '@/features/sessions/hooks/useLLMProviders'
import classes from '../create-session.module.css'

interface Team {
  id: string
  name: string
}

interface ReviewStepProps {
  sessionName: string
  selectedTeamId: string | null
  teams: Team[]
  sessionType: SessionType | null
  phoneNumber: string
  language: string
  tags: string[]
  selectedPersona: string | null
  personas: Persona[]
  selectedPersonaData: Persona | null
  accent: string
  scenarioTopic: string
  scenarioObjective: string
  scenarioContext: string
  scenarioId: string | null
  scenarios: Array<{ id: string; name: string; description?: string }>
  aiRole: string
  userRole: string
  durationMinutes: number
  crmSelections: {
    accounts: string[]
    opportunities: string[]
    leads: string[]
    contacts: string[]
  }
  crmConnected: boolean
  llmProvider: string | null
  llmModel: string | null
  llmProvidersData?: { providers: LLMProvider[] }
  tone: string
  speechRate: string
  difficulty: number
  multiTurnEnabled: boolean
}

const difficultyOptions = [
  { label: 'Warm-up', range: '1-3', value: 2 },
  { label: 'Focused', range: '4-6', value: 5 },
  { label: 'Challenging', range: '7-8', value: 7 },
  { label: 'Elite', range: '9-10', value: 9 },
]

export function ReviewStep({
  sessionName,
  selectedTeamId,
  teams,
  sessionType,
  phoneNumber,
  language,
  tags,
  selectedPersona,
  personas,
  selectedPersonaData,
  accent,
  scenarioTopic,
  scenarioObjective,
  scenarioContext,
  scenarioId,
  scenarios,
  aiRole,
  userRole,
  durationMinutes,
  crmSelections,
  crmConnected,
  llmProvider,
  llmModel,
  llmProvidersData,
  tone,
  speechRate,
  difficulty,
  multiTurnEnabled,
}: ReviewStepProps) {
  const selectedDifficulty = difficultyOptions.find((option) => option.value === difficulty)
  const selectedScenario = scenarios.find((scenario) => scenario.id === scenarioId) ?? null
  const crmSelectionCount =
    crmSelections.accounts.length +
    crmSelections.opportunities.length +
    crmSelections.leads.length +
    crmSelections.contacts.length

  return (
    <Stack gap="lg">
      <Group>
        <ThemeIcon size="lg" radius="md" variant="light" color="blue">
          <IconChecklist size={20} />
        </ThemeIcon>
        <Box>
          <Title order={3}>Review Session Details</Title>
          <Text size="sm" c="dimmed">
            Confirm everything before launch.
          </Text>
        </Box>
      </Group>

      <Stack gap="md" className={classes.reviewStack}>
        <Paper p="md" withBorder radius="lg" className={classes.reviewSection}>
          <Title order={4} mb="md">
            Basics
          </Title>
          <Stack gap="xs">
            <Group justify="apart" className={classes.reviewRow}>
              <Text fw={600}>Name</Text>
              <Text c="dimmed">{sessionName.trim() || 'Untitled session'}</Text>
            </Group>
            <Group justify="apart" className={classes.reviewRow}>
              <Text fw={600}>Team</Text>
              <Text c="dimmed">
                {selectedTeamId && selectedTeamId !== ''
                  ? teams.find((t) => t.id === selectedTeamId)?.name || selectedTeamId
                  : 'Personal Session'}
              </Text>
            </Group>
            <Group justify="apart" className={classes.reviewRow}>
              <Text fw={600}>Type</Text>
              <Text c="dimmed">{sessionType || 'Not set'}</Text>
            </Group>
            {sessionType === 'phone' && (
              <Group justify="apart" className={classes.reviewRow}>
                <Text fw={600}>Phone number</Text>
                <Text c="dimmed">{phoneNumber || 'Not set'}</Text>
              </Group>
            )}
            <Group justify="apart" className={classes.reviewRow}>
              <Text fw={600}>Language</Text>
              <Text c="dimmed">{language}</Text>
            </Group>
            {tags.length > 0 && (
              <Group gap="xs" mt="xs">
                {tags.map((tag) => (
                  <Badge key={tag} variant="light">
                    {tag}
                  </Badge>
                ))}
              </Group>
            )}
          </Stack>
        </Paper>

        <Paper p="md" withBorder radius="lg" className={classes.reviewSection}>
          <Title order={4} mb="md">
            Persona
          </Title>
          <Stack gap="xs">
            <Group justify="apart" className={classes.reviewRow}>
              <Text fw={600}>Persona</Text>
              <Text c="dimmed">
                {selectedPersona
                  ? personas.find((p) => p.id === selectedPersona)?.name || selectedPersona
                  : 'Not selected'}
              </Text>
            </Group>
            <Group justify="apart" className={classes.reviewRow}>
              <Text fw={600}>Voice profile</Text>
              <Text c="dimmed">{getVoiceProfile(selectedPersonaData?.traits ?? null)}</Text>
            </Group>
            <Group justify="apart" className={classes.reviewRow}>
              <Text fw={600}>Accent</Text>
              <Text c="dimmed">{accent}</Text>
            </Group>
          </Stack>
        </Paper>

        <Paper p="md" withBorder radius="lg" className={classes.reviewSection}>
          <Title order={4} mb="md">
            Scenario
          </Title>
          <Stack gap="xs">
            <Group justify="apart" className={classes.reviewRow}>
              <Text fw={600}>Topic</Text>
              <Text c="dimmed">{scenarioTopic || 'Not set'}</Text>
            </Group>
            <Group justify="apart" className={classes.reviewRow}>
              <Text fw={600}>Objective</Text>
              <Text c="dimmed">{scenarioObjective || 'Not set'}</Text>
            </Group>
            <Group justify="apart" className={classes.reviewRow}>
              <Text fw={600}>Scenario</Text>
              <Text c="dimmed">
                {selectedScenario?.name || (scenarioId ? scenarioId : 'Not selected')}
              </Text>
            </Group>
            {scenarioContext && (
              <Group justify="apart" className={classes.reviewRow}>
                <Text fw={600}>Context</Text>
                <Text c="dimmed">{scenarioContext}</Text>
              </Group>
            )}
            <Group justify="apart" className={classes.reviewRow}>
              <Text fw={600}>AI role</Text>
              <Text c="dimmed">{aiRole || 'Not set'}</Text>
            </Group>
            <Group justify="apart" className={classes.reviewRow}>
              <Text fw={600}>Your role</Text>
              <Text c="dimmed">{userRole || 'Not set'}</Text>
            </Group>
            <Group justify="apart" className={classes.reviewRow}>
              <Text fw={600}>Session length</Text>
              <Text c="dimmed">{durationMinutes} min</Text>
            </Group>
          </Stack>
        </Paper>

        <Paper p="md" withBorder radius="lg" className={classes.reviewSection}>
          <Title order={4} mb="md">
            AI Brain
          </Title>
          <Stack gap="xs">
            <Group justify="apart" className={classes.reviewRow}>
              <Text fw={600}>Provider</Text>
              <Text c="dimmed" tt="capitalize">
                {llmProvider || 'Not selected'}
              </Text>
            </Group>
            <Group justify="apart" className={classes.reviewRow}>
              <Text fw={600}>Model</Text>
              <Text c="dimmed">{llmModel || 'Not selected'}</Text>
            </Group>
            {llmProvider && llmModel && llmProvidersData && (
              <Group justify="apart" className={classes.reviewRow}>
                <Text fw={600}>Estimated Cost</Text>
                <Text c="dimmed" size="sm">
                  $
                  {llmProvidersData.providers
                    .find((p) => p.name === llmProvider)
                    ?.modelDetails.find((m) => m.name === llmModel)
                    ?.pricing.inputTokensPerMillion.toFixed(2)}
                  /M tokens input
                </Text>
              </Group>
            )}
          </Stack>
        </Paper>

        <Paper p="md" withBorder radius="lg" className={classes.reviewSection}>
          <Title order={4} mb="md">
            CRM Context
          </Title>
          <Stack gap="xs">
            <Group justify="apart" className={classes.reviewRow}>
              <Text fw={600}>Salesforce</Text>
              <Text c="dimmed">{crmConnected ? 'Connected' : 'Not connected'}</Text>
            </Group>
            <Group justify="apart" className={classes.reviewRow}>
              <Text fw={600}>Selected records</Text>
              <Text c="dimmed">
                {crmSelectionCount > 0 ? `${crmSelectionCount} selected` : 'None selected'}
              </Text>
            </Group>
          </Stack>
        </Paper>

        <Paper p="md" withBorder radius="lg" className={classes.reviewSection}>
          <Title order={4} mb="md">
            Style
          </Title>
          <Stack gap="xs">
            <Group justify="apart" className={classes.reviewRow}>
              <Text fw={600}>Tone</Text>
              <Text c="dimmed">{tone}</Text>
            </Group>
            <Group justify="apart" className={classes.reviewRow}>
              <Text fw={600}>Speech Rate</Text>
              <Text c="dimmed">{speechRate}</Text>
            </Group>
            <Group justify="apart" className={classes.reviewRow}>
              <Text fw={600}>Difficulty</Text>
              <Text c="dimmed">
                {selectedDifficulty
                  ? `${selectedDifficulty.label} (${selectedDifficulty.range})`
                  : `${difficulty}/10`}
              </Text>
            </Group>
            <Group justify="apart" className={classes.reviewRow}>
              <Text fw={600}>Multi-turn</Text>
              <Text c="dimmed">{multiTurnEnabled ? 'Enabled' : 'Single turn'}</Text>
            </Group>
          </Stack>
        </Paper>
      </Stack>
    </Stack>
  )
}
