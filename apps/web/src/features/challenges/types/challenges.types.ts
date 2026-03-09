export type ChallengePeriod = 'DAILY' | 'WEEKLY' | 'MONTHLY'
export type ChallengeDifficulty = 'BEGINNER' | 'INTERMEDIATE' | 'EXPERT' | 'MASTER'
export type ChallengeStatus = 'UPCOMING' | 'ACTIVE' | 'EXPIRED'

export interface Challenge {
  id: string
  period: ChallengePeriod
  difficulty: ChallengeDifficulty
  status: ChallengeStatus
  title: string
  description: string
  topic: string
  startsAt: string
  expiresAt: string
  participationCount: number
  myParticipation?: {
    sessionId: string | null
    score: number | null
    completedAt: string | null
  } | null
}

export interface ChallengeDetail extends Challenge {
  scenarioPrompt: string
  evaluatorPersonaPrompt: string
}

export interface LeaderboardEntry {
  rank: number
  userId: string
  score: number | null
  completedAt: string | null
}

export interface GlobalLeaderboardEntry {
  rank: number
  userId: string
  totalScore: number | null
}

export interface ChallengesListResponse {
  challenges: Challenge[]
  total: number
}

export interface ListChallengesParams {
  period?: ChallengePeriod
  difficulty?: ChallengeDifficulty
  limit?: number
  offset?: number
}
