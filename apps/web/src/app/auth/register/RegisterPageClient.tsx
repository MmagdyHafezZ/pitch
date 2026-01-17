'use client'

import { useRouter } from 'next/navigation'
import { Box, Container, Stack, Text, Title } from '@mantine/core'
import { RegisterForm } from '@/features/auth/components/RegisterForm'
import styles from '../auth-layout.module.css'

export function RegisterPageClient() {
  const router = useRouter()

  return (
    <Box
      className={styles.page}
      style={{
        background: 'linear-gradient(135deg, #0b1a52 0%, #112374 45%, #1c3a9a 100%)',
      }}
    >
      <Box className={styles.column}>
        <Box className={styles.hero}>
          <Box
            component="img"
            src="/pitchMascot.png"
            alt="Pitch mascot"
            style={{
              width: 'min(260px, 70vw)',
              height: 'auto',
              borderRadius: '0',
              boxShadow: 'none',
              background: 'transparent',
            }}
          />
          <Box className={styles.heroText}>
            <Title order={2} fw={700} c="white">
              Welcome back
            </Title>
            <Text size="sm" c="gray.3" style={{ maxWidth: '320px' }}>
              Create your account with a trusted OAuth provider.
            </Text>
            <Text size="xs" c="gray.4">
              OAuth-only, no passwords stored.
            </Text>
          </Box>
        </Box>
      </Box>

      <Box className={styles.divider} />

      <Box className={styles.column}>
        <Container size={440} w="100%">
          <RegisterForm onSwitchToLogin={() => router.push('/auth/login')} />
        </Container>
      </Box>
    </Box>
  )
}
