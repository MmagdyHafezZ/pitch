'use client'

import { useEffect, useState } from 'react'
import {
  Badge,
  Group,
  Text,
  Popover,
  Stack,
  ThemeIcon,
  Loader,
  Divider,
  Tooltip,
  ScrollArea,
} from '@mantine/core'
import {
  IconCircleCheck,
  IconCircleX,
  IconAlertTriangle,
  IconRefresh,
  IconServer,
  IconBrandDocker,
} from '@tabler/icons-react'
import { api } from '@/lib/client'

type ServiceStatus = {
  name: string
  status: 'online' | 'degraded' | 'offline'
  latency: number
}

type ContainerInfo = {
  id: string
  name: string
  image: string
  state: string
  status: string
}

const SERVICE_STATUS_CONFIG = {
  online: { color: 'teal', icon: IconCircleCheck, label: 'Online' },
  degraded: { color: 'yellow', icon: IconAlertTriangle, label: 'Degraded' },
  offline: { color: 'red', icon: IconCircleX, label: 'Offline' },
} as const

const CONTAINER_STATE_CONFIG: Record<
  string,
  { color: string; icon: typeof IconCircleCheck; label: string }
> = {
  running: { color: 'teal', icon: IconCircleCheck, label: 'Running' },
  exited: { color: 'red', icon: IconCircleX, label: 'Exited' },
  paused: { color: 'yellow', icon: IconAlertTriangle, label: 'Paused' },
  restarting: { color: 'orange', icon: IconAlertTriangle, label: 'Restarting' },
  dead: { color: 'red', icon: IconCircleX, label: 'Dead' },
  created: { color: 'gray', icon: IconAlertTriangle, label: 'Created' },
}

function containerConfig(state: string) {
  return (
    CONTAINER_STATE_CONFIG[state.toLowerCase()] ?? {
      color: 'gray',
      icon: IconAlertTriangle,
      label: state,
    }
  )
}

function overallStatus(services: ServiceStatus[]): 'online' | 'degraded' | 'offline' {
  if (services.length === 0) return 'offline'
  if (services.every((s) => s.status === 'offline')) return 'offline'
  if (services.some((s) => s.status !== 'online')) return 'degraded'
  return 'online'
}

export function ServiceStatusPanel() {
  const [services, setServices] = useState<ServiceStatus[]>([])
  const [containers, setContainers] = useState<ContainerInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [lastChecked, setLastChecked] = useState<Date | null>(null)

  const fetchHealth = async () => {
    try {
      const data = await api.admin.healthServices()
      setServices(data.services)
      setContainers(data.containers ?? [])
      setLastChecked(new Date())
    } catch {
      setServices([])
      setContainers([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchHealth()
    const interval = setInterval(fetchHealth, 30_000)
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <Group gap="xs">
        <Loader size="xs" />
        <Text size="sm" c="dimmed">
          Checking services…
        </Text>
      </Group>
    )
  }

  const overall = overallStatus(services)
  const { color: overallColor } = SERVICE_STATUS_CONFIG[overall]
  const overallLabel =
    overall === 'online' ? 'All Systems Online' : overall === 'degraded' ? 'Degraded' : 'Offline'

  const runningCount = containers.filter((c) => c.state.toLowerCase() === 'running').length

  return (
    <Popover width={340} position="bottom-end" withArrow shadow="md">
      <Popover.Target>
        <Badge
          variant="dot"
          color={overallColor}
          size="lg"
          style={{ cursor: 'pointer' }}
          rightSection={
            <Tooltip label="Refresh" withArrow>
              <IconRefresh
                size={12}
                style={{ marginLeft: 4, opacity: 0.6 }}
                onClick={(e) => {
                  e.stopPropagation()
                  setLoading(true)
                  fetchHealth()
                }}
              />
            </Tooltip>
          }
        >
          {overallLabel}
        </Badge>
      </Popover.Target>

      <Popover.Dropdown>
        <Stack gap="sm">
          {/* Header */}
          <Group justify="space-between">
            <Text size="xs" fw={700} tt="uppercase" c="dimmed">
              System Health
            </Text>
            {lastChecked && (
              <Text size="xs" c="dimmed">
                {lastChecked.toLocaleTimeString()}
              </Text>
            )}
          </Group>

          {/* API Services */}
          <div>
            <Group gap="xs" mb={6}>
              <IconServer size={13} opacity={0.6} />
              <Text size="xs" fw={600} c="dimmed" tt="uppercase">
                API Services
              </Text>
            </Group>
            <Stack gap={6}>
              {services.length === 0 ? (
                <Text size="sm" c="dimmed" ta="center" py={4}>
                  No data
                </Text>
              ) : (
                services.map((svc) => {
                  const cfg = SERVICE_STATUS_CONFIG[svc.status]
                  const Icon = cfg.icon
                  return (
                    <Group key={svc.name} justify="space-between" wrap="nowrap">
                      <Group gap="xs" wrap="nowrap">
                        <ThemeIcon size="sm" variant="light" color={cfg.color} radius="xl">
                          <Icon size={12} />
                        </ThemeIcon>
                        <Text size="sm">{svc.name}</Text>
                      </Group>
                      <Group gap="xs" wrap="nowrap">
                        <Badge size="xs" variant="light" color={cfg.color}>
                          {cfg.label}
                        </Badge>
                        <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
                          {svc.latency}ms
                        </Text>
                      </Group>
                    </Group>
                  )
                })
              )}
            </Stack>
          </div>

          {/* Docker Containers */}
          <Divider />
          <div>
            <Group gap="xs" mb={6} justify="space-between">
              <Group gap="xs">
                <IconBrandDocker size={13} opacity={0.6} />
                <Text size="xs" fw={600} c="dimmed" tt="uppercase">
                  Containers
                </Text>
              </Group>
              {containers.length > 0 && (
                <Text size="xs" c="dimmed">
                  {runningCount}/{containers.length} running
                </Text>
              )}
            </Group>
            {containers.length === 0 ? (
              <Text size="sm" c="dimmed" ta="center" py={4}>
                Docker not available
              </Text>
            ) : (
              <ScrollArea.Autosize mah={180}>
                <Stack gap={6}>
                  {containers.map((c) => {
                    const cfg = containerConfig(c.state)
                    const Icon = cfg.icon
                    return (
                      <Group key={c.id} justify="space-between" wrap="nowrap">
                        <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
                          <ThemeIcon size="sm" variant="light" color={cfg.color} radius="xl">
                            <Icon size={12} />
                          </ThemeIcon>
                          <Stack gap={0} style={{ minWidth: 0 }}>
                            <Text size="sm" truncate>
                              {c.name}
                            </Text>
                            <Text size="xs" c="dimmed" truncate>
                              {c.image}
                            </Text>
                          </Stack>
                        </Group>
                        <Badge
                          size="xs"
                          variant="light"
                          color={cfg.color}
                          style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                        >
                          {cfg.label}
                        </Badge>
                      </Group>
                    )
                  })}
                </Stack>
              </ScrollArea.Autosize>
            )}
          </div>

          <Text size="xs" c="dimmed" ta="center">
            Auto-refreshes every 30s
          </Text>
        </Stack>
      </Popover.Dropdown>
    </Popover>
  )
}
