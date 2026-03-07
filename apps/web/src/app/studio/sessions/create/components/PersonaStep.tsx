'use client'

import {
  Stack,
  Group,
  Box,
  Title,
  Text,
  Badge,
  Button,
  Loader,
  Alert,
  TextInput,
  ActionIcon,
  Avatar,
  SimpleGrid,
  ThemeIcon,
  Progress,
  Card,
  Paper,
} from '@mantine/core'
import {
  IconChevronLeft,
  IconChevronRight,
  IconSearch,
  IconUser,
  IconHeart,
  IconBolt,
  IconSparkles,
  IconStar,
  IconPlayerPlay,
  IconPlayerPause,
} from '@tabler/icons-react'
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion'
import { Persona, PersonaTraits } from '../lib/types'
import { normalizeMetrics, getVoiceProfile, getRarityColor } from '../lib/helpers'
import classes from '../create-session.module.css'
import { ReactNode, RefObject, useEffect, useRef, useState } from 'react'
import type { TtsProvider } from '@/features/tts'
import { CreatePersonaModal } from './CreatePersonaModal'
import { notifications } from '@mantine/notifications'
import { api } from '@/lib/client'

export const metricIconMap: Record<string, ReactNode> = {
  empathy: <IconHeart size={12} />,
  assertiveness: <IconBolt size={12} />,
  creativity: <IconSparkles size={12} />,
  pacing: <IconStar size={12} />,
}

export const getMetricIcon = (label: string) => {
  const key = label.toLowerCase().replace(/\s+/g, '')
  return metricIconMap[key] ?? null
}

const resolveSignatureTraits = (traits: PersonaTraits | Record<string, unknown>): string[] => {
  const personaTraits = traits as Partial<PersonaTraits>
  const rawValue: unknown = personaTraits.signatureTraits ?? personaTraits.highlights ?? []

  if (Array.isArray(rawValue)) {
    return rawValue
      .filter((value): value is string => typeof value === 'string')
      .map((value) => value.trim())
      .filter(Boolean)
  }

  if (typeof rawValue === 'string') {
    return rawValue
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
  }

  return []
}

const resolvePersonaAvatarUrl = (
  traits: PersonaTraits | Record<string, unknown>
): string | undefined => {
  const personaTraits = traits as Partial<PersonaTraits>
  const avatar = personaTraits.avatar
  return typeof avatar?.imageUrl === 'string' && avatar.imageUrl.trim().length > 0
    ? avatar.imageUrl
    : undefined
}

interface PersonaStepProps {
  personasLoading: boolean
  personas: Persona[]
  filteredPersonas: Persona[]
  personaSearch: string
  setPersonaSearch: (value: string) => void
  scrollPersona: (direction: 'left' | 'right') => void
  personaScrollRef: RefObject<HTMLDivElement | null>
  selectedPersona: string | null
  setSelectedPersona: (id: string | null) => void
  errors: Record<string, string>
  selectedPersonaData: Persona | null
  ttsProviders: TtsProvider[]
  onCreatePersona: (input: { name: string; traits: PersonaTraits }) => Promise<Persona>
  createDisabledReason?: string | null
}

