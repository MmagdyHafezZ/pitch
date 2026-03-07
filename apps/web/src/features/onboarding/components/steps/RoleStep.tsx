'use client'

import { Box, Title, Text, Stack, SimpleGrid, Card, ThemeIcon, Button, Group } from '@mantine/core'
import { IconBriefcase, IconUsers } from '@tabler/icons-react'
import { motion } from 'framer-motion'
import { useState } from 'react'
import { UserRole } from '../../types'

interface RoleStepProps {
  onNext: (role: UserRole) => void
  onSkip: () => void
}

const roles: { value: UserRole; label: string; description: string; icon: React.ReactNode }[] = [
  {
    value: 'MANAGER',
    label: 'Sales Manager',
    description: 'I lead a team, manage pipelines, and oversee coaching sessions.',
    icon: <IconUsers size={32} />,
  },
  {
    value: 'EMPLOYEE',
    label: 'Sales Rep',
    description: 'I practice pitches, receive coaching, and grow my skills.',
    icon: <IconBriefcase size={32} />,
  },
]

export function RoleStep({ onNext, onSkip }: RoleStepProps) {
  const [selected, setSelected] = useState<UserRole | null>(null)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.35 }}
    >
      <Stack gap="xl">
        <Box ta="center">
          <Title order={2} fw={700} mb="xs">
            What best describes your role?
          </Title>
          <Text c="dimmed">This helps us tailor your experience.</Text>
        </Box>

        <SimpleGrid cols={2} spacing="md">
          {roles.map((role) => (
            <Card
              key={role.value}
              padding="xl"
              radius="lg"
              withBorder
              onClick={() => setSelected(role.value)}
              style={{
                cursor: 'pointer',
                borderColor: selected === role.value ? 'var(--mantine-color-indigo-5)' : undefined,
                borderWidth: selected === role.value ? 2 : 1,
                backgroundColor:
                  selected === role.value ? 'var(--mantine-color-indigo-0)' : undefined,
                transition: 'all 150ms ease',
              }}
            >
              <Stack align="center" gap="md" ta="center">
                <ThemeIcon
                  size={64}
                  radius="xl"
                  variant={selected === role.value ? 'filled' : 'light'}
                  color="indigo"
                >
                  {role.icon}
                </ThemeIcon>
                <Box>
                  <Text fw={600} size="lg" mb={4}>
                    {role.label}
                  </Text>
                  <Text c="dimmed" size="sm">
                    {role.description}
                  </Text>
                </Box>
              </Stack>
            </Card>
          ))}
        </SimpleGrid>

        <Group justify="space-between" mt="md">
          <Button variant="subtle" color="gray" onClick={onSkip}>
            Skip
          </Button>
          <Button onClick={() => selected && onNext(selected)} disabled={!selected} px={32}>
            Continue
          </Button>
        </Group>
      </Stack>
    </motion.div>
  )
}
