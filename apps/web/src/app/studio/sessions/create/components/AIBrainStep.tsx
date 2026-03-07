'use client'

import {
  Stack,
  Group,
  Box,
  Title,
  Text,
  Badge,
  Loader,
  Alert,
  TextInput,
  ActionIcon,
  Paper,
  ThemeIcon,
} from '@mantine/core'
import {
  IconBrain,
  IconChevronLeft,
  IconChevronRight,
  IconSearch,
  IconBolt,
  IconTool,
  IconEye,
  IconVolume,
} from '@tabler/icons-react'
import { RefObject } from 'react'
import { LLMProviderSelector } from './LLMProviderSelector'
import { CostEstimator } from './CostEstimator'
import { LLMProvider } from '@/features/sessions/hooks/useLLMProviders'
import { getBrainCompatibleModels, getPreferredBrainModel } from '../lib/brain-models'
import classes from '../create-session.module.css'

interface AIBrainStepProps {
  llmProvidersLoading: boolean
  llmProvidersData?: { providers: LLMProvider[] }
  llmProvider: string | null
  setLlmProvider: (value: string | null) => void
  setLlmModel: (value: string | null) => void
  setModelSearch: (value: string) => void
  errors: Record<string, string>
  modelSearch: string
  llmModel: string | null
  scrollModels: (direction: 'left' | 'right') => void
  modelScrollRef: RefObject<HTMLDivElement | null>
}

