'use client'

import { Stack, Group, Box, Title, Text, Paper, Badge, ThemeIcon, Skeleton } from '@mantine/core'
import { IconChecklist, IconCoin } from '@tabler/icons-react'
import { SessionType } from '@/features/sessions'
import type { EditableScenarioDraft, Scenario } from '@/features/scenarios/types/scenario.types'
import { getScenarioSummary } from '@/features/scenarios/utils/scenario-editor'
import { Persona } from '../lib/types'
import { getVoiceProfile } from '../lib/helpers'
import { LLMProvider } from '@/features/sessions/hooks/useLLMProviders'
import { useSessionCoinEstimate } from '@/features/coins/hooks/useCoinsBalance'
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
  language: string
  tags: string[]
  selectedPersona: string | null
  personas: Persona[]
  selectedPersonaData: Persona | null
  accent: string
  scenarioTopic: string
  scenarioObjective: string
  scenarioContext: string
  selectedScenario: Scenario | null
  selectedDraft: EditableScenarioDraft | null
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
  responseLength: string
  patienceLevel: string
  initiativeLevel: string
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
  language,
  tags,
  selectedPersona,
  personas,
  selectedPersonaData,
  accent,
  scenarioTopic,
  scenarioObjective,
  scenarioContext,
  selectedScenario,
  selectedDraft,
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
  responseLength,
  patienceLevel,
  initiativeLevel,
  difficulty,
  multiTurnEnabled,
}: ReviewStepProps) {
  const { data: coinEstimate, isLoading: coinEstimateLoading } = useSessionCoinEstimate({
    model: llmModel ?? undefined,
    provider: llmProvider ?? undefined,
    sessionType: sessionType ?? 'text',
    durationMinutes,
    enabled: Boolean(llmModel && sessionType),
  })

  const selectedDifficulty = difficultyOptions.find((option) => option.value === difficulty)
  const scenarioSummary = getScenarioSummary(selectedDraft ?? selectedScenario)
  const scenarioSource = selectedDraft
    ? 'Generated option'
    : selectedScenario
      ? 'Saved scenario'
      : 'Quick prompt'
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
                <Text c="dimmed">Collected when the session starts</Text>
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
              <Text fw={600}>Source</Text>
              <Text c="dimmed">{scenarioSource}</Text>
            </Group>
            <Group justify="apart" className={classes.reviewRow}>
              <Text fw={600}>Scenario</Text>
              <Text c="dimmed">
                {scenarioSummary?.name || scenarioTopic || 'Prompt-only setup'}
              </Text>
            </Group>
            {(scenarioSummary?.objective || scenarioObjective) && (
              <Group justify="apart" className={classes.reviewRow}>
                <Text fw={600}>Objective</Text>
                <Text c="dimmed">{scenarioSummary?.objective || scenarioObjective}</Text>
              </Group>
            )}
            {(scenarioSummary?.background || scenarioContext) && (
              <Group justify="apart" className={classes.reviewRow}>
                <Text fw={600}>Context</Text>
                <Text c="dimmed">{scenarioSummary?.background || scenarioContext}</Text>
              </Group>
            )}
            {scenarioSummary && (
              <Group justify="apart" className={classes.reviewRow}>
                <Text fw={600}>Visibility</Text>
                <Text c="dimmed">{scenarioSummary.visibility.toLowerCase()}</Text>
              </Group>
            )}
            <Group justify="apart" className={classes.reviewRow}>
              <Text fw={600}>AI role</Text>
              <Text c="dimmed">{scenarioSummary?.aiRole || aiRole || 'Not set'}</Text>
            </Group>
            <Group justify="apart" className={classes.reviewRow}>
              <Text fw={600}>Your role</Text>
              <Text c="dimmed">{scenarioSummary?.userRole || userRole || 'Not set'}</Text>
            </Group>
            <Group justify="apart" className={classes.reviewRow}>
              <Text fw={600}>Session length</Text>
              <Text c="dimmed">{scenarioSummary?.durationMinutes || durationMinutes} min</Text>
            </Group>
            {scenarioSummary?.tags.length ? (
              <Group gap="xs" mt="xs">
                {scenarioSummary.tags.map((tag) => (
                  <Badge key={tag} variant="light" color="gray">
                    {tag}
                  </Badge>
                ))}
              </Group>
            ) : null}
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
            {llmProvider && llmModel && (
              <Group justify="apart" className={classes.reviewRow}>
                <Group gap={4}>
                  <IconCoin size={14} color="var(--mantine-color-yellow-5)" />
                  <Text fw={600}>Session cost</Text>
                </Group>
                {coinEstimateLoading ? (
                  <Skeleton height={14} width={60} radius="sm" />
                ) : coinEstimate ? (
                  <Text size="sm" fw={600} c="yellow.5">
                    ~{coinEstimate.estimatedCoins} coins
                    <Text span size="xs" c="dimmed" ml={4}>
                      (~${coinEstimate.estimatedCostUsd.toFixed(3)})
                    </Text>
                  </Text>
                ) : (
                  <Text c="dimmed" size="sm">
                    Estimate unavailable
                  </Text>
                )}
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
              <Text fw={600}>Response length</Text>
              <Text c="dimmed">{responseLength}</Text>
            </Group>
            <Group justify="apart" className={classes.reviewRow}>
              <Text fw={600}>Patience level</Text>
              <Text c="dimmed">{patienceLevel}</Text>
            </Group>
            <Group justify="apart" className={classes.reviewRow}>
              <Text fw={600}>Initiative</Text>
              <Text c="dimmed">{initiativeLevel}</Text>
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
