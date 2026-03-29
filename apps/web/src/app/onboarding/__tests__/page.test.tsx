/**
 * @jest-environment jsdom
 */
import { render, screen } from '@/__tests__/utils/test-utils'
import OnboardingPage from '../page'

const mockReplace = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: mockReplace,
  }),
}))

jest.mock('@/features/auth/stores/auth.store', () => ({
  useAuthStore: jest.fn(),
}))

jest.mock('@/features/onboarding', () => ({
  OnboardingWizard: () => <div data-testid="onboarding-wizard">OnboardingWizard</div>,
}))

jest.mock('@/components/ui/LoadingScreen', () => ({
  LoadingScreen: () => <div data-testid="loading-screen">Loading...</div>,
}))

describe('OnboardingPage', () => {
  const { useAuthStore } = require('@/features/auth/stores/auth.store')

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('shows loading screen when not authenticated', () => {
    useAuthStore.mockImplementation((selector: any) => selector({ user: null, token: null }))

    render(<OnboardingPage />)
    expect(screen.getByTestId('loading-screen')).toBeInTheDocument()
  })

  it('shows OnboardingWizard when authenticated and onboarding not completed', () => {
    useAuthStore.mockImplementation((selector: any) =>
      selector({
        user: { id: 'u1', settings: {} },
        token: 'token',
      })
    )

    render(<OnboardingPage />)
    expect(screen.getByTestId('onboarding-wizard')).toBeInTheDocument()
  })

  it('shows loading screen and redirects when onboarding is completed', () => {
    useAuthStore.mockImplementation((selector: any) =>
      selector({
        user: {
          id: 'u1',
          settings: { onboarding: { completed: true } },
        },
        token: 'token',
      })
    )

    render(<OnboardingPage />)
    expect(screen.getByTestId('loading-screen')).toBeInTheDocument()
    expect(mockReplace).toHaveBeenCalledWith('/studio/home')
  })
})
