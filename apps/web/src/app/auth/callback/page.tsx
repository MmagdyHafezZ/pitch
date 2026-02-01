'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Container, Paper, Text, Loader, Alert, Stack, Button } from '@mantine/core'
import { IconCheck, IconX } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import {
  parseOAuthCallback,
  handleOAuthSuccess,
  handleOAuthError,
} from '@/features/auth/utils/oauth.utils'

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<AuthCallbackFallback />}>
      <AuthCallbackContent />
    </Suspense>
  )
}

function AuthCallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        const { token, refresh_token, error } = parseOAuthCallback(searchParams)

        if (error) {
          handleOAuthError(error)
          setErrorMessage(decodeURIComponent(error))
          setStatus('error')
          return
        }

        if (!token) {
          const errorMsg = 'No authentication token received'
          handleOAuthError(errorMsg)
          setErrorMessage(errorMsg)
          setStatus('error')
          return
        }

        // Handle successful OAuth
        handleOAuthSuccess({
          access_token: token,
          refresh_token,
        })

        setStatus('success')

        // Show success notification
        notifications.show({
          title: 'Login Successful',
          message: 'You have been successfully authenticated',
          color: 'green',
          icon: <IconCheck size={16} />,
        })

        // Redirect to home after a brief delay
        setTimeout(() => {
          router.push('/studio/home')
        }, 2000)
      } catch (error) {
        console.error('Auth callback error:', error)
        const errorMsg = 'An unexpected error occurred during authentication'
        handleOAuthError(errorMsg)
        setErrorMessage(errorMsg)
        setStatus('error')
      }
    }

    handleAuthCallback()
  }, [searchParams, router])

  const handleRetry = () => {
    router.push('/auth/login')
  }

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
      <Paper withBorder shadow="md" p="xl" radius="md" style={{ width: '100%', maxWidth: '400px' }}>
        <Stack align="center" gap="lg">
          {status === 'loading' && (
            <>
              <Loader size="lg" />
              <Text size="lg" fw={500}>
                Processing authentication...
              </Text>
              <Text size="sm" c="dimmed" ta="center">
                Please wait while we complete your login
              </Text>
            </>
          )}

          {status === 'success' && (
            <>
              <IconCheck size={48} color="green" />
              <Text size="lg" fw={500} c="green">
                Authentication Successful!
              </Text>
              <Text size="sm" c="dimmed" ta="center">
                You are being redirected to your home...
              </Text>
            </>
          )}

          {status === 'error' && (
            <>
              <IconX size={48} color="red" />
              <Text size="lg" fw={500} c="red">
                Authentication Failed
              </Text>
              <Alert color="red" variant="light" style={{ width: '100%' }}>
                {errorMessage}
              </Alert>
              <Button onClick={handleRetry} variant="light">
                Try Again
              </Button>
            </>
          )}
        </Stack>
      </Paper>
    </Container>
  )
}

function AuthCallbackFallback() {
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
      <Paper withBorder shadow="md" p="xl" radius="md" style={{ width: '100%', maxWidth: '400px' }}>
        <Stack align="center" gap="lg">
          <Loader size="lg" />
          <Text size="lg" fw={500}>
            Preparing authentication...
          </Text>
          <Text size="sm" c="dimmed" ta="center">
            Hang tight while we finalize your login
          </Text>
        </Stack>
      </Paper>
    </Container>
  )
}
