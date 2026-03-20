'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Title,
  Text,
  Table,
  Card,
  Group,
  Stack,
  Badge,
  ActionIcon,
  Avatar,
  Modal,
  TextInput,
  Switch,
  Button,
  Skeleton,
  Tooltip,
  Input,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { IconPencil, IconTrash, IconSearch } from '@tabler/icons-react'
import { api } from '@/lib/client'

type User = {
  id: string
  email: string
  name: string
  avatar?: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export default function UsersManagement() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [opened, { open, close }] = useDisclosure(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [form, setForm] = useState({ name: '', email: '', isActive: true })
  const [saving, setSaving] = useState(false)

  const fetchUsers = useCallback(async () => {
    try {
      const data = await api.users.getAll()
      setUsers(Array.isArray(data) ? data : [])
    } catch {
      notifications.show({ title: 'Error', message: 'Failed to load users', color: 'red' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const filtered = users.filter((u) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      u.name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.id.toLowerCase().includes(q)
    )
  })

  const openEdit = (user: User) => {
    setEditingUser(user)
    setForm({ name: user.name, email: user.email, isActive: user.isActive })
    open()
  }

  const handleSave = async () => {
    if (!editingUser) return
    setSaving(true)
    try {
      await api.users.update(editingUser.id, {
        name: form.name,
        email: form.email,
        isActive: form.isActive,
      })
      notifications.show({ title: 'Success', message: 'User updated', color: 'teal' })
      close()
      fetchUsers()
    } catch (err: any) {
      notifications.show({
        title: 'Error',
        message: err?.message || 'Failed to update user',
        color: 'red',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (user: User) => {
    if (!window.confirm(`Delete user "${user.name}" (${user.email})? This cannot be undone.`))
      return

    try {
      await api.users.delete(user.id)
      notifications.show({
        title: 'Deleted',
        message: `User "${user.name}" deleted`,
        color: 'teal',
      })
      fetchUsers()
    } catch (err: any) {
      notifications.show({
        title: 'Error',
        message: err?.message || 'Failed to delete user',
        color: 'red',
      })
    }
  }

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-end">
        <div>
          <Title order={2} fw={700}>
            Users
          </Title>
          <Text c="dimmed" size="sm" mt={4}>
            {loading ? 'Loading...' : `${users.length} total users`}
          </Text>
        </div>
      </Group>

      <Input
        placeholder="Search by name, email, or ID..."
        leftSection={<IconSearch size={16} />}
        value={search}
        onChange={(e) => setSearch(e.currentTarget.value)}
      />

      <Card withBorder radius="md" p={0}>
        {loading ? (
          <Stack p="lg" gap="sm">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} height={48} />
            ))}
          </Stack>
        ) : filtered.length === 0 ? (
          <Stack align="center" p="xl">
            <Text c="dimmed">{search ? 'No users match your search.' : 'No users found.'}</Text>
          </Stack>
        ) : (
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>User</Table.Th>
                <Table.Th>Email</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Joined</Table.Th>
                <Table.Th w={100}>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filtered.map((user) => (
                <Table.Tr key={user.id}>
                  <Table.Td>
                    <Group gap="sm">
                      <Avatar src={user.avatar} alt={user.name} radius="xl" size="sm" color="blue">
                        {user.name?.charAt(0)?.toUpperCase()}
                      </Avatar>
                      <div>
                        <Text size="sm" fw={500}>
                          {user.name}
                        </Text>
                        <Text size="xs" c="dimmed" lineClamp={1}>
                          {user.id}
                        </Text>
                      </div>
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{user.email}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge color={user.isActive ? 'green' : 'red'} variant="dot" size="sm">
                      {user.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs" c="dimmed">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap={4}>
                      <Tooltip label="Edit">
                        <ActionIcon variant="subtle" size="sm" onClick={() => openEdit(user)}>
                          <IconPencil size={14} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="Delete">
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          size="sm"
                          onClick={() => handleDelete(user)}
                        >
                          <IconTrash size={14} />
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Card>

      <Modal opened={opened} onClose={close} title="Edit User" centered size="md">
        <Stack gap="md">
          <TextInput
            label="Name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <TextInput
            label="Email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          />
          <Switch
            label="Active"
            checked={form.isActive}
            onChange={(e) => setForm((f) => ({ ...f, isActive: e.currentTarget.checked }))}
          />
          <Group justify="flex-end" mt="sm">
            <Button variant="subtle" onClick={close}>
              Cancel
            </Button>
            <Button onClick={handleSave} loading={saving}>
              Update
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  )
}
