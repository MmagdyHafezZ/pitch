'use client'

import {
  SimpleGrid,
  Paper,
  Stack,
  Group,
  ThemeIcon,
  Text,
  Divider,
  Badge,
  Grid,
  TextInput,
  Select,
  TagsInput,
} from '@mantine/core'
import { ReactNode } from 'react'
import {
  IconInfoCircle,
  IconMessage,
  IconMicrophone,
  IconPhone,
  IconVideo,
} from '@tabler/icons-react'
import type { SessionType } from '@/features/sessions'
import classes from '../create-session.module.css'

interface Team {
  id: string
  name: string
}

interface BasicsStepProps {
  sessionType: SessionType | null
  setSessionType: (value: SessionType) => void
  errors: Record<string, string>
  sessionName: string
  setSessionName: (value: string) => void
  teamsLoading: boolean
  selectedTeamId: string | null
  setSelectedTeamId: (value: string | null) => void
  teams: Team[]
  language: string
  setLanguage: (value: string) => void
  tags: string[]
  setTags: (value: string[]) => void
}

const sessionTypeOptions: Array<{
  value: SessionType
  label: string
  description: string
  hint: string
  icon: ReactNode
}> = [
  {
    value: 'text',
    label: 'Text',
    description: 'Fast, flexible, transcript-first',
    hint: 'Great for rapid iteration',
    icon: <IconMessage size={20} />,
  },
  {
    value: 'voice',
    label: 'Voice',
    description: 'Browser mic conversation with TTS',
    hint: 'Uses your mic and speakers, not your phone',
    icon: <IconMicrophone size={20} />,
  },
  {
    value: 'video',
    label: 'Video',
    description: 'Full presence, high immersion',
    hint: 'Ideal for high-stakes training',
    icon: <IconVideo size={20} />,
  },
  {
    value: 'phone',
    label: 'Phone calls',
    description: 'Rings your verified phone number',
    hint: 'Best for real dial-out practice',
    icon: <IconPhone size={20} />,
  },
]

export function BasicsStep({
  sessionType,
  setSessionType,
  errors,
  sessionName,
  setSessionName,
  teamsLoading,
  selectedTeamId,
  setSelectedTeamId,
  teams,
  language,
  setLanguage,
  tags,
  setTags,
}: BasicsStepProps) {
  return (
    <Stack gap="lg">
      <Stack gap="xs">
        <Text fw={700}>Pick a session type</Text>
        <Text size="sm" c="dimmed">
          Start with the format that matches your training goal.
        </Text>
      </Stack>
      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
        {sessionTypeOptions.map((option) => {
          const isSelected = sessionType === option.value
          return (
            <Paper
              key={option.value}
              data-tour-id={`session-type-${option.value}`}
              withBorder
              p="md"
              radius="lg"
              className={classes.selectionCard}
              onClick={() => setSessionType(option.value)}
              style={{
                cursor: 'pointer',
                border: isSelected
                  ? '2px solid var(--mantine-color-blue-6)'
                  : '1px solid var(--mantine-color-dark-5)',
                background: isSelected
                  ? 'linear-gradient(135deg, color-mix(in srgb, var(--mantine-color-blue-6) 20%, var(--mantine-color-dark-8)), var(--mantine-color-dark-8))'
                  : 'var(--mantine-color-dark-8)',
                boxShadow: isSelected
                  ? '0 10px 24px color-mix(in srgb, var(--mantine-color-blue-6) 30%, transparent)'
                  : undefined,
              }}
            >
              <Stack gap="sm">
                <Group align="center" gap="sm">
                  <ThemeIcon
                    size="lg"
                    radius="md"
                    color={isSelected ? 'blue' : 'gray'}
                    variant={isSelected ? 'filled' : 'light'}
                  >
                    {option.icon}
                  </ThemeIcon>
                  <Stack gap={2}>
                    <Text fw={700}>{option.label}</Text>
                    <Text size="xs" c="dimmed">
                      {option.description}
                    </Text>
                  </Stack>
                </Group>
                <Text size="xs" c="dimmed">
                  {option.hint}
                </Text>
              </Stack>
            </Paper>
          )
        })}
      </SimpleGrid>
      {errors.sessionType && (
        <Text c="red" size="sm">
          {errors.sessionType}
        </Text>
      )}

      <Divider my="sm" />

      <Paper className={classes.basicsDetailCard} p="md" radius="lg" withBorder>
        <Stack gap="md">
          <Group justify="space-between">
            <Text fw={600}>Session details</Text>
            <Badge size="xs" variant="light" color="blue">
              Optional refinements
            </Badge>
          </Group>
          <Grid gutter="md">
            <Grid.Col span={{ base: 12, md: 7 }}>
              <TextInput
                label="Session Name"
                placeholder="Give this session a name"
                value={sessionName}
                onChange={(event) => setSessionName(event.currentTarget.value)}
                description="Optional, but helpful for searching later"
                data-tour-id="create-session-name"
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 5 }}>
              <Select
                label="Team (Optional)"
                placeholder={
                  teamsLoading ? 'Loading teams...' : 'Select a team or leave empty for personal'
                }
                value={selectedTeamId === '' ? null : selectedTeamId}
                onChange={(value) => {
                  setSelectedTeamId(value || null)
                }}
                data={[
                  { value: '', label: 'Personal Session (No Team)' },
                  ...teams.map((team) => ({
                    value: team.id,
                    label: team.name,
                  })),
                ]}
                disabled={teamsLoading}
                searchable
                clearable
              />
            </Grid.Col>
            {sessionType === 'phone' && (
              <Grid.Col span={12}>
                <Paper withBorder radius="md" p="sm" className={classes.inlineInfoCard}>
                  <Group align="flex-start" gap="sm" wrap="nowrap">
                    <IconInfoCircle size={18} className={classes.inlineInfoIcon} />
                    <Stack gap={2}>
                      <Text fw={600} size="sm">
                        Phone number is collected when the session starts
                      </Text>
                      <Text size="xs" c="dimmed">
                        Setup only defines the training format. The caller verifies a number when
                        the session starts, then PITCH dials that verified number.
                      </Text>
                    </Stack>
                  </Group>
                </Paper>
              </Grid.Col>
            )}
            <Grid.Col span={{ base: 12, md: 6 }}>
              <Select
                label="Language"
                placeholder="Select language"
                value={language}
                onChange={(value) => setLanguage(value || 'en-US')}
                data={[
                  { value: 'en-US', label: 'English (US)' },
                  { value: 'en-GB', label: 'English (UK)' },
                  { value: 'es-ES', label: 'Spanish' },
                  { value: 'fr-FR', label: 'French' },
                  { value: 'de-DE', label: 'German' },
                ]}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 6 }}>
              <TagsInput
                label="Tags"
                placeholder="Add tags"
                data={tags}
                value={tags}
                onChange={setTags}
                acceptValueOnBlur
              />
            </Grid.Col>
          </Grid>
        </Stack>
      </Paper>
    </Stack>
  )
}
