'use client'

import { Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Container, Paper, Text, Alert, Stack, Button } from '@mantine/core'
import { IconAlertTriangle } from '@tabler/icons-react'

const ERROR_MESSAGES: Record<string, string> = {
  launch_failed:
    'The LTI launch could not be completed. The session token from your learning platform was invalid or expired.',
  invalid_state:
    'The OIDC state was invalid or already used. Please try launching again from your course.',
  missing_email:
    'Your learning platform did not provide an email address. Please ensure your profile is complete.',
}

export default function LtiErrorPage() {
  return (
    <Suspense fallback={null}>
      <LtiErrorContent />
    </Suspense>
  )
}

function LtiErrorContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const reason = searchParams.get('reason') ?? 'launch_failed'
  const message = ERROR_MESSAGES[reason] ?? ERROR_MESSAGES.launch_failed

  return (
    <Container
      size="sm"
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Paper withBorder shadow="md" p="xl" radius="md" style={{ width: '100%', maxWidth: 440 }}>
        <Stack align="center" gap="lg">
          <IconAlertTriangle size={48} color="orange" />
          <Text size="lg" fw={600}>
            LTI Launch Error
          </Text>
          <Alert color="orange" variant="light" style={{ width: '100%' }}>
            {message}
          </Alert>
          <Text size="sm" c="dimmed" ta="center">
            If this keeps happening, contact your instructor or PITCH support.
          </Text>
          <Button variant="light" onClick={() => router.push('/auth/login')}>
            Sign in manually
          </Button>
        </Stack>
      </Paper>
    </Container>
  )
}
