import { ChallengesService } from '../challenges.service'
import { api } from '@/lib/client'

jest.mock('@/lib/client', () => ({
  api: {
    challenges: {
      list: jest.fn(),
      get: jest.fn(),
      participate: jest.fn(),
      submitScore: jest.fn(),
      challengeLeaderboard: jest.fn(),
      globalLeaderboard: jest.fn(),
    },
  },
}))

const mocked = api.challenges as jest.Mocked<typeof api.challenges>

beforeEach(() => jest.clearAllMocks())

describe('ChallengesService', () => {
  it('list delegates with params', async () => {
    const mockResponse = { challenges: [{ id: 'c1' }], total: 1 }
    mocked.list.mockResolvedValue(mockResponse)

    const result = await ChallengesService.list({ period: 'DAILY', limit: 10 })
    expect(mocked.list).toHaveBeenCalledWith({ period: 'DAILY', limit: 10 })
    expect(result).toEqual(mockResponse)
  })

  it('list works without params', async () => {
    mocked.list.mockResolvedValue({ challenges: [], total: 0 })
    await ChallengesService.list()
    expect(mocked.list).toHaveBeenCalledWith(undefined)
  })

  it('get delegates with id', async () => {
    const challenge = { id: 'c1', title: 'Test' }
    mocked.get.mockResolvedValue(challenge)

    const result = await ChallengesService.get('c1')
    expect(mocked.get).toHaveBeenCalledWith('c1')
    expect(result).toEqual(challenge)
  })

  it('participate delegates with challengeId', async () => {
    const response = { challengeId: 'c1', sessionId: 's1', alreadyParticipating: false }
    mocked.participate.mockResolvedValue(response)

    const result = await ChallengesService.participate('c1')
    expect(mocked.participate).toHaveBeenCalledWith('c1')
    expect(result).toEqual(response)
  })

  it('submitScore delegates with correct args', async () => {
    mocked.submitScore.mockResolvedValue({ success: true })

    const result = await ChallengesService.submitScore('c1', 's1', 85)
    expect(mocked.submitScore).toHaveBeenCalledWith('c1', 's1', 85)
    expect(result).toEqual({ success: true })
  })

  it('leaderboard delegates with challengeId and optional limit', async () => {
    const entries = [{ userId: 'u1', score: 90 }]
    mocked.challengeLeaderboard.mockResolvedValue(entries)

    const result = await ChallengesService.leaderboard('c1', 10)
    expect(mocked.challengeLeaderboard).toHaveBeenCalledWith('c1', 10)
    expect(result).toEqual(entries)
  })

  it('leaderboard works without limit', async () => {
    mocked.challengeLeaderboard.mockResolvedValue([])
    await ChallengesService.leaderboard('c1')
    expect(mocked.challengeLeaderboard).toHaveBeenCalledWith('c1', undefined)
  })

  it('globalLeaderboard delegates with optional limit', async () => {
    const entries = [{ userId: 'u1', totalScore: 500 }]
    mocked.globalLeaderboard.mockResolvedValue(entries)

    const result = await ChallengesService.globalLeaderboard(5)
    expect(mocked.globalLeaderboard).toHaveBeenCalledWith(5)
    expect(result).toEqual(entries)
  })

  it('globalLeaderboard works without limit', async () => {
    mocked.globalLeaderboard.mockResolvedValue([])
    await ChallengesService.globalLeaderboard()
    expect(mocked.globalLeaderboard).toHaveBeenCalledWith(undefined)
  })

  it('propagates errors from api layer', async () => {
    mocked.get.mockRejectedValue(new Error('Not found'))
    await expect(ChallengesService.get('bad-id')).rejects.toThrow('Not found')
  })
})
