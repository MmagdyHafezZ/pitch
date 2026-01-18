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
        background:
          'linear-gradient(135deg, #0b1a52 0%, #112374 45%, #1c3a9a 100%), radial-gradient(380px 380px at 15% 20%, rgba(255, 255, 255, 0.50) 0%, rgba(255, 255, 255, 0) 70%), radial-gradient(420px 420px at 85% 75%, rgba(255, 255, 255, 0.5) 0%, rgba(255, 255, 255, 0) 72%)',
      }}
    >
      <Box className={styles.brand}>P.IT.C.H.</Box>
      <Box className={`${styles.column} ${styles.columnLeft}`}>
        <Box className={styles.hero}>
          <Box className={styles.mascotWrap}>
            <Box className={styles.mascotShadow} />
            <Box className={styles.mascotGlow} />
            <Box
              component="img"
              src="/pitchMascot.png"
              alt="Pitch mascot"
              className={styles.mascotImage}
              style={{
                width: 'min(300px, 76vw)',
                height: 'auto',
              }}
            />
          </Box>
          <Box className={styles.heroText}>
            <Title order={2} fw={700} c="white" className={styles.title}>
              Welcome back.
            </Title>
            <Text size="sm" className={styles.supporting} style={{ maxWidth: '360px' }}>
              Everything is ready when you are. Your progress is right where you left it.
            </Text>
          </Box>
        </Box>
      </Box>

      <Box className={styles.divider} />

      <Box className={`${styles.column} ${styles.columnRight}`}>
        <Container size={440} w="100%" className={styles.formShift}>
          <LoginForm onSwitchToRegister={() => router.push('/auth/register')} />
        </Container>
      </Box>
    </Box>
  )
}