export function PersonaStep({
  personasLoading,
  personas,
  filteredPersonas,
  personaSearch,
  setPersonaSearch,
  scrollPersona,
  personaScrollRef,
  selectedPersona,
  setSelectedPersona,
  errors,
  selectedPersonaData,
  ttsProviders,
  onCreatePersona,
  createDisabledReason,
}: PersonaStepProps) {
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [previewLoadingPersonaId, setPreviewLoadingPersonaId] = useState<string | null>(null)
  const [playingPersonaId, setPlayingPersonaId] = useState<string | null>(null)
  const previewAudioRef = useRef<HTMLAudioElement | null>(null)
  const previewUrlRef = useRef<string | null>(null)
  const visiblePersonas = filteredPersonas.filter((persona) => persona.id !== selectedPersona)

  const clearPreviewUrl = () => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
      previewUrlRef.current = null
    }
  }

  const stopPreviewAudio = () => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause()
      previewAudioRef.current.src = ''
      previewAudioRef.current = null
    }
    clearPreviewUrl()
    setPlayingPersonaId(null)
  }

  useEffect(() => {
    return () => {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause()
        previewAudioRef.current.src = ''
        previewAudioRef.current = null
      }
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current)
        previewUrlRef.current = null
      }
    }
  }, [])

  const handlePreviewAudio = async (persona: Persona) => {
    if (playingPersonaId === persona.id) {
      stopPreviewAudio()
      return
    }

    setPreviewLoadingPersonaId(persona.id)
    stopPreviewAudio()

    try {
      const audioBlob = await api.personas.getPreviewAudio(persona.id)
      const objectUrl = URL.createObjectURL(audioBlob)
      previewUrlRef.current = objectUrl

      const audio = new Audio(objectUrl)
      previewAudioRef.current = audio
      audio.onended = () => {
        setPlayingPersonaId(null)
        clearPreviewUrl()
      }
      audio.onerror = () => {
        setPlayingPersonaId(null)
        clearPreviewUrl()
      }

      await audio.play()
      setPlayingPersonaId(persona.id)
    } catch (error) {
      notifications.show({
        title: 'Preview unavailable',
        message: error instanceof Error ? error.message : 'Unable to load persona preview audio.',
        color: 'red',
      })
    } finally {
      setPreviewLoadingPersonaId((current) => (current === persona.id ? null : current))
    }
  }

  if (personasLoading) {
    return (
      <Group justify="center" p="xl">
        <Loader />
        <Text c="dimmed">Loading personas...</Text>
      </Group>
    )
  }

  if (personas.length === 0) {
    return (
      <Stack gap="md">
        <Alert color="yellow" title="No personas available">
          No personas found yet. Create one to continue.
        </Alert>
        <Button
          variant="light"
          onClick={() => setCreateModalOpen(true)}
          disabled={Boolean(createDisabledReason)}
        >
          Create Persona Here
        </Button>
        <CreatePersonaModal
          opened={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
          onCreatePersona={onCreatePersona}
          ttsProviders={ttsProviders}
          createDisabledReason={createDisabledReason}
        />
      </Stack>
    )
  }

  return (
    <LayoutGroup>
      <Stack gap="md">
        <Group justify="space-between" align="center">
          <Box>
            <Title order={3}>Select AI Persona</Title>
            <Text size="sm" c="dimmed">
              Match the persona to your training scenario.
            </Text>
          </Box>
          <Group gap="sm">
            {selectedPersona && (
              <Badge size="lg" variant="light">
                Persona selected
              </Badge>
            )}
            <Button variant="light" onClick={() => setCreateModalOpen(true)}>
              Create Persona Here
            </Button>
          </Group>
        </Group>

        <Stack gap="lg">
          <TextInput
            value={personaSearch}
            onChange={(event: { currentTarget: { value: string } }) =>
              setPersonaSearch(event.currentTarget.value)
            }
            placeholder="Search personas by name, role, or archetype"
            leftSection={<IconSearch size={16} />}
          />
          <Box className={classes.personaCarousel}>
            <ActionIcon
              variant="light"
              size="lg"
              className={`${classes.personaArrow} ${classes.personaArrowLeft}`}
              onClick={() => scrollPersona('left')}
            >
              <IconChevronLeft size={18} />
            </ActionIcon>
            <ActionIcon
              variant="light"
              size="lg"
              className={`${classes.personaArrow} ${classes.personaArrowRight}`}
              onClick={() => scrollPersona('right')}
            >
              <IconChevronRight size={18} />
            </ActionIcon>
            <div ref={personaScrollRef} className={classes.personaTrack}>
              <AnimatePresence mode="popLayout">
                {visiblePersonas.length === 0 ? (
                  <Box className={classes.personaEmptyInline}>
                    <Text size="sm" c="dimmed">
                      {selectedPersonaData
                        ? 'Your selected persona is shown below. Adjust the search or create another persona to compare more options.'
                        : 'No personas match your search.'}
                    </Text>
                  </Box>
                ) : (
                  visiblePersonas.map((persona) => {
                    const traits = persona.traits ?? {}
                    const metrics = normalizeMetrics(traits)
                    const signatureTraits = resolveSignatureTraits(traits)
                    const voiceProfile = getVoiceProfile(traits)
                    const archetype = traits.archetype ?? traits.role ?? 'Persona'
                    const rarity = traits.rarity ?? 'Standard'
                    const rarityColor = getRarityColor(rarity, traits.rarityColor)
                    const miniMetrics = metrics.slice(0, 2)
                    const avatarUrl = resolvePersonaAvatarUrl(traits)
                    const isPreviewLoading = previewLoadingPersonaId === persona.id
                    const isPreviewPlaying = playingPersonaId === persona.id

                    return (
                      <motion.div
                        key={persona.id}
                        layout
                        initial={{ opacity: 0, y: 16, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 12, scale: 0.96 }}
                        transition={{ duration: 0.24, ease: 'easeOut' }}
                        style={{ flexShrink: 0 }}
                      >
                        <Card
                          withBorder
                          padding="md"
                          radius="xl"
                          data-selected="false"
                          className={`${classes.selectionCard} ${classes.personaCard}`}
                          onClick={() => {
                            setSelectedPersona(persona.id)
                          }}
                          style={{ height: '100%', overflow: 'hidden' }}
                        >
                          <Stack gap="sm" className={classes.personaStack}>
                            <Group
                              justify="space-between"
                              align="flex-start"
                              className={classes.personaHeader}
                            >
                              <Group gap="sm">
                                <Box pos="relative">
                                  <Avatar size={64} radius="md" src={avatarUrl}>
                                    <IconUser size={30} />
                                  </Avatar>
                                </Box>
                                <Stack gap={2}>
                                  <Text fw={700} size="sm">
                                    {persona.name}
                                  </Text>
                                  <Text size="xs" c="dimmed">
                                    {traits.role ?? 'AI Persona'} · {traits.level ?? 'Expert'}
                                  </Text>
                                </Stack>
                              </Group>
                              <Stack gap={4} align="flex-end">
                                <ActionIcon
                                  size="sm"
                                  variant="light"
                                  color={isPreviewPlaying ? 'red' : 'brand'}
                                  loading={isPreviewLoading}
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    void handlePreviewAudio(persona)
                                  }}
                                  title={
                                    isPreviewPlaying
                                      ? 'Pause persona preview audio'
                                      : 'Play persona preview audio'
                                  }
                                >
                                  {isPreviewPlaying ? (
                                    <IconPlayerPause size={14} />
                                  ) : (
                                    <IconPlayerPlay size={14} />
                                  )}
                                </ActionIcon>
                                <Badge size="xs" variant="light">
                                  {archetype}
                                </Badge>
                                <Badge size="xs" variant="outline" color={rarityColor}>
                                  {rarity}
                                </Badge>
                              </Stack>
                            </Group>

                            {traits.personality && (
                              <Text size="xs" c="dimmed" className={classes.personaFlavorClamp}>
                                {traits.personality}
                              </Text>
                            )}

                            <Group gap="xs" className={classes.personaVoice}>
                              <Badge size="xs" variant="light">
                                Voice
                              </Badge>
                              <Text size="xs" c="dimmed">
                                {voiceProfile}
                              </Text>
                            </Group>

                            {miniMetrics.length > 0 && (
                              <SimpleGrid
                                cols={2}
                                spacing="xs"
                                className={classes.personaMiniMetrics}
                              >
                                {miniMetrics.map((metric) => (
                                  <Box key={metric.label} className={classes.personaMetric}>
                                    <Group justify="space-between" align="center" mb={4}>
                                      <Group gap={6}>
                                        <ThemeIcon size="xs" variant="light">
                                          {getMetricIcon(metric.label) ?? <IconStar size={12} />}
                                        </ThemeIcon>
                                        <Text size="xs">{metric.label}</Text>
                                      </Group>
                                      <Text size="xs" c="dimmed">
                                        {metric.value}
                                      </Text>
                                    </Group>
                                    <Progress value={metric.value} size="xs" radius="xl" />
                                  </Box>
                                ))}
                              </SimpleGrid>
                            )}

                            {signatureTraits.length > 0 && (
                              <Group gap={6} className={classes.personaTraits}>
                                {signatureTraits.slice(0, 2).map((trait) => (
                                  <Badge key={trait} size="xs" variant="light" color="gray">
                                    {trait}
                                  </Badge>
                                ))}
                              </Group>
                            )}
                          </Stack>
                        </Card>
                      </motion.div>
                    )
                  })
                )}
              </AnimatePresence>
            </div>
          </Box>

          <div className={classes.personaDropzone}>
            <AnimatePresence initial={false}>
              {selectedPersonaData ? (
                (() => {
                  const traits = (selectedPersonaData.traits ?? {}) as PersonaTraits
                  const metrics = normalizeMetrics(traits)
                  const signatureTraits = resolveSignatureTraits(traits)
                  const voiceProfile = getVoiceProfile(traits)
                  const archetype = traits.archetype ?? traits.role ?? 'Persona'
                  const rarity = traits.rarity ?? 'Standard'
                  const rarityColor = getRarityColor(rarity, traits.rarityColor)
                  const avatarUrl = resolvePersonaAvatarUrl(traits)
                  const isPreviewLoading = previewLoadingPersonaId === selectedPersonaData.id
                  const isPreviewPlaying = playingPersonaId === selectedPersonaData.id

                  return (
                    <Paper
                      withBorder
                      radius="xl"
                      p="lg"
                      className={`${classes.personaPreview} ${classes.personaSelectedCard}`}
                      onClick={() => setSelectedPersona(null)}
                    >
                      <Stack gap="md">
                        <Group align="center" className={classes.personaPreviewHeader}>
                          <Avatar size={72} radius="lg" src={avatarUrl}>
                            <IconUser size={34} />
                          </Avatar>
                          <Stack gap={2}>
                            <Text fw={700}>{selectedPersonaData.name}</Text>
                            <Text size="xs" c="dimmed">
                              {traits.role ?? 'AI Persona'} · {traits.level ?? 'Expert'}
                            </Text>
                            <Group gap={6}>
                              <Badge size="xs" variant="light">
                                {archetype}
                              </Badge>
                              <Badge size="xs" variant="outline" color={rarityColor}>
                                {rarity}
                              </Badge>
                              <Button
                                size="xs"
                                variant={isPreviewPlaying ? 'filled' : 'light'}
                                color={isPreviewPlaying ? 'red' : 'brand'}
                                loading={isPreviewLoading}
                                leftSection={
                                  isPreviewPlaying ? (
                                    <IconPlayerPause size={14} />
                                  ) : (
                                    <IconPlayerPlay size={14} />
                                  )
                                }
                                onClick={(event) => {
                                  event.stopPropagation()
                                  void handlePreviewAudio(selectedPersonaData)
                                }}
                              >
                                {isPreviewPlaying ? 'Stop voice' : 'Play voice'}
                              </Button>
                            </Group>
                          </Stack>
                        </Group>

                        {traits.personality && (
                          <Text size="sm" c="dimmed" className={classes.personaPreviewBio}>
                            {traits.personality}
                          </Text>
                        )}

                        <Box className={classes.personaPreviewBlock}>
                          <Text size="xs" fw={600}>
                            Voice Profile
                          </Text>
                          <Text size="sm" c="dimmed">
                            {voiceProfile}
                          </Text>
                          {traits.voice?.provider && (
                            <Text size="xs" c="dimmed">
                              Provider: {traits.voice.provider}
                            </Text>
                          )}
                          {traits.voice?.voiceName && (
                            <Text size="xs" c="dimmed">
                              Voice: {traits.voice.voiceName}
                            </Text>
                          )}
                          {traits.voice?.language && (
                            <Text size="xs" c="dimmed">
                              Accent: {traits.voice.language}
                            </Text>
                          )}
                        </Box>

                        <Box className={classes.personaPreviewBlock}>
                          <Text size="xs" fw={600}>
                            Signature Traits
                          </Text>
                          {signatureTraits.length > 0 ? (
                            <Group gap={6} mt={6}>
                              {signatureTraits.map((trait) => (
                                <Badge key={trait} size="xs" variant="light" color="gray">
                                  {trait}
                                </Badge>
                              ))}
                            </Group>
                          ) : (
                            <Text size="xs" c="dimmed" mt={6}>
                              No signature traits configured.
                            </Text>
                          )}
                        </Box>

                        <Box className={classes.personaPreviewBlock}>
                          <Text size="xs" fw={600}>
                            Comparison Metrics
                          </Text>
                          {metrics.length > 0 ? (
                            <Stack gap="xs" mt="xs">
                              {metrics.map((metric) => (
                                <Box key={metric.label} className={classes.personaMetric}>
                                  <Group justify="space-between" align="center" mb={4}>
                                    <Group gap={6}>
                                      <ThemeIcon size="xs" variant="light">
                                        {getMetricIcon(metric.label) ?? <IconStar size={12} />}
                                      </ThemeIcon>
                                      <Text size="xs">{metric.label}</Text>
                                    </Group>
                                    <Text size="xs" c="dimmed">
                                      {metric.value}
                                    </Text>
                                  </Group>
                                  <Progress value={metric.value} size="xs" radius="xl" />
                                </Box>
                              ))}
                            </Stack>
                          ) : (
                            <Text size="xs" c="dimmed" mt={6}>
                              No metrics configured for this persona yet.
                            </Text>
                          )}
                        </Box>
                      </Stack>
                    </Paper>
                  )
                })()
              ) : (
                <Stack gap="sm" align="center" className={classes.personaEmpty}>
                  <Avatar size={68} radius="lg" variant="light">
                    <IconUser size={28} />
                  </Avatar>
                  <Text fw={600}>Choose your character</Text>
                  <Text size="sm" c="dimmed" ta="center">
                    Select a persona to dock their full dossier here.
                  </Text>
                </Stack>
              )}
            </AnimatePresence>
          </div>

          {errors.persona && (
            <Text c="red" size="sm">
              {errors.persona}
            </Text>
          )}
        </Stack>
        <CreatePersonaModal
          opened={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
          onCreatePersona={onCreatePersona}
          ttsProviders={ttsProviders}
          createDisabledReason={createDisabledReason}
        />
      </Stack>
    </LayoutGroup>
  )
}
