import { renderHook, act } from '@testing-library/react'
import { useOnboarding } from '../useOnboarding'
import { useOnboardingStore } from '../../stores/onboarding.store'
import { useAuthStore } from '@/features/auth/stores/auth.store'
import { api } from '@/lib/client'

const mockPush = jest.fn()
const mockReplace = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
  }),
}))

jest.mock('@/lib/client', () => ({
  api: {
    users: {
      updateMySettings: jest.fn().mockResolvedValue({}),
    },
    auth: {
      login: jest.fn(),
      register: jest.fn(),
      logout: jest.fn().mockResolvedValue(undefined),
      refreshToken: jest.fn(),
      me: jest.fn(),
      checkEmail: jest.fn(),
    },
    crm: {
      salesforce: {
        connect: jest.fn(),
        status: jest.fn(),
        accounts: jest.fn(),
        contacts: jest.fn(),
        opportunities: jest.fn(),
        leads: jest.fn(),
        search: jest.fn(),
      },
    },
  },
  setAccessToken: jest.fn(),
  setAccessTokenListener: jest.fn(),
  refreshAccessToken: jest.fn(),
  getAccessToken: jest.fn(),
  apiRequest: jest.fn(),
  apiRequestRoot: jest.fn(),
}))

const mockedUpdateMySettings = api.users.updateMySettings as jest.Mock

beforeEach(() => {
  jest.clearAllMocks()
  act(() => {
    useOnboardingStore.getState().reset()
    useAuthStore.setState({
      user: {
        id: 'u1',
        email: 'test@example.com',
        name: 'Test User',
        isActive: true,
        createdAt: '',
        updatedAt: '',
        settings: {},
      } as any,
      token: 'token',
      isAuthenticated: true,
      isLoading: false,
      error: null,
    })
  })
})

