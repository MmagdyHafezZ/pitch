'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Loader,
  NumberInput,
  Stack,
  Text,
  Title,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconCoin, IconShieldLock } from '@tabler/icons-react'
import { api } from '@/lib/client'
import { useAuthStore } from '@/features/auth/stores/auth.store'

type RefillRequest = {
  userId: string
  email: string
  name: string
  teamId: string
  requestedCoins: number
  requestedAt: string
  status: 'pending' | 'approved' | 'denied'
}

export default function AdminCoinsPage() {
  const router = useRouter()
  const user = useAuthStore((state) => state.user)
  const [requests, setRequests] = useState<RefillRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [approvedAmounts, setApprovedAmounts] = useState<Record<string, number>>({})
  const [reviewingUserId, setReviewingUserId] = useState<string | null>(null)

  useEffect(() => {
    if (user && !user.isSystemAdmin) {
      router.replace('/studio/home')
    }
  }, [router, user])

  useEffect(() => {
    if (!user?.isSystemAdmin) return

    let active = true
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const result = await api.coins.listRefillRequests()
        if (!active) return
        const list = Array.isArray(result) ? result : []
        setRequests(list)
        setApprovedAmounts((current) => {
          const next = { ...current }
          for (const r of list) {
            next[r.userId] = next[r.userId] ?? r.requestedCoins
          }
          return next
        })
      } catch (err) {
        if (!active) return
        setError(err instanceof Error ? err.message : 'Unable to load requests.')
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [user?.isSystemAdmin])

  const handleApprove = async (request: RefillRequest) => {
    const approvedCoins = Math.floor(approvedAmounts[request.userId] ?? 0)
    if (approvedCoins <= 0) {
      notifications.show({
        title: 'Invalid amount',
        message: 'Approved coins must be greater than zero.',
        color: 'red',
      })
      return
    }

    setReviewingUserId(request.userId)
    try {
      await api.coins.approveRefillRequest(request.userId, { approvedCoins })
      setRequests((current) => current.filter((r) => r.userId !== request.userId))
      notifications.show({
        title: 'Refill approved',
        message: `${request.email} now has ${approvedCoins.toLocaleString()} coins.`,
        color: 'teal',
      })
    } catch (err) {
      notifications.show({
        title: 'Approval failed',
        message: err instanceof Error ? err.message : 'Unable to approve.',
        color: 'red',
      })
    } finally {
      setReviewingUserId(null)
    }
  }

  const handleDeny = async (request: RefillRequest) => {
    setReviewingUserId(request.userId)
    try {
      await api.coins.denyRefillRequest(request.userId)
      setRequests((current) => current.filter((r) => r.userId !== request.userId))
      notifications.show({
        title: 'Request denied',
        message: `${request.email}'s refill request was denied.`,
        color: 'yellow',
      })
    } catch (err) {
      notifications.show({
        title: 'Denial failed',
        message: err instanceof Error ? err.message : 'Unable to deny.',
        color: 'red',
      })
    } finally {
      setReviewingUserId(null)
    }
  }

  if (!user?.isSystemAdmin) {
    return (
      <Stack gap="md">
        <Title order={2}>Credit top-up requests</Title>
        <Alert color="red" variant="light" icon={<IconShieldLock size={18} />}>
          Super admin access is required.
        </Alert>
      </Stack>
    )
  }

  return (
    <Stack gap="lg">
      <Stack gap={4}>
        <Group gap="sm">
          <IconCoin size={20} />
          <Title order={2}>Credit top-up requests</Title>
        </Group>
        <Text c="dimmed">
          Review pending coin refill requests. You can adjust the approved amount before confirming.
        </Text>
      </Stack>

      {error && (
        <Alert color="red" variant="light">
          {error}
        </Alert>
      )}

      {loading ? (
        <Loader size="lg" />
      ) : requests.length === 0 ? (
        <Alert color="green" variant="light">
          No pending credit top-up requests.
        </Alert>
      ) : (
        <Stack gap="md">
          {requests.map((request) => (
            <Card key={request.userId} withBorder radius="lg" p="lg">
              <Stack gap="md">
                <Group justify="space-between" align="flex-start">
                  <Stack gap={4}>
                    <Text fw={700}>{request.name}</Text>
                    <Text size="sm" c="dimmed">
                      {request.email}
                    </Text>
                    <Text size="xs" c="dimmed">
                      Team: {request.teamId}
                    </Text>
                  </Stack>
                  <Badge variant="light" color="yellow">
                    Pending
                  </Badge>
                </Group>

                <Group gap="xs">
                  <Text size="sm">Requested:</Text>
                  <Text size="sm" fw={700}>
                    {request.requestedCoins.toLocaleString()} coins
                  </Text>
                  <Text size="xs" c="dimmed">
                    on {new Date(request.requestedAt).toLocaleString()}
                  </Text>
                </Group>

                <Group align="flex-end" wrap="wrap">
                  <NumberInput
                    label="Approved coins"
                    min={1}
                    step={100}
                    value={approvedAmounts[request.userId] ?? request.requestedCoins}
                    onChange={(value) =>
                      setApprovedAmounts((current) => ({
                        ...current,
                        [request.userId]: typeof value === 'number' ? value : Number(value) || 0,
                      }))
                    }
                  />
                  <Button
                    variant="light"
                    color="yellow"
                    loading={reviewingUserId === request.userId}
                    onClick={() => handleDeny(request)}
                  >
                    Deny
                  </Button>
                  <Button
                    color="teal"
                    loading={reviewingUserId === request.userId}
                    onClick={() => handleApprove(request)}
                  >
                    Approve
                  </Button>
                </Group>
              </Stack>
            </Card>
          ))}
        </Stack>
      )}
    </Stack>
  )
}
