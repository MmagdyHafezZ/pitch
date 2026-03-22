'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Title,
  Text,
  Table,
  Card,
  Group,
  Stack,
  Button,
  Badge,
  ActionIcon,
  Modal,
  TextInput,
  Textarea,
  Select,
  NumberInput,
  Switch,
  Skeleton,
  Tooltip,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { IconPlus, IconPencil } from '@tabler/icons-react'
import { api } from '@/lib/client'

type Plan = {
  id: string
  name: string
  description: string | null
  planLevel: string
  maxCoins: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

const PLAN_LEVELS = [
  { value: 'FREE', label: 'Free' },
  { value: 'PRO', label: 'Pro' },
  { value: 'TEAM', label: 'Team' },
  { value: 'ENTERPRISE', label: 'Enterprise' },
]

const EMPTY_FORM = {
  name: '',
  description: '',
  planLevel: 'FREE',
  maxCoins: 100,
  isActive: true,
}

export default function PlansManagement() {
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [opened, { open, close }] = useDisclosure(false)
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)

  const fetchPlans = useCallback(async () => {
    try {
      const data = await api.plans.getAll()
      setPlans(Array.isArray(data) ? data : [])
    } catch {
      notifications.show({ title: 'Error', message: 'Failed to load plans', color: 'red' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPlans()
  }, [fetchPlans])

  const openCreate = () => {
    setEditingPlan(null)
    setForm(EMPTY_FORM)
    open()
  }

  const openEdit = (plan: Plan) => {
    setEditingPlan(plan)
    setForm({
      name: plan.name,
      description: plan.description ?? '',
      planLevel: plan.planLevel,
      maxCoins: plan.maxCoins,
      isActive: plan.isActive,
    })
    open()
  }

  const handleSave = async () => {
    if (!form.name.trim()) {
      notifications.show({ title: 'Validation', message: 'Name is required', color: 'yellow' })
      return
    }

    setSaving(true)
    try {
      if (editingPlan) {
        await api.plans.update(editingPlan.id, form)
        notifications.show({ title: 'Success', message: 'Plan updated', color: 'teal' })
      } else {
        await api.plans.create(form)
        notifications.show({ title: 'Success', message: 'Plan created', color: 'teal' })
      }
      close()
      fetchPlans()
    } catch (err: any) {
      notifications.show({
        title: 'Error',
        message: err?.message || 'Failed to save plan',
        color: 'red',
      })
    } finally {
      setSaving(false)
    }
  }

  const levelColor = (level: string) => {
    const map: Record<string, string> = {
      FREE: 'gray',
      PRO: 'blue',
      TEAM: 'teal',
      ENTERPRISE: 'violet',
    }
    return map[level] ?? 'gray'
  }

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-end">
        <div>
          <Title order={2} fw={700}>
            Plans
          </Title>
          <Text c="dimmed" size="sm" mt={4}>
            Create and manage subscription plans
          </Text>
        </div>
        <Button leftSection={<IconPlus size={16} />} onClick={openCreate} color="brand">
          Create Plan
        </Button>
      </Group>

      <Card withBorder radius="md" p={0} shadow="sm">
        {loading ? (
          <Stack p="lg" gap="sm">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} height={40} />
            ))}
          </Stack>
        ) : plans.length === 0 ? (
          <Stack align="center" p="xl" gap="sm">
            <Text c="dimmed">No plans yet. Create your first plan to get started.</Text>
          </Stack>
        ) : (
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Name</Table.Th>
                <Table.Th>Level</Table.Th>
                <Table.Th>Max Coins</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Created</Table.Th>
                <Table.Th w={100}>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {plans.map((plan) => (
                <Table.Tr key={plan.id}>
                  <Table.Td>
                    <div>
                      <Text size="sm" fw={500}>
                        {plan.name}
                      </Text>
                      {plan.description && (
                        <Text size="xs" c="dimmed" lineClamp={1}>
                          {plan.description}
                        </Text>
                      )}
                    </div>
                  </Table.Td>
                  <Table.Td>
                    <Badge color={levelColor(plan.planLevel)} variant="light" size="sm" radius="sm">
                      {plan.planLevel}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{plan.maxCoins.toLocaleString()}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge
                      color={plan.isActive ? 'teal' : 'red'}
                      variant="light"
                      size="sm"
                      radius="sm"
                    >
                      {plan.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs" c="dimmed">
                      {new Date(plan.createdAt).toLocaleDateString()}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Tooltip label="Edit">
                      <ActionIcon variant="subtle" size="sm" onClick={() => openEdit(plan)}>
                        <IconPencil size={14} />
                      </ActionIcon>
                    </Tooltip>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Card>

      <Modal
        opened={opened}
        onClose={close}
        title={editingPlan ? 'Edit Plan' : 'Create Plan'}
        centered
        size="md"
      >
        <Stack gap="md">
          <TextInput
            label="Plan Name"
            placeholder="e.g. Pro Monthly"
            required
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <Textarea
            label="Description"
            placeholder="Describe this plan..."
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            autosize
            minRows={2}
          />
          <Select
            label="Plan Level"
            data={PLAN_LEVELS}
            value={form.planLevel}
            onChange={(val) => setForm((f) => ({ ...f, planLevel: val ?? 'FREE' }))}
          />
          <NumberInput
            label="Max Coins"
            placeholder="100"
            min={0}
            value={form.maxCoins}
            onChange={(val) => setForm((f) => ({ ...f, maxCoins: Number(val) || 0 }))}
          />
          <Switch
            label="Active"
            checked={form.isActive}
            onChange={(e) => {
              const checked = e.currentTarget.checked
              setForm((f) => ({ ...f, isActive: checked }))
            }}
          />
          <Group justify="flex-end" mt="sm">
            <Button variant="subtle" onClick={close}>
              Cancel
            </Button>
            <Button onClick={handleSave} loading={saving}>
              {editingPlan ? 'Update' : 'Create'}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  )
}
