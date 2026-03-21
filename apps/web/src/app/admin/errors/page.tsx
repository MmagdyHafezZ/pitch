'use client'

import { useState } from 'react'
import {
  Title,
  Text,
  Table,
  Card,
  Group,
  Stack,
  Badge,
  ActionIcon,
  Button,
  Select,
  Center,
  ThemeIcon,
} from '@mantine/core'
import { IconAlertTriangle, IconTrash, IconX } from '@tabler/icons-react'
import { useErrorLogStore, type ApiError } from '../stores/error-log.store'

const METHOD_OPTIONS = [
  { value: '', label: 'All Methods' },
  { value: 'GET', label: 'GET' },
  { value: 'POST', label: 'POST' },
  { value: 'PUT', label: 'PUT' },
  { value: 'PATCH', label: 'PATCH' },
  { value: 'DELETE', label: 'DELETE' },
]

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: '4xx', label: '4xx Client Errors' },
  { value: '5xx', label: '5xx Server Errors' },
]

const METHOD_COLOR: Record<string, string> = {
  GET: 'blue',
  POST: 'green',
  PUT: 'orange',
  PATCH: 'yellow',
  DELETE: 'red',
}

function statusColor(status: number): string {
  if (status >= 500) return 'red'
  if (status >= 400) return 'orange'
  return 'gray'
}

export default function ErrorsPage() {
  const errors = useErrorLogStore((s) => s.errors)
  const removeError = useErrorLogStore((s) => s.removeError)
  const clearErrors = useErrorLogStore((s) => s.clearErrors)

  const [methodFilter, setMethodFilter] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('')

  const filtered = errors.filter((e: ApiError) => {
    if (methodFilter && e.method !== methodFilter) return false
    if (statusFilter === '4xx' && (e.status < 400 || e.status >= 500)) return false
    if (statusFilter === '5xx' && e.status < 500) return false
    return true
  })

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-end">
        <div>
          <Title order={2} fw={700}>
            API Error Log
          </Title>
          <Text c="dimmed" size="sm" mt={4}>
            Session-scoped log of 4xx/5xx API errors
          </Text>
        </div>
        <Button
          variant="subtle"
          color="red"
          leftSection={<IconTrash size={16} />}
          onClick={clearErrors}
          disabled={errors.length === 0}
        >
          Clear All
        </Button>
      </Group>

      <Group gap="sm">
        <Select
          placeholder="Filter by method"
          data={METHOD_OPTIONS}
          value={methodFilter}
          onChange={(v) => setMethodFilter(v ?? '')}
          clearable
          w={160}
        />
        <Select
          placeholder="Filter by status"
          data={STATUS_OPTIONS}
          value={statusFilter}
          onChange={(v) => setStatusFilter(v ?? '')}
          clearable
          w={180}
        />
      </Group>

      <Card withBorder radius="md" p={0}>
        {filtered.length === 0 ? (
          <Center py={60}>
            <Stack align="center" gap="sm">
              <ThemeIcon size="xl" variant="light" color="teal" radius="xl">
                <IconAlertTriangle size={24} />
              </ThemeIcon>
              <Text c="dimmed" size="sm">
                No errors recorded this session
              </Text>
            </Stack>
          </Center>
        ) : (
          <Table striped highlightOnHover withColumnBorders={false}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Timestamp</Table.Th>
                <Table.Th>Method</Table.Th>
                <Table.Th>Endpoint</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Message</Table.Th>
                <Table.Th w={48} />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filtered.map((error: ApiError) => (
                <Table.Tr key={error.id}>
                  <Table.Td>
                    <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
                      {new Date(error.timestamp).toLocaleTimeString()}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge size="sm" variant="light" color={METHOD_COLOR[error.method] ?? 'gray'}>
                      {error.method}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" ff="monospace">
                      {error.endpoint}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge size="sm" variant="light" color={statusColor(error.status)}>
                      {error.status}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" lineClamp={1}>
                      {error.message}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <ActionIcon
                      variant="subtle"
                      color="gray"
                      size="sm"
                      onClick={() => removeError(error.id)}
                    >
                      <IconX size={14} />
                    </ActionIcon>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Card>
    </Stack>
  )
}
