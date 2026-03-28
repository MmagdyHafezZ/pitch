'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Container, Paper, Text, Loader, Alert, Stack, Button } from '@mantine/core'
import { IconCheck, IconX } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { api } from '@/lib/client'
import { useAuthStore } from '@/features/auth'
import { parseOAuthCallback, storeOAuthTokens } from '@/features/auth/utils/oauth.utils'
import {
  clearTeamInviteContext,
  getTeamInviteContext,
} from '@/features/teams/utils/team-invite-context'

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
  const setToken = useAuthStore((state) => state.setToken)
  const setUser = useAuthStore((state) => state.setUser)
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    const destination = (() => {
      const next = searchParams.get('next') ?? searchParams.get('redirect') ?? '/studio/home'
      if (!next.startsWith('/') || next.startsWith('//')) return '/studio/home'
      return next
    })()

    let redirectTimer: ReturnType<typeof setTimeout> | null = null

    const handleAuthCallback = async () => {
      try {
        const { token, refresh_token, error } = parseOAuthCallback(searchParams)

        if (error) {
          setErrorMessage(decodeURIComponent(error))
          setStatus('error')
          return
        }

        if (!token) {
          const errorMsg = 'No authentication token received'
          setErrorMessage(errorMsg)
          setStatus('error')
          return
        }

        // Handle successful OAuth
        setToken(token)
        storeOAuthTokens({
          access_token: token,
          refresh_token,
        })

        try {
          const me = await api.auth.me()
          setUser(me)
        } catch {
          // Non-fatal: token is already set and user can still proceed.
        }

        const inviteContext = getTeamInviteContext()
        if (inviteContext?.teamId) {
          try {
            await api.teams.claimInvite(inviteContext.teamId)
            clearTeamInviteContext()
            notifications.show({
              title: 'Team invitation accepted',
              message: 'You were added to the invited team.',
              color: 'teal',
              icon: <IconCheck size={16} />,
            })
          } catch (claimError) {
            console.error('Failed to claim team invite:', claimError)
          }
        }

        setStatus('success')

        // Show success notification
        notifications.show({
          title: 'Login Successful',
          message: 'You have been successfully authenticated',
          color: 'green',
          icon: <IconCheck size={16} />,
        })

        // Redirect after a brief delay
        redirectTimer = setTimeout(() => {
          router.replace(destination)
        }, 1500)
      } catch (error) {
        console.error('Auth callback error:', error)
        const errorMsg = 'An unexpected error occurred during authentication'
        setErrorMessage(errorMsg)
        setStatus('error')
      }
    }

    handleAuthCallback()

    return () => {
      if (redirectTimer) {
        clearTimeout(redirectTimer)
      }
    }
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
