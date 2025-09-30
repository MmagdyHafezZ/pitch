'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Container, Title, Text, Button, Stack, Center, Loader } from '@mantine/core'
import { useAuth } from '@/features/auth'

export default function Home() {
  const { isAuthenticated, user, isLoading, logout } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/auth/login')
    }
  }, [isAuthenticated, isLoading, router])

  if (isLoading) {
    return (
      <Center h="100vh">
        <Loader size="lg" />
      </Center>
    )
  }

  if (!isAuthenticated) {
    return null // Will redirect
  }

  return (
    <Container size="md" py="xl">
      <Stack align="center" gap="xl">
        <Title order={1} ta="center">
          Welcome to PITCH
        </Title>

        <Text size="lg" ta="center" c="dimmed">
          Hello, {user?.name}! You&apos;re successfully logged in.
        </Text>

        <Text ta="center">
          This is your business management dashboard. The platform is ready for you to start
          building your business features.
        </Text>

        <Button onClick={() => logout()} variant="light">
          Logout
        </Button>
      </Stack>
    </Container>
  )
}
