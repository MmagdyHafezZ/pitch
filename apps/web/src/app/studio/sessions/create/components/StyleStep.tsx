'use client'

import { Stack, Group, Box, Title, Text, Paper, SimpleGrid, ThemeIcon } from '@mantine/core'
import {
  IconAdjustments,
  IconBriefcase,
  IconShieldCheck,
  IconMoodSmile,
  IconMoodAngry,
  IconCoffee,
  IconLeaf,
  IconMountain,
  IconFlame,
  IconCrown,
  IconPlayerTrackNext,
  IconClockHour4,
  IconClockHour8,
  IconArrowsHorizontal,
  IconArrowRight,
  IconBolt,
} from '@tabler/icons-react'
import classes from '../create-session.module.css'

interface StyleStepProps {
  accent: string
  setAccent: (value: string) => void
  tone: string
  setTone: (value: string) => void
  speechRate: string
  setSpeechRate: (value: string) => void
  responseLength: string
  setResponseLength: (value: string) => void
  patienceLevel: string
  setPatienceLevel: (value: string) => void
  initiativeLevel: string
  setInitiativeLevel: (value: string) => void
  difficulty: number
  setDifficulty: (value: number) => void
  multiTurnEnabled: boolean
  setMultiTurnEnabled: (value: boolean) => void
}

const accentOptions = [
  {
    value: 'Persona-based',
    label: 'Persona-based',
    description: 'Use the selected persona voice profile as-is.',
    icon: <IconAdjustments size={18} />,
  },
  {
    value: 'American English',
    label: 'American',
    description: 'Neutral US pronunciation and cadence.',
    icon: <IconBriefcase size={18} />,
  },
  {
    value: 'British English',
    label: 'British',
    description: 'UK-style pronunciation with crisp delivery.',
    icon: <IconShieldCheck size={18} />,
  },
  {
    value: 'Australian English',
    label: 'Australian',
    description: 'Australian English rhythm and vowel color.',
    icon: <IconCoffee size={18} />,
  },
  {
    value: 'Canadian English',
    label: 'Canadian',
    description: 'Canadian English pronunciation.',
    icon: <IconMountain size={18} />,
  },
  {
    value: 'Indian English',
    label: 'Indian',
    description: 'Indian English pacing and articulation.',
    icon: <IconFlame size={18} />,
  },
  {
    value: 'Spanish',
    label: 'Spanish',
    description: 'Spanish accent profile.',
    icon: <IconLeaf size={18} />,
  },
  {
    value: 'French',
    label: 'French',
    description: 'French accent profile.',
    icon: <IconMoodSmile size={18} />,
  },
  {
    value: 'German',
    label: 'German',
    description: 'German accent profile.',
    icon: <IconCrown size={18} />,
  },
  {
    value: 'Italian',
    label: 'Italian',
    description: 'Italian accent profile.',
    icon: <IconPlayerTrackNext size={18} />,
  },
]

const toneOptions = [
  {
    value: 'Formal',
    label: 'Formal',
    description: 'Structured, objective, and direct.',
    icon: <IconBriefcase size={18} />,
  },
  {
    value: 'Professional',
    label: 'Professional',
    description: 'Polished with firm guidance.',
    icon: <IconShieldCheck size={18} />,
  },
  {
    value: 'Friendly',
    label: 'Friendly',
    description: 'Warm, supportive, and calm.',
    icon: <IconMoodSmile size={18} />,
  },
  {
    value: 'Casual',
    label: 'Casual',
    description: 'Relaxed and conversational.',
    icon: <IconCoffee size={18} />,
  },
  {
    value: 'Rude Karen',
    label: 'Rude Karen',
    description: 'Entitled, combative, and hard to please.',
    icon: <IconMoodAngry size={18} />,
  },
]

const speechPaceOptions = [
  {
    value: 'Measured',
    label: 'Measured',
    description: 'Slow down, leave pauses, and sound deliberate.',
    icon: <IconClockHour4 size={18} />,
  },
  {
    value: 'Conversational',
    label: 'Conversational',
    description: 'Balanced pacing for natural back-and-forth.',
    icon: <IconArrowsHorizontal size={18} />,
  },
  {
    value: 'Fast',
    label: 'Fast',
    description: 'Sharper, quicker replies with tighter cadence.',
    icon: <IconBolt size={18} />,
  },
]