describe('useOnboarding', () => {
  describe('completeOnboarding', () => {
    it('saves settings, marks complete, and redirects to default route', async () => {
      const { result } = renderHook(() => useOnboarding())

      await act(async () => {
        await result.current.completeOnboarding({ role: 'EMPLOYEE' })
      })

      expect(mockedUpdateMySettings).toHaveBeenCalledWith(
        expect.objectContaining({
          onboarding: expect.objectContaining({
            role: 'EMPLOYEE',
            completed: true,
          }),
        })
      )
      expect(mockReplace).toHaveBeenCalledWith('/studio/home')
    })

    it('redirects to custom route when provided', async () => {
      const { result } = renderHook(() => useOnboarding())

      await act(async () => {
        await result.current.completeOnboarding({ role: 'MANAGER' }, { redirectTo: '/custom' })
      })

      expect(mockReplace).toHaveBeenCalledWith('/custom')
    })

    it('sets and clears isSaving flag', async () => {
      const { result } = renderHook(() => useOnboarding())

      expect(useOnboardingStore.getState().isSaving).toBe(false)

      await act(async () => {
        await result.current.completeOnboarding({})
      })

      expect(useOnboardingStore.getState().isSaving).toBe(false)
    })

    it('clears isSaving on error', async () => {
      mockedUpdateMySettings.mockRejectedValueOnce(new Error('fail'))

      const { result } = renderHook(() => useOnboarding())

      try {
        await act(async () => {
          await result.current.completeOnboarding({})
        })
      } catch {
        // expected
      }

      // The finally block in completeOnboarding calls setIsSaving(false)
      await act(async () => {})
      expect(useOnboardingStore.getState().isSaving).toBe(false)
    })
  })

  describe('skipAll', () => {
    it('saves empty settings as completed and redirects', async () => {
      const { result } = renderHook(() => useOnboarding())

      await act(async () => {
        await result.current.skipAll()
      })

      expect(mockedUpdateMySettings).toHaveBeenCalledWith(
        expect.objectContaining({
          onboarding: expect.objectContaining({
            completed: true,
          }),
        })
      )
      expect(mockReplace).toHaveBeenCalledWith('/studio/home')
    })

    it('clears isSaving on error', async () => {
      mockedUpdateMySettings.mockRejectedValueOnce(new Error('fail'))

      const { result } = renderHook(() => useOnboarding())

      try {
        await act(async () => {
          await result.current.skipAll()
        })
      } catch {
        // expected
      }

      await act(async () => {})
      expect(useOnboardingStore.getState().isSaving).toBe(false)
    })
  })

  describe('saveProgress', () => {
    it('saves partial data without marking completed', async () => {
      const { result } = renderHook(() => useOnboarding())

      await act(async () => {
        await result.current.saveProgress({ role: 'EMPLOYEE' })
      })

      expect(mockedUpdateMySettings).toHaveBeenCalledWith(
        expect.objectContaining({
          onboarding: expect.objectContaining({
            role: 'EMPLOYEE',
            completed: false,
          }),
        })
      )
    })
  })

  describe('completeOnboarding with existing settings', () => {
    it('merges with existing onboarding settings', async () => {
      act(() => {
        useAuthStore.setState({
          user: {
            id: 'u1',
            email: 'test@example.com',
            name: 'Test User',
            isActive: true,
            createdAt: '',
            updatedAt: '',
            settings: {
              onboarding: {
                role: 'MANAGER',
                tutorialCompleted: true,
              },
            },
          } as any,
        })
      })

      const { result } = renderHook(() => useOnboarding())

      await act(async () => {
        await result.current.completeOnboarding({ careerInfo: { jobTitle: 'Engineer' } })
      })

      expect(mockedUpdateMySettings).toHaveBeenCalledWith(
        expect.objectContaining({
          onboarding: expect.objectContaining({
            role: 'MANAGER',
            careerInfo: { jobTitle: 'Engineer' },
            completed: true,
            tutorialCompleted: true,
          }),
        })
      )
    })
  })

  describe('user state update after completeOnboarding', () => {
    it('updates local user state', async () => {
      const { result } = renderHook(() => useOnboarding())

      await act(async () => {
        await result.current.completeOnboarding({ role: 'EMPLOYEE' })
      })

      const user = useAuthStore.getState().user as any
      expect(user?.settings?.onboarding?.completed).toBe(true)
      expect(user?.settings?.onboarding?.role).toBe('EMPLOYEE')
    })
  })
})

describe('useOnboardingStore', () => {
  it('has correct initial state', () => {
    const state = useOnboardingStore.getState()
    expect(state.step).toBe('welcome')
    expect(state.data).toEqual({})
    expect(state.isSaving).toBe(false)
  })

  it('setStep updates the step', () => {
    act(() => useOnboardingStore.getState().setStep('role'))
    expect(useOnboardingStore.getState().step).toBe('role')
  })

  it('updateData merges partial data', () => {
    act(() => useOnboardingStore.getState().updateData({ role: 'MANAGER' }))
    expect(useOnboardingStore.getState().data).toEqual({ role: 'MANAGER' })

    act(() => useOnboardingStore.getState().updateData({ wantsTutorial: true }))
    expect(useOnboardingStore.getState().data).toEqual({ role: 'MANAGER', wantsTutorial: true })
  })

  it('setIsSaving updates the flag', () => {
    act(() => useOnboardingStore.getState().setIsSaving(true))
    expect(useOnboardingStore.getState().isSaving).toBe(true)
  })

  it('reset clears all state', () => {
    act(() => {
      useOnboardingStore.getState().setStep('tutorial')
      useOnboardingStore.getState().updateData({ role: 'EMPLOYEE' })
      useOnboardingStore.getState().setIsSaving(true)
    })

    act(() => useOnboardingStore.getState().reset())

    const state = useOnboardingStore.getState()
    expect(state.step).toBe('welcome')
    expect(state.data).toEqual({})
    expect(state.isSaving).toBe(false)
  })
})
