'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Badge,
  Box,
  Button,
  Center,
  Container,
  Group,
  Loader,
  Paper,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import {
  IconBadgeTm,
  IconArrowLeft,
  IconClock,
  IconMail,
  IconSend,
  IconShieldLock,
} from '@tabler/icons-react'
import { useAuthStore } from '@/features/auth/stores/auth.store'
import { api } from '@/lib/client'
import { LandingBackground } from '../../LandingBackground'
import classes from './access-request.module.css'

export default function AccessRequestPage() {
  const router = useRouter()
  const user = useAuthStore((state) => state.user)
  const setUser = useAuthStore((state) => state.setUser)
  const logout = useAuthStore((state) => state.logout)
  const [submitting, setSubmitting] = useState(false)

  const studioAccess = user?.settings?.studioAccess
  const status = studioAccess?.status
  const requestedAt = studioAccess?.requestedAt
    ? new Date(studioAccess.requestedAt).toLocaleString()
    : null

  const content = useMemo(() => {
    if (!user) {
      return {
        badge: 'Checking access',
        title: 'Loading your access state',
        description: 'We are checking whether your account can open Studio.',
        panelTitle: 'Checking access',
        panelText: 'One moment while we load your account.',
      }
    }

    if (status === 'pending') {
      return {
        badge: 'Request pending',
        title: 'Your Studio access request is in review',
        description:
          'A super admin still needs to approve your request and assign quota before Studio unlocks.',
        panelTitle: 'Request received',
        panelText: requestedAt
          ? `Submitted on ${requestedAt}. You can leave this page and come back later.`
          : 'Your request has been received and is waiting for review.',
      }
    }

    if (status === 'denied') {
      return {
        badge: 'Request denied',
        title: 'Your Studio access request was not approved',
        description:
          'A super admin reviewed your request and did not grant Studio access at this time.',
        panelTitle: 'What you can do',
        panelText:
          'If this should be reconsidered, you can submit a new request and a super admin can review it again.',
      }
    }

    return {
      badge: 'Restricted access',
      title: 'Studio access is currently limited',
      description:
        'This workspace is approved manually. Request access below and a super admin can unlock Studio with a quota allocation for your account.',
      panelTitle: 'What happens next',
      panelText:
        'Once approved, your account gets a personal workspace and a quota-backed plan so you can start using Studio immediately.',
    }
  }, [requestedAt, status, user])

  const handleRequestAccess = async () => {
    if (!user) return

    setSubmitting(true)
    try {
      const nextAccess = await api.studioAccess.request()
      setUser({
        ...user,
        settings: {
          ...(user.settings ?? {}),
          studioAccess: nextAccess,
        },
      })
      notifications.show({
        title: 'Request submitted',
        message: 'Your Studio access request has been sent to the super admins.',
        color: 'teal',
      })
    } catch (error) {
      notifications.show({
        title: 'Request failed',
        message: error instanceof Error ? error.message : 'Unable to request access right now.',
        color: 'red',
      })
    } finally {
      setSubmitting(false)
    }
  }

  if (!user) {
    return (
      <Center mih="100vh">
        <Loader size="lg" />
      </Center>
    )
  }

  const isPending = status === 'pending'

  return (
    <Box className={classes.page}>
      <LandingBackground />

      <Container size="lg" className={classes.shell}>
        <Box className={classes.frame}>
          <Text className={classes.brand}>P.IT.C.H.</Text>

          <Paper className={classes.card}>
            <Stack gap={28} className={classes.content}>
              <Group justify="space-between" align="flex-start" gap="xl" className={classes.hero}>
                <Stack gap={12} className={classes.heroCopy}>
                  <Badge
                    size="lg"
                    radius="xl"
                    color={isPending ? 'yellow' : 'blue'}
                    variant="light"
                    className={classes.badge}
                  >
                    {content.badge}
                  </Badge>

                  <Title order={1} className={classes.title}>
                    {content.title}
                  </Title>

                  <Text size="md" className={classes.description}>
                    {content.description}
                  </Text>
                </Stack>

                <Paper className={classes.heroPanel}>
                  <Group gap="md" align="flex-start" wrap="nowrap">
                    <ThemeIcon size={48} radius="xl" variant="light" color="indigo">
                      <IconShieldLock size={22} />
                    </ThemeIcon>

                    <Stack gap={4}>
                      <Text className={classes.heroPanelLabel}>Studio access</Text>
                      <Text className={classes.heroPanelTitle}>
                        {isPending
                          ? 'Approval is in progress'
                          : 'Manual review unlocks your workspace'}
                      </Text>
                      <Text size="sm" className={classes.heroPanelText}>
                        {isPending
                          ? 'A super admin needs to approve the request and assign quota before Studio opens.'
                          : 'Requests are reviewed account-by-account so quota is assigned correctly before first use.'}
                      </Text>
                    </Stack>
                  </Group>
                </Paper>
              </Group>

              <Box className={classes.grid}>
                <Paper className={`${classes.panel} ${classes.identityPanel}`}>
                  <Stack gap={14}>
                    <ThemeIcon size={44} radius="xl" variant="light" color="blue">
                      <IconMail size={20} />
                    </ThemeIcon>

                    <Box>
                      <Text className={classes.panelLabel}>Signed in as:</Text>
                      <Text className={classes.email}>{user.email}</Text>
                    </Box>
                  </Stack>
                </Paper>

                <Paper className={`${classes.panel} ${isPending ? classes.pendingPanel : ''}`}>
                  <Group gap="sm" wrap="nowrap" align="flex-start">
                    <ThemeIcon
                      size={40}
                      radius="xl"
                      variant="light"
                      color={isPending ? 'yellow' : 'indigo'}
                    >
                      {isPending ? <IconClock size={18} /> : <IconBadgeTm size={18} />}
                    </ThemeIcon>

                    <Box>
                      <Text className={classes.panelTitle}>{content.panelTitle}</Text>
                      <Text size="sm" className={classes.panelText}>
                        {content.panelText}
                      </Text>
                    </Box>
                  </Group>
                </Paper>
              </Box>

              {!isPending ? (
                <Box className={classes.steps}>
                  <Paper className={classes.stepCard}>
                    <Text className={classes.stepIndex}>01</Text>
                    <Text className={classes.stepTitle}>Request access</Text>
                    <Text size="sm" className={classes.stepText}>
                      Your current account email is sent to the super admins.
                    </Text>
                  </Paper>

                  <Paper className={classes.stepCard}>
                    <Text className={classes.stepIndex}>02</Text>
                    <Text className={classes.stepTitle}>Quota is assigned</Text>
                    <Text size="sm" className={classes.stepText}>
                      Approval includes a quota allocation for your Studio usage.
                    </Text>
                  </Paper>

                  <Paper className={classes.stepCard}>
                    <Text className={classes.stepIndex}>03</Text>
                    <Text className={classes.stepTitle}>Studio unlocks</Text>
                    <Text size="sm" className={classes.stepText}>
                      Once approved, your workspace is ready and Studio opens normally.
                    </Text>
                  </Paper>
                </Box>
              ) : (
                <Paper className={classes.waitingBanner}>
                  <Group gap="sm" wrap="nowrap" align="flex-start">
                    <Text size="sm" className={classes.waitingText}>
                      Your request is attached to this account and is waiting for super admin
                      approval. You can leave this page and come back later.
                    </Text>
                  </Group>
                </Paper>
              )}

              {!isPending && (
                <Button
                  size="lg"
                  leftSection={<IconSend size={18} />}
                  loading={submitting}
                  onClick={handleRequestAccess}
                  className={classes.requestButton}
                >
                  Request Studio access
                </Button>
              )}

              <Box className={classes.footer}>
                <Button
                  variant="subtle"
                  color="gray"
                  leftSection={<IconArrowLeft size={16} />}
                  onClick={() => router.push('/')}
                >
                  Back to home
                </Button>

                <Button variant="light" color="red" onClick={logout}>
                  Switch accounts
                </Button>
              </Box>
            </Stack>
          </Paper>
        </Box>
      </Container>
    </Box>
  )
}
