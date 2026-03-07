'use client'

import { Box, Title, Text, Button, Stack, ThemeIcon } from '@mantine/core'
import { IconRocket } from '@tabler/icons-react'
import { motion } from 'framer-motion'
import { useAuthStore } from '@/features/auth/stores/auth.store'

interface WelcomeStepProps {
  onNext: () => void
}

export function WelcomeStep({ onNext }: WelcomeStepProps) {
  const user = useAuthStore((s) => s.user)
  const firstName = user?.name?.split(' ')[0] ?? 'there'

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.35 }}
    >
      <Stack align="center" gap="xl" py="xl">
        <ThemeIcon
          size={80}
          radius="xl"
          variant="gradient"
          gradient={{ from: 'indigo', to: 'cyan' }}
        >
          <IconRocket size={40} />
        </ThemeIcon>

        <Box ta="center">
          <Title order={1} fw={700} mb="sm">
            Welcome, {firstName}!
          </Title>
          <Text c="dimmed" size="lg" maw={480} mx="auto">
            Let&apos;s take a few minutes to set up your PITCH profile and show you around. You can
            skip any step at any time.
          </Text>
        </Box>

        <Button size="lg" onClick={onNext} px={40}>
          Get Started
        </Button>
      </Stack>
    </motion.div>
  )
}
