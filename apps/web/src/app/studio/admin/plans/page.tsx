'use client'

import { useEffect, useState } from 'react'
import { Alert, Badge, Button, Card, Group, Loader, Stack, Text, Title } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconChartPie } from '@tabler/icons-react'
import { AdminWorkspacePage } from '../_components/AdminWorkspacePage'
import { api } from '@/lib/client'
import { useAuthStore } from '@/features/auth/stores/auth.store'

type PendingPlanChange = {
  id: string
  teamId: string
  planId: string
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

function PendingPlanChangesSection() {
  const user = useAuthStore((state) => state.user)
  const [requests, setRequests] = useState<PendingPlanChange[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reviewingId, setReviewingId] = useState<string | null>(null)

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
        if (active) {
          setError(err instanceof Error ? err.message : 'Failed to load pending plan changes.')
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    void load()
    return () => {
      active = false
    }
  }, [user?.isSystemAdmin])

  const handleApprove = async (request: PendingPlanChange) => {
    setReviewingId(request.id)
    try {
      await api.admin.subscriptions.approvePlanChange(request.id)
      setRequests((prev) => prev.filter((item) => item.id !== request.id))
      notifications.show({
        title: 'Plan change approved',
        message: `Subscription ${request.id} has been upgraded.`,
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

  const handleReject = async (request: PendingPlanChange) => {
    setReviewingId(request.id)
    try {
      await api.admin.subscriptions.rejectPlanChange(request.id)
      setRequests((prev) => prev.filter((item) => item.id !== request.id))
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
    return null
  }

  return (
    <Stack gap="md">
      <Stack gap={4}>
        <Group gap="sm">
          <IconChartPie size={20} />
          <Title order={3}>Plan change requests</Title>
        </Group>
        <Text c="dimmed">
          Review pending subscription plan change requests and approve or reject each one.
        </Text>
      </Stack>

      {error ? (
        <Alert color="red" variant="light">
          {error}
        </Alert>
      ) : null}

      {loading ? (
        <Loader size="lg" />
      ) : requests.length === 0 ? (
        <Alert color="green" variant="light">
          No pending plan change requests.
        </Alert>
      ) : (
        <Stack gap="md">
          {requests.map((request) => {
            const pending = request.metadata?.pendingPlanChange
            return (
              <Card key={request.id} withBorder radius="lg" p="lg">
                <Stack gap="md">
                  <Group justify="space-between" align="flex-start">
                    <Stack gap={4}>
                      <Text fw={700} size="sm">
                        Team: {request.teamId}
                      </Text>
                      <Text size="sm" c="dimmed">
                        Current plan:{' '}
                        <Text span fw={600} c="inherit">
                          {request.plan?.name ?? request.planId}
                        </Text>
                      </Text>
                      {pending ? (
                        <Text size="sm" c="dimmed">
                          Requesting:{' '}
                          <Text span fw={600} c="blue">
                            {pending.requestedPlanId}
                          </Text>{' '}
                          · {pending.requestedInterval}
                        </Text>
                      ) : null}
                    </Stack>
                    <Badge variant="light" color="yellow">
                      Pending
                    </Badge>
                  </Group>

                  {pending ? (
                    <Text size="xs" c="dimmed">
                      Requested on {new Date(pending.requestedAt).toLocaleString()}
                    </Text>
                  ) : null}

                  <Group>
                    <Button
                      variant="light"
                      color="yellow"
                      loading={reviewingId === request.id}
                      onClick={() => handleReject(request)}
                    >
                      Reject
                    </Button>
                    <Button
                      loading={reviewingId === request.id}
                      onClick={() => handleApprove(request)}
                    >
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

export default function AdminPlansPage() {
  return (
    <Stack gap="lg">
      <PendingPlanChangesSection />
      <AdminWorkspacePage view="plans" />
    </Stack>
  )
}
