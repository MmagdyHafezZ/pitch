/**
 * @jest-environment jsdom
 */
import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@/__tests__/utils/test-utils'
import { notifications } from '@mantine/notifications'
import { SettingsModal } from '../SettingsModal'

var mockPush: jest.Mock
var mockLogout: jest.Mock
var mockAuthStoreSetUser: jest.Mock
var mockAppearanceSetState: jest.Mock
var mockFetchCrmStatus: jest.Mock
var mockApi: {
  users: {
    getMySettings: jest.Mock
    update: jest.Mock
    updateMySettings: jest.Mock
  }
}

jest.mock('next/navigation', () => ({
  useRouter: () => {
    mockPush ??= jest.fn()
    return { push: mockPush }
  },
}))

jest.mock('@mantine/notifications', () => {
  const actual = jest.requireActual('@mantine/notifications')
  const show = jest.fn()
  return {
    ...actual,
    notifications: {
      show,
    },
  }
})

jest.mock('@/features/auth', () => ({
  useAuth: () => {
    mockLogout ??= jest.fn()
    return {
      user: {
        id: 'user-1',
        name: 'Test User',
        email: 'test@example.com',
      },
      logout: mockLogout,
    }
  },
}))

jest.mock('@/features/auth/stores/auth.store', () => ({
  useAuthStore: {
    getState: () => {
      mockAuthStoreSetUser ??= jest.fn()
      return {
        user: {
          id: 'user-1',
          name: 'Test User',
          email: 'test@example.com',
        },
        setUser: mockAuthStoreSetUser,
      }
    },
  },
}))

jest.mock('@/features/crm', () => ({
  useCrm: () => {
    mockFetchCrmStatus ??= jest.fn()
    return {
      status: { connected: false, provider: 'salesforce' },
      loadingStatus: false,
      error: null,
      fetchStatus: mockFetchCrmStatus,
      connect: jest.fn().mockResolvedValue(null),
    }
  },
}))

jest.mock('@/lib/client', () => {
  mockApi = {
    users: {
      getMySettings: jest.fn(),
      update: jest.fn(),
      updateMySettings: jest.fn(),
    },
  }
  return { api: mockApi }
})

jest.mock('@/lib/stores/appearance.store', () => {
  mockAppearanceSetState ??= jest.fn()
  const hook = jest.fn(() => ({
    colorMode: 'system',
    setColorMode: jest.fn(),
    profiles: [
      {
        id: 'ocean',
        name: 'Ocean',
        isCustom: false,
        tokens: {
          navBg: '#0f172a',
          surfaceBg: '#f1f3f5',
          accent: '#228be6',
          selected: '#4c6ef5',
          success: '#2f9e44',
          info: '#15aabf',
        },
      },
    ],
    activeProfileId: 'ocean',
    setActiveProfile: jest.fn(),
    deleteProfile: jest.fn(),
    customDraft: {
      navBg: '#0f172a',
      surfaceBg: '#f1f3f5',
      accent: '#228be6',
      selected: '#4c6ef5',
      success: '#2f9e44',
      info: '#15aabf',
    },
    updateCustomDraft: jest.fn(),
    randomizeCustomDraft: jest.fn(),
    createProfileFromDraft: jest.fn(),
    customDraftGradient: false,
    setCustomDraftGradient: jest.fn(),
  }))

  ;(hook as any).setState = mockAppearanceSetState
  return {
    useAppearanceStore: hook,
  }
})

describe('SettingsModal', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockApi.users.getMySettings.mockResolvedValue({})
    mockApi.users.update.mockResolvedValue({})
    mockApi.users.updateMySettings.mockResolvedValue({})
  })

  it('loads persisted settings when opened', async () => {
    mockApi.users.getMySettings.mockResolvedValueOnce({
      account: { timezone: '(GMT-8:00) Pacific Time' },
      appearance: { colorMode: 'dark' },
      browser: { compactMode: true },
    })

    render(<SettingsModal opened onClose={jest.fn()} />)

    await waitFor(() => {
      expect(mockApi.users.getMySettings).toHaveBeenCalledTimes(1)
    })
    expect(mockAppearanceSetState).toHaveBeenCalled()
  })

  it('saves profile and settings to the account', async () => {
    const onClose = jest.fn()
    const user = userEvent.setup()

    render(<SettingsModal opened onClose={onClose} />)

    await waitFor(() => {
      expect(mockApi.users.getMySettings).toHaveBeenCalled()
    })

    const nameInput = screen.getByLabelText('Name')
    const emailInput = screen.getByLabelText('Email')

    await user.clear(nameInput)
    await user.type(nameInput, 'Updated User')
    await user.clear(emailInput)
    await user.type(emailInput, 'updated@example.com')

    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(mockApi.users.update).toHaveBeenCalledWith('user-1', {
        name: 'Updated User',
        email: 'updated@example.com',
      })
    })

    expect(mockApi.users.updateMySettings).toHaveBeenCalledTimes(1)
    expect(mockApi.users.updateMySettings.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        account: expect.objectContaining({ timezone: expect.any(String) }),
        appearance: expect.objectContaining({
          colorMode: 'system',
          activeProfileId: 'ocean',
        }),
        crm: expect.objectContaining({
          provider: expect.anything(),
          connected: false,
        }),
      })
    )
    expect(mockAuthStoreSetUser).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Updated User',
        email: 'updated@example.com',
      })
    )
    expect(jest.mocked(notifications.show)).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })
})
