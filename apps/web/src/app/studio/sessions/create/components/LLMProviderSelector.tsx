import { Card, Group, Stack, Text, Badge, Radio } from '@mantine/core'
import type { LLMProviderInfo } from '@/features/sessions/types/sessions.types'

interface LLMProviderSelectorProps {
  providers: LLMProviderInfo[]
  selectedProvider: string | null
  onProviderChange: (provider: string) => void
}

export function LLMProviderSelector({
  providers,
  selectedProvider,
  onProviderChange,
}: LLMProviderSelectorProps) {
  const enabledProviders = providers.filter((p) => p.enabled)

  if (enabledProviders.length === 0) {
    return (
      <Text c="dimmed" ta="center">
        No LLM providers available
      </Text>
    )
  }

  return (
    <Stack gap="md">
      <Radio.Group value={selectedProvider || ''} onChange={onProviderChange}>
        <Group gap="md">
          {enabledProviders.map((provider) => {
            const isSelected = selectedProvider === provider.name
            return (
              <Card
                key={provider.name}
                withBorder
                padding="md"
                radius="md"
                style={{
                  cursor: 'pointer',
                  border: isSelected
                    ? '2px solid var(--mantine-color-dark-6)'
                    : 'var(--mantine-color-dark-7)',
                  backgroundColor: isSelected
                    ? 'var(--mantine-color-dark-6)'
                    : 'var(--mantine-color-dark-7)',
                  flex: '1 1 0',
                  minWidth: '200px',
                }}
                onClick={() => onProviderChange(provider.name)}
              >
                <Stack gap="xs" align="center">
                  <Radio value={provider.name} label="" style={{ cursor: 'pointer' }} />
                  <Text fw={600} size="lg" tt="capitalize">
                    {provider.name}
                  </Text>
                  <Badge size="sm" variant="light">
                    {provider.models.length} models
                  </Badge>
                </Stack>
              </Card>
            )
          })}
        </Group>
      </Radio.Group>
    </Stack>
  )
}
