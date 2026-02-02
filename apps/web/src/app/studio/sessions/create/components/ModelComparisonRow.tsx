import { Group, Stack, Text, Badge } from '@mantine/core'
import { IconCheck } from '@tabler/icons-react'
import type { LLMModelDetail } from '@/features/sessions/types/sessions.types'

interface ModelComparisonRowProps {
  model: LLMModelDetail
}

export function ModelComparisonRow({ model }: ModelComparisonRowProps) {
  const formatPrice = (price: number | undefined) => {
    if (price === undefined || price === 0) return 'Contact Sales'
    return `$${price.toFixed(2)}`
  }

  const formatContextWindow = (tokens: number) => {
    if (tokens >= 1000000) {
      return `${(tokens / 1000000).toFixed(1)}M`
    } else if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(0)}K`
    }
    return tokens.toString()
  }

  return (
    <Stack gap="xs">
      <Text fw={600}>{model.name}</Text>

      <Group gap="md">
        <Text size="sm" c="dimmed">
          Context: {formatContextWindow(model.maxTokens)}
        </Text>
        <Text size="sm" c="dimmed">
          •
        </Text>
        <Text size="sm" c="dimmed">
          {formatPrice(model.pricing.inputTokensPerMillion)}/
          {formatPrice(model.pricing.outputTokensPerMillion)} per 1M tokens
        </Text>
      </Group>

      <Group gap="xs">
        {model.supportsStreaming && (
          <Badge size="xs" variant="light" color="green" leftSection={<IconCheck size={12} />}>
            Streaming
          </Badge>
        )}
        {model.supportsTools && (
          <Badge size="xs" variant="light" color="blue" leftSection={<IconCheck size={12} />}>
            Tools
          </Badge>
        )}
        {model.supportsVision && (
          <Badge size="xs" variant="light" color="purple" leftSection={<IconCheck size={12} />}>
            Vision
          </Badge>
        )}
        {model.supportsAudio && (
          <Badge size="xs" variant="light" color="orange" leftSection={<IconCheck size={12} />}>
            Audio
          </Badge>
        )}
      </Group>
    </Stack>
  )
}