const responseLengthOptions = [
  {
    value: 'Concise',
    label: 'Concise',
    description: 'Short replies that keep the user talking.',
    icon: <IconClockHour4 size={18} />,
  },
  {
    value: 'Balanced',
    label: 'Balanced',
    description: 'Moderate detail with clear explanations.',
    icon: <IconClockHour8 size={18} />,
  },
  {
    value: 'Detailed',
    label: 'Detailed',
    description: 'Longer responses when depth matters.',
    icon: <IconPlayerTrackNext size={18} />,
  },
]

const patienceOptions = [
  {
    value: 'Low',
    label: 'Low patience',
    description: 'The persona gets frustrated quickly with vague answers.',
    icon: <IconFlame size={18} />,
  },
  {
    value: 'Medium',
    label: 'Balanced patience',
    description: 'Pushes back, but gives the user room to recover.',
    icon: <IconMountain size={18} />,
  },
  {
    value: 'High',
    label: 'High patience',
    description: 'Stays calm and gives the user more runway.',
    icon: <IconLeaf size={18} />,
  },
]

const initiativeOptions = [
  {
    value: 'Reactive',
    label: 'Reactive',
    description: 'Waits for the user and answers directly.',
    icon: <IconArrowRight size={18} />,
  },
  {
    value: 'Balanced',
    label: 'Balanced',
    description: 'Mixes answers with targeted follow-up questions.',
    icon: <IconArrowsHorizontal size={18} />,
  },
  {
    value: 'Proactive',
    label: 'Proactive',
    description: 'Drives the conversation forward with initiative.',
    icon: <IconPlayerTrackNext size={18} />,
  },
]

const difficultyOptions = [
  {
    label: 'Warm-up',
    range: '1-3',
    description: 'Gentle guidance and easy prompts.',
    value: 2,
    icon: <IconLeaf size={18} />,
  },
  {
    label: 'Focused',
    range: '4-6',
    description: 'Balanced challenge with helpful cues.',
    value: 5,
    icon: <IconMountain size={18} />,
  },
  {
    label: 'Challenging',
    range: '7-8',
    description: 'Sharper feedback, tougher scenarios.',
    value: 7,
    icon: <IconFlame size={18} />,
  },
  {
    label: 'Elite',
    range: '9-10',
    description: 'High stakes, no hints.',
    value: 9,
    icon: <IconCrown size={18} />,
  },
]

