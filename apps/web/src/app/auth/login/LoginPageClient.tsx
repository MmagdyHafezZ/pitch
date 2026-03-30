'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Box, Container, Text, Title } from '@mantine/core'
import { LoginForm } from '@/features/auth/components/LoginForm'
import SoftAurora from '@/components/SoftAurora'
import {
  persistTeamInviteContext,
  readTeamInviteContextFromSearch,
} from '@/features/teams/utils/team-invite-context'
import styles from '../auth-layout.module.css'

export function LoginPageClient() {
  const router = useRouter()
  const searchParams = useSearchParams()

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
          <Box className={`${styles.heroText} ${styles.heroTextSpacer}`}>
            <Title order={2} fw={700} c="white" className={styles.title}>
              Train like it&apos;s real.
            </Title>
            <Text size="sm" className={styles.supporting} style={{ maxWidth: '360px' }}>
              Practice your pitch against AI personas that push back, raise real objections, and
              think like actual buyers — so you&apos;re sharp and ready when it counts.
            </Text>
          </Box>
        </Box>
      </Box>

      <Box className={styles.divider} />

      <Box className={`${styles.column} ${styles.columnRight}`}>
        <Container size={440} w="100%" className={`${styles.formShift} ${styles.formPanel}`}>
          <LoginForm
            onSwitchToRegister={() => {
              const query = searchParams.toString()
              router.push(query ? `/auth/register?${query}` : '/auth/register')
            }}
          />
        </Container>
      </Box>
    </Box>
  )
}