export function AIBrainStep({
  llmProvidersLoading,
  llmProvidersData,
  llmProvider,
  setLlmProvider,
  setLlmModel,
  setModelSearch,
  errors,
  modelSearch,
  llmModel,
  scrollModels,
  modelScrollRef,
}: AIBrainStepProps) {
  return (
    <Stack gap="md">
      <div className={classes.brainGlow} />
      <div className={`${classes.brainOrb} ${classes.brainOrbA}`} />
      <div className={`${classes.brainOrb} ${classes.brainOrbB}`} />
      <div className={classes.brainScan} />

      <Group align="flex-start" className={classes.brainHeader}>
        <div className={classes.brainIconWrap}>
          <IconBrain size={26} />
        </div>
        <Stack gap={4}>
          <Title order={3}>AI Brain Control Deck</Title>
          <Text size="sm" c="dimmed">
            Pick the core model and tune the balance between quality, speed, and cost.
          </Text>
          <Group gap={6} className={classes.brainBadges}>
            <Badge size="xs" variant="light" color="blue">
              Smart Routing
            </Badge>
            <Badge size="xs" variant="light" color="blue">
              Safe Defaults
            </Badge>
            <Badge size="xs" variant="outline" color="gray">
              Session-aware
            </Badge>
          </Group>
        </Stack>
      </Group>

      {llmProvidersLoading ? (
        <Group justify="center" p="xl">
          <Loader />
          <Text c="dimmed">Loading AI models...</Text>
        </Group>
      ) : !llmProvidersData || llmProvidersData.providers.length === 0 ? (
        <Alert color="yellow" title="No providers available">
          No LLM providers found. Please contact support or try again later.
        </Alert>
      ) : (
        <Stack gap="lg" className={classes.brainContent}>
          <Paper className={classes.brainCard} radius="lg" p="md" withBorder>
            <Group justify="space-between" mb="sm">
              <Text fw={600}>Provider</Text>
              <Badge size="xs" variant="light" color="blue">
                Required
              </Badge>
            </Group>
            <LLMProviderSelector
              providers={llmProvidersData.providers}
              selectedProvider={llmProvider}
              onProviderChange={(provider) => {
                setLlmProvider(provider)
                setLlmModel(null)
                setModelSearch('')
                const selectedProv = llmProvidersData.providers.find((p) => p.name === provider)
                const preferredModel = getPreferredBrainModel(selectedProv)
                if (preferredModel) {
                  setLlmModel(preferredModel.name)
                }
              }}
            />
          </Paper>

          {llmProvider ? (
            (() => {
              const selectedProvider = llmProvidersData.providers.find(
                (p) => p.name === llmProvider
              )
              const compatibleModels = getBrainCompatibleModels(selectedProvider)
              const filteredModels = compatibleModels.filter((model) =>
                model.name.toLowerCase().includes(modelSearch.trim().toLowerCase())
              )
              const hiddenModelCount =
                (selectedProvider?.modelDetails.length ?? 0) - compatibleModels.length

              return (
                <Paper className={classes.brainCard} radius="lg" p="md" withBorder>
                  <Group justify="space-between" mb="sm">
                    <Text fw={600}>Models</Text>
                    <Group gap={6}>
                      <Badge size="xs" variant="light" color="blue">
                        {selectedProvider?.name ?? 'Provider'}
                      </Badge>
                      <Badge size="xs" variant="outline" color="gray">
                        Scroll to compare
                      </Badge>
                    </Group>
                  </Group>
                  <TextInput
                    value={modelSearch}
                    onChange={(event) => setModelSearch(event.currentTarget.value)}
                    placeholder="Search text-generation models"
                    leftSection={<IconSearch size={16} />}
                    mb="md"
                  />
                  {hiddenModelCount > 0 && (
                    <Text size="xs" c="dimmed" mb="sm">
                      {hiddenModelCount} audio, TTS, realtime, or transcription models are hidden
                      from this deck.
                    </Text>
                  )}
                  {filteredModels.length === 0 ? (
                    <Text size="sm" c="dimmed">
                      No matching text-generation models for this provider.
                    </Text>
                  ) : (
                    <Box className={classes.modelCarousel}>
                      <ActionIcon
                        variant="light"
                        color="blue"
                        size="lg"
                        className={`${classes.personaArrow} ${classes.modelArrowLeft}`}
                        onClick={() => scrollModels('left')}
                      >
                        <IconChevronLeft size={18} />
                      </ActionIcon>
                      <ActionIcon
                        variant="light"
                        color="blue"
                        size="lg"
                        className={`${classes.personaArrow} ${classes.modelArrowRight}`}
                        onClick={() => scrollModels('right')}
                      >
                        <IconChevronRight size={18} />
                      </ActionIcon>
                      <div ref={modelScrollRef} className={classes.modelTrack}>
                        {filteredModels.map((model) => {
                          const isSelected = llmModel === model.name
                          return (
                            <Paper
                              key={model.name}
                              withBorder
                              radius="lg"
                              p="md"
                              className={`${classes.modelCard} ${
                                isSelected ? classes.modelCardSelected : ''
                              }`}
                              onClick={() => {
                                setLlmModel(model.name)
                              }}
                            >
                              <Group justify="space-between" align="center">
                                <Text fw={700} size="sm">
                                  {model.name}
                                </Text>
                                {isSelected && (
                                  <Badge size="xs" variant="filled" color="blue">
                                    Selected
                                  </Badge>
                                )}
                              </Group>
                              <Text size="xs" c="dimmed" mt={4}>
                                Max tokens: {model.maxTokens}
                                {model.maxOutputTokens ? ` · Output: ${model.maxOutputTokens}` : ''}
                              </Text>

                              <Group gap={6} mt="sm" className={classes.modelBadges}>
                                {model.supportedModalities.map((modality) => (
                                  <Badge key={modality} size="xs" variant="light" color="blue">
                                    {modality}
                                  </Badge>
                                ))}
                              </Group>

                              <Stack gap={6} mt="sm" className={classes.modelMeta}>
                                <Group gap={8}>
                                  <ThemeIcon size="xs" variant="light" color="blue">
                                    <IconBolt size={12} />
                                  </ThemeIcon>
                                  <Text size="xs" c="dimmed">
                                    Streaming {model.supportsStreaming ? 'enabled' : 'off'}
                                  </Text>
                                </Group>
                                <Group gap={8}>
                                  <ThemeIcon size="xs" variant="light" color="blue">
                                    <IconTool size={12} />
                                  </ThemeIcon>
                                  <Text size="xs" c="dimmed">
                                    Tools {model.supportsTools ? 'supported' : 'off'}
                                  </Text>
                                </Group>
                                <Group gap={8}>
                                  <ThemeIcon size="xs" variant="light" color="blue">
                                    <IconEye size={12} />
                                  </ThemeIcon>
                                  <Text size="xs" c="dimmed">
                                    Vision {model.supportsVision ? 'ready' : 'off'}
                                  </Text>
                                </Group>
                                <Group gap={8}>
                                  <ThemeIcon size="xs" variant="light" color="blue">
                                    <IconVolume size={12} />
                                  </ThemeIcon>
                                  <Text size="xs" c="dimmed">
                                    Audio {model.supportsAudio ? 'ready' : 'off'}
                                  </Text>
                                </Group>
                              </Stack>

                              <Box className={classes.modelPricing}>
                                <Text size="xs" fw={600}>
                                  Pricing
                                </Text>
                                <Text size="xs" c="dimmed">
                                  Input ${model.pricing.inputTokensPerMillion}/M tok
                                </Text>
                                <Text size="xs" c="dimmed">
                                  Output ${model.pricing.outputTokensPerMillion}/M tok
                                </Text>
                                {model.pricing.imageTokens && (
                                  <Text size="xs" c="dimmed">
                                    Images ${model.pricing.imageTokens}/M tok
                                  </Text>
                                )}
                                {model.pricing.audioSecondsToTokens && (
                                  <Text size="xs" c="dimmed">
                                    Audio {model.pricing.audioSecondsToTokens} sec/token
                                  </Text>
                                )}
                              </Box>
                            </Paper>
                          )
                        })}
                      </div>
                    </Box>
                  )}
                </Paper>
              )
            })()
          ) : (
            <Paper className={classes.brainCard} radius="lg" p="md" withBorder>
              <Text size="sm" c="dimmed">
                Choose a provider to browse models.
              </Text>
            </Paper>
          )}

          <Paper className={classes.brainCard} radius="lg" p="md" withBorder>
            <Group justify="space-between" mb="sm">
              <Text fw={600}>Cost & Performance</Text>
              <Badge size="xs" variant="outline" color="blue">
                Live estimate
              </Badge>
            </Group>
            {llmProvider && llmModel ? (
              <CostEstimator
                model={llmProvidersData?.providers
                  .find((p) => p.name === llmProvider)
                  ?.modelDetails.find((m) => m.name === llmModel)}
              />
            ) : (
              <Text size="sm" c="dimmed">
                Select a provider and model to see pricing.
              </Text>
            )}
          </Paper>

          {errors.llmProvider && (
            <Text c="red" size="sm">
              {errors.llmProvider}
            </Text>
          )}
          {errors.llmModel && (
            <Text c="red" size="sm">
              {errors.llmModel}
            </Text>
          )}
        </Stack>
      )}
    </Stack>
  )
}
