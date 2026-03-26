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
  Select,
  Stack,
  Text,
  Title,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconShieldLock, IconUsers } from '@tabler/icons-react'
import { api } from '@/lib/client'
import { useAuthStore } from '@/features/auth/stores/auth.store'

type StudioAccessRequest = {
  userId: string
  email: string
  name: string
  requestedAt: string
  quota?: number
  role?: 'MEMBER' | 'ADMIN' | 'OWNER'
}

type ReviewRole = 'MEMBER' | 'ADMIN'

export default function StudioAccessAdminPage() {
  const router = useRouter()
  const user = useAuthStore((state) => state.user)
  const [requests, setRequests] = useState<StudioAccessRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [quotas, setQuotas] = useState<Record<string, number>>({})
  const [roles, setRoles] = useState<Record<string, ReviewRole>>({})
  const [reviewingUserId, setReviewingUserId] = useState<string | null>(null)

  useEffect(() => {
    if (user && !user.isSystemAdmin) {
      router.replace('/studio/home')
    }
  }, [router, user])

  useEffect(() => {
    if (!user?.isSystemAdmin) return

    let active = true

    const loadRequests = async () => {
      setLoading(true)
      setError(null)
      try {
        const result = await api.studioAccess.listRequests()
        if (!active) return
        setRequests(Array.isArray(result) ? result : [])
        setQuotas((current) => {
          const next = { ...current }
          for (const request of Array.isArray(result) ? result : []) {
            next[request.userId] = next[request.userId] ?? request.quota ?? 5000
          }
          return next
        })
        setRoles((current) => {
          const next = { ...current }
          for (const request of Array.isArray(result) ? result : []) {
            next[request.userId] =
              next[request.userId] ?? (request.role === 'ADMIN' ? 'ADMIN' : 'MEMBER')
          }
          return next
        })
      } catch (nextError) {
        if (!active) return
        setError(
          nextError instanceof Error ? nextError.message : 'Unable to load Studio access requests.'
        )
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadRequests()
    return () => {
      active = false
    }
  }, [user?.isSystemAdmin])

  const handleApprove = async (request: StudioAccessRequest) => {
    const quota = Math.floor(quotas[request.userId] ?? 0)
    const role = roles[request.userId] ?? 'MEMBER'
    if (quota <= 0) {
      notifications.show({
        title: 'Invalid quota',
        message: 'Quota must be greater than zero.',
        color: 'red',
      })
      return
    }

    setReviewingUserId(request.userId)
    try {
      await api.studioAccess.approveRequest(request.userId, { quota, role })
      setRequests((current) => current.filter((item) => item.userId !== request.userId))
      notifications.show({
        title: 'Access approved',
        message: `${request.email} now has Studio access as ${role === 'ADMIN' ? 'an admin' : 'a regular user'} with ${quota} coins.`,
        color: 'teal',
      })
    } catch (nextError) {
      notifications.show({
        title: 'Approval failed',
        message: nextError instanceof Error ? nextError.message : 'Unable to approve access.',
        color: 'red',
      })
    } finally {
      setReviewingUserId(null)
    }
  }

  const handleDeny = async (request: StudioAccessRequest) => {
    setReviewingUserId(request.userId)
    try {
      await api.studioAccess.denyRequest(request.userId)
      setRequests((current) => current.filter((item) => item.userId !== request.userId))
      notifications.show({
        title: 'Access denied',
        message: `${request.email} was notified that Studio access was not approved.`,
        color: 'yellow',
      })
    } catch (nextError) {
      notifications.show({
        title: 'Denial failed',
        message: nextError instanceof Error ? nextError.message : 'Unable to deny access.',
        color: 'red',
      })
    } finally {
      setReviewingUserId(null)
    }
  }

  if (!user?.isSystemAdmin) {
    return (
      <Stack gap="md">
        <Title order={2}>Studio access approvals</Title>
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
          <IconUsers size={20} />
          <Title order={2}>Studio access approvals</Title>
        </Group>
        <Text c="dimmed">
          Review pending requests, choose a workspace role, and approve or deny each account.
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
          No pending Studio access requests.
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
                  </Stack>
                  <Badge variant="light" color="yellow">
                    Pending
                  </Badge>
                </Group>

                <Text size="sm" c="dimmed">
                  Requested on {new Date(request.requestedAt).toLocaleString()}
                </Text>

                <Group align="end" wrap="wrap">
                  <NumberInput
                    label="Quota"
                    min={1}
                    step={100}
                    value={quotas[request.userId] ?? 5000}
                    onChange={(value) =>
                      setQuotas((current) => ({
                        ...current,
                        [request.userId]: typeof value === 'number' ? value : Number(value) || 0,
                      }))
                    }
                  />
                  <Select
                    label="Role"
                    data={[
                      { value: 'MEMBER', label: 'Regular user' },
                      { value: 'ADMIN', label: 'Admin user' },
                    ]}
                    value={roles[request.userId] ?? 'MEMBER'}
                    onChange={(value) =>
                      setRoles((current) => ({
                        ...current,
                        [request.userId]: value === 'ADMIN' ? 'ADMIN' : 'MEMBER',
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
