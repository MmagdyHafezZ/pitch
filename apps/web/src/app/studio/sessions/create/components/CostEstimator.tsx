import { Paper, Stack, Group, Text } from '@mantine/core'
import { IconCoin } from '@tabler/icons-react'
import type { LLMModelDetail } from '@/features/sessions/types/sessions.types'

interface CostEstimatorProps {
  model: LLMModelDetail | undefined
}

export function CostEstimator({ model }: CostEstimatorProps) {
  if (!model) return null

  const formatCost = (cost: number) => {
    if (cost === 0) return 'Contact Sales'
    return `$${cost.toFixed(2)}`
  }

  // Estimate based on 10K input + 2K output tokens (typical conversation)
  const estimatedInputCost = (model.pricing.inputTokensPerMillion / 1000000) * 10000
  const estimatedOutputCost = (model.pricing.outputTokensPerMillion / 1000000) * 2000
  const estimatedTotalCost = estimatedInputCost + estimatedOutputCost

  return (
    <Paper p="md" withBorder bg="var(--mantine-color-dark-7)" radius="md">
      <Stack gap="xs">
        <Group gap="xs">
          <IconCoin size={20} color="var(--mantine-color-blue-6)" />
          <Text fw={600} size="sm">
            Estimated Cost
          </Text>
        </Group>

        <Group justify="space-between">
          <Text size="sm" c="dimmed">
            Per 1M input tokens:
          </Text>
          <Text size="sm" fw={500}>
            {formatCost(model.pricing.inputTokensPerMillion)}
          </Text>
        </Group>

        <Group justify="space-between">
          <Text size="sm" c="dimmed">
            Per 1M output tokens:
          </Text>
          <Text size="sm" fw={500}>
            {formatCost(model.pricing.outputTokensPerMillion)}
          </Text>
        </Group>

        {estimatedTotalCost > 0 && (
          <>
            <div style={{ borderTop: '1px solid var(--mantine-color-gray-3)', marginTop: 4 }} />
            <Group justify="space-between">
              <Text size="sm" c="dimmed">
                Typical conversation (~12K tokens):
              </Text>
              <Text size="sm" fw={600} c="blue">
                ~{formatCost(estimatedTotalCost)}
              </Text>
            </Group>
          </>
        )}
      </Stack>
    </Paper>
  )
}
