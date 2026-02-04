import { useMemo } from 'react'
import { Select, Stack, Paper, Alert } from '@mantine/core'
import { IconAlertCircle } from '@tabler/icons-react'
import type {
  LLMProviderInfo,
  LLMModelDetail,
  SessionType,
} from '@/features/sessions/types/sessions.types'
import { ModelComparisonRow } from './ModelComparisonRow'

interface LLMModelSelectorProps {
  provider: LLMProviderInfo | undefined
  sessionType: SessionType
  selectedModel: string | null
  onModelChange: (model: string) => void
}

export function LLMModelSelector({
  provider,
  sessionType,
  selectedModel,
  onModelChange,
}: LLMModelSelectorProps) {
  const filteredModels = useMemo(() => {
    if (!provider) return []

    // For voice/video sessions, prefer streaming models
    if (sessionType === 'voice' || sessionType === 'video' || sessionType === 'phone') {
      return provider.modelDetails.filter((m) => m.supportsStreaming)
    }

    return provider.modelDetails
  }, [provider, sessionType])

  const selectedModelDetail = useMemo(() => {
    return filteredModels.find((m) => m.name === selectedModel)
  }, [filteredModels, selectedModel])

  const showStreamingWarning =
    (sessionType === 'voice' || sessionType === 'video' || sessionType === 'phone') &&
    selectedModelDetail &&
    !selectedModelDetail.supportsStreaming

  if (!provider) {
    return null
  }

  if (filteredModels.length === 0) {
    return (
      <Alert color="yellow" icon={<IconAlertCircle size={16} />}>
        No compatible models available for {sessionType} sessions. Please select a different
        provider.
      </Alert>
    )
  }

  return (
    <Stack gap="md">
      <Select
        label="Model"
        placeholder="Select a model"
        value={selectedModel}
        onChange={(value) => onModelChange(value || '')}
        data={filteredModels.map((model) => ({
          value: model.name,
          label: model.name,
        }))}
        searchable
        required
        description="Choose the AI model to power your session"
      />

      {selectedModelDetail && (
        <Paper p="md" withBorder>
          <ModelComparisonRow model={selectedModelDetail} />
        </Paper>
      )}

      {showStreamingWarning && (
        <Alert color="yellow" icon={<IconAlertCircle size={16} />}>
          Warning: Selected model doesn&apos;t support streaming. Voice experience may be degraded.
          Consider choosing a streaming-enabled model for better performance.
        </Alert>
      )}
    </Stack>
  )
}
