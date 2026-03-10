import { api } from '@/lib/client'
import type {
  ChallengesListResponse,
  ChallengeDetail,
  LeaderboardEntry,
  GlobalLeaderboardEntry,
  ListChallengesParams,
} from '../types/challenges.types'

export const ChallengesService = {
  list: (params?: ListChallengesParams) =>
    api.challenges.list(params) as Promise<ChallengesListResponse>,

  get: (id: string) => api.challenges.get(id) as Promise<ChallengeDetail>,

  participate: (challengeId: string) =>
    api.challenges.participate(challengeId) as Promise<{
      challengeId: string
      sessionId: string | null
      alreadyParticipating: boolean
    }>,

  submitScore: (challengeId: string, sessionId: string, score: number) =>
    api.challenges.submitScore(challengeId, sessionId, score) as Promise<{ success: boolean }>,

  leaderboard: (challengeId: string, limit?: number) =>
    api.challenges.challengeLeaderboard(challengeId, limit) as Promise<LeaderboardEntry[]>,

  globalLeaderboard: (limit?: number) =>
    api.challenges.globalLeaderboard(limit) as Promise<GlobalLeaderboardEntry[]>,
}
