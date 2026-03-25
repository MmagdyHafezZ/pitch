'use client'

import { Box, Text, Progress, Stack, rem, Skeleton } from '@mantine/core'
import { IconCoin } from '@tabler/icons-react'
import { useCoinsBalance, usePersonalCoinsBalance } from '@/features/coins/hooks/useCoinsBalance'

type Props = {
  teamId: string | null | undefined
}

function formatCoins(n: number): string {
  return n.toLocaleString()
}

function QuotaRow({
  label,
  remaining,
  allowance,
  isLoading,
  isError,
  emptyLabel,
}: {
  label: string
  remaining?: number
  allowance?: number
  isLoading: boolean
  isError: boolean
  emptyLabel?: string
}) {
  const usedPct =
    allowance && allowance > 0 ? Math.round(((allowance - (remaining ?? 0)) / allowance) * 100) : 0

  const barColor = usedPct >= 90 ? 'red' : usedPct >= 70 ? 'orange' : 'var(--pitch-accent-strong)'

  return (
    <Stack gap={4}>
      <Text size="xs" style={{ color: 'var(--pitch-nav-text-dim)', fontWeight: 600 }}>
        {label}
      </Text>

      {isLoading && (
        <>
          <Skeleton height={4} radius="xl" />
          <Box style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Skeleton height={9} width={38} radius="sm" />
            <Skeleton height={9} width={28} radius="sm" />
          </Box>
        </>
      )}

      {!isLoading && (isError || remaining == null) && (
        <>
          <Progress value={0} size={4} radius="xl" color="gray" />
          <Text size="xs" style={{ color: 'var(--pitch-nav-text-dim)' }}>
            {emptyLabel ?? '—'}
          </Text>
        </>
      )}

      {!isLoading && !isError && remaining != null && allowance != null && (
        <>
          <Progress
            value={usedPct}
            size={4}
            radius="xl"
            color={barColor}
            style={{
              background: 'color-mix(in srgb, var(--pitch-nav-text-dim) 30%, transparent)',
            }}
          />
          <Box style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Text size="xs" fw={700} style={{ color: 'var(--pitch-nav-text)' }}>
              {formatCoins(remaining)} left
            </Text>
            <Text size="xs" style={{ color: 'var(--pitch-nav-text-dim)' }}>
              / {formatCoins(allowance)}
            </Text>
          </Box>
        </>
      )}
    </Stack>
  )
}

export function CoinQuotaWidget({ teamId }: Props) {
  const personal = usePersonalCoinsBalance()
  const team = useCoinsBalance(teamId)

  const teamBalance = team.data?.ok ? team.data : null

  return (
    <Box
      mt="sm"
      mx={0}
      px={12}
      py={10}
      style={{
        background: `linear-gradient(
          180deg,
          color-mix(in srgb, var(--pitch-nav-bg, var(--mantine-color-nav-9)) 96%, transparent),
          color-mix(in srgb, var(--pitch-nav-bg, var(--mantine-color-nav-9)) 88%, transparent)
        )`,
        borderRadius: 12,
        border: '1px solid color-mix(in srgb, var(--pitch-nav-text-dim) 28%, transparent)',
        boxShadow:
          'inset 0 0 0 1px color-mix(in srgb, var(--pitch-nav-text-dim) 10%, transparent)',
        overflow: 'hidden',
      }}
    >
      <Stack gap={8}>
        {/* Header */}
        <Box style={{ display: 'flex', alignItems: 'center', gap: rem(6) }}>
          <IconCoin size={14} style={{ color: 'var(--pitch-nav-text-dim)', flexShrink: 0 }} />
          <Text
            size="xs"
            fw={600}
            style={{ color: 'var(--pitch-nav-text-dim)', letterSpacing: '0.04em' }}
          >
            SESSION CREDITS
          </Text>
        </Box>

        {/* Personal quota — always shown */}
        <QuotaRow
          label="Personal"
          remaining={personal.data?.remaining}
          allowance={personal.data?.allowance}
          isLoading={personal.isLoading}
          isError={personal.isError}
        />

        {/* Team quota — shown when a team is selected */}
        {teamId && (
          <>
            <Box
              style={{
                height: 1,
                background: 'color-mix(in srgb, var(--pitch-nav-text-dim) 24%, transparent)',
              }}
            />
            <QuotaRow
              label="Team"
              remaining={teamBalance?.remaining}
              allowance={teamBalance?.allowance}
              isLoading={team.isLoading}
              isError={team.isError || (!!team.data && !team.data.ok)}
              emptyLabel="No active plan"
            />
          </>
        )}
      </Stack>
    </Box>
  )
}
