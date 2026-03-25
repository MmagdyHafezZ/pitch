import { renderHook, act } from '@testing-library/react'
import { useChallenges } from '../useChallenges'
import { useChallengesStore } from '../../stores/challenges.store'

beforeEach(() => {
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
})

describe('useChallenges', () => {
  it('returns initial empty state', () => {
    const { result } = renderHook(() => useChallenges())

    expect(result.current.challenges).toEqual([])
    expect(result.current.allChallenges).toEqual([])
    expect(result.current.total).toBe(0)
    expect(result.current.activePeriod).toBeUndefined()
    expect(result.current.activeDifficulty).toBeUndefined()
    expect(result.current.globalLeaderboard).toEqual([])
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('exposes all store methods', () => {
    const { result } = renderHook(() => useChallenges())

    expect(typeof result.current.fetch).toBe('function')
    expect(typeof result.current.fetchGlobalLeaderboard).toBe('function')
    expect(typeof result.current.participate).toBe('function')
    expect(typeof result.current.submitScore).toBe('function')
    expect(typeof result.current.setActivePeriod).toBe('function')
    expect(typeof result.current.setActiveDifficulty).toBe('function')
    expect(typeof result.current.timeLeft).toBe('function')
  })

  it('filters challenges by active period', () => {
    act(() => {
      useChallengesStore.setState({
        challenges: [
          { id: '1', period: 'DAILY', difficulty: 'easy' } as any,
          { id: '2', period: 'WEEKLY', difficulty: 'hard' } as any,
          { id: '3', period: 'DAILY', difficulty: 'hard' } as any,
        ],
        activePeriod: 'DAILY',
      })
    })

    const { result } = renderHook(() => useChallenges())

    expect(result.current.challenges).toHaveLength(2)
    expect(result.current.challenges.map((c: any) => c.id)).toEqual(['1', '3'])
    expect(result.current.allChallenges).toHaveLength(3)
  })

  it('filters challenges by active difficulty', () => {
    act(() => {
      useChallengesStore.setState({
        challenges: [
          { id: '1', period: 'DAILY', difficulty: 'easy' } as any,
          { id: '2', period: 'WEEKLY', difficulty: 'hard' } as any,
        ],
        activeDifficulty: 'hard',
      })
    })

    const { result } = renderHook(() => useChallenges())

    expect(result.current.challenges).toHaveLength(1)
    expect(result.current.challenges[0].id).toBe('2')
  })

  it('filters by both period and difficulty', () => {
    act(() => {
      useChallengesStore.setState({
        challenges: [
          { id: '1', period: 'DAILY', difficulty: 'easy' } as any,
          { id: '2', period: 'WEEKLY', difficulty: 'hard' } as any,
          { id: '3', period: 'DAILY', difficulty: 'hard' } as any,
        ],
        activePeriod: 'DAILY',
        activeDifficulty: 'hard',
      })
    })

    const { result } = renderHook(() => useChallenges())

    expect(result.current.challenges).toHaveLength(1)
    expect(result.current.challenges[0].id).toBe('3')
  })

  it('returns all challenges when no filters are active', () => {
    act(() => {
      useChallengesStore.setState({
        challenges: [
          { id: '1', period: 'DAILY', difficulty: 'easy' } as any,
          { id: '2', period: 'WEEKLY', difficulty: 'hard' } as any,
        ],
        activePeriod: undefined,
        activeDifficulty: undefined,
      })
    })

    const { result } = renderHook(() => useChallenges())

    expect(result.current.challenges).toHaveLength(2)
  })

  describe('timeLeft', () => {
    it('returns "Expired" for past dates', () => {
      const { result } = renderHook(() => useChallenges())
      expect(result.current.timeLeft('2020-01-01T00:00:00Z')).toBe('Expired')
    })

    it('returns minutes for less than an hour', () => {
      const { result } = renderHook(() => useChallenges())
      const soon = new Date(Date.now() + 30 * 60 * 1000).toISOString()
      const text = result.current.timeLeft(soon)
      expect(text).toMatch(/\d+m left/)
    })

    it('returns hours and minutes for less than a day', () => {
      const { result } = renderHook(() => useChallenges())
      const later = new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString()
      const text = result.current.timeLeft(later)
      expect(text).toMatch(/\d+h \d+m left/)
    })

    it('returns days for 24+ hours', () => {
      const { result } = renderHook(() => useChallenges())
      const farOut = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
      const text = result.current.timeLeft(farOut)
      expect(text).toMatch(/\d+d left/)
    })
  })

  it('reflects loading state', () => {
    act(() => {
      useChallengesStore.setState({ loading: true })
    })

    const { result } = renderHook(() => useChallenges())
    expect(result.current.loading).toBe(true)
  })

  it('reflects error state', () => {
    act(() => {
      useChallengesStore.setState({ error: 'Something went wrong' })
    })

    const { result } = renderHook(() => useChallenges())
    expect(result.current.error).toBe('Something went wrong')
  })
})
