'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Container, Paper, Text, Loader, Alert, Stack, Button } from '@mantine/core'
import { IconCheck, IconX } from '@tabler/icons-react'
import { api } from '@/lib/client'
import { useAuthStore } from '@/features/auth'
import { storeOAuthTokens } from '@/features/auth/utils/oauth.utils'

export default function LtiLaunchPage() {
  return (
    <Suspense fallback={<LtiLaunchFallback />}>
      <LtiLaunchContent />
    </Suspense>
  )
}

function LtiLaunchContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const setToken = useAuthStore((state) => state.setToken)
  const setUser = useAuthStore((state) => state.setUser)
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    const handleLtiLaunch = async () => {
      const token = searchParams.get('token')
      const refreshToken = searchParams.get('refresh_token')
      const pitchSessionId = searchParams.get('pitchSessionId')

      if (!token) {
        setErrorMessage(
          'No authentication token received from LMS. Please check your LTI configuration or contact your instructor.'
        )
        setStatus('error')
        return
      }

      // Store the token issued by the LTI gateway
      setToken(token)
      storeOAuthTokens({ access_token: token, refresh_token: refreshToken ?? undefined })

      try {
        const me = await api.auth.me()
        setUser(me)
      } catch {
        // Non-fatal: token is already set
      }

      setStatus('success')

      // If a specific PITCH session is linked to this LTI resource, launch it directly.
      // Otherwise fall back to the sessions dashboard.
      setTimeout(() => {
        if (pitchSessionId) {
          router.replace(`/session/${pitchSessionId}`)
        } else {
          router.replace('/studio/sessions')
        }
      }, 1200)
    }

    handleLtiLaunch()
  }, [searchParams, router, setToken, setUser])

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
      <Paper withBorder shadow="md" p="xl" radius="md" style={{ width: '100%', maxWidth: 400 }}>
        <Stack align="center" gap="lg">
          {status === 'loading' && (
            <>
              <Loader size="lg" />
              <Text size="lg" fw={500}>
                Connecting to PITCH…
              </Text>
              <Text size="sm" c="dimmed" ta="center">
                Signing you in via your learning platform
              </Text>
            </>
          )}

          {status === 'success' && (
            <>
              <IconCheck size={48} color="green" />
              <Text size="lg" fw={500} c="green">
                Signed in successfully
              </Text>
              <Text size="sm" c="dimmed" ta="center">
                Redirecting you to your session…
              </Text>
            </>
          )}

          {status === 'error' && (
            <>
              <IconX size={48} color="red" />
              <Text size="lg" fw={500} c="red">
                Launch Failed
              </Text>
              <Alert color="red" variant="light" style={{ width: '100%' }}>
                {errorMessage}
              </Alert>
              <Button variant="light" onClick={() => router.push('/auth/login')}>
                Sign in manually
              </Button>
            </>
          )}
        </Stack>
      </Paper>
    </Container>
  )
}

function LtiLaunchFallback() {
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
      <Paper withBorder shadow="md" p="xl" radius="md" style={{ width: '100%', maxWidth: 400 }}>
        <Stack align="center" gap="lg">
          <Loader size="lg" />
          <Text size="lg" fw={500}>
            Connecting to PITCH…
          </Text>
        </Stack>
      </Paper>
    </Container>
  )
}
