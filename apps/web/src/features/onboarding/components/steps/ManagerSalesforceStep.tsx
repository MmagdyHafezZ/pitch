'use client'

import { Box, Title, Text, Stack, Button, Group, Alert, ThemeIcon, Badge } from '@mantine/core'
import { IconCloud, IconCheck, IconAlertCircle } from '@tabler/icons-react'
import { motion } from 'framer-motion'
import { useState, useEffect } from 'react'
import { api } from '@/lib/client'

interface ManagerSalesforceStepProps {
  onNext: () => void
  onSkip: () => void
}

export function ManagerSalesforceStep({ onNext, onSkip }: ManagerSalesforceStepProps) {
  const [isConnecting, setIsConnecting] = useState(false)
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleConnect = async () => {
    setIsConnecting(true)
    setError(null)
    try {
      // Initiate Salesforce OAuth — navigates away to OAuth provider
      // The CRM connect endpoint handles the redirect
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'
      window.location.href = `${baseUrl}/crm/salesforce/connect`
    } catch {
      setError('Failed to connect to Salesforce. Please try again or skip this step.')
      setIsConnecting(false)
    }
  }

  const checkStatus = async () => {
    try {
      const status = await api.crm.salesforce.status()
      if (status?.connected) {
        setConnected(true)
      }
    } catch {}
  }

  // Check status on mount in case user just returned from OAuth
  useEffect(() => {
    void checkStatus()
  }, [])

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
            Connect Salesforce
          </Title>
          <Text c="dimmed" maw={440} mx="auto">
            Link your Salesforce org to pull in real accounts, contacts, and opportunities for
            richer practice sessions.
          </Text>
        </Box>

        <Box
          p="xl"
          style={{
            border: '1px solid var(--mantine-color-gray-3)',
            borderRadius: 'var(--mantine-radius-lg)',
            textAlign: 'center',
          }}
        >
          <Stack align="center" gap="md">
            <ThemeIcon size={72} radius="xl" variant="light" color="blue">
              <IconCloud size={36} />
            </ThemeIcon>

            {connected ? (
              <>
                <Badge
                  leftSection={<IconCheck size={12} />}
                  color="green"
                  variant="light"
                  size="lg"
                >
                  Salesforce Connected
                </Badge>
                <Text c="dimmed" size="sm">
                  Your Salesforce org is linked. CRM data will be available in your sessions.
                </Text>
              </>
            ) : (
              <>
                <Text fw={500}>Salesforce CRM</Text>
                <Text c="dimmed" size="sm">
                  Connect your Salesforce account to enrich coaching sessions with real customer
                  data.
                </Text>
                <Button
                  leftSection={<IconCloud size={16} />}
                  loading={isConnecting}
                  onClick={handleConnect}
                  variant="outline"
                  color="blue"
                  size="md"
                >
                  Connect with Salesforce
                </Button>
              </>
            )}
          </Stack>
        </Box>

        {error && (
          <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light">
            {error}
          </Alert>
        )}

        <Group justify="space-between">
          <Button variant="subtle" color="gray" onClick={onSkip}>
            Skip for now
          </Button>
          <Button onClick={onNext} px={32}>
            {connected ? 'Continue' : 'Continue anyway'}
          </Button>
        </Group>
      </Stack>
    </motion.div>
  )
}
