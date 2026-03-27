'use client'

import { useEffect, useState } from 'react'
import {
  Badge,
  Box,
  Button,
  Divider,
  Group,
  Loader,
  NumberInput,
  Progress,
  SimpleGrid,
  Stack,
  Table,
  Text,
  ThemeIcon,
  Tooltip,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import {
  IconBolt,
  IconCheck,
  IconClock,
  IconInfoCircle,
  IconRefresh,
  IconTrendingUp,
  IconX,
} from '@tabler/icons-react'
import Link from 'next/link'
import { api, queryClient } from '@/lib/client'
import { useTeams } from '@/features/teams/hooks/useTeams'
import { useCoinsBalance } from '@/features/coins/hooks/useCoinsBalance'

// ── types ────────────────────────────────────────────────────────────────────
type Plan = {
  id: string
  name: string
  planLevel: string
  maxCoins: number
  coinCostPerSession: number
  coinPriceUsd: number
  isActive: boolean
}

type PendingPlanChange = {
  requestedPlanId: string
  requestedInterval: string
  requestedAt: string
  requestedByUserId: string
}

type Subscription = {
  id: string
  teamId: string
  planId: string
  interval: string
  currentPeriodStart: string
  currentPeriodEnd: string
  isActive: boolean
  plan?: Plan
  metadata?: { pendingPlanChange?: PendingPlanChange } | null
}

type LedgerEntry = {
  type: string
  createdAt?: string
  estimatedCoins?: number
  deltaCoins?: number
  sessionId?: string
  allowance?: number
  remainingAfter?: number
}

type RefillStatus = 'pending' | 'approved' | 'denied'
type RefillRequest = {
  requestedCoins: number
  requestedAt: string
  status: RefillStatus
  reviewedAt?: string
  reviewedBy?: string
  approvedCoins?: number
  teamId: string
}

const LEVEL_COLOR: Record<string, string> = {
  FREE: 'gray',
  PRO: 'blue',
  TEAM: 'violet',
  ENTERPRISE: 'orange',
}

const LEDGER_COLOR: Record<string, string> = {
  RESERVE: 'blue',
  ADJUST: 'orange',
  REFILL: 'teal',
  RELEASE: 'gray',
  UPGRADE: 'violet',
}

// ── helpers ───────────────────────────────────────────────────────────────────
function periodPacingLabel(
  usedPct: number,
  periodElapsedPct: number
): { label: string; color: string } | null {
  const delta = usedPct - periodElapsedPct
  if (delta > 20) return { label: 'Above average pace', color: 'orange' }
  if (delta < -20 && usedPct > 5) return { label: 'Well within limits', color: 'teal' }
  return null
}

// ── page ─────────────────────────────────────────────────────────────────────
export default function SubscriptionPage() {
  const { activeTeamId, teams } = useTeams()
  const teamBalance = useCoinsBalance(activeTeamId)

  // Determine whether this is the user's personal workspace or a shared team.
  // The frontend uses `user.id` as orgId for personal sessions; personal teams
  // typically have a single member (the owner). We treat a team as "personal"
  // when its membership count is exactly 1.
  const activeTeam = teams.find((t) => t.id === activeTeamId) ?? null
  const isPersonal = !activeTeam || !activeTeam.memberships || activeTeam.memberships.length <= 1
  const teamDisplayName = isPersonal ? null : (activeTeam?.name ?? null)

  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [plans, setPlans] = useState<Plan[]>([])
  const [ledger, setLedger] = useState<LedgerEntry[]>([])
  const [refillRequest, setRefillRequest] = useState<RefillRequest | null>(null)
  const [requestedCoins, setRequestedCoins] = useState<number>(500)
  const [loadingPage, setLoadingPage] = useState(true)
  const [switchingPlan, setSwitchingPlan] = useState<string | null>(null)
  const [submittingRefill, setSubmittingRefill] = useState(false)
  const [topupOpen, setTopupOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  const balance = teamBalance.data?.ok ? teamBalance.data : null
  const currentPlan = subscription?.plan ?? plans.find((p) => p.id === subscription?.planId)
  const usedCoins = balance ? balance.allowance - balance.remaining : 0
  const usedPct =
    balance && balance.allowance > 0 ? Math.round((usedCoins / balance.allowance) * 100) : 0

  // Contextual insight: sessions remaining
  const sessionsLeft =
    balance && currentPlan && currentPlan.coinCostPerSession > 0
      ? Math.floor(balance.remaining / currentPlan.coinCostPerSession)
      : null

  // Pacing: compare % credits used vs % of period elapsed
  const periodElapsedPct = subscription
    ? Math.round(
        ((Date.now() - new Date(subscription.currentPeriodStart).getTime()) /
          (new Date(subscription.currentPeriodEnd).getTime() -
            new Date(subscription.currentPeriodStart).getTime())) *
          100
      )
    : 0

  const pacing = periodElapsedPct > 0 ? periodPacingLabel(usedPct, periodElapsedPct) : null

  const daysLeft = subscription
    ? Math.max(
        0,
        Math.ceil((new Date(subscription.currentPeriodEnd).getTime() - Date.now()) / 86_400_000)
      )
    : null

  const barColor = usedPct >= 90 ? 'red' : usedPct >= 70 ? 'orange' : 'teal'

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 10)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (!activeTeamId) return
    let active = true
    void (async () => {
      setLoadingPage(true)
      try {
        const [sub, allPlans, myRequest] = await Promise.all([
          api.subscriptions.getByTeamId(activeTeamId).catch(() => null),
          api.plans.getAll().catch(() => []),
          api.coins.myRefillRequest().catch(() => null),
        ])
        if (!active) return
        setSubscription(sub)
        // Deduplicate plans by planLevel (keep first occurrence per level)
        const activePlans = (allPlans as Plan[]).filter((p) => p.isActive)
        const seen = new Set<string>()
        setPlans(
          activePlans.filter((p) => {
            if (seen.has(p.planLevel)) return false
            seen.add(p.planLevel)
            return true
          })
        )
        setRefillRequest(myRequest)
        if (sub) {
          const history = await api.coins.ledgerHistory(activeTeamId).catch(() => [])
          if (active) setLedger(history as LedgerEntry[])
        }
      } finally {
        if (active) setLoadingPage(false)
      }
    })()
    return () => {
      active = false
    }
  }, [activeTeamId])

  const handleSwitchPlan = async (plan: Plan) => {
    if (!subscription) return
    setSwitchingPlan(plan.id)
    try {
      await api.subscriptions.upgrade(subscription.id, {
        planId: plan.id,
        interval: subscription.interval ?? 'MONTH',
        teamId: subscription.teamId,
      })
      // Refresh subscription to show the pending plan change badge
      const updated = await api.subscriptions.getByTeamId(activeTeamId!)
      setSubscription(updated)
      notifications.show({
        title: 'Plan change requested',
        message: `Your request to switch to ${plan.name} is pending admin review.`,
        color: 'blue',
        icon: <IconClock size={16} />,
      })
    } catch (err) {
      notifications.show({
        title: 'Request failed',
        message: err instanceof Error ? err.message : 'Unable to request plan change.',
        color: 'red',
      })
    } finally {
      setSwitchingPlan(null)
    }
  }

  const handleRefillRequest = async () => {
    if (!activeTeamId) return
    setSubmittingRefill(true)
    try {
      const result = await api.coins.refillRequest({ requestedCoins, teamId: activeTeamId })
      setRefillRequest(result)
      setTopupOpen(false)
      notifications.show({
        title: 'Request submitted',
        message: `${requestedCoins.toLocaleString()} credits requested — admin will review shortly.`,
        color: 'teal',
        icon: <IconCheck size={16} />,
      })
    } catch (err) {
      notifications.show({
        title: 'Request failed',
        message: err instanceof Error ? err.message : 'Unable to submit request.',
        color: 'red',
      })
    } finally {
      setSubmittingRefill(false)
    }
  }

  if (loadingPage) {
    return (
      <Stack align="center" justify="center" h={320}>
        <Loader size="md" color="var(--pitch-accent-strong)" />
        <Text size="sm" c="dimmed">
          Loading…
        </Text>
      </Stack>
    )
  }

  // ── render ──────────────────────────────────────────────────────────────────
  return (
    <Box style={{ position: 'relative', minHeight: '100%' }}>
      {/* ── Page background blobs (scoped to subscription page) ────────────
          Sits behind everything via zIndex 0. Complements the global
          app-layout orbs with credit/coin-themed accent gradients.      */}
      <Box
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 0,
          overflow: 'hidden',
        }}
      >
        {/* Top-right — primary accent, reinforces the "credits" theme */}
        <Box
          style={{
            position: 'absolute',
            top: -120,
            right: -120,
            width: 560,
            height: 560,
            borderRadius: '50%',
            background:
              'radial-gradient(circle, color-mix(in srgb, var(--pitch-accent-strong) 12%, transparent) 0%, transparent 65%)',
            filter: 'blur(48px)',
          }}
        />
        {/* Bottom-left — secondary, softer */}
        <Box
          style={{
            position: 'absolute',
            bottom: 60,
            left: -100,
            width: 400,
            height: 400,
            borderRadius: '50%',
            background:
              'radial-gradient(circle, color-mix(in srgb, var(--pitch-selected, var(--pitch-accent)) 8%, transparent) 0%, transparent 70%)',
            filter: 'blur(56px)',
          }}
        />
      </Box>

      {/* ── Content (on top of background) ─────────────────────────────── */}
      <Box
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          justifyContent: 'center',
          padding: 'var(--mantine-spacing-xl)',
        }}
      >
        <style>{`
        @keyframes sub-rise {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .s1 { animation: sub-rise 0.38s cubic-bezier(.22,1,.36,1) 0.00s both; }
        .s2 { animation: sub-rise 0.38s cubic-bezier(.22,1,.36,1) 0.07s both; }
        .s3 { animation: sub-rise 0.38s cubic-bezier(.22,1,.36,1) 0.14s both; }
        .s4 { animation: sub-rise 0.38s cubic-bezier(.22,1,.36,1) 0.21s both; }
        .plan-tile {
          transition: border-color 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;
        }
        .plan-tile:hover {
          transform: translateY(-1px);
          box-shadow: 0 8px 20px color-mix(in srgb, #000 14%, transparent);
        }
      `}</style>

        <Stack
          gap="xl"
          w="100%"
          maw={760}
          style={{ opacity: mounted ? 1 : 0, transition: 'opacity 0.12s' }}
        >
          {/* ── 1. CREDIT BALANCE HERO ─────────────────────────────────────────
            The dominant element. Inspired by OpenAI's credit balance card and
            Vercel's usage page — one big number, meaningful context, pacing. */}
          <Box
            className="s1"
            p="xl"
            style={{
              borderRadius: 20,
              border: '1px solid var(--pitch-card-border, var(--mantine-color-default-border))',
              background: `linear-gradient(160deg,
              color-mix(in srgb, var(--pitch-card-bg, var(--mantine-color-body)) 100%, transparent) 0%,
              color-mix(in srgb, var(--pitch-card-bg-strong, var(--pitch-card-bg, var(--mantine-color-body))) 88%, transparent) 100%)`,
            }}
          >
            {/* Plan row */}
            <Group justify="space-between" align="center" mb="lg">
              <Group gap="sm">
                {currentPlan ? (
                  <Badge
                    color={LEVEL_COLOR[currentPlan.planLevel] ?? 'gray'}
                    variant="filled"
                    size="sm"
                    radius="sm"
                    style={{ letterSpacing: '0.05em', fontWeight: 700 }}
                  >
                    {currentPlan.planLevel}
                  </Badge>
                ) : null}
                <Badge variant="light" color={isPersonal ? 'gray' : 'blue'} size="sm" radius="sm">
                  {isPersonal ? 'Personal' : (teamDisplayName ?? 'Team')}
                </Badge>
                <Text size="sm" fw={600} style={{ color: 'var(--pitch-surface-text)' }}>
                  {currentPlan?.name ?? 'No active plan'}
                </Text>
              </Group>
              {subscription && (
                <Text size="xs" c="dimmed">
                  Resets{' '}
                  {new Date(subscription.currentPeriodEnd).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </Text>
              )}
            </Group>

            {/* The big number */}
            {teamBalance.isLoading ? (
              <Loader size="sm" my="xl" />
            ) : balance ? (
              <>
                <Stack gap={6} mb="xl">
                  <Group gap="md" align="flex-end" wrap="nowrap">
                    <Text
                      fz={{ base: 52, sm: 68 }}
                      fw={900}
                      lh={1}
                      style={{
                        color: 'var(--pitch-surface-text)',
                        fontVariantNumeric: 'tabular-nums',
                        letterSpacing: '-0.03em',
                      }}
                    >
                      {balance.remaining.toLocaleString()}
                    </Text>
                    {usedPct >= 70 && (
                      <Badge color={barColor} variant="light" size="md" mb={8}>
                        {usedPct >= 90 ? '⚠ Low' : 'High usage'}
                      </Badge>
                    )}
                  </Group>

                  <Group gap="xs" align="center">
                    <Text size="sm" c="dimmed">
                      {isPersonal ? 'personal' : (teamDisplayName ?? 'team')} credits remaining
                    </Text>
                    {sessionsLeft !== null && (
                      <>
                        <Text c="dimmed" size="sm">
                          ·
                        </Text>
                        <Text size="sm" c="dimmed">
                          <Text span fw={600} style={{ color: 'var(--pitch-surface-text)' }}>
                            ≈{sessionsLeft.toLocaleString()}
                          </Text>{' '}
                          sessions left
                        </Text>
                      </>
                    )}
                    {currentPlan && (
                      <Tooltip
                        label={`${currentPlan.coinCostPerSession} credits/session · $${currentPlan.coinPriceUsd.toFixed(3)}/credit`}
                        withArrow
                        fz="xs"
                      >
                        <Box style={{ cursor: 'help', display: 'flex', alignItems: 'center' }}>
                          <IconInfoCircle
                            size={13}
                            style={{ color: 'var(--mantine-color-dimmed)' }}
                          />
                        </Box>
                      </Tooltip>
                    )}
                  </Group>
                </Stack>

                {/* Progress bar */}
                <Progress
                  value={usedPct}
                  size={10}
                  radius="xl"
                  color={barColor}
                  mb={10}
                  style={{
                    background:
                      'color-mix(in srgb, var(--pitch-card-border, var(--mantine-color-default-border)) 90%, transparent)',
                  }}
                />

                {/* Below bar: stats + pacing + CTA */}
                <Group justify="space-between" align="center" wrap="nowrap">
                  <Group gap="lg" wrap="wrap">
                    <Stack gap={0}>
                      <Text size="xs" c="dimmed">
                        Used
                      </Text>
                      <Text
                        size="xs"
                        fw={600}
                        style={{
                          color: 'var(--pitch-surface-text)',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {usedCoins.toLocaleString()} of {balance.allowance.toLocaleString()}
                      </Text>
                    </Stack>

                    {daysLeft !== null && (
                      <Stack gap={0}>
                        <Text size="xs" c="dimmed">
                          Days left
                        </Text>
                        <Text size="xs" fw={600} style={{ color: 'var(--pitch-surface-text)' }}>
                          {daysLeft}
                        </Text>
                      </Stack>
                    )}

                    {pacing && (
                      <Group gap={4}>
                        <IconTrendingUp
                          size={12}
                          style={{ color: `var(--mantine-color-${pacing.color}-5)` }}
                        />
                        <Text
                          size="xs"
                          style={{ color: `var(--mantine-color-${pacing.color}-5)` }}
                          fw={500}
                        >
                          {pacing.label}
                        </Text>
                      </Group>
                    )}
                  </Group>

                  {/* Primary CTA */}
                  {refillRequest?.status === 'pending' ? (
                    <Button
                      size="xs"
                      variant="default"
                      leftSection={<IconClock size={13} />}
                      style={{ cursor: 'default' }}
                      disabled
                    >
                      Top-up pending
                    </Button>
                  ) : (
                    <Button
                      size="xs"
                      variant="default"
                      leftSection={<IconRefresh size={13} />}
                      onClick={() => setTopupOpen((v) => !v)}
                    >
                      {topupOpen ? 'Cancel' : 'Request top-up'}
                    </Button>
                  )}
                </Group>
              </>
            ) : (
              <Text size="sm" c="dimmed" my="md">
                No balance data available.
              </Text>
            )}
          </Box>

          {/* ── 2. TOP-UP FORM (inline, progressive disclosure) ──────────────── */}
          {topupOpen && refillRequest?.status !== 'pending' && (
            <Box
              className="s1"
              px="lg"
              py="md"
              style={{
                borderRadius: 14,
                border: '1px solid var(--pitch-card-border, var(--mantine-color-default-border))',
                background:
                  'color-mix(in srgb, var(--pitch-card-bg, var(--mantine-color-body)) 70%, transparent)',
              }}
            >
              <Text size="sm" fw={600} mb={2} style={{ color: 'var(--pitch-surface-text)' }}>
                Request additional credits
              </Text>
              <Text size="xs" c="dimmed" mb="sm">
                An admin will review and may approve a different amount.
              </Text>
              <Group align="flex-end" gap="sm">
                <NumberInput
                  label="Credits requested"
                  placeholder="500"
                  min={1}
                  step={100}
                  value={requestedCoins}
                  onChange={(v) => setRequestedCoins(typeof v === 'number' ? v : Number(v) || 0)}
                  size="sm"
                  style={{ flex: 1, maxWidth: 200 }}
                  styles={{
                    input: {
                      background: 'var(--pitch-input-bg, var(--pitch-card-bg))',
                      border:
                        '1px solid var(--pitch-card-border, var(--mantine-color-default-border))',
                    },
                  }}
                />
                <Button
                  size="sm"
                  loading={submittingRefill}
                  disabled={requestedCoins <= 0}
                  onClick={handleRefillRequest}
                  style={{ background: 'var(--pitch-accent-strong)' }}
                >
                  Submit
                </Button>
              </Group>
            </Box>
          )}

          {/* ── 3. TOP-UP STATUS BANNER ──────────────────────────────────────── */}
          {refillRequest && (
            <Box
              className="s2"
              px="md"
              py="sm"
              style={{
                borderRadius: 12,
                border: `1px solid var(--mantine-color-${
                  refillRequest.status === 'pending'
                    ? 'yellow'
                    : refillRequest.status === 'approved'
                      ? 'teal'
                      : 'red'
                }-light-hover)`,
                background: `color-mix(in srgb, var(--mantine-color-${
                  refillRequest.status === 'pending'
                    ? 'yellow'
                    : refillRequest.status === 'approved'
                      ? 'teal'
                      : 'red'
                }-light) 35%, transparent)`,
              }}
            >
              <Group justify="space-between" align="center" wrap="nowrap">
                <Group gap="sm" align="center">
                  <ThemeIcon
                    size={26}
                    radius="md"
                    color={
                      refillRequest.status === 'pending'
                        ? 'yellow'
                        : refillRequest.status === 'approved'
                          ? 'teal'
                          : 'red'
                    }
                    variant="light"
                  >
                    {refillRequest.status === 'pending' ? (
                      <IconClock size={13} />
                    ) : refillRequest.status === 'approved' ? (
                      <IconCheck size={13} />
                    ) : (
                      <IconX size={13} />
                    )}
                  </ThemeIcon>
                  <Stack gap={1}>
                    <Text size="sm" fw={600} style={{ color: 'var(--pitch-surface-text)' }}>
                      {refillRequest.status === 'pending'
                        ? `${refillRequest.requestedCoins.toLocaleString()} credits under review`
                        : refillRequest.status === 'approved'
                          ? `${refillRequest.approvedCoins?.toLocaleString()} credits approved`
                          : 'Request not approved'}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {new Date(refillRequest.requestedAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                      {refillRequest.reviewedBy ? ` · ${refillRequest.reviewedBy}` : ''}
                    </Text>
                  </Stack>
                </Group>

                {refillRequest.status === 'denied' && (
                  <Button
                    size="xs"
                    variant="subtle"
                    onClick={() => {
                      setTopupOpen(true)
                      setRefillRequest(null)
                    }}
                  >
                    Request again
                  </Button>
                )}
              </Group>
            </Box>
          )}

          {/* ── 4. PLANS ─────────────────────────────────────────────────────────
            Inspired by Linear: highlight current plan clearly, show the one
            key differentiator (credits), reduce repetition across cards. */}
          <Box className="s3">
            <Group justify="space-between" align="center" mb="md">
              <Text
                size="xs"
                fw={700}
                tt="uppercase"
                c="dimmed"
                style={{ letterSpacing: '0.08em' }}
              >
                Plan
              </Text>
              <Text size="xs" c="dimmed">
                Looking for team subscription?{' '}
                <Link
                  href="/studio/team-config"
                  style={{ color: 'var(--pitch-accent-strong)', textDecoration: 'none' }}
                >
                  Manage it here →
                </Link>
              </Text>
            </Group>

            <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
              {plans.map((plan) => {
                const isCurrent = plan.id === currentPlan?.id
                const pendingChange = subscription?.metadata?.pendingPlanChange
                const isPending = pendingChange?.requestedPlanId === plan.id
                const hasPendingChange = !!pendingChange
                return (
                  <Box
                    key={plan.id}
                    className={isCurrent ? undefined : 'plan-tile'}
                    p="md"
                    style={{
                      borderRadius: 14,
                      border: isCurrent
                        ? '1.5px solid var(--pitch-accent-strong)'
                        : isPending
                          ? '1.5px solid var(--mantine-color-yellow-6)'
                          : '1px solid var(--pitch-card-border, var(--mantine-color-default-border))',
                      background: isCurrent
                        ? 'color-mix(in srgb, var(--pitch-accent-strong) 7%, var(--pitch-card-bg, var(--mantine-color-body)))'
                        : isPending
                          ? 'color-mix(in srgb, var(--mantine-color-yellow-light) 30%, var(--pitch-card-bg, var(--mantine-color-body)))'
                          : 'color-mix(in srgb, var(--pitch-card-bg, var(--mantine-color-body)) 75%, transparent)',
                      boxShadow: isCurrent
                        ? '0 0 0 3px color-mix(in srgb, var(--pitch-accent-strong) 10%, transparent)'
                        : undefined,
                    }}
                  >
                    <Stack gap="sm" h="100%">
                      <Group justify="space-between" align="flex-start">
                        <Badge
                          color={LEVEL_COLOR[plan.planLevel] ?? 'gray'}
                          variant={isCurrent ? 'filled' : 'light'}
                          size="xs"
                          radius="sm"
                        >
                          {plan.planLevel}
                        </Badge>
                        {isCurrent && (
                          <ThemeIcon size={16} radius="xl" color="teal" variant="light">
                            <IconCheck size={9} />
                          </ThemeIcon>
                        )}
                        {isPending && (
                          <ThemeIcon size={16} radius="xl" color="yellow" variant="light">
                            <IconClock size={9} />
                          </ThemeIcon>
                        )}
                      </Group>

                      {/* Key differentiator: credits per period */}
                      <Stack gap={1}>
                        <Text
                          fw={800}
                          fz={22}
                          lh={1}
                          style={{
                            color: 'var(--pitch-surface-text)',
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {plan.maxCoins >= 1_000_000
                            ? '∞'
                            : plan.maxCoins >= 1000
                              ? `${(plan.maxCoins / 1000).toFixed(0)}k`
                              : plan.maxCoins.toLocaleString()}
                        </Text>
                        <Text size="xs" c="dimmed">
                          credits / period
                        </Text>
                      </Stack>

                      {/* Session count as context */}
                      {plan.coinCostPerSession > 0 ? (
                        <Text size="xs" c="dimmed">
                          ≈{Math.floor(plan.maxCoins / plan.coinCostPerSession).toLocaleString()}{' '}
                          sessions
                        </Text>
                      ) : (
                        <Text size="xs" c="dimmed">
                          Unlimited sessions
                        </Text>
                      )}

                      {isCurrent ? (
                        <Text size="xs" c="dimmed" mt="auto" pt="xs">
                          Current plan
                        </Text>
                      ) : isPending ? (
                        <Text size="xs" c="yellow.7" fw={600} mt="auto" pt="xs">
                          Pending review
                        </Text>
                      ) : (
                        <Button
                          size="xs"
                          variant="default"
                          fullWidth
                          mt="auto"
                          loading={switchingPlan === plan.id}
                          disabled={hasPendingChange}
                          rightSection={<IconBolt size={11} />}
                          onClick={() => handleSwitchPlan(plan)}
                          style={{ marginTop: 8 }}
                        >
                          Switch
                        </Button>
                      )}
                    </Stack>
                  </Box>
                )
              })}
            </SimpleGrid>
          </Box>

          {/* ── 5. CREDIT HISTORY ────────────────────────────────────────────────
            Clean table — color-coded amounts, no card nesting, scannable.
            Green = credits added, red = credits spent. */}
          {ledger.length > 0 && (
            <Box className="s4">
              <Divider
                mb="lg"
                style={{
                  borderColor: 'var(--pitch-card-border, var(--mantine-color-default-border))',
                }}
              />

              <Text
                size="xs"
                fw={700}
                tt="uppercase"
                c="dimmed"
                mb="md"
                style={{ letterSpacing: '0.08em' }}
              >
                Credit history
              </Text>

              <Box
                style={{
                  borderRadius: 12,
                  border: '1px solid var(--pitch-card-border, var(--mantine-color-default-border))',
                  overflow: 'hidden',
                }}
              >
                <Table verticalSpacing={10} horizontalSpacing="md">
                  <Table.Thead
                    style={{
                      background:
                        'color-mix(in srgb, var(--pitch-card-bg, var(--mantine-color-body)) 50%, transparent)',
                    }}
                  >
                    <Table.Tr>
                      {['Event', 'Credits', 'Balance', 'Date'].map((h) => (
                        <Table.Th key={h}>
                          <Text size="xs" c="dimmed" fw={600}>
                            {h}
                          </Text>
                        </Table.Th>
                      ))}
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {ledger.slice(0, 20).map((entry, idx) => {
                      const raw =
                        entry.type === 'RESERVE' && entry.estimatedCoins != null
                          ? -entry.estimatedCoins
                          : entry.type === 'ADJUST' && entry.deltaCoins != null
                            ? entry.deltaCoins
                            : entry.type === 'REFILL' && entry.allowance != null
                              ? entry.allowance
                              : null

                      const amountStr =
                        raw === null ? '—' : `${raw > 0 ? '+' : ''}${raw.toLocaleString()}`
                      const amountColor =
                        raw === null
                          ? undefined
                          : raw > 0
                            ? 'var(--mantine-color-teal-5)'
                            : 'var(--mantine-color-red-4)'

                      return (
                        <Table.Tr
                          key={idx}
                          style={{
                            borderTop:
                              '1px solid var(--pitch-card-border, var(--mantine-color-default-border))',
                          }}
                        >
                          <Table.Td>
                            <Badge
                              size="xs"
                              color={LEDGER_COLOR[entry.type] ?? 'gray'}
                              variant="light"
                              radius="sm"
                            >
                              {entry.type}
                            </Badge>
                          </Table.Td>
                          <Table.Td>
                            <Text
                              size="sm"
                              fw={600}
                              style={{ color: amountColor, fontVariantNumeric: 'tabular-nums' }}
                            >
                              {amountStr}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Text
                              size="xs"
                              c="dimmed"
                              style={{ fontVariantNumeric: 'tabular-nums' }}
                            >
                              {entry.remainingAfter?.toLocaleString() ?? '—'}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Text size="xs" c="dimmed">
                              {entry.createdAt
                                ? new Date(entry.createdAt).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                  })
                                : '—'}
                            </Text>
                          </Table.Td>
                        </Table.Tr>
                      )
                    })}
                  </Table.Tbody>
                </Table>
              </Box>
            </Box>
          )}
        </Stack>
      </Box>
    </Box>
  )
}
