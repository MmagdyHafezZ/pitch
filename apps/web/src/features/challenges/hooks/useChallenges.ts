'use client'

import { useCallback, useMemo } from 'react'
import { useChallengesStore } from '../stores/challenges.store'
import type { ChallengePeriod, ChallengeDifficulty } from '../types/challenges.types'

export function useChallenges() {
  const store = useChallengesStore()
  const fetchChallenges = useChallengesStore((state) => state.fetchChallenges)

  const filteredChallenges = useMemo(() => {
    return store.challenges.filter((c) => {
      if (store.activePeriod && c.period !== store.activePeriod) return false
      if (store.activeDifficulty && c.difficulty !== store.activeDifficulty) return false
      return true
    })
  }, [store.challenges, store.activePeriod, store.activeDifficulty])

  const timeLeft = useCallback((expiresAt: string) => {
    const ms = new Date(expiresAt).getTime() - Date.now()
    if (ms <= 0) return 'Expired'
    const hours = Math.floor(ms / 1000 / 60 / 60)
    const minutes = Math.floor((ms / 1000 / 60) % 60)
    if (hours >= 24) return `${Math.floor(hours / 24)}d left`
    if (hours > 0) return `${hours}h ${minutes}m left`
    return `${minutes}m left`
  }, [])

  const fetch = useCallback(
    (period?: ChallengePeriod, difficulty?: ChallengeDifficulty) => {
      return fetchChallenges({ period, difficulty })
    },
    [fetchChallenges]
  )

  return {
    challenges: filteredChallenges,
    allChallenges: store.challenges,
    total: store.total,
    activePeriod: store.activePeriod,
    activeDifficulty: store.activeDifficulty,
    globalLeaderboard: store.globalLeaderboard,
    loading: store.loading,
    error: store.error,
    timeLeft,
    fetch,
    fetchGlobalLeaderboard: store.fetchGlobalLeaderboard,
    participate: store.participate,
    submitScore: store.submitScore,
    setActivePeriod: store.setActivePeriod,
    setActiveDifficulty: store.setActiveDifficulty,
  }
}