export function StyleStep({
  accent,
  setAccent,
  tone,
  setTone,
  speechRate,
  setSpeechRate,
  responseLength,
  setResponseLength,
  patienceLevel,
  setPatienceLevel,
  initiativeLevel,
  setInitiativeLevel,
  difficulty,
  setDifficulty,
  multiTurnEnabled,
  setMultiTurnEnabled,
}: StyleStepProps) {
  return (
    <Stack gap="lg">
      <Group>
        <ThemeIcon size="lg" radius="md" variant="light" color="blue">
          <IconAdjustments size={20} />
        </ThemeIcon>
        <Box>
          <Title order={3}>Session Configuration</Title>
          <Text size="sm" c="dimmed">
            Shape the experience your learner will feel.
          </Text>
        </Box>
      </Group>
      <Text size="sm" c="dimmed">
        Keep the selected voice, and optionally override its accent for this run.
      </Text>

      <Paper withBorder p="md" radius="lg" className={classes.styleCard}>
        <Stack gap="lg">
          <Box>
            <Text fw={600}>Accent</Text>
            <Text size="sm" c="dimmed">
              Set an accent target for the TTS provider while preserving the chosen voice.
            </Text>
          </Box>
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
            {accentOptions.map((option) => {
              const isSelected = accent === option.value
              return (
                <Paper
                  key={option.value}
                  withBorder
                  p="md"
                  radius="lg"
                  data-tour-id={`style-accent-${option.label.toLowerCase().replace(/\s+/g, '-')}`}
                  className={`${classes.optionCard} ${isSelected ? classes.optionCardSelected : ''}`}
                  onClick={() => setAccent(option.value)}
                >
                  <Group align="center" gap="sm">
                    <ThemeIcon size="lg" radius="md" variant="light" color="blue">
                      {option.icon}
                    </ThemeIcon>
                    <Stack gap={2}>
                      <Text fw={700}>{option.label}</Text>
                      <Text size="xs" c="dimmed">
                        {option.description}
                      </Text>
                    </Stack>
                  </Group>
                </Paper>
              )
            })}
          </SimpleGrid>

          <Box>
            <Text fw={600}>Conversation tone</Text>
            <Text size="sm" c="dimmed">
              Choose the emotional texture for this session.
            </Text>
          </Box>
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
            {toneOptions.map((option) => {
              const isSelected = tone === option.value
              return (
                <Paper
                  key={option.value}
                  withBorder
                  p="md"
                  radius="lg"
                  data-tour-id={`style-tone-${option.value.toLowerCase().replace(/\s+/g, '-')}`}
                  className={`${classes.optionCard} ${isSelected ? classes.optionCardSelected : ''}`}
                  onClick={() => setTone(option.value)}
                >
                  <Group align="center" gap="sm">
                    <ThemeIcon size="lg" radius="md" variant="light" color="blue">
                      {option.icon}
                    </ThemeIcon>
                    <Stack gap={2}>
                      <Text fw={700}>{option.label}</Text>
                      <Text size="xs" c="dimmed">
                        {option.description}
                      </Text>
                    </Stack>
                  </Group>
                </Paper>
              )
            })}
          </SimpleGrid>

          <Box>
            <Text fw={600}>Speech pace</Text>
            <Text size="sm" c="dimmed">
              Choose a cadence directly instead of dragging a slider.
            </Text>
          </Box>
          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
            {speechPaceOptions.map((option) => {
              const isSelected = speechRate === option.value
              return (
                <Paper
                  key={option.value}
                  withBorder
                  p="md"
                  radius="lg"
                  data-tour-id={`style-pace-${option.value.toLowerCase()}`}
                  className={`${classes.optionCard} ${
                    isSelected ? classes.optionCardSelected : ''
                  }`}
                  onClick={() => setSpeechRate(option.value)}
                >
                  <Group align="center" gap="sm">
                    <ThemeIcon size="lg" radius="md" variant="light" color="blue">
                      {option.icon}
                    </ThemeIcon>
                    <Stack gap={2}>
                      <Text fw={700}>{option.label}</Text>
                      <Text size="xs" c="dimmed">
                        {option.description}
                      </Text>
                    </Stack>
                  </Group>
                </Paper>
              )
            })}
          </SimpleGrid>

          <Box>
            <Text fw={600}>Response length</Text>
            <Text size="sm" c="dimmed">
              Control how much detail the AI gives before handing the floor back.
            </Text>
          </Box>
          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
            {responseLengthOptions.map((option) => {
              const isSelected = responseLength === option.value
              return (
                <Paper
                  key={option.value}
                  withBorder
                  p="md"
                  radius="lg"
                  data-tour-id={`style-length-${option.value.toLowerCase()}`}
                  className={`${classes.optionCard} ${
                    isSelected ? classes.optionCardSelected : ''
                  }`}
                  onClick={() => setResponseLength(option.value)}
                >
                  <Group align="center" gap="sm">
                    <ThemeIcon size="lg" radius="md" variant="light" color="blue">
                      {option.icon}
                    </ThemeIcon>
                    <Stack gap={2}>
                      <Text fw={700}>{option.label}</Text>
                      <Text size="xs" c="dimmed">
                        {option.description}
                      </Text>
                    </Stack>
                  </Group>
                </Paper>
              )
            })}
          </SimpleGrid>

          <Box>
            <Text fw={600}>Patience</Text>
            <Text size="sm" c="dimmed">
              Decide how forgiving the persona should be when the learner struggles.
            </Text>
          </Box>
          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
            {patienceOptions.map((option) => {
              const isSelected = patienceLevel === option.value
              return (
                <Paper
                  key={option.value}
                  withBorder
                  p="md"
                  radius="lg"
                  data-tour-id={`style-patience-${option.value.toLowerCase()}`}
                  className={`${classes.optionCard} ${
                    isSelected ? classes.optionCardSelected : ''
                  }`}
                  onClick={() => setPatienceLevel(option.value)}
                >
                  <Group align="center" gap="sm">
                    <ThemeIcon size="lg" radius="md" variant="light" color="blue">
                      {option.icon}
                    </ThemeIcon>
                    <Stack gap={2}>
                      <Text fw={700}>{option.label}</Text>
                      <Text size="xs" c="dimmed">
                        {option.description}
                      </Text>
                    </Stack>
                  </Group>
                </Paper>
              )
            })}
          </SimpleGrid>

          <Box>
            <Text fw={600}>Initiative</Text>
            <Text size="sm" c="dimmed">
              Choose how strongly the AI drives follow-ups and next steps.
            </Text>
          </Box>
          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
            {initiativeOptions.map((option) => {
              const isSelected = initiativeLevel === option.value
              return (
                <Paper
                  key={option.value}
                  withBorder
                  p="md"
                  radius="lg"
                  data-tour-id={`style-initiative-${option.value.toLowerCase()}`}
                  className={`${classes.optionCard} ${
                    isSelected ? classes.optionCardSelected : ''
                  }`}
                  onClick={() => setInitiativeLevel(option.value)}
                >
                  <Group align="center" gap="sm">
                    <ThemeIcon size="lg" radius="md" variant="light" color="blue">
                      {option.icon}
                    </ThemeIcon>
                    <Stack gap={2}>
                      <Text fw={700}>{option.label}</Text>
                      <Text size="xs" c="dimmed">
                        {option.description}
                      </Text>
                    </Stack>
                  </Group>
                </Paper>
              )
            })}
          </SimpleGrid>

          <Box>
            <Text fw={600}>Difficulty</Text>
            <Text size="sm" c="dimmed">
              Pick the challenge band for this session.
            </Text>
          </Box>
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
            {difficultyOptions.map((option) => {
              const isSelected = difficulty === option.value
              return (
                <Paper
                  key={option.label}
                  withBorder
                  p="md"
                  radius="lg"
                  data-tour-id={`style-difficulty-${option.label.toLowerCase().replace(/\s+/g, '-')}`}
                  className={`${classes.optionCard} ${
                    isSelected ? classes.optionCardSelected : ''
                  }`}
                  onClick={() => setDifficulty(option.value)}
                >
                  <Group align="center" gap="sm">
                    <ThemeIcon size="lg" radius="md" variant="light" color="blue">
                      {option.icon}
                    </ThemeIcon>
                    <Stack gap={2}>
                      <Text fw={700}>{option.label}</Text>
                      <Text size="xs" c="dimmed">
                        Range {option.range}
                      </Text>
                    </Stack>
                  </Group>
                  <Text size="xs" c="dimmed" mt="sm">
                    {option.description}
                  </Text>
                </Paper>
              )
            })}
          </SimpleGrid>

          <Box>
            <Text fw={600}>Multi-turn mode</Text>
            <Text size="sm" c="dimmed">
              Allow back-and-forth exploration or single-shot prompts.
            </Text>
          </Box>
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            {[
              { value: true, label: 'Enabled', description: 'Interactive, multi-turn flow.' },
              { value: false, label: 'Single turn', description: 'One prompt per response.' },
            ].map((option) => {
              const isSelected = multiTurnEnabled === option.value
              return (
                <Paper
                  key={option.label}
                  withBorder
                  p="md"
                  radius="lg"
                  className={`${classes.optionCard} ${
                    isSelected ? classes.optionCardSelected : ''
                  }`}
                  onClick={() => setMultiTurnEnabled(option.value)}
                >
                  <Text fw={700}>{option.label}</Text>
                  <Text size="xs" c="dimmed">
                    {option.description}
                  </Text>
                </Paper>
              )
            })}
          </SimpleGrid>
        </Stack>
      </Paper>
    </Stack>
  )
}
