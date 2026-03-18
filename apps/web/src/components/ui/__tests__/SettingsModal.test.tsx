/**
 * @jest-environment jsdom
 */
import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@/__tests__/utils/test-utils'
import { SettingsModal } from '../SettingsModal'

var mockPush: jest.Mock
var mockLogout: jest.Mock

jest.mock('next/navigation', () => ({
  useRouter: () => {
    mockPush ??= jest.fn()
    return { push: mockPush }
  },
}))

jest.mock('@/features/auth', () => ({
  useAuth: () => {
    mockLogout ??= jest.fn().mockResolvedValue(undefined)
    return {
      user: {
        id: 'user-1',
        name: 'Test User',
        email: 'test@example.com',
      },
      logout: mockLogout,
      deleteAccount: jest.fn().mockResolvedValue(undefined),
    }
  },
}))

jest.mock('@/lib/stores/appearance.store', () => {
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
  return {
    useAppearanceStore: hook,
  }
})

describe('SettingsModal', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders account fields with current user defaults', async () => {
    render(<SettingsModal opened onClose={jest.fn()} />)

    expect(await screen.findByLabelText('Name')).toHaveValue('Test User')
    expect(screen.getByLabelText('Email')).toHaveValue('test@example.com')
    expect(screen.getByRole('textbox', { name: 'Time Zone' })).toBeInTheDocument()
  })

  it('closes modal when Save is clicked', async () => {
    const onClose = jest.fn()
    const user = userEvent.setup()

    render(<SettingsModal opened onClose={onClose} />)
    await user.click(await screen.findByRole('button', { name: /^Save$/ }))

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('logs out and redirects home', async () => {
    const onClose = jest.fn()
    const user = userEvent.setup()

    render(<SettingsModal opened onClose={onClose} />)
    await user.click(await screen.findByText('Logout'))

    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalledTimes(1)
    })
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(mockPush).toHaveBeenCalledWith('/')
  })

  it('shows delete account action on account section', async () => {
    render(<SettingsModal opened onClose={jest.fn()} />)
    expect(await screen.findByText('Delete Account')).toBeInTheDocument()
  })

  it('renders the persisted language settings section', async () => {
    const user = userEvent.setup()

    render(<SettingsModal opened onClose={jest.fn()} />)
    await user.click(await screen.findByText('Language'))

    expect(
      await screen.findByText(
        'Choose the language used across PITCH and as the default for new training sessions.'
      )
    ).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Platform language' })).toBeInTheDocument()
  })
})
