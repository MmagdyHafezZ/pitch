/**
 * @jest-environment jsdom
 */
import userEvent from '@testing-library/user-event'
import { render, screen, waitFor, within } from '@/__tests__/utils/test-utils'
import { SettingsModal } from '../SettingsModal'

var mockPush: jest.Mock
var mockLogout: jest.Mock
var mockSetUser: jest.Mock
var mockGetMyPhoneVerification: jest.Mock
var mockRequestPhoneVerification: jest.Mock
var mockResendPhoneVerification: jest.Mock
var mockVerifyPhoneVerification: jest.Mock

jest.mock('next/navigation', () => ({
  useRouter: () => {
    mockPush ??= jest.fn()
    return { push: mockPush }
  },
}))

jest.mock('@/lib/client', () => ({
  api: {
    users: {
      getMyPhoneVerification: (...args: any[]) => {
        mockGetMyPhoneVerification ??= jest
          .fn()
          .mockResolvedValue({ verified: false, phoneNumber: null, pendingPhoneNumber: null })
        return mockGetMyPhoneVerification(...args)
      },
      requestPhoneVerification: (...args: any[]) => {
        mockRequestPhoneVerification ??= jest.fn()
        return mockRequestPhoneVerification(...args)
      },
      resendPhoneVerification: (...args: any[]) => {
        mockResendPhoneVerification ??= jest.fn()
        return mockResendPhoneVerification(...args)
      },
      verifyPhoneVerification: (...args: any[]) => {
        mockVerifyPhoneVerification ??= jest.fn()
        return mockVerifyPhoneVerification(...args)
      },
    },
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
  useAuthStore: (selector: (state: { setUser: jest.Mock }) => unknown) => {
    mockSetUser ??= jest.fn()
    return selector({ setUser: mockSetUser })
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
    mockSetUser = jest.fn()
    mockGetMyPhoneVerification = jest
      .fn()
      .mockResolvedValue({ verified: false, phoneNumber: null, pendingPhoneNumber: null })
    mockRequestPhoneVerification = jest.fn()
    mockResendPhoneVerification = jest.fn()
    mockVerifyPhoneVerification = jest.fn()
  })

  it('renders account fields with current user defaults', async () => {
    render(<SettingsModal opened onClose={jest.fn()} />)

    expect(await screen.findByLabelText('Name')).toHaveValue('Test User')
    expect(screen.getByLabelText('Email')).toHaveValue('test@example.com')
    expect(screen.getByText('Not connected')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add number' })).toBeInTheDocument()
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

  it('opens the add-number overlay and requests a phone verification code', async () => {
    mockRequestPhoneVerification.mockResolvedValue({
      verified: false,
      phoneNumber: null,
      pendingPhoneNumber: '+15551234567',
      remainingSends: 2,
    })

    const user = userEvent.setup()
    render(<SettingsModal opened onClose={jest.fn()} />)

    await user.click(await screen.findByRole('button', { name: 'Add number' }))
    expect(await screen.findByRole('textbox', { name: 'Country code' })).toHaveValue(
      'Canada / US (+1)'
    )
    await user.type(await screen.findByRole('textbox', { name: 'Phone number' }), '5551234567')
    await user.click(screen.getByRole('button', { name: 'Confirm' }))

    await waitFor(() => {
      expect(mockRequestPhoneVerification).toHaveBeenCalledWith({ phoneNumber: '+15551234567' })
    })
    expect(await screen.findByText('Please enter verification code below')).toBeInTheDocument()
    expect(screen.getByText('We sent a code to +15551234567.')).toBeInTheDocument()
  })

  it('verifies a phone code from the overlay and syncs the user phone in auth state', async () => {
    mockGetMyPhoneVerification.mockResolvedValue({
      verified: false,
      phoneNumber: null,
      pendingPhoneNumber: '+15551234567',
      remainingSends: 2,
    })
    mockVerifyPhoneVerification.mockResolvedValue({
      verified: true,
      phoneNumber: '+15551234567',
      verifiedAt: '2026-03-17T12:00:00.000Z',
    })

    const user = userEvent.setup()
    render(<SettingsModal opened onClose={jest.fn()} />)

    await user.click(await screen.findByRole('button', { name: 'Finish setup' }))
    await screen.findByText('Please enter verification code below')
    const codeInput = within(screen.getByTestId('phone-code-input')).getAllByRole('textbox')[0]
    await user.type(codeInput, '123456')
    await user.click(screen.getByRole('button', { name: 'Verify code' }))

    await waitFor(() => {
      expect(mockVerifyPhoneVerification).toHaveBeenCalledWith({ code: '123456' })
    })
    expect(mockSetUser).toHaveBeenCalledWith(
      expect.objectContaining({
        phoneNumber: '+15551234567',
        phoneVerifiedAt: '2026-03-17T12:00:00.000Z',
      })
    )
    expect(await screen.findByText('+15551234567')).toBeInTheDocument()
    expect(screen.getByText('Connected for phone-based sessions.')).toBeInTheDocument()
  })
})
