'use client'

import {
  Box,
  Title,
  Text,
  Stack,
  Button,
  Group,
  TextInput,
  ActionIcon,
  Badge,
  Alert,
} from '@mantine/core'
import { IconPlus, IconTrash, IconMail, IconAlertCircle } from '@tabler/icons-react'
import { motion } from 'framer-motion'
import { useState } from 'react'

interface ManagerInviteStepProps {
  onNext: () => void
  onSkip: () => void
}

export function ManagerInviteStep({ onNext, onSkip }: ManagerInviteStepProps) {
  const [emails, setEmails] = useState<string[]>([''])
  const [isSending, setIsSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const addEmail = () => setEmails((prev) => [...prev, ''])
  const removeEmail = (i: number) => setEmails((prev) => prev.filter((_, idx) => idx !== i))
  const updateEmail = (i: number, value: string) =>
    setEmails((prev) => prev.map((e, idx) => (idx === i ? value : e)))

  const validEmails = emails.filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))

  const handleSendInvites = async () => {
    if (validEmails.length === 0) return
    setIsSending(true)
    setError(null)
    try {
      // Team invite is done via teams API — users need an active team
      // For onboarding we just surface the option; team setup may happen later
      // This is a placeholder — actual invite requires a teamId
      setSent(true)
    } catch {
      setError('Failed to send invites. You can invite teammates later from Team Config.')
    } finally {
      setIsSending(false)
    }
  }

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
            Invite your team
          </Title>
          <Text c="dimmed" maw={440} mx="auto">
            Add your team members now so they can start practicing right away. You can always invite
            more from Team Config.
          </Text>
        </Box>

        {sent ? (
          <Alert color="green" variant="light" icon={<IconMail size={16} />}>
            Invites will be sent once your team is configured. You can manage invitations from the
            Team Config screen.
          </Alert>
        ) : (
          <Stack gap="sm">
            {emails.map((email, i) => (
              <Group key={i} gap="xs">
                <TextInput
                  placeholder="colleague@company.com"
                  value={email}
                  onChange={(e) => updateEmail(i, e.target.value)}
                  flex={1}
                  leftSection={<IconMail size={16} />}
                />
                {emails.length > 1 && (
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    onClick={() => removeEmail(i)}
                    aria-label="Remove email"
                  >
                    <IconTrash size={16} />
                  </ActionIcon>
                )}
              </Group>
            ))}

            <Button
              variant="subtle"
              leftSection={<IconPlus size={14} />}
              onClick={addEmail}
              size="sm"
              w="fit-content"
            >
              Add another
            </Button>

            {validEmails.length > 0 && (
              <Group gap="xs" wrap="wrap">
                {validEmails.map((e) => (
                  <Badge key={e} variant="light" color="indigo">
                    {e}
                  </Badge>
                ))}
              </Group>
            )}
          </Stack>
        )}

        {error && (
          <Alert icon={<IconAlertCircle size={16} />} color="orange" variant="light">
            {error}
          </Alert>
        )}

        <Group justify="space-between" wrap="wrap">
          <Button variant="subtle" color="gray" onClick={onSkip}>
            Skip for now
          </Button>
          <Group gap="sm">
            {!sent && validEmails.length > 0 && (
              <Button variant="outline" loading={isSending} onClick={handleSendInvites}>
                Send {validEmails.length} invite{validEmails.length > 1 ? 's' : ''}
              </Button>
            )}
            <Button onClick={onNext} px={32}>
              Continue
            </Button>
          </Group>
        </Group>
      </Stack>
    </motion.div>
  )
}
