'use client'

import {
  AppShell,
  Group,
  TextInput,
  Button,
  Select,
  Title,
  Card,
  Stack,
  Text,
  Badge,
  SimpleGrid,
  Box,
} from '@mantine/core'
import { IconSearch } from '@tabler/icons-react'
import { useState } from 'react'

import { AppLayout } from '@/components/layout/AppLayout'
import { AppSidebar } from '@/components/ui/AppSideBar'
import { AppTopBar } from '@/components/ui/AppTopBar'

type Status = 'Upcoming' | 'Pending' | 'Overdue' | 'Completed'
const statusColor: Record<Status, string> = {
  Upcoming: 'blue',
  Pending: 'yellow',
  Overdue: 'red',
  Completed: 'green',
}

function SessionCard({
  title,
  date,
  tags,
  status,
  score,
}: {
  title: string
  date: string
  tags: string[]
  status: Status
  score?: number
}) {
  return (
    <Card withBorder radius="md" padding="md" shadow="sm">
      <Stack gap="xs">
        <Group justify="space-between" align="center">
          <Title order={5}>{title}</Title>
          <Badge color={statusColor[status]} radius="sm" variant="light">
            {status}
          </Badge>
        </Group>
        <Text size="xs" c="dimmed">
          {date}
        </Text>
        <Group gap={6} wrap="wrap">
          {tags.map((t) => (
            <Badge key={t} variant="outline" color="gray" radius="sm">
              {t}
            </Badge>
          ))}
        </Group>
        {status === 'Completed' && (
          <Badge radius="sm" size="lg" color={score && score >= 7 ? 'green' : 'yellow'}>
            {score?.toFixed(1)}
          </Badge>
        )}
      </Stack>
    </Card>
  )
}

export default function SessionsPage() {
  const [active, setActive] = useState('Sessions')
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date())

  const assigned = [
    {
      title: 'Product Intro Practice',
      date: 'October 12, 2025',
      tags: ['Tag', 'Tag', 'Tag'],
      status: 'Upcoming' as const,
    },
    {
      title: 'Product Intro Practice',
      date: 'October 10, 2025',
      tags: ['Tag', 'Tag', 'Tag', '7 mins'],
      status: 'Pending' as const,
    },
    {
      title: 'Product Intro Practice',
      date: 'October 05, 2025',
      tags: ['Tag', 'Tag', 'Tag'],
      status: 'Overdue' as const,
    },
    {
      title: 'Product Intro Practice',
      date: 'October 03, 2025',
      tags: ['Tag', 'Tag', 'Tag'],
      status: 'Overdue' as const,
    },
    {
      title: 'Product Intro Practice',
      date: 'October 03, 2025',
      tags: ['Tag', 'Tag'],
      status: 'Completed' as const,
      score: 8.3,
    },
    {
      title: 'Product Intro Practice',
      date: 'October 02, 2025',
      tags: ['Tag', '7 mins'],
      status: 'Completed' as const,
      score: 6.5,
    },
    {
      title: 'Product Intro Practice',
      date: 'October 01, 2025',
      tags: ['Tag'],
      status: 'Completed' as const,
      score: 3.7,
    },
    {
      title: 'Product Intro Practice',
      date: 'September 29, 2025',
      tags: ['Tag', 'Tag'],
      status: 'Upcoming' as const,
    },
    {
      title: 'Product Intro Practice',
      date: 'September 28, 2025',
      tags: ['Tag', 'Tag'],
      status: 'Upcoming' as const,
    },
  ]

  const created = [
    {
      title: 'Sales Pitch 101',
      date: 'September 20, 2025',
      tags: ['Tag', 'Tag'],
      status: 'Upcoming' as const,
    },
    {
      title: 'Pricing Objection Handling',
      date: 'September 18, 2025',
      tags: ['Tag'],
      status: 'Pending' as const,
    },
    {
      title: 'Competitive Intel Brief',
      date: 'September 08, 2025',
      tags: ['Tag', 'Tag'],
      status: 'Completed' as const,
      score: 7.9,
    },
  ]

  return (
    <AppLayout
      header={
        <AppTopBar
          showSearch={false}
          rightSlot={
            <Group gap="sm" wrap="nowrap">
              <Select
                data={['Sort Descending', 'Sort Ascending']}
                defaultValue="Sort Descending"
                allowDeselect={false}
                comboboxProps={{ withinPortal: true }}
                styles={{
                  input: {
                    background: 'var(--mantine-color-dark-7)',
                    color: 'white',
                    border: '1px solid var(--mantine-color-dark-6)',
                  },
                }}
                radius="xl"
                w={180}
              />
              <TextInput
                placeholder="Search"
                leftSection={<IconSearch size={18} />}
                radius="xl"
                styles={{
                  input: {
                    width: 'clamp(220px, 32vw, 420px)',
                    background: 'var(--mantine-color-dark-7)',
                    color: 'white',
                    border: '1px solid var(--mantine-color-dark-6)',
                  },
                }}
              />
              <Button radius="md">Create New Session</Button>
            </Group>
          }
        />
      }
      navbar={
        <AppSidebar
          active={active}
          setActive={setActive}
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
        />
      }
    >
      <Box>
        <Group justify="space-between" mb="xs">
          <Title order={3}>Assigned to you</Title>
        </Group>
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
          {assigned.map((s, i) => (
            <SessionCard key={`${s.title}-${i}`} {...s} />
          ))}
        </SimpleGrid>
      </Box>

      <Box mt="xl">
        <Group justify="space-between" mb="xs">
          <Title order={3}>Created by you</Title>
        </Group>
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
          {created.map((s, i) => (
            <SessionCard key={`${s.title}-created-${i}`} {...s} />
          ))}
        </SimpleGrid>
      </Box>
    </AppLayout>
  )
}
