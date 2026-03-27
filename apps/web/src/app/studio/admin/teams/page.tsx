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
  Stack,
  Text,
  Textarea,
  Title,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconBuildingCommunity, IconShieldLock } from '@tabler/icons-react'
import { api } from '@/lib/client'
import { useAuthStore } from '@/features/auth/stores/auth.store'

type PendingTeam = {
  id: string
  name: string
  slug: string
  createdAt: string
  memberships?: Array<{
    role: string
    user: { id: string; email: string; name: string }
  }>
}

export default function AdminTeamsPage() {
  const router = useRouter()
  const user = useAuthStore((state) => state.user)
  const [teams, setTeams] = useState<PendingTeam[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notes, setNotes] = useState<Record<string, string>>({})
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
        const result = await api.admin.teams.listPending()
        if (active) setTeams(Array.isArray(result) ? result : [])
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Failed to load pending teams.')
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [user?.isSystemAdmin])

  const handleApprove = async (team: PendingTeam) => {
    setReviewingId(team.id)
    try {
      await api.admin.teams.approve(team.id)
      setTeams((prev) => prev.filter((t) => t.id !== team.id))
      notifications.show({
        title: 'Team approved',
        message: `"${team.name}" is now active.`,
        color: 'teal',
      })
    } catch (err) {
      notifications.show({
        title: 'Approval failed',
        message: err instanceof Error ? err.message : 'Unable to approve team.',
        color: 'red',
      })
    } finally {
      setReviewingId(null)
    }
  }

  const handleReject = async (team: PendingTeam) => {
    setReviewingId(team.id)
    try {
      await api.admin.teams.reject(team.id, notes[team.id])
      setTeams((prev) => prev.filter((t) => t.id !== team.id))
      notifications.show({
        title: 'Team rejected',
        message: `"${team.name}" request was denied.`,
        color: 'yellow',
      })
    } catch (err) {
      notifications.show({
        title: 'Rejection failed',
        message: err instanceof Error ? err.message : 'Unable to reject team.',
        color: 'red',
      })
    } finally {
      setReviewingId(null)
    }
  }

  if (!user?.isSystemAdmin) {
    return (
      <Stack gap="md">
        <Title order={2}>Team approval requests</Title>
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
          <IconBuildingCommunity size={20} />
          <Title order={2}>Team approval requests</Title>
        </Group>
        <Text c="dimmed">
          Review pending team creation requests and approve or reject each one.
        </Text>
      </Stack>

      {error && (
        <Alert color="red" variant="light">
          {error}
        </Alert>
      )}

      {loading ? (
        <Loader size="lg" />
      ) : teams.length === 0 ? (
        <Alert color="green" variant="light">
          No pending team requests.
        </Alert>
      ) : (
        <Stack gap="md">
          {teams.map((team) => {
            const owner = team.memberships?.find((m) => m.role === 'OWNER')
            return (
              <Card key={team.id} withBorder radius="lg" p="lg">
                <Stack gap="md">
                  <Group justify="space-between" align="flex-start">
                    <Stack gap={4}>
                      <Text fw={700}>{team.name}</Text>
                      <Text size="sm" c="dimmed">
                        slug: {team.slug}
                      </Text>
                      {owner && (
                        <Text size="sm" c="dimmed">
                          Requested by {owner.user.name} ({owner.user.email})
                        </Text>
                      )}
                    </Stack>
                    <Badge variant="light" color="yellow">
                      Pending
                    </Badge>
                  </Group>

                  <Text size="sm" c="dimmed">
                    Created on {new Date(team.createdAt).toLocaleString()}
                  </Text>

                  <Textarea
                    placeholder="Rejection note (optional)"
                    value={notes[team.id] ?? ''}
                    onChange={(e) =>
                      setNotes((prev) => ({ ...prev, [team.id]: e.currentTarget.value }))
                    }
                    autosize
                    minRows={2}
                  />

                  <Group>
                    <Button
                      variant="light"
                      color="yellow"
                      loading={reviewingId === team.id}
                      onClick={() => handleReject(team)}
                    >
                      Reject
                    </Button>
                    <Button loading={reviewingId === team.id} onClick={() => handleApprove(team)}>
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
