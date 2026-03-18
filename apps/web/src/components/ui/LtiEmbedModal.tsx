'use client'

import { useEffect, useState } from 'react'
import {
  Alert,
  Button,
  CopyButton,
  Divider,
  Group,
  Loader,
  Modal,
  ScrollArea,
  Stack,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
  Title,
} from '@mantine/core'
import { useForm } from '@mantine/form'
import {
  IconAlertTriangle,
  IconCheck,
  IconCircleCheck,
  IconCopy,
  IconLink,
} from '@tabler/icons-react'
import { api } from '@/lib/client'

// ─── Types ────────────────────────────────────────────────────────────────────

interface LtiCredentials {
  v13: {
    launchUrl: string
    oidcLoginUrl: string
    jwksUrl: string
    redirectUri: string
    publicKeyPem: string | null
  }
  v11: { launchUrl: string }
}

interface LtiEmbedModalProps {
  opened: boolean
  onClose: () => void
  sessionId: string
}

// ─── Copy Field ───────────────────────────────────────────────────────────────

function CopyField({
  label,
  value,
  note,
  multiline,
}: {
  label: string
  value: string
  note?: string
  multiline?: boolean
}) {
  return (
    <Stack gap={4}>
      <Text size="sm" fw={600}>
        {label}
      </Text>
      {note && (
        <Text size="xs" c="dimmed">
          {note}
        </Text>
      )}
      <Group gap={0} wrap="nowrap" align="flex-start">
        {multiline ? (
          <Textarea
            value={value}
            readOnly
            autosize
            minRows={3}
            maxRows={6}
            style={{ flex: 1 }}
            styles={{
              input: {
                fontFamily: 'monospace',
                fontSize: 12,
                borderRadius: '4px 0 0 4px',
                borderRight: 'none',
              },
            }}
          />
        ) : (
          <TextInput
            value={value}
            readOnly
            style={{ flex: 1 }}
            styles={{
              input: {
                fontFamily: 'monospace',
                fontSize: 12,
                borderRadius: '4px 0 0 4px',
                borderRight: 'none',
              },
            }}
          />
        )}
        <CopyButton value={value} timeout={1500}>
          {({ copied, copy }) => (
            <Button
              onClick={copy}
              variant="light"
              color={copied ? 'teal' : 'gray'}
              leftSection={copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
              style={{
                borderRadius: '0 4px 4px 0',
                flexShrink: 0,
                alignSelf: multiline ? 'stretch' : undefined,
              }}
            >
              {copied ? 'Copied' : 'Copy'}
            </Button>
          )}
        </CopyButton>
      </Group>
    </Stack>
  )
}

// ─── Modal ────────────────────────────────────────────────────────────────────

export function LtiEmbedModal({ opened, onClose, sessionId }: LtiEmbedModalProps) {
  const [credentials, setCredentials] = useState<LtiCredentials | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [registering, setRegistering] = useState(false)
  const [registered, setRegistered] = useState(false)
  const [registerError, setRegisterError] = useState<string | null>(null)

  const form = useForm({
    initialValues: {
      name: '',
      keysetUrl: '',
      issuer: '',
      authTokenUrl: '',
      authLoginUrl: '',
      clientId: '',
      deploymentId: '',
    },
    validate: {
      name: (v) => (v.trim().length < 2 ? 'Name must be at least 2 characters' : null),
      keysetUrl: (v) => (v.trim() ? null : 'Required'),
      issuer: (v) => (v.trim() ? null : 'Required'),
      authTokenUrl: (v) => (v.trim() ? null : 'Required'),
      authLoginUrl: (v) => (v.trim() ? null : 'Required'),
      clientId: (v) => (v.trim() ? null : 'Required'),
      deploymentId: (v) => (v.trim() ? null : 'Required'),
    },
  })

  useEffect(() => {
    if (!opened || credentials) return
    setLoading(true)
    setError(null)
    api.lti
      .getCredentials()
      .then((data) => setCredentials(data))
      .catch(() => setError('Failed to load LTI credentials.'))
      .finally(() => setLoading(false))
  }, [opened, credentials])

  const handleRegister = form.onSubmit(async (values) => {
    setRegistering(true)
    setRegisterError(null)
    try {
      await api.lti.registerPlatform(values)
      setRegistered(true)
      form.reset()
    } catch {
      setRegisterError(
        'Failed to register the LMS platform. Please check the values and try again.'
      )
    } finally {
      setRegistering(false)
    }
  })

  const redirectUriJson = credentials ? `["${credentials.v13.redirectUri}"]` : ''

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs" align="center">
          <ThemeIcon color="blue" variant="light" radius="xl" size="md">
            <IconLink size={16} />
          </ThemeIcon>
          <Stack gap={0}>
            <Text fw={700} size="lg" lh={1.2}>
              Embed in LMS
            </Text>
            <Text size="xs" c="dimmed">
              Connect this session to your Learning Management System via LTI
            </Text>
          </Stack>
        </Group>
      }
      size="lg"
      centered
      scrollAreaComponent={ScrollArea.Autosize}
    >
      {loading && (
        <Group justify="center" py="xl">
          <Loader size="sm" />
          <Text size="sm" c="dimmed">
            Loading credentials…
          </Text>
        </Group>
      )}

      {error && (
        <Alert icon={<IconAlertTriangle size={16} />} color="red" variant="light">
          {error}
        </Alert>
      )}

      {credentials && (
        <Stack gap="xl">
          {/* ── Section 1: Tool credentials to paste into the LMS ── */}
          <Stack gap="md">
            <Title order={5}>1. Add these credentials to your LMS</Title>

            <CopyField label="Launch URL" value={credentials.v13.launchUrl} />
            <CopyField label="Auth URL" value={credentials.v13.oidcLoginUrl} />

            {credentials.v13.publicKeyPem ? (
              <CopyField label="Public Key" value={credentials.v13.publicKeyPem} multiline />
            ) : (
              <CopyField
                label="Public Keyset URL (JWKS)"
                value={credentials.v13.jwksUrl}
                note="Paste this URL into the Public Key / JWKS field. Your LMS will fetch keys automatically."
              />
            )}

            <CopyField
              label="Redirect URIs"
              value={redirectUriJson}
              note="Note that different LMSs have different formats for redirect URIs."
            />
          </Stack>

          <Divider />

          {/* ── Section 2: LMS-provided credentials to register here ── */}
          <Stack gap="md">
            <Stack gap={2}>
              <Title order={5}>2. Add LTI 1.3 Credential</Title>
              <Text size="xs" c="dimmed">
                Configure LTI 1.3 credentials to launch this assignment from your Learning
                Management System.
              </Text>
            </Stack>

            {registered && (
              <Alert icon={<IconCircleCheck size={16} />} color="teal" variant="light">
                LMS platform registered successfully.
              </Alert>
            )}

            {registerError && (
              <Alert icon={<IconAlertTriangle size={16} />} color="red" variant="light">
                {registerError}
              </Alert>
            )}

            <form onSubmit={handleRegister}>
              <Stack gap="sm">
                <TextInput
                  label="Credential Name"
                  description="Give your credential a short and descriptive name."
                  placeholder="e.g. Adobe Learning Manager"
                  withAsterisk
                  {...form.getInputProps('name')}
                />

                <Divider label="LMS Configuration" labelPosition="left" />

                <TextInput
                  label="Keyset URL"
                  description="Enter the LMS-provided keyset URL"
                  placeholder="https://lms.example.com/lti/1.3/jwks"
                  withAsterisk
                  {...form.getInputProps('keysetUrl')}
                />

                <TextInput
                  label="Issuer"
                  description="Enter the LMS issuer"
                  placeholder="https://lms.example.com"
                  withAsterisk
                  {...form.getInputProps('issuer')}
                />

                <TextInput
                  label="Token URL"
                  description="Enter the LMS-provided token URL"
                  placeholder="https://lms.example.com/lti/1.3/token"
                  withAsterisk
                  {...form.getInputProps('authTokenUrl')}
                />

                <TextInput
                  label="Auth URL"
                  description="Enter the LMS-provided auth URL"
                  placeholder="https://lms.example.com/lti/1.3/authorize"
                  withAsterisk
                  {...form.getInputProps('authLoginUrl')}
                />

                <TextInput
                  label="Client ID"
                  description="Enter the LMS-provided client ID"
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  withAsterisk
                  {...form.getInputProps('clientId')}
                />

                <TextInput
                  label="Deployment ID"
                  description="Enter the LMS-provided deployment ID"
                  placeholder="44"
                  withAsterisk
                  {...form.getInputProps('deploymentId')}
                />

                <Group justify="flex-end" mt="xs">
                  <Button type="submit" loading={registering}>
                    Register
                  </Button>
                </Group>
              </Stack>
            </form>
          </Stack>
        </Stack>
      )}
    </Modal>
  )
}
