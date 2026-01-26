'use client'

import { useEffect, useState } from 'react'
import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Container,
  Group,
  NumberInput,
  Paper,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { IconAlertCircle, IconArrowLeft, IconCheck, IconPlus, IconX } from '@tabler/icons-react'
import { useParams, useRouter } from 'next/navigation'
import { notifications } from '@mantine/notifications'
import { useSessions, type Session } from '@/features/sessions'

const resolveConfig = (session: Session | null) => {
  if (!session || !session.sessionConfig || typeof session.sessionConfig !== 'object') {
    return {}
  }
  return session.sessionConfig as Record<string, unknown>
}

export default function EditSessionPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const sessionId = Array.isArray(params?.id) ? params.id[0] : params?.id
  const { currentSession, loading, error, fetchSessionById, updateSession } = useSessions()

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [sessionName, setSessionName] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [newTag, setNewTag] = useState('')
  const [language, setLanguage] = useState('en-US')
  const [scenarioId, setScenarioId] = useState('')
  const [personaId, setPersonaId] = useState('')

  const [multiTurnEnabled, setMultiTurnEnabled] = useState(true)
  const [accent, setAccent] = useState('British')
  const [tone, setTone] = useState('Formal')
  const [speechRate, setSpeechRate] = useState('Normal')
  const [difficulty, setDifficulty] = useState(5)

  const session = currentSession?.id === sessionId ? currentSession : null

  useEffect(() => {
    if (!sessionId) return
    fetchSessionById(sessionId)
  }, [sessionId, fetchSessionById])

  useEffect(() => {
    if (!session) return
    setSessionName(session.name ?? '')
    setTags(session.tags ?? [])
    setLanguage(session.language ?? 'en-US')
    setScenarioId(session.scenarioId ?? '')
    setPersonaId(session.personaId ?? '')

    const config = resolveConfig(session)
    setMultiTurnEnabled(
      typeof config.multiTurnEnabled === 'boolean' ? config.multiTurnEnabled : true
    )
    setAccent(typeof config.accent === 'string' ? config.accent : 'British')
    setTone(typeof config.tone === 'string' ? config.tone : 'Formal')
    setSpeechRate(typeof config.speechRate === 'string' ? config.speechRate : 'Normal')
    setDifficulty(typeof config.difficulty === 'number' ? config.difficulty : 5)
  }, [session])

  const addTag = () => {
    const next = newTag.trim()
    if (!next || tags.includes(next)) return
    setTags([...tags, next])
    setNewTag('')
  }

  const removeTag = (tag: string) => {
    setTags(tags.filter((item) => item !== tag))
  }

  const handleSubmit = async () => {
    if (!sessionId || !session) return
    setIsSubmitting(true)

    try {
      const baseConfig = resolveConfig(session)
      const sessionConfig = {
        ...baseConfig,
        multiTurnEnabled,
        accent,
        tone,
        speechRate,
        difficulty,
      }

      await updateSession(sessionId, {
        name: sessionName.trim() || undefined,
        tags,
        language: language || undefined,
        scenarioId: scenarioId.trim() || undefined,
        personaId: personaId.trim() || undefined,
        sessionConfig,
      })

      notifications.show({
        title: 'Saved',
        message: 'Session updated successfully.',
        color: 'green',
        icon: <IconCheck size={16} />,
      })

      router.push('/studio/sessions')
    } catch (err) {
      notifications.show({
        title: 'Error',
        message: err instanceof Error ? err.message : 'Failed to update session',
        color: 'red',
        icon: <IconAlertCircle size={16} />,
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Container size="lg" py="xl">
      <Group mb="xl">
        <ActionIcon variant="subtle" size="lg" onClick={() => router.push('/studio/sessions')}>
          <IconArrowLeft size={20} />
        </ActionIcon>
        <Title order={1}>Edit Session</Title>
      </Group>

      {error && (
        <Alert icon={<IconAlertCircle size={16} />} title="Error" color="red" mb="md">
          {error}
        </Alert>
      )}

      {!session && loading ? (
        <Paper shadow="sm" p="xl" radius="md" withBorder>
          <Text c="dimmed">Loading session...</Text>
        </Paper>
      ) : !session ? (
        <Paper shadow="sm" p="xl" radius="md" withBorder>
          <Text c="dimmed">Session not found.</Text>
        </Paper>
      ) : (
        <Paper shadow="sm" p="xl" radius="md" withBorder>
          <Stack gap="lg">
            <Group justify="space-between" align="center">
              <Box>
                <Title order={3}>{session.name || 'Untitled session'}</Title>
                <Text size="sm" c="dimmed">
                  {session.id}
                </Text>
              </Box>
              <Badge size="lg" variant="light">
                {session.type}
              </Badge>
            </Group>

            <TextInput
              label="Session Name"
              value={sessionName}
              onChange={(event) => setSessionName(event.currentTarget.value)}
              placeholder="Give this session a name"
            />

            <Select
              label="Language"
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

            <Group grow>
              <TextInput
                label="Scenario ID"
                value={scenarioId}
                onChange={(event) => setScenarioId(event.currentTarget.value)}
              />
              <TextInput
                label="Persona ID"
                value={personaId}
                onChange={(event) => setPersonaId(event.currentTarget.value)}
              />
            </Group>

            <Box>
              <Text size="sm" fw={500} mb={4}>
                Tags
              </Text>
              <Group gap="xs" mb="xs">
                {tags.map((tag) => (
                  <Paper key={tag} px="sm" py={4} withBorder>
                    <Group gap={4}>
                      <Text size="sm">{tag}</Text>
                      <ActionIcon
                        size="xs"
                        variant="subtle"
                        color="gray"
                        onClick={() => removeTag(tag)}
                      >
                        <IconX size={12} />
                      </ActionIcon>
                    </Group>
                  </Paper>
                ))}
              </Group>
              <Group gap="xs">
                <TextInput
                  placeholder="Add a tag"
                  value={newTag}
                  onChange={(event) => setNewTag(event.currentTarget.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      addTag()
                    }
                  }}
                  style={{ flex: 1 }}
                />
                <Button onClick={addTag} leftSection={<IconPlus size={16} />}>
                  Add
                </Button>
              </Group>
            </Box>

            <Box>
              <Title order={4} mb="sm">
                Session Configuration
              </Title>
              <Stack gap="md">
                <Select
                  label="Accent"
                  value={accent}
                  onChange={(value) => setAccent(value || 'British')}
                  data={[
                    { value: 'British', label: 'British' },
                    { value: 'American', label: 'American' },
                    { value: 'Australian', label: 'Australian' },
                    { value: 'Canadian', label: 'Canadian' },
                  ]}
                />

                <Select
                  label="Tone"
                  value={tone}
                  onChange={(value) => setTone(value || 'Formal')}
                  data={[
                    { value: 'Formal', label: 'Formal' },
                    { value: 'Casual', label: 'Casual' },
                    { value: 'Friendly', label: 'Friendly' },
                    { value: 'Professional', label: 'Professional' },
                  ]}
                />

                <Select
                  label="Speech Rate"
                  value={speechRate}
                  onChange={(value) => setSpeechRate(value || 'Normal')}
                  data={[
                    { value: 'Slow', label: 'Slow' },
                    { value: 'Normal', label: 'Normal' },
                    { value: 'Fast', label: 'Fast' },
                  ]}
                />

                <NumberInput
                  label="Difficulty"
                  value={difficulty}
                  onChange={(value) => setDifficulty(Number(value))}
                  min={1}
                  max={10}
                />

                <Select
                  label="Multi-turn Enabled"
                  value={multiTurnEnabled ? 'yes' : 'no'}
                  onChange={(value) => setMultiTurnEnabled(value === 'yes')}
                  data={[
                    { value: 'yes', label: 'Yes' },
                    { value: 'no', label: 'No' },
                  ]}
                />
              </Stack>
            </Box>

            <Group justify="flex-end">
              <Button variant="default" onClick={() => router.push('/studio/sessions')}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                loading={isSubmitting || loading}
                leftSection={<IconCheck size={16} />}
              >
                Save Changes
              </Button>
            </Group>
          </Stack>
        </Paper>
      )}
    </Container>
  )
}
