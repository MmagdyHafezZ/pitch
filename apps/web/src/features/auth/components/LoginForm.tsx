'use client'

import React, { useState } from 'react'
import {
  Paper,
  Button,
  Title,
  Text,
  Anchor,
  Alert,
  Stack,
  Box,
  TextInput,
  Loader,
} from '@mantine/core'
import {
  IconAlertCircle,
  IconBrandGoogle,
  IconBrandGithub,
  IconBrandLinkedin,
  IconBrandDiscord,
  IconMail,
} from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useOAuthProvidersQuery } from '../services/auth.service'
import { redirectToOAuthProvider } from '../utils/oauth.utils'
import { api } from '@/lib/client'

interface OAuthProvider {
  name: string
  displayName: string
  icon: string
  color: string
  authUrl: string
}

interface LoginFormProps {
  onSwitchToRegister?: () => void
  onSuccess?: () => void
}

const getProviderIcon = (name: string) => {
  switch (name.toLowerCase()) {
    case 'google':
      return <IconBrandGoogle size={18} />
    case 'github':
      return <IconBrandGithub size={18} />
    case 'linkedin':
      return <IconBrandLinkedin size={18} />
    case 'discord':
      return <IconBrandDiscord size={18} />
    case 'microsoft':
      return (
        <Text size="sm" fw={700}>
          MS
        </Text>
      )
    default:
      return (
        <Text size="sm" fw={700}>
          {name.charAt(0).toUpperCase()}
        </Text>
      )
  }
}

const getProviderProps = (name: string) => {
  const baseStyle = {
    variant: 'outline' as const,
    color: 'gray',
    style: {
      backgroundColor: 'white',
      borderColor: '#e5e7eb',
      color: '#374151',
    },
  }

  switch (name.toLowerCase()) {
    case 'google':
    case 'github':
    case 'linkedin':
    case 'discord':
    case 'microsoft':
      return baseStyle
    default:
      return { variant: 'filled' as const, color: 'blue' }
  }
}

export function LoginForm({ onSwitchToRegister }: LoginFormProps) {
  const [showError, setShowError] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [email, setEmail] = useState('')
  const [isCheckingEmail, setIsCheckingEmail] = useState(false)
  const [showProviderSelection, setShowProviderSelection] = useState(false)
  const [detectedProvider, setDetectedProvider] = useState<string | null>(null)

  const {
    data: oauthProviders = [],
    isLoading: loading,
    error: providersError,
  } = useOAuthProvidersQuery()

  React.useEffect(() => {
    if (providersError) {
      setErrorMessage('Unable to load authentication providers')
      setShowError(true)
    }
  }, [providersError])

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return

    setIsCheckingEmail(true)
    setShowError(false)

    try {
      const result = await api.auth.checkEmail(email.trim())

      if (!result.exists) {
        setErrorMessage(result.message)
        setShowError(true)
        setShowProviderSelection(true)
      } else if (result.requiresOAuth && result.provider) {
        setDetectedProvider(result.provider)
        const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'

        notifications.show({
          title: 'Redirecting...',
          message: result.message,
          color: 'blue',
        })

        redirectToOAuthProvider(baseUrl, result.provider, email.trim())
      } else {
        setErrorMessage(result.message)
        setShowError(true)
      }
    } catch (error) {
      setErrorMessage('Failed to check email. Please try again.')
      setShowError(true)
    } finally {
      setIsCheckingEmail(false)
    }
  }

  const handleOAuthLogin = (provider: OAuthProvider) => {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'

      notifications.show({
        title: 'Redirecting...',
        message: `Redirecting to ${provider.displayName} for authentication`,
        color: 'blue',
      })

      redirectToOAuthProvider(baseUrl, provider.name, email.trim() || undefined)
    } catch (error) {
      setErrorMessage(`Failed to initiate ${provider.displayName} login`)
      setShowError(true)
    }
  }

  return (
    <Paper
      withBorder
      shadow="xl"
      p={32}
      radius="lg"
      style={{
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(10px)',
        border: 'none',
      }}
    >
      <Box ta="center" mb="xl">
        <Title order={2} fw={700} c="dark.8" mb="xs">
          Welcome back
        </Title>
        <Text c="gray.6" size="sm">
          Sign in to access your assessment home
        </Text>
      </Box>

      {showError && (
        <Alert
          icon={<IconAlertCircle size="1rem" />}
          title="Login Error"
          color="red"
          variant="light"
          onClose={() => setShowError(false)}
          withCloseButton
          mb="md"
        >
          {errorMessage}
        </Alert>
      )}

      {/* Email Input Form */}
      <form onSubmit={handleEmailSubmit}>
        <Stack gap="md" mb="xl">
          <TextInput
            placeholder="Enter your email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            size="lg"
            leftSection={<IconMail size={18} />}
            styles={{
              input: {
                height: '56px',
                fontSize: '16px',
                borderRadius: '12px',
                border: '2px solid #e5e7eb',
                '&:focus': {
                  borderColor: '#6366f1',
                  boxShadow: '0 0 0 3px rgba(99, 102, 241, 0.1)',
                },
              },
            }}
            disabled={isCheckingEmail}
          />

          <Button
            type="submit"
            size="lg"
            fullWidth
            loading={isCheckingEmail}
            disabled={!email.trim() || isCheckingEmail}
            styles={{
              root: {
                height: '56px',
                backgroundColor: '#6366f1',
                '&:hover': {
                  backgroundColor: '#5338f1',
                },
              },
            }}
          >
            {isCheckingEmail ? 'Checking...' : 'Continue'}
          </Button>
        </Stack>
      </form>

      {/* Show OAuth Providers only for signup or when detected */}
      {(showProviderSelection || detectedProvider) && (
        <>
          <Text ta="center" c="gray.6" size="sm" mb="md">
            {detectedProvider ? 'Sign in with your account' : 'Or sign up with'}
          </Text>

          <Stack gap="sm" mb="xl">
            {loading ? (
              <Text ta="center" c="dimmed">
                Loading authentication providers...
              </Text>
            ) : oauthProviders.length > 0 ? (
              oauthProviders
                .filter(
                  (provider) =>
                    !detectedProvider || provider.name.toLowerCase() === detectedProvider
                )
                .map((provider) => (
                  <Button
                    key={provider.name}
                    {...getProviderProps(provider.name)}
                    size="lg"
                    fullWidth
                    leftSection={getProviderIcon(provider.name)}
                    onClick={() => handleOAuthLogin(provider)}
                    styles={{
                      root: {
                        height: '56px',
                        transition: 'all 200ms ease',
                        fontSize: '16px',
                        fontWeight: 500,
                      },
                    }}
                  >
                    Continue with {provider.displayName}
                  </Button>
                ))
            ) : (
              <Text ta="center" c="dimmed">
                No authentication providers available
              </Text>
            )}
          </Stack>
        </>
      )}

      <Text ta="center" mt="xl" size="sm" c="gray.6">
        Don&apos;t have an account?{' '}
        <Anchor size="sm" c="indigo.6" onClick={onSwitchToRegister} style={{ fontWeight: 500 }}>
          Sign up
        </Anchor>
      </Text>

      <Text ta="center" mt="md" size="xs" c="gray.5">
        By signing in, you agree to our{' '}
        <Anchor size="xs" c="indigo.6">
          Terms of Service
        </Anchor>{' '}
        and{' '}
        <Anchor size="xs" c="indigo.6">
          Privacy Policy
        </Anchor>
      </Text>
    </Paper>
  )
}
