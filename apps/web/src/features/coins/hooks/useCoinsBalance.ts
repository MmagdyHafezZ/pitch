'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/client'

/** Invalidate all coin balance queries (call after session start/end). */
export function useInvalidateCoinsBalance() {
  const qc = useQueryClient()
  return () => {
    void qc.invalidateQueries({ queryKey: ['coins'] })
  }
}

export type SessionCoinEstimate = {
  estimatedCoins: number
  estimatedCostUsd: number
  coinPriceUsd: number
  markupMultiplier: number
  model: string
  provider: string
  durationMinutes: number
}

/** Estimate coins for an upcoming session (used on the create-session page). */
export function useSessionCoinEstimate(params: {
  model?: string
  provider?: string
  sessionType: string
  durationMinutes?: number
  enabled?: boolean
}) {
  return useQuery<SessionCoinEstimate>({
    queryKey: [
      'coins',
      'session-estimate',
      params.model,
      params.provider,
      params.sessionType,
      params.durationMinutes,
    ],
    queryFn: () =>
      api.coins.sessionEstimate({
        model: params.model,
        provider: params.provider,
        sessionType: params.sessionType,
        durationMinutes: params.durationMinutes,
      }),
    enabled: params.enabled !== false && Boolean(params.sessionType),
    staleTime: 1000 * 60 * 5, // 5 min — pricing rarely changes mid-session
    retry: 1,
  })
}

export type CoinsBalance =
  | { ok: false; reason: 'NO_ACTIVE_SUBSCRIPTION' }
  | { ok: true; teamId: string; periodKey: string; allowance: number; remaining: number }

export type PersonalCoinsBalance = {
  ok: true
  userId: string
  periodKey: string
  allowance: number
  remaining: number
}

export function useCoinsBalance(teamId: string | null | undefined) {
  const q = useQuery<CoinsBalance>({
    queryKey: ['coins', 'balance', teamId],
    queryFn: () => api.coins.balance(teamId!),
    enabled: Boolean(teamId),
    staleTime: 1000 * 30, // 30 s — refreshes after session returns to studio
    refetchOnWindowFocus: true,
    retry: 1,
  })
  // In RQ v5 a disabled query still has status='pending' (no cached data).
  // Guard with isFetching so "actually loading" is distinct from "disabled/idle".
  return { ...q, isLoading: q.isFetching && q.isPending }
}

export function usePersonalCoinsBalance() {
  const q = useQuery<PersonalCoinsBalance>({
    queryKey: ['coins', 'my-balance'],
    queryFn: () => api.coins.myBalance(),
    staleTime: 1000 * 30, // 30 s
    refetchOnWindowFocus: true,
    retry: 1,
  })
  return { ...q, isLoading: q.isFetching && q.isPending }
}
