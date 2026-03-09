'use client'

import { create } from 'zustand'
import { ChallengesService } from '../services/challenges.service'
import type {
  Challenge,
  ChallengePeriod,
  ChallengeDifficulty,
  GlobalLeaderboardEntry,
  ListChallengesParams,
} from '../types/challenges.types'

type ChallengesState = {
  challenges: Challenge[]
  total: number
  activePeriod: ChallengePeriod | undefined
  activeDifficulty: ChallengeDifficulty | undefined
  globalLeaderboard: GlobalLeaderboardEntry[]
  loading: boolean
  error: string | null

  fetchChallenges: (params?: ListChallengesParams) => Promise<void>
  fetchGlobalLeaderboard: (limit?: number) => Promise<void>
  participate: (
    challengeId: string
  ) => Promise<{ sessionId: string | null; alreadyParticipating: boolean }>
  submitScore: (challengeId: string, sessionId: string, score: number) => Promise<void>
  setActivePeriod: (period: ChallengePeriod | undefined) => void
  setActiveDifficulty: (difficulty: ChallengeDifficulty | undefined) => void
}

export const useChallengesStore = create<ChallengesState>()((set, get) => ({
  challenges: [],
  total: 0,
  activePeriod: undefined,
  activeDifficulty: undefined,
  globalLeaderboard: [],
  loading: false,
  error: null,

  setActivePeriod: (period) => set({ activePeriod: period }),
  setActiveDifficulty: (difficulty) => set({ activeDifficulty: difficulty }),

  fetchChallenges: async (params?: ListChallengesParams) => {
    set({ loading: true, error: null })
    try {
      const data = await ChallengesService.list(params)
      set({ challenges: data.challenges, total: data.total, loading: false })
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to load challenges',
      })
    }
  },

  fetchGlobalLeaderboard: async (limit = 20) => {
    try {
      const data = await ChallengesService.globalLeaderboard(limit)
      set({ globalLeaderboard: data })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to load leaderboard' })
    }
  },

  participate: async (challengeId: string) => {
    const result = await ChallengesService.participate(challengeId)
    // Update local participation status
    set((state) => ({
      challenges: state.challenges.map((c) =>
        c.id === challengeId
          ? {
              ...c,
              myParticipation: { sessionId: result.sessionId, score: null, completedAt: null },
            }
          : c
      ),
    }))
    return result
  },

  submitScore: async (challengeId: string, sessionId: string, score: number) => {
    await ChallengesService.submitScore(challengeId, sessionId, score)
    set((state) => ({
      challenges: state.challenges.map((c) =>
        c.id === challengeId && c.myParticipation
          ? {
              ...c,
              myParticipation: {
                ...c.myParticipation,
                score,
                completedAt: new Date().toISOString(),
              },
            }
          : c
      ),
    }))
  },
}))
