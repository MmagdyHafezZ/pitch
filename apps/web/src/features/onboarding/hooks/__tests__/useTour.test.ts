/** @jest-environment jsdom */
import { renderHook, act } from '@testing-library/react'

const mockPush = jest.fn()
const mockDestroy = jest.fn()
const mockDrive = jest.fn()
const mockMoveNext = jest.fn()
const mockIsLastStep = jest.fn(() => false)

const mockDriverInstance = {
  destroy: mockDestroy,
  drive: mockDrive,
  moveNext: mockMoveNext,
  isLastStep: mockIsLastStep,
}

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
  }),
}))

jest.mock('driver.js', () => ({
  driver: jest.fn(() => mockDriverInstance),
}))

jest.mock('@mantine/modals', () => ({
  modals: {
    openConfirmModal: jest.fn(),
  },
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

import { useAuthStore } from '@/features/auth/stores/auth.store'
import { useTour } from '../useTour'
import { api } from '@/lib/client'
import { modals } from '@mantine/modals'

function setupUser(overrides: Record<string, any> = {}) {
  act(() => {
    useAuthStore.setState({
      user: {
        id: 'u1',
        email: 'test@example.com',
        name: 'Test User',
        isActive: true,
        createdAt: '',
        updatedAt: '',
        settings: {},
        ...overrides,
      } as any,
      token: 'token',
      isAuthenticated: true,
      isLoading: false,
      error: null,
    })
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  setupUser()
})

describe('useTour', () => {
  describe('startTour', () => {
    it('returns startTour and destroyTour functions', () => {
      const { result } = renderHook(() => useTour())
      expect(typeof result.current.startTour).toBe('function')
      expect(typeof result.current.destroyTour).toBe('function')
    })

    it('calls driver and drive when starting a tour with available steps', async () => {
      const { driver } = require('driver.js')

      document.body.innerHTML = '<div data-tour-id="app-sidebar"></div>'
      const { result } = renderHook(() => useTour())

      await act(async () => {
        await result.current.startTour('home')
      })

      expect(driver).toHaveBeenCalled()
      expect(mockDrive).toHaveBeenCalled()
    })

    it('skips to next screen in full mode when no steps are available', async () => {
      document.body.innerHTML = ''
      const { result } = renderHook(() => useTour())

      await act(async () => {
        await result.current.startTour('home', { mode: 'full' })
      })

      expect(mockPush).toHaveBeenCalledWith(expect.stringContaining('startTour=full'))
    })

    it('completes full tour when on last screen with no available steps', async () => {
      document.body.innerHTML = ''
      setupUser({ settings: { onboarding: { role: 'EMPLOYEE' } } })
      const { result } = renderHook(() => useTour())

      await act(async () => {
        await result.current.startTour('analytics', { mode: 'full' })
      })

      expect(api.users.updateMySettings).toHaveBeenCalled()
    })

    it('does nothing when no steps match and mode is single', async () => {
      document.body.innerHTML = ''
      const { result } = renderHook(() => useTour())

      await act(async () => {
        await result.current.startTour('home', { mode: 'single' })
      })

      expect(mockPush).not.toHaveBeenCalled()
      expect(mockDrive).not.toHaveBeenCalled()
    })

    it('includes team-config for MANAGER role in full tour', async () => {
      setupUser({ settings: { onboarding: { role: 'MANAGER' } } })
      document.body.innerHTML = ''
      const { result } = renderHook(() => useTour())

      await act(async () => {
        await result.current.startTour('analytics', { mode: 'full' })
      })

      expect(mockPush).toHaveBeenCalledWith(expect.stringContaining('team-config'))
    })

    it('does not include team-config for EMPLOYEE role in full tour', async () => {
      setupUser({ settings: { onboarding: { role: 'EMPLOYEE' } } })
      document.body.innerHTML = ''
      const { result } = renderHook(() => useTour())

      await act(async () => {
        await result.current.startTour('analytics', { mode: 'full' })
      })

      expect(mockPush).not.toHaveBeenCalledWith(expect.stringContaining('team-config'))
    })

    it('destroys previous driver before starting new tour', async () => {
      document.body.innerHTML = '<div data-tour-id="app-sidebar"></div>'
      const { result } = renderHook(() => useTour())

      await act(async () => {
        await result.current.startTour('home')
      })

      await act(async () => {
        await result.current.startTour('home')
      })

      expect(mockDestroy).toHaveBeenCalled()
    })
  })

  describe('destroyTour', () => {
    it('destroys the driver instance', async () => {
      document.body.innerHTML = '<div data-tour-id="app-sidebar"></div>'
      const { result } = renderHook(() => useTour())

      await act(async () => {
        await result.current.startTour('home')
      })

      act(() => {
        result.current.destroyTour()
      })

      expect(mockDestroy).toHaveBeenCalled()
    })

    it('is safe to call when no driver is active', () => {
      const { result } = renderHook(() => useTour())

      act(() => {
        result.current.destroyTour()
      })
    })
  })

  describe('onCloseClick', () => {
    it('opens a confirm modal when close is clicked', async () => {
      const { driver } = require('driver.js')

      document.body.innerHTML = '<div data-tour-id="app-sidebar"></div>'
      const { result } = renderHook(() => useTour())

      await act(async () => {
        await result.current.startTour('home')
      })

      const driverConfig = driver.mock.calls[driver.mock.calls.length - 1][0]
      expect(driverConfig.onCloseClick).toBeDefined()

      driverConfig.onCloseClick(null, null, { driver: mockDriverInstance })
      expect(modals.openConfirmModal).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Stop tutorial?',
        })
      )
    })
  })

  describe('onNextClick', () => {
    it('calls moveNext when not on last step', async () => {
      const { driver } = require('driver.js')
      mockIsLastStep.mockReturnValue(false)

      document.body.innerHTML = '<div data-tour-id="app-sidebar"></div>'
      const { result } = renderHook(() => useTour())

      await act(async () => {
        await result.current.startTour('home')
      })

      const driverConfig = driver.mock.calls[driver.mock.calls.length - 1][0]
      driverConfig.onNextClick(null, null, { driver: mockDriverInstance })

      expect(mockMoveNext).toHaveBeenCalled()
    })

    it('completes tour on last step in single mode', async () => {
      const { driver } = require('driver.js')
      mockIsLastStep.mockReturnValue(true)

      document.body.innerHTML = '<div data-tour-id="app-sidebar"></div>'
      const { result } = renderHook(() => useTour())

      await act(async () => {
        await result.current.startTour('home', { mode: 'single' })
      })

      const driverConfig = driver.mock.calls[driver.mock.calls.length - 1][0]

      await act(async () => {
        driverConfig.onNextClick(null, null, { driver: mockDriverInstance })
      })

      expect(mockDestroy).toHaveBeenCalled()
      expect(api.users.updateMySettings).toHaveBeenCalled()
    })
  })
})
