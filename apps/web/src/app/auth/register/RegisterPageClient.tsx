'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Box, Container, Text, Title } from '@mantine/core'
import { RegisterForm } from '@/features/auth/components/RegisterForm'
import SoftAurora from '@/components/SoftAurora'
import {
  persistTeamInviteContext,
  readTeamInviteContextFromSearch,
} from '@/features/teams/utils/team-invite-context'
import styles from '../auth-layout.module.css'

export function RegisterPageClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const inviteEmail = searchParams.get('email')?.trim() || undefined

  useEffect(() => {
    const inviteContext = readTeamInviteContextFromSearch(
      new URLSearchParams(searchParams.toString())
    )
    if (inviteContext) {
      persistTeamInviteContext(inviteContext)
    }
  }, [searchParams])

  return (
    <Box className={styles.page}>
      <Box className={styles.auroraLayer} aria-hidden="true">
        <SoftAurora
          speed={0.6}
          scale={1.5}
          brightness={1}
          color1="#f7f7f7"
          color2="#e100ff"
          noiseFrequency={2.5}
          noiseAmplitude={1}
          bandHeight={0.5}
          bandSpread={1}
          octaveDecay={0.1}
          layerOffset={0}
          colorSpeed={1}
          enableMouseInteraction
          mouseInfluence={0.25}
        />
      </Box>
      <Box className={styles.auroraOverlay} aria-hidden="true" />
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
              className={`${styles.mascotImage} ${styles.mascotDesktop}`}
            />
            <Box
              component="img"
              src="/pitchMascotMobile.png"
              alt="Pitch mascot"
              className={`${styles.mascotImage} ${styles.mascotMobile}`}
            />
          </Box>
          <Box className={styles.heroText}>
            <Title order={2} fw={700} c="white" className={styles.title}>
              Your reps start here.
            </Title>
            <Text size="sm" className={styles.supporting} style={{ maxWidth: '360px' }}>
              Build a profile, pick a scenario, and start practising real sales conversations with
              AI that challenges you like a real buyer would.
            </Text>
          </Box>
        </Box>
      </Box>

      <Box className={styles.divider} />

      <Box className={`${styles.column} ${styles.columnRight}`}>
        <Container size={440} w="100%" className={`${styles.formShift} ${styles.formPanel}`}>
          <RegisterForm
            inviteEmail={inviteEmail}
            onSwitchToLogin={() => {
              const query = searchParams.toString()
              router.push(query ? `/auth/login?${query}` : '/auth/login')
            }}
          />
        </Container>
      </Box>
    </Box>
  )
}
