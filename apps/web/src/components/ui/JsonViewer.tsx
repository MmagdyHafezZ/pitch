'use client'

import { Box, Text, Stack } from '@mantine/core'

type JsonViewerProps = {
  data: Record<string, any>
}

export function JsonViewer({ data }: JsonViewerProps) {
  return (
    <Box
      style={{
        backgroundColor: 'var(--mantine-color-dark-6)',
        borderRadius: 'var(--mantine-radius-md)',
        padding: 'var(--mantine-spacing-sm)',
        fontFamily: 'monospace',
        fontSize: 'var(--mantine-font-size-xs)',
        color: 'white',
      }}
    >
      <Stack gap="xs">
        {Object.entries(data).map(([key, value]) => (
          <Box key={key}>
            <Text component="span" c="blue.4" fw={700}>
              {key}:
            </Text>{' '}
            <Text component="span" c="green.4">
              {JSON.stringify(value, null, 2)}
            </Text>
          </Box>
        ))}
      </Stack>
    </Box>
  )
}
