'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Loader,
  Paper,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from '@mantine/core'
import { IconAlertCircle, IconBolt, IconCreditCard, IconStars } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { api } from '@/lib/client'

type BillingInterval = 'MONTH' | 'YEAR'

type PlanLike = {
  id: string
  name?: string
  description?: string | null
  planLevel?: string
  maxCoins?: number
  isActive?: boolean
}

type SubscriptionLike = {
  id: string
  teamId?: string
  planId?: string
  interval?: BillingInterval | string
  currentPeriodStart?: string
  currentPeriodEnd?: string
  cancelAtPeriodEnd?: boolean
  plan?: PlanLike | null
}

const formatDate = (value?: string) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

const formatCoins = (value?: number) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—'
  return new Intl.NumberFormat().format(value)
}

type Props = {
  teamId: string
  teamName: string
  canManage: boolean
}

export function TeamSubscriptionPanel({ teamId, teamName, canManage }: Props) {
  const [plans, setPlans] = useState<PlanLike[]>([])
  const [subscription, setSubscription] = useState<SubscriptionLike | null>(null)
  const [interval, setInterval] = useState<BillingInterval>('MONTH')
  const [loading, setLoading] = useState(true)
  const [savingPlanId, setSavingPlanId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const [plansResponse, subscriptionResponse] = await Promise.all([
          api.plans.getAll().catch((err) => {
            throw err
          }),
          api.subscriptions.getByTeamId(teamId).catch((err) => {
            const message = err instanceof Error ? err.message : String(err)
            if (/not found|couldn'?t find a subscription/i.test(message)) {
              return null
            }
            throw err
          }),
        ])

        if (!mounted) return

        const normalizedPlans = Array.isArray(plansResponse)
          ? plansResponse
          : Array.isArray((plansResponse as any)?.plans)
            ? (plansResponse as any).plans
            : []

        setPlans(
          normalizedPlans
            .filter(Boolean)
            .sort((a: PlanLike, b: PlanLike) =>
              String(a?.name ?? '').localeCompare(String(b?.name ?? ''))
            )
        )

        const nextSubscription = subscriptionResponse as SubscriptionLike | null
        setSubscription(nextSubscription)
        if (nextSubscription?.interval === 'YEAR' || nextSubscription?.interval === 'MONTH') {
          setInterval(nextSubscription.interval)
        }
      } catch (err) {
        if (!mounted) return
        setError(err instanceof Error ? err.message : 'Failed to load subscription data')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    void load()
    return () => {
      mounted = false
    }
  }, [teamId])

  const currentPlanId = subscription?.planId ?? subscription?.plan?.id ?? null

  const activePlans = useMemo(() => plans.filter((plan) => plan?.isActive !== false), [plans])

  const handleSelectPlan = async (plan: PlanLike) => {
    if (!canManage) return
    setSavingPlanId(plan.id)
    setError(null)
    try {
      let nextSubscription: SubscriptionLike

      if (!subscription?.id) {
        nextSubscription = await api.subscriptions.create({
          teamId,
          planId: plan.id,
          interval,
        })
      } else if (currentPlanId === plan.id) {
        nextSubscription = await api.subscriptions.update(subscription.id, {
          teamId,
          planId: plan.id,
          interval,
        })
      } else {
        nextSubscription = await api.subscriptions.upgrade(subscription.id, {
          planId: plan.id,
          interval,
        })
      }

      setSubscription(nextSubscription)
      notifications.show({
        title: 'Subscription updated',
        message: `${teamName} is now on ${plan.name ?? 'the selected'} plan.`,
        color: 'teal',
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update subscription'
      setError(message)
      notifications.show({
        title: 'Subscription update failed',
        message,
        color: 'red',
      })
    } finally {
      setSavingPlanId(null)
    }
  }

  return (
    <Card
      withBorder
      radius="xl"
      p="lg"
      shadow="lg"
      style={{
        background:
          'linear-gradient(160deg, color-mix(in srgb, var(--mantine-color-teal-6) 10%, var(--mantine-color-dark-8)), var(--mantine-color-dark-8))',
        borderColor: 'color-mix(in srgb, var(--mantine-color-teal-6) 28%, transparent)',
      }}
    >
      <Stack gap="md">
        <Group justify="space-between" align="flex-start">
          <Stack gap={2}>
            <Group gap="xs">
              <IconCreditCard size={16} />
              <Text fw={700}>Subscription</Text>
            </Group>
            <Text size="sm" c="dimmed">
              Choose a plan for this team and manage the active billing interval.
            </Text>
          </Stack>
          <SegmentedControl
            value={interval}
            onChange={(value) => setInterval(value as BillingInterval)}
            data={[
              { label: 'Monthly', value: 'MONTH' },
              { label: 'Yearly', value: 'YEAR' },
            ]}
            disabled={!canManage || loading}
            size="sm"
          />
        </Group>

        {error && (
          <Alert color="red" variant="light" icon={<IconAlertCircle size={16} />}>
            {error}
          </Alert>
        )}

        <Paper withBorder radius="lg" p="md" bg="dark.7">
          {loading ? (
            <Group gap="xs">
              <Loader size="sm" />
              <Text size="sm" c="dimmed">
                Loading subscription…
              </Text>
            </Group>
          ) : subscription ? (
            <Stack gap={6}>
              <Group justify="space-between" wrap="wrap">
                <Group gap="xs">
                  <IconStars size={14} />
                  <Title order={5}>{subscription.plan?.name ?? 'Active plan'}</Title>
                </Group>
                <Group gap="xs">
                  <Badge color="teal" variant="light">
                    {String(subscription.interval ?? interval)}
                  </Badge>
                  {subscription.cancelAtPeriodEnd && (
                    <Badge color="yellow" variant="light">
                      Cancels at period end
                    </Badge>
                  )}
                </Group>
              </Group>
              <Text size="sm" c="dimmed">
                Period: {formatDate(subscription.currentPeriodStart)} to{' '}
                {formatDate(subscription.currentPeriodEnd)}
              </Text>
              <Text size="sm" c="dimmed">
                Coins per period: {formatCoins(subscription.plan?.maxCoins)}
              </Text>
            </Stack>
          ) : (
            <Stack gap={4}>
              <Text fw={600}>No subscription configured</Text>
              <Text size="sm" c="dimmed">
                Select a plan below to activate one for this team.
              </Text>
            </Stack>
          )}
        </Paper>

        {loading ? null : activePlans.length === 0 ? (
          <Alert color="yellow" variant="light" icon={<IconAlertCircle size={16} />}>
            No active plans are available right now.
          </Alert>
        ) : (
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
            {activePlans.map((plan) => {
              const selected = currentPlanId === plan.id
              return (
                <Paper
                  key={plan.id}
                  withBorder
                  radius="lg"
                  p="md"
                  style={{
                    background: selected
                      ? 'linear-gradient(135deg, color-mix(in srgb, var(--mantine-color-teal-6) 14%, var(--mantine-color-dark-8)), var(--mantine-color-dark-8))'
                      : 'color-mix(in srgb, var(--mantine-color-dark-8) 95%, transparent)',
                    borderColor: selected
                      ? 'var(--mantine-color-teal-6)'
                      : 'color-mix(in srgb, var(--mantine-color-dark-4) 45%, transparent)',
                  }}
                >
                  <Stack gap="sm">
                    <Group justify="space-between" align="flex-start">
                      <Stack gap={2}>
                        <Text fw={700}>{plan.name ?? 'Unnamed plan'}</Text>
                        <Text size="xs" c="dimmed">
                          {plan.planLevel ?? 'Custom'}
                        </Text>
                      </Stack>
                      {selected && (
                        <Badge color="teal" variant="filled">
                          Current
                        </Badge>
                      )}
                    </Group>

                    <Text size="sm" c="dimmed" lineClamp={2}>
                      {plan.description || 'Subscription plan for team usage and coin allowance.'}
                    </Text>

                    <Group justify="space-between" align="center">
                      <Stack gap={0}>
                        <Text size="xs" c="dimmed">
                          Coin allowance
                        </Text>
                        <Text fw={700}>{formatCoins(plan.maxCoins)}</Text>
                      </Stack>
                      <Button
                        size="sm"
                        variant={selected ? 'default' : 'filled'}
                        color="teal"
                        leftSection={<IconBolt size={14} />}
                        loading={savingPlanId === plan.id}
                        onClick={() => void handleSelectPlan(plan)}
                        disabled={!canManage}
                      >
                        {selected ? 'Update interval' : 'Select plan'}
                      </Button>
                    </Group>
                  </Stack>
                </Paper>
              )
            })}
          </SimpleGrid>
        )}
      </Stack>
    </Card>
  )
}
