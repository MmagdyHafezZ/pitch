'use client'

import { useState } from 'react'
import {
  Paper,
  TextInput,
  PasswordInput,
  Button,
  Title,
  Text,
  Anchor,
  Container,
  Alert,
  Stack,
} from '@mantine/core'
import { IconAlertCircle } from '@tabler/icons-react'
import { useRegisterForm } from '../hooks/useAuthForm'
import { notifications } from '@mantine/notifications'

interface RegisterFormProps {
  onSwitchToLogin?: () => void
  onSuccess?: () => void
}

export function RegisterForm({ onSwitchToLogin, onSuccess }: RegisterFormProps) {
  const [showError, setShowError] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const { form, handleSubmit, isLoading } = useRegisterForm({
    onSuccess: () => {
      notifications.show({
        title: 'Account created!',
        message: 'Welcome! Your account has been successfully created.',
        color: 'green',
      })
      onSuccess?.()
    },
    onError: (error) => {
      setErrorMessage(error)
      setShowError(true)
    },
  })

  return (
    <Container size={420} my={40}>
      <Title ta="center" order={2} fw={900} mb="md">
        Create your account
      </Title>

      <Text c="dimmed" size="sm" ta="center" mb="xl">
        Join us today and start your journey
      </Text>

      <Paper withBorder shadow="md" p={30} mt={30} radius="md">
        <form onSubmit={handleSubmit}>
          <Stack gap="sm">
            {showError && (
              <Alert
                icon={<IconAlertCircle size="1rem" />}
                title="Registration Error"
                color="red"
                variant="filled"
                onClose={() => setShowError(false)}
                withCloseButton
              >
                {errorMessage}
              </Alert>
            )}

            <TextInput
              label="Full Name"
              placeholder="Your full name"
              required
              {...form.getInputProps('name')}
              error={form.errors.name}
            />

            <TextInput
              label="Email"
              placeholder="your@email.com"
              required
              {...form.getInputProps('email')}
              error={form.errors.email}
            />

            <PasswordInput
              label="Password"
              placeholder="Create a password"
              required
              {...form.getInputProps('password')}
              error={form.errors.password}
            />

            <PasswordInput
              label="Confirm Password"
              placeholder="Confirm your password"
              required
              {...form.getInputProps('confirmPassword')}
              error={form.errors.confirmPassword}
            />

            <Button type="submit" fullWidth mt="xl" loading={isLoading} disabled={isLoading}>
              Create account
            </Button>

            {onSwitchToLogin && (
              <Text c="dimmed" size="sm" ta="center" mt="md">
                Already have an account?{' '}
                <Anchor size="sm" component="button" type="button" onClick={onSwitchToLogin}>
                  Sign in
                </Anchor>
              </Text>
            )}
          </Stack>
        </form>
      </Paper>
    </Container>
  )
}
