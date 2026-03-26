'use client'

import { useEffect, useState } from 'react'
import {
  Button,
  Group,
  Text,
  Popover,
  Stack,
  ThemeIcon,
  Loader,
  Tooltip,
  Divider,
  ScrollArea,
} from '@mantine/core'
import {
  IconCircleCheck,
  IconCircleX,
  IconAlertTriangle,
  IconRefresh,
  IconChevronDown,
} from '@tabler/icons-react'
import { api } from '@/lib/client'

type ServiceStatus = {
  name: string
  status: 'online' | 'degraded' | 'offline'
  latency: number
}

const STATUS_CONFIG = {
  online: { color: 'teal', icon: IconCircleCheck, label: 'Online' },
  degraded: { color: 'yellow', icon: IconAlertTriangle, label: 'Degraded' },
  offline: { color: 'red', icon: IconCircleX, label: 'Offline' },
} as const

const SERVICE_GROUPS: { label: string; names: string[] }[] = [
  {
    label: 'Gateway & Simulation',
    names: ['Gateway API', 'Simulation Sessions', 'Simulation Invitations', 'LLM Service'],
  },
  {
    label: 'Core Services',
    names: ['User Service', 'Analytics Service', 'Support Service'],
  },
  {
    label: 'Infrastructure',
    names: ['CRM Service', 'LTI Service', 'S3 Service'],
  },
]

function overallStatus(services: ServiceStatus[]): 'online' | 'degraded' | 'offline' {
  if (services.length === 0) return 'offline'
  if (services.every((s) => s.status === 'offline')) return 'offline'
  if (services.some((s) => s.status !== 'online')) return 'degraded'
  return 'online'
}

export function ServiceStatusPanel() {
  const [services, setServices] = useState<ServiceStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [lastChecked, setLastChecked] = useState<Date | null>(null)

  const fetchHealth = async () => {
    setLoading(true)
    try {
      const data = await api.admin.healthServices()
      setServices(data.services)
      setLastChecked(new Date())
    } catch {
      setServices([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchHealth()
    const interval = setInterval(fetchHealth, 30_000)
    return () => clearInterval(interval)
  }, [])

  if (loading && services.length === 0) {
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
  const { color: overallColor } = STATUS_CONFIG[overall]
  const onlineCount = services.filter((s) => s.status === 'online').length

  // Build a map for quick lookup
  const serviceMap = new Map(services.map((s) => [s.name, s]))

  return (
    <>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
      <Popover width={340} position="bottom-end" withArrow shadow="md">
        <Popover.Target>
          <Button
            variant="light"
            color={overallColor}
            size="sm"
            leftSection={
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: 'currentColor',
                  display: 'inline-block',
                  animation: overall === 'online' ? 'pulse 2s infinite' : 'none',
                  flexShrink: 0,
                }}
              />
            }
            rightSection={
              <Group gap={4} wrap="nowrap">
                <Tooltip label="Refresh" withArrow>
                  <IconRefresh
                    size={12}
                    style={{ opacity: 0.6, cursor: 'pointer' }}
                    onClick={(e) => {
                      e.stopPropagation()
                      fetchHealth()
                    }}
                  />
                </Tooltip>
                <IconChevronDown size={14} />
              </Group>
            }
          >
            {loading ? 'Checking…' : `${onlineCount}/${services.length} Online`}
          </Button>
        </Popover.Target>

        <Popover.Dropdown p={0}>
          <ScrollArea.Autosize mah={480}>
            <Stack gap={0} p="sm">
              <Group justify="space-between" mb="xs">
                <Text size="xs" fw={700} tt="uppercase" c="dimmed">
                  System Status
                </Text>
                {lastChecked && (
                  <Text size="xs" c="dimmed">
                    {lastChecked.toLocaleTimeString()}
                  </Text>
                )}
              </Group>

              {services.length === 0 ? (
                <Text size="sm" c="dimmed" ta="center" py="md">
                  No data available
                </Text>
              ) : (
                SERVICE_GROUPS.map((group, gi) => {
                  const groupServices = group.names
                    .map((n) => serviceMap.get(n))
                    .filter(Boolean) as ServiceStatus[]

                  if (groupServices.length === 0) return null

                  return (
                    <div key={group.label}>
                      {gi > 0 && <Divider my="xs" />}
                      <Text size="xs" c="dimmed" tt="uppercase" fw={600} mb={6}>
                        {group.label}
                      </Text>
                      <Stack gap={4}>
                        {groupServices.map((svc) => {
                          const cfg = STATUS_CONFIG[svc.status]
                          const Icon = cfg.icon
                          return (
                            <Group key={svc.name} justify="space-between" wrap="nowrap">
                              <Group gap="xs" wrap="nowrap">
                                <ThemeIcon size="sm" variant="light" color={cfg.color} radius="xl">
                                  <Icon size={11} />
                                </ThemeIcon>
                                <Text size="sm">{svc.name}</Text>
                              </Group>
                              <Group gap={6} wrap="nowrap">
                                <Text
                                  size="xs"
                                  fw={500}
                                  c={cfg.color === 'teal' ? 'teal' : cfg.color}
                                >
                                  {cfg.label}
                                </Text>
                                <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
                                  {svc.latency}ms
                                </Text>
                              </Group>
                            </Group>
                          )
                        })}
                      </Stack>
                    </div>
                  )
                })
              )}

              <Divider my="xs" />
              <Text size="xs" c="dimmed" ta="center">
                Auto-refreshes every 30s
              </Text>
            </Stack>
          </ScrollArea.Autosize>
        </Popover.Dropdown>
      </Popover>
    </>
  )
}
