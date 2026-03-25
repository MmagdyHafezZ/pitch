/**
 * @jest-environment jsdom
 */
import React from 'react'
import userEvent from '@testing-library/user-event'
import { render, screen, waitFor, act } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { OnboardingWizard } from '../OnboardingWizard'
import { useOnboardingStore } from '../../stores/onboarding.store'

const mockCompleteOnboarding = jest.fn().mockResolvedValue(undefined)
const mockSkipAll = jest.fn().mockResolvedValue(undefined)

jest.mock('../../hooks/useOnboarding', () => ({
  useOnboarding: () => ({
    completeOnboarding: mockCompleteOnboarding,
    skipAll: mockSkipAll,
    saveProgress: jest.fn(),
  }),
}))

jest.mock('@/features/auth/stores/auth.store', () => ({
  useAuthStore: (selector: any) =>
    selector({
      user: { id: 'u1', name: 'Test User', settings: {} },
      token: 'token',
    }),
}))

jest.mock('@/lib/client', () => ({
  api: {
    crm: {
      salesforce: {
        status: jest.fn().mockRejectedValue(new Error('not connected')),
      },
    },
    users: {
      updateMySettings: jest.fn().mockResolvedValue({}),
    },
  },
}))

jest.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: any) => <>{children}</>,
  motion: {
    div: ({ children, ...props }: any) => <div>{children}</div>,
  },
}))

const qc = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
})

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={qc}>
      <MantineProvider>{children}</MantineProvider>
    </QueryClientProvider>
  )
}

beforeEach(() => {
  jest.clearAllMocks()
  act(() => {
    useOnboardingStore.getState().reset()
  })
})

describe('OnboardingWizard', () => {
  it('renders the welcome step initially', () => {
    render(<OnboardingWizard />, { wrapper: Wrapper })

    expect(screen.getByText(/Welcome, Test/)).toBeInTheDocument()
    expect(screen.getByText('Get Started')).toBeInTheDocument()
    expect(screen.getByText(/Step 1 of/)).toBeInTheDocument()
  })

  it('shows PITCH brand text', () => {
    render(<OnboardingWizard />, { wrapper: Wrapper })
    expect(screen.getByText('PITCH')).toBeInTheDocument()
  })

  it('has a Skip all button', () => {
    render(<OnboardingWizard />, { wrapper: Wrapper })
    expect(screen.getByText('Skip all')).toBeInTheDocument()
  })

  it('calls skipAll when Skip all button is clicked', async () => {
    const user = userEvent.setup()
    render(<OnboardingWizard />, { wrapper: Wrapper })

    await user.click(screen.getByText('Skip all'))
    expect(mockSkipAll).toHaveBeenCalled()
  })

  it('advances from welcome to role step', async () => {
    const user = userEvent.setup()
    render(<OnboardingWizard />, { wrapper: Wrapper })

    await user.click(screen.getByText('Get Started'))

    expect(screen.getByText('What best describes your role?')).toBeInTheDocument()
  })

  it('shows manager flow steps after selecting MANAGER', async () => {
    const user = userEvent.setup()
    render(<OnboardingWizard />, { wrapper: Wrapper })

    await user.click(screen.getByText('Get Started'))
    await user.click(screen.getByText('Sales Manager'))
    await user.click(screen.getByText('Continue'))

    await waitFor(() => {
      expect(screen.getByText('Connect Salesforce')).toBeInTheDocument()
    })
  })

  it('shows employee flow after selecting EMPLOYEE', async () => {
    const user = userEvent.setup()
    render(<OnboardingWizard />, { wrapper: Wrapper })

    await user.click(screen.getByText('Get Started'))
    await user.click(screen.getByText('Sales Rep'))
    await user.click(screen.getByText('Continue'))

    await waitFor(() => {
      expect(screen.getByText('Tell us about yourself')).toBeInTheDocument()
    })
  })

  it('can skip the role step to go to tutorial', async () => {
    const user = userEvent.setup()
    render(<OnboardingWizard />, { wrapper: Wrapper })

    await user.click(screen.getByText('Get Started'))
    await user.click(screen.getByText('Skip'))

    await waitFor(() => {
      expect(screen.getByText(/You're all set!/)).toBeInTheDocument()
    })
  })

  it('calls completeOnboarding on Start Tour click', async () => {
    const user = userEvent.setup()
    render(<OnboardingWizard />, { wrapper: Wrapper })

    await user.click(screen.getByText('Get Started'))
    await user.click(screen.getByText('Skip'))

    await waitFor(() => {
      expect(screen.getByText('Start Tour')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Start Tour'))

    expect(mockCompleteOnboarding).toHaveBeenCalledWith(
      expect.objectContaining({ wantsTutorial: true }),
      expect.objectContaining({
        redirectTo: expect.stringContaining('startTour'),
      })
    )
  })

  it('calls completeOnboarding on Skip tour click', async () => {
    const user = userEvent.setup()
    render(<OnboardingWizard />, { wrapper: Wrapper })

    await user.click(screen.getByText('Get Started'))
    await user.click(screen.getByText('Skip'))

    await waitFor(() => {
      expect(screen.getByText('Skip tour')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Skip tour'))

    expect(mockCompleteOnboarding).toHaveBeenCalledWith(
      expect.objectContaining({ wantsTutorial: false })
    )
  })

  it('navigates full manager flow', async () => {
    const user = userEvent.setup()
    render(<OnboardingWizard />, { wrapper: Wrapper })

    await user.click(screen.getByText('Get Started'))
    await user.click(screen.getByText('Sales Manager'))
    await user.click(screen.getByText('Continue'))

    await waitFor(() => {
      expect(screen.getByText('Connect Salesforce')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Continue anyway'))

    await waitFor(() => {
      expect(screen.getByText('Invite your team')).toBeInTheDocument()
    })

    await user.click(screen.getAllByText('Continue')[0])

    await waitFor(() => {
      expect(screen.getByText(/You're all set!/)).toBeInTheDocument()
    })
  })
})
