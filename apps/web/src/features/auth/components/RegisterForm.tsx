'use client'

import React, { useState } from 'react'
import { Paper, Button, Title, Text, Anchor, Alert, Stack, Box } from '@mantine/core'
import {
  IconAlertCircle,
  IconBrandGoogle,
  IconBrandGithub,
  IconBrandLinkedin,
  IconBrandDiscord,
} from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useOAuthProvidersQuery } from '../services/auth.service'
import { redirectToOAuthProvider } from '../utils/oauth.utils'

interface OAuthProvider {
  name: string
  displayName: string
  icon: string
  color: string
  authUrl: string
}

interface RegisterFormProps {
  onSwitchToLogin?: () => void
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
      return { variant: 'filled' as const, color: 'brand' }
  }
}

export function RegisterForm({ onSwitchToLogin }: RegisterFormProps) {
  const [showError, setShowError] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const {
    data: oauthProviders = [],
    isLoading: loading,
    error: providersError,
  } = useOAuthProvidersQuery()

  // Show error if providers query fails
  React.useEffect(() => {
    if (providersError) {
      setErrorMessage('Unable to load authentication providers')
      setShowError(true)
    }
  }, [providersError])

  const handleOAuthSignup = (provider: OAuthProvider) => {
    try {
      console.log('Initiating OAuth signup with provider:', provider.name)

      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'

      notifications.show({
        title: 'Redirecting...',
        message: `Redirecting to ${provider.displayName} to create your account`,
        color: 'brand',
      })

      // Use utility function to redirect to OAuth provider (same flow for signup and login)
      redirectToOAuthProvider(baseUrl, provider.name)
    } catch (error) {
      console.error('OAuth signup error:', error)
      setErrorMessage(`Failed to initiate ${provider.displayName} signup`)
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
          Create your account
        </Title>
        <Text c="gray.6" size="sm">
          Join professionals using PITCH to grow with guidance.
        </Text>
      </Box>

      {showError && (
        <Alert
          icon={<IconAlertCircle size="1rem" />}
          title="Registration Error"
          color="red"
          variant="light"
          onClose={() => setShowError(false)}
          withCloseButton
          mb="md"
        >
          {errorMessage}
        </Alert>
      )}

      {/* OAuth Providers */}
      <Stack gap="sm" mb="xl">
        {loading ? (
          <Text ta="center" c="dimmed">
            Loading authentication providers...
          </Text>
        ) : oauthProviders.length > 0 ? (
          oauthProviders.map((provider) => (
            <Button
              key={provider.name}
              {...getProviderProps(provider.name)}
              size="lg"
              fullWidth
              leftSection={getProviderIcon(provider.name)}
              onClick={() => handleOAuthSignup(provider)}
              styles={{
                root: {
                  height: '56px',
                  transition: 'all 200ms ease',
                  fontSize: '16px',
                  fontWeight: 500,
                },
              }}
            >
              Sign up with {provider.displayName}
            </Button>
          ))
        ) : (
          <Text ta="center" c="dimmed">
            No authentication providers available
          </Text>
        )}
      </Stack>

      <Text ta="center" mt="xl" size="sm" c="gray.6">
        Already have an account?{' '}
        <Anchor size="sm" c="indigo.6" onClick={onSwitchToLogin} style={{ fontWeight: 500 }}>
          Sign in
        </Anchor>
      </Text>

      <Text ta="center" mt="md" size="xs" c="gray.5">
        By creating an account, you agree to our{' '}
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
