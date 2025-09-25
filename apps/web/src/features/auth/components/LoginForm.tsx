'use client';

import { useState } from 'react';
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
} from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import { useLoginForm } from '../hooks/useAuthForm';
import { notifications } from '@mantine/notifications';

interface LoginFormProps {
  onSwitchToRegister?: () => void;
  onSuccess?: () => void;
}

export function LoginForm({ onSwitchToRegister, onSuccess }: LoginFormProps) {
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const { form, handleSubmit, isLoading } = useLoginForm({
    onSuccess: () => {
      notifications.show({
        title: 'Welcome back!',
        message: 'You have been successfully logged in.',
        color: 'green',
      });
      onSuccess?.();
    },
    onError: (error) => {
      setErrorMessage(error);
      setShowError(true);
    },
  });

  return (
    <Container size={420} my={40}>
      <Title ta="center" order={2} fw={900} mb="md">
        Welcome back!
      </Title>

      <Text c="dimmed" size="sm" ta="center" mb="xl">
        Enter your credentials to access your account
      </Text>

      <Paper withBorder shadow="md" p={30} mt={30} radius="md">
        <form onSubmit={handleSubmit}>
          <Stack gap="sm">
            {showError && (
              <Alert
                icon={<IconAlertCircle size="1rem" />}
                title="Login Error"
                color="red"
                variant="filled"
                onClose={() => setShowError(false)}
                withCloseButton
              >
                {errorMessage}
              </Alert>
            )}

            <TextInput
              label="Email"
              placeholder="your@email.com"
              required
              {...form.getInputProps('email')}
              error={form.errors.email}
            />

            <PasswordInput
              label="Password"
              placeholder="Your password"
              required
              {...form.getInputProps('password')}
              error={form.errors.password}
            />

            <Button
              type="submit"
              fullWidth
              mt="xl"
              loading={isLoading}
              disabled={isLoading}
            >
              Sign in
            </Button>

            {onSwitchToRegister && (
              <Text c="dimmed" size="sm" ta="center" mt="md">
                Don&apos;t have an account yet?{' '}
                <Anchor
                  size="sm"
                  component="button"
                  type="button"
                  onClick={onSwitchToRegister}
                >
                  Create account
                </Anchor>
              </Text>
            )}
          </Stack>
        </form>
      </Paper>
    </Container>
  );
}