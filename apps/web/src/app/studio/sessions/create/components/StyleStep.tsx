'use client'

import { Stack, Group, Box, Title, Text, Paper, SimpleGrid, ThemeIcon, Slider } from '@mantine/core'
import {
  IconAdjustments,
  IconBriefcase,
  IconShieldCheck,
  IconMoodSmile,
  IconCoffee,
  IconLeaf,
  IconMountain,
  IconFlame,
  IconCrown,
} from '@tabler/icons-react'
import classes from '../create-session.module.css'

interface StyleStepProps {
  tone: string
  setTone: (value: string) => void
  speechRate: string
  setSpeechRate: (value: string) => void
  difficulty: number
  setDifficulty: (value: number) => void
  multiTurnEnabled: boolean
  setMultiTurnEnabled: (value: boolean) => void
}

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
  tone,
  setTone,
  speechRate,
  setSpeechRate,
  difficulty,
  setDifficulty,
  multiTurnEnabled,
  setMultiTurnEnabled,
}: StyleStepProps) {
  const speechRateValue = speechRate === 'Slow' ? 0 : speechRate === 'Fast' ? 100 : 50

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
        Accent and voice are inherited from the persona you selected.
      </Text>

      <Paper withBorder p="md" radius="lg" className={classes.styleCard}>
        <Stack gap="lg">
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
              Set the cadence for responses.
            </Text>
          </Box>
          <Paper withBorder p="md" radius="lg" className={classes.speechRateCard}>
            <Slider
              value={speechRateValue}
              onChange={(value) => {
                const next = value <= 25 ? 'Slow' : value >= 75 ? 'Fast' : 'Normal'
                setSpeechRate(next)
              }}
              min={0}
              max={100}
              step={25}
              marks={[
                { value: 0, label: 'Slow' },
                { value: 50, label: 'Normal' },
                { value: 100, label: 'Fast' },
              ]}
              color="blue"
            />
            <Text size="xs" c="dimmed" mt="sm">
              Current pace: {speechRate}
            </Text>
          </Paper>

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
