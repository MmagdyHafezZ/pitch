'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Alert, Badge, Button, Card, Group, Loader, Stack, Text, Title } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useQueryClient } from '@tanstack/react-query'
import { IconChartPie, IconShieldLock } from '@tabler/icons-react'
import { api } from '@/lib/client'
import { useAuthStore } from '@/features/auth/stores/auth.store'

type PendingPlanChange = {
  id: string // subscription id
  teamId: string
  planId: string // current plan id
  currentPeriodEnd: string
  plan?: { name: string; planLevel: string }
  metadata?: {
    pendingPlanChange?: {
      requestedPlanId: string
      requestedInterval: string
      requestedAt: string
      requestedByUserId: string
    }
  }
}

export default function AdminPlansPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const user = useAuthStore((state) => state.user)
  const [requests, setRequests] = useState<PendingPlanChange[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reviewingId, setReviewingId] = useState<string | null>(null)

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
        const result = await api.admin.subscriptions.listPlanChanges()
        if (active) setRequests(Array.isArray(result) ? result : [])
      } catch (err) {
        if (active)
          setError(err instanceof Error ? err.message : 'Failed to load pending plan changes.')
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [user?.isSystemAdmin])

  const handleApprove = async (req: PendingPlanChange) => {
    setReviewingId(req.id)
    try {
      await api.admin.subscriptions.approvePlanChange(req.id)
      setRequests((prev) => prev.filter((r) => r.id !== req.id))
      await queryClient.invalidateQueries({ queryKey: ['notifications'] })
      notifications.show({
        title: 'Plan change approved',
        message: `Subscription ${req.id} has been upgraded.`,
        color: 'teal',
      })
    } catch (err) {
      notifications.show({
        title: 'Approval failed',
        message: err instanceof Error ? err.message : 'Unable to approve plan change.',
        color: 'red',
      })
    } finally {
      setReviewingId(null)
    }
  }

  const handleReject = async (req: PendingPlanChange) => {
    setReviewingId(req.id)
    try {
      await api.admin.subscriptions.rejectPlanChange(req.id)
      setRequests((prev) => prev.filter((r) => r.id !== req.id))
      await queryClient.invalidateQueries({ queryKey: ['notifications'] })
      notifications.show({
        title: 'Plan change rejected',
        message: 'The request has been cancelled.',
        color: 'yellow',
      })
    } catch (err) {
      notifications.show({
        title: 'Rejection failed',
        message: err instanceof Error ? err.message : 'Unable to reject plan change.',
        color: 'red',
      })
    } finally {
      setReviewingId(null)
    }
  }

  if (!user?.isSystemAdmin) {
    return (
      <Stack gap="md">
        <Title order={2}>Plan change requests</Title>
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
          <IconChartPie size={20} />
          <Title order={2}>Plan change requests</Title>
        </Group>
        <Text c="dimmed">
          Review pending subscription plan change requests and approve or reject each one.
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
          No pending plan change requests.
        </Alert>
      ) : (
        <Stack gap="md">
          {requests.map((req) => {
            const pending = req.metadata?.pendingPlanChange
            return (
              <Card key={req.id} withBorder radius="lg" p="lg">
                <Stack gap="md">
                  <Group justify="space-between" align="flex-start">
                    <Stack gap={4}>
                      <Text fw={700} size="sm">
                        Team: {req.teamId}
                      </Text>
                      <Text size="sm" c="dimmed">
                        Current plan:{' '}
                        <Text span fw={600} c="inherit">
                          {req.plan?.name ?? req.planId}
                        </Text>
                      </Text>
                      {pending && (
                        <Text size="sm" c="dimmed">
                          Requesting:{' '}
                          <Text span fw={600} c="blue">
                            {pending.requestedPlanId}
                          </Text>{' '}
                          · {pending.requestedInterval}
                        </Text>
                      )}
                    </Stack>
                    <Badge variant="light" color="yellow">
                      Pending
                    </Badge>
                  </Group>

                  {pending && (
                    <Text size="xs" c="dimmed">
                      Requested on {new Date(pending.requestedAt).toLocaleString()}
                    </Text>
                  )}

                  <Group>
                    <Button
                      variant="light"
                      color="yellow"
                      loading={reviewingId === req.id}
                      onClick={() => handleReject(req)}
                    >
                      Reject
                    </Button>
                    <Button loading={reviewingId === req.id} onClick={() => handleApprove(req)}>
                      Approve
                    </Button>
                  </Group>
                </Stack>
              </Card>
            )
          })}
        </Stack>
      )}
    </Stack>
  )
}
