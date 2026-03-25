import { act } from '@testing-library/react'
import { useChallengesStore } from '../challenges.store'
import { ChallengesService } from '../../services/challenges.service'
import type {
  Challenge,
  GlobalLeaderboardEntry,
  ChallengePeriod,
  ChallengeDifficulty,
} from '../../types/challenges.types'

const makeChallenge = (overrides: Partial<Challenge> = {}): Challenge => ({
  id: 'challenge_1',
  period: 'WEEKLY',
  difficulty: 'BEGINNER',
  status: 'ACTIVE',
  title: 'Test Challenge',
  description: 'A test challenge',
  topic: 'sales',
  startsAt: '2024-01-01T00:00:00.000Z',
  expiresAt: '2024-01-07T00:00:00.000Z',
  participationCount: 0,
  ...overrides,
})

const resetStore = () => {
  act(() => {
    useChallengesStore.setState({
      challenges: [],
      total: 0,
      activePeriod: undefined,
      activeDifficulty: undefined,
      globalLeaderboard: [],
      loading: false,
      error: null,
    })
  })
}

describe('ChallengesStore', () => {
  beforeEach(() => {
    resetStore()
    jest.restoreAllMocks()
  })

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const state = useChallengesStore.getState()

      expect(state.challenges).toEqual([])
      expect(state.total).toBe(0)
      expect(state.activePeriod).toBeUndefined()
      expect(state.activeDifficulty).toBeUndefined()
      expect(state.globalLeaderboard).toEqual([])
      expect(state.loading).toBe(false)
      expect(state.error).toBeNull()
    })
  })

  describe('setActivePeriod', () => {
    it('should set the active period', () => {
      act(() => {
        useChallengesStore.getState().setActivePeriod('DAILY')
      })

      expect(useChallengesStore.getState().activePeriod).toBe('DAILY')
    })

    it('should clear the active period when set to undefined', () => {
      act(() => {
        useChallengesStore.setState({ activePeriod: 'WEEKLY' })
        useChallengesStore.getState().setActivePeriod(undefined)
      })

      expect(useChallengesStore.getState().activePeriod).toBeUndefined()
    })

    it.each<ChallengePeriod>(['DAILY', 'WEEKLY', 'MONTHLY'])(
      'should set period to %s',
      (period) => {
        act(() => {
          useChallengesStore.getState().setActivePeriod(period)
        })
        expect(useChallengesStore.getState().activePeriod).toBe(period)
      }
    )
  })

  describe('setActiveDifficulty', () => {
    it('should set the active difficulty', () => {
      act(() => {
        useChallengesStore.getState().setActiveDifficulty('EXPERT')
      })

      expect(useChallengesStore.getState().activeDifficulty).toBe('EXPERT')
    })

    it('should clear the active difficulty when set to undefined', () => {
      act(() => {
        useChallengesStore.setState({ activeDifficulty: 'BEGINNER' })
        useChallengesStore.getState().setActiveDifficulty(undefined)
      })

      expect(useChallengesStore.getState().activeDifficulty).toBeUndefined()
    })

    it.each<ChallengeDifficulty>(['BEGINNER', 'INTERMEDIATE', 'EXPERT', 'MASTER'])(
      'should set difficulty to %s',
      (difficulty) => {
        act(() => {
          useChallengesStore.getState().setActiveDifficulty(difficulty)
        })
        expect(useChallengesStore.getState().activeDifficulty).toBe(difficulty)
      }
    )
  })

  describe('fetchChallenges', () => {
    it('should fetch challenges and update state on success', async () => {
      const challenges = [
        makeChallenge({ id: 'challenge_1' }),
        makeChallenge({ id: 'challenge_2' }),
      ]
      jest.spyOn(ChallengesService, 'list').mockResolvedValueOnce({
        challenges,
        total: challenges.length,
      })

      await act(async () => {
        await useChallengesStore.getState().fetchChallenges()
      })

      const state = useChallengesStore.getState()
      expect(state.challenges).toEqual(challenges)
      expect(state.total).toBe(2)
      expect(state.loading).toBe(false)
      expect(state.error).toBeNull()
    })

    it('should set loading to true during fetch', async () => {
      let resolveList!: (value: { challenges: Challenge[]; total: number }) => void
      jest.spyOn(ChallengesService, 'list').mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveList = resolve
          })
      )

      act(() => {
        useChallengesStore.getState().fetchChallenges()
      })

      expect(useChallengesStore.getState().loading).toBe(true)

      await act(async () => {
        resolveList({ challenges: [], total: 0 })
        await Promise.resolve()
      })
    })

    it('should set error when fetch fails', async () => {
      jest.spyOn(ChallengesService, 'list').mockRejectedValueOnce(new Error('Server error'))

      await act(async () => {
        await useChallengesStore.getState().fetchChallenges()
      })

      const state = useChallengesStore.getState()
      expect(state.error).toBe('Server error')
      expect(state.loading).toBe(false)
    })

    it('should fallback error for non-Error throw', async () => {
      jest.spyOn(ChallengesService, 'list').mockRejectedValueOnce('boom')

      await act(async () => {
        await useChallengesStore.getState().fetchChallenges()
      })

      expect(useChallengesStore.getState().error).toBe('Failed to load challenges')
    })

    it('should pass params to the service', async () => {
      const spy = jest
        .spyOn(ChallengesService, 'list')
        .mockResolvedValueOnce({ challenges: [], total: 0 })

      await act(async () => {
        await useChallengesStore.getState().fetchChallenges({ period: 'DAILY', limit: 5 })
      })

      expect(spy).toHaveBeenCalledWith({ period: 'DAILY', limit: 5 })
    })
  })

  describe('fetchGlobalLeaderboard', () => {
    it('should fetch and set the global leaderboard', async () => {
      const leaderboard: GlobalLeaderboardEntry[] = [
        { rank: 1, userId: 'user_1', totalScore: 100 },
        { rank: 2, userId: 'user_2', totalScore: 80 },
      ]
      jest.spyOn(ChallengesService, 'globalLeaderboard').mockResolvedValueOnce(leaderboard)

      await act(async () => {
        await useChallengesStore.getState().fetchGlobalLeaderboard()
      })

      expect(useChallengesStore.getState().globalLeaderboard).toEqual(leaderboard)
    })

    it('should pass the limit param to the service', async () => {
      const spy = jest.spyOn(ChallengesService, 'globalLeaderboard').mockResolvedValueOnce([])

      await act(async () => {
        await useChallengesStore.getState().fetchGlobalLeaderboard(10)
      })

      expect(spy).toHaveBeenCalledWith(10)
    })

    it('should use default limit of 20', async () => {
      const spy = jest.spyOn(ChallengesService, 'globalLeaderboard').mockResolvedValueOnce([])

      await act(async () => {
        await useChallengesStore.getState().fetchGlobalLeaderboard()
      })

      expect(spy).toHaveBeenCalledWith(20)
    })

    it('should set error when fetch fails', async () => {
      jest
        .spyOn(ChallengesService, 'globalLeaderboard')
        .mockRejectedValueOnce(new Error('Leaderboard error'))

      await act(async () => {
        await useChallengesStore.getState().fetchGlobalLeaderboard()
      })

      expect(useChallengesStore.getState().error).toBe('Leaderboard error')
    })

    it('should fallback error for non-Error throw', async () => {
      jest.spyOn(ChallengesService, 'globalLeaderboard').mockRejectedValueOnce(null)

      await act(async () => {
        await useChallengesStore.getState().fetchGlobalLeaderboard()
      })

      expect(useChallengesStore.getState().error).toBe('Failed to load leaderboard')
    })
  })

  describe('participate', () => {
    it('should call participate and update myParticipation on the matching challenge', async () => {
      const challenge = makeChallenge({ id: 'challenge_1', myParticipation: null })
      act(() => {
        useChallengesStore.setState({ challenges: [challenge] })
      })

      jest.spyOn(ChallengesService, 'participate').mockResolvedValueOnce({
        challengeId: 'challenge_1',
        sessionId: 'session_new',
        alreadyParticipating: false,
      })

      let result: { sessionId: string | null; alreadyParticipating: boolean } | undefined
      await act(async () => {
        result = await useChallengesStore.getState().participate('challenge_1')
      })

      expect(result).toEqual({
        challengeId: 'challenge_1',
        sessionId: 'session_new',
        alreadyParticipating: false,
      })

      const updated = useChallengesStore.getState().challenges.find((c) => c.id === 'challenge_1')
      expect(updated?.myParticipation).toEqual({
        sessionId: 'session_new',
        score: null,
        completedAt: null,
      })
    })

    it('should not affect other challenges', async () => {
      const challenges = [makeChallenge({ id: 'c1' }), makeChallenge({ id: 'c2' })]
      act(() => {
        useChallengesStore.setState({ challenges })
      })

      jest.spyOn(ChallengesService, 'participate').mockResolvedValueOnce({
        challengeId: 'c1',
        sessionId: 'session_x',
        alreadyParticipating: false,
      })

      await act(async () => {
        await useChallengesStore.getState().participate('c1')
      })

      const c2 = useChallengesStore.getState().challenges.find((c) => c.id === 'c2')
      expect(c2?.myParticipation).toBeUndefined()
    })

    it('should propagate errors from the service', async () => {
      jest
        .spyOn(ChallengesService, 'participate')
        .mockRejectedValueOnce(new Error('Participate failed'))

      await expect(
        act(async () => {
          await useChallengesStore.getState().participate('challenge_1')
        })
      ).rejects.toThrow('Participate failed')
    })
  })

  describe('submitScore', () => {
    it('should submit score and update myParticipation on the matching challenge', async () => {
      const challenge = makeChallenge({
        id: 'challenge_1',
        myParticipation: { sessionId: 'session_1', score: null, completedAt: null },
      })
      act(() => {
        useChallengesStore.setState({ challenges: [challenge] })
      })

      jest.spyOn(ChallengesService, 'submitScore').mockResolvedValueOnce({ success: true })

      await act(async () => {
        await useChallengesStore.getState().submitScore('challenge_1', 'session_1', 95)
      })

      const updated = useChallengesStore.getState().challenges.find((c) => c.id === 'challenge_1')
      expect(updated?.myParticipation?.score).toBe(95)
      expect(updated?.myParticipation?.completedAt).toBeDefined()
    })

    it('should not modify challenges without myParticipation', async () => {
      const challenge = makeChallenge({ id: 'challenge_1', myParticipation: undefined })
      act(() => {
        useChallengesStore.setState({ challenges: [challenge] })
      })

      jest.spyOn(ChallengesService, 'submitScore').mockResolvedValueOnce({ success: true })

      await act(async () => {
        await useChallengesStore.getState().submitScore('challenge_1', 'session_1', 50)
      })

      const updated = useChallengesStore.getState().challenges.find((c) => c.id === 'challenge_1')
      expect(updated?.myParticipation).toBeUndefined()
    })

    it('should propagate errors from the service', async () => {
      jest.spyOn(ChallengesService, 'submitScore').mockRejectedValueOnce(new Error('Submit failed'))

      await expect(
        act(async () => {
          await useChallengesStore.getState().submitScore('challenge_1', 'session_1', 50)
        })
      ).rejects.toThrow('Submit failed')
    })
  })
})
