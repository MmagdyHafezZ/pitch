'use client'

import { useRouter } from 'next/navigation'
import { Box, Container, Stack, Text, Title } from '@mantine/core'
import { LoginForm } from '@/features/auth/components/LoginForm'
import styles from '../auth-layout.module.css'

export function LoginPageClient() {
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
            
          </Box>
        </Box>
      </Box>

      <Box className={styles.divider} />

      <Box className={styles.column}>
        <Container size={440} w="100%">
          <LoginForm onSwitchToRegister={() => router.push('/auth/register')} />
        </Container>
      </Box>
    </Box>
  )
}
