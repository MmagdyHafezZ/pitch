'use client'

import { useState } from 'react'
import { LoginForm } from './LoginForm'
import { RegisterForm } from './RegisterForm'
import { Box, Group, Stack, Text, Title, Container } from '@mantine/core'
import { IconCheck } from '@tabler/icons-react'
import PitchLogo from '@/components/logos/PitchLogo'

interface AuthPageProps {
  defaultMode?: 'login' | 'register'
  onSuccess?: () => void
}

export function AuthPage({ defaultMode = 'login', onSuccess }: AuthPageProps) {
  const [mode, setMode] = useState<'login' | 'register'>(defaultMode)

  const switchToLogin = () => setMode('login')
  const switchToRegister = () => setMode('register')

  return (
    <Box
      style={{
        minHeight: '100vh',
        display: 'flex',
        background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #3b82f6 100%)',
      }}
    >
      {/* Left Side - Branding */}
      <Box
        style={{
          display: 'none',
          '@media (min-width: 1024px)': {
            display: 'flex',
            width: '50%',
            background: 'linear-gradient(135deg, #eff6ff 0%, #e0e7ff 50%, #f3e8ff 100%)',
            padding: '48px',
            flexDirection: 'column',
            justifyContent: 'space-between',
            position: 'relative',
            overflow: 'hidden',
          },
        }}
        className="hidden lg:flex lg:w-1/2 p-12 flex-col justify-between relative overflow-hidden"
        bg="linear-gradient(135deg, #eff6ff 0%, #e0e7ff 50%, #f3e8ff 100%)"
      >
        <Stack align="center" gap="xl">
          <Group justify="center" mb="md">
            <Box style={{ transform: 'scale(1.5)' }}>
              <PitchLogo className="w-12 h-12" />
            </Box>
          </Group>

          <Title
            order={2}
            ta="center"
            style={{
              background: 'linear-gradient(90deg, #6366f1, #8b5cf6, #3b82f6)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              fontSize: '2rem',
              fontWeight: 700,
              lineHeight: 1.2,
            }}
          >
            Create Assessments with AI
          </Title>
        </Stack>

        {/* Product Demo Image */}
        <Box
          style={{
            width: '100%',
            height: '256px',
            background: 'rgba(255, 255, 255, 0.2)',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '32px 0',
          }}
        >
          <Text size="sm" c="gray.6">
            Product Demo Placeholder
          </Text>
        </Box>

        <Stack gap="md">
          <Group gap="sm">
            <IconCheck size={20} color="#6366f1" />
            <Text size="md" c="gray.7">
              Generate unlimited question variations
            </Text>
          </Group>
          <Group gap="sm">
            <IconCheck size={20} color="#6366f1" />
            <Text size="md" c="gray.7">
              Support for all question types & file uploads
            </Text>
          </Group>
          <Group gap="sm">
            <IconCheck size={20} color="#6366f1" />
            <Text size="md" c="gray.7">
              Integrate with popular learning platforms
            </Text>
          </Group>
          <Group gap="sm">
            <IconCheck size={20} color="#6366f1" />
            <Text size="md" c="gray.7">
              Advanced analytics & progress tracking
            </Text>
          </Group>
          <Group gap="sm">
            <IconCheck size={20} color="#6366f1" />
            <Text size="md" c="gray.7">
              Trusted by educators worldwide
            </Text>
          </Group>
        </Stack>

        {/* Floating Elements */}
        <Box
          style={{
            position: 'absolute',
            top: '80px',
            right: '80px',
            width: '128px',
            height: '128px',
            background: 'rgba(165, 180, 252, 0.3)',
            borderRadius: '50%',
            filter: 'blur(40px)',
          }}
        />
        <Box
          style={{
            position: 'absolute',
            bottom: '160px',
            right: '40px',
            width: '96px',
            height: '96px',
            background: 'rgba(196, 181, 253, 0.4)',
            borderRadius: '50%',
            filter: 'blur(32px)',
          }}
        />
        <Box
          style={{
            position: 'absolute',
            top: '50%',
            right: '128px',
            width: '64px',
            height: '64px',
            background: 'rgba(147, 197, 253, 0.4)',
            borderRadius: '50%',
            filter: 'blur(24px)',
          }}
        />
      </Box>

      {/* Right Side - Authentication Form */}
      <Box
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '32px',
        }}
      >
        <Container size={420}>
          {mode === 'register' ? (
            <RegisterForm onSwitchToLogin={switchToLogin} />
          ) : (
            <LoginForm onSwitchToRegister={switchToRegister} />
          )}
        </Container>
      </Box>
    </Box>
  )
}
