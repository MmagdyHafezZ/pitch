/**
 * @jest-environment jsdom
 */
import React from 'react'
import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WelcomeStep } from '../WelcomeStep'
import { RoleStep } from '../RoleStep'
import { TutorialOfferStep } from '../TutorialOfferStep'
import { EmployeeCareerStep } from '../EmployeeCareerStep'
import { ManagerInviteStep } from '../ManagerInviteStep'
import { ManagerSalesforceStep } from '../ManagerSalesforceStep'

jest.mock('@/features/auth/stores/auth.store', () => ({
  useAuthStore: (selector: any) =>
    selector({
      user: { id: 'u1', name: 'Jane Doe', settings: {} },
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

describe('WelcomeStep', () => {
  it('renders welcome message with the user first name', () => {
    render(<WelcomeStep onNext={jest.fn()} />, { wrapper: Wrapper })
    expect(screen.getByText(/Welcome, Jane!/)).toBeInTheDocument()
  })

  it('renders Get Started button', () => {
    render(<WelcomeStep onNext={jest.fn()} />, { wrapper: Wrapper })
    expect(screen.getByText('Get Started')).toBeInTheDocument()
  })

  it('calls onNext when Get Started is clicked', async () => {
    const user = userEvent.setup()
    const onNext = jest.fn()
    render(<WelcomeStep onNext={onNext} />, { wrapper: Wrapper })

    await user.click(screen.getByText('Get Started'))
    expect(onNext).toHaveBeenCalled()
  })
})

describe('RoleStep', () => {
  it('renders role selection cards', () => {
    render(<RoleStep onNext={jest.fn()} onSkip={jest.fn()} />, { wrapper: Wrapper })

    expect(screen.getByText('What best describes your role?')).toBeInTheDocument()
    expect(screen.getByText('Sales Manager')).toBeInTheDocument()
    expect(screen.getByText('Sales Rep')).toBeInTheDocument()
  })

  it('has disabled Continue button when no role is selected', () => {
    render(<RoleStep onNext={jest.fn()} onSkip={jest.fn()} />, { wrapper: Wrapper })
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()
  })

  it('enables Continue after selecting a role', async () => {
    const user = userEvent.setup()
    render(<RoleStep onNext={jest.fn()} onSkip={jest.fn()} />, { wrapper: Wrapper })

    await user.click(screen.getByText('Sales Manager'))
    expect(screen.getByRole('button', { name: 'Continue' })).not.toBeDisabled()
  })

  it('calls onNext with MANAGER when Sales Manager is selected', async () => {
    const user = userEvent.setup()
    const onNext = jest.fn()
    render(<RoleStep onNext={onNext} onSkip={jest.fn()} />, { wrapper: Wrapper })

    await user.click(screen.getByText('Sales Manager'))
    await user.click(screen.getByText('Continue'))
    expect(onNext).toHaveBeenCalledWith('MANAGER')
  })

  it('calls onNext with EMPLOYEE when Sales Rep is selected', async () => {
    const user = userEvent.setup()
    const onNext = jest.fn()
    render(<RoleStep onNext={onNext} onSkip={jest.fn()} />, { wrapper: Wrapper })

    await user.click(screen.getByText('Sales Rep'))
    await user.click(screen.getByText('Continue'))
    expect(onNext).toHaveBeenCalledWith('EMPLOYEE')
  })

  it('calls onSkip when Skip is clicked', async () => {
    const user = userEvent.setup()
    const onSkip = jest.fn()
    render(<RoleStep onNext={jest.fn()} onSkip={onSkip} />, { wrapper: Wrapper })

    await user.click(screen.getByText('Skip'))
    expect(onSkip).toHaveBeenCalled()
  })
})

describe('TutorialOfferStep', () => {
  it('renders tour highlights', () => {
    render(<TutorialOfferStep onStartTour={jest.fn()} onSkip={jest.fn()} />, { wrapper: Wrapper })

    expect(screen.getByText(/You're all set!/)).toBeInTheDocument()
    expect(screen.getByText('Home Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Sessions')).toBeInTheDocument()
    expect(screen.getByText('Analytics')).toBeInTheDocument()
    expect(screen.getByText('Team Config')).toBeInTheDocument()
  })

  it('calls onStartTour when Start Tour is clicked', async () => {
    const user = userEvent.setup()
    const onStartTour = jest.fn()
    render(<TutorialOfferStep onStartTour={onStartTour} onSkip={jest.fn()} />, { wrapper: Wrapper })

    await user.click(screen.getByText('Start Tour'))
    expect(onStartTour).toHaveBeenCalled()
  })

  it('calls onSkip when Skip tour is clicked', async () => {
    const user = userEvent.setup()
    const onSkip = jest.fn()
    render(<TutorialOfferStep onStartTour={jest.fn()} onSkip={onSkip} />, { wrapper: Wrapper })

    await user.click(screen.getByText('Skip tour'))
    expect(onSkip).toHaveBeenCalled()
  })
})

describe('EmployeeCareerStep', () => {
  it('renders career form fields', () => {
    render(<EmployeeCareerStep onNext={jest.fn()} onSkip={jest.fn()} />, { wrapper: Wrapper })

    expect(screen.getByText('Tell us about yourself')).toBeInTheDocument()
    expect(screen.getByLabelText('Job Title')).toBeInTheDocument()
    expect(screen.getByLabelText('Years of Sales Experience')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Select your industry')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('https://linkedin.com/in/yourprofile')).toBeInTheDocument()
  })

  it('calls onNext with form values when Continue is clicked', async () => {
    const user = userEvent.setup()
    const onNext = jest.fn()
    render(<EmployeeCareerStep onNext={onNext} onSkip={jest.fn()} />, { wrapper: Wrapper })

    await user.type(screen.getByLabelText('Job Title'), 'Account Exec')
    await user.click(screen.getByText('Continue'))

    expect(onNext).toHaveBeenCalledWith(expect.objectContaining({ jobTitle: 'Account Exec' }))
  })

  it('calls onSkip when Skip is clicked', async () => {
    const user = userEvent.setup()
    const onSkip = jest.fn()
    render(<EmployeeCareerStep onNext={jest.fn()} onSkip={onSkip} />, { wrapper: Wrapper })

    await user.click(screen.getByText('Skip'))
    expect(onSkip).toHaveBeenCalled()
  })
})

describe('ManagerInviteStep', () => {
  it('renders the invite form', () => {
    render(<ManagerInviteStep onNext={jest.fn()} onSkip={jest.fn()} />, { wrapper: Wrapper })

    expect(screen.getByText('Invite your team')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('colleague@company.com')).toBeInTheDocument()
  })

  it('can add more email fields', async () => {
    const user = userEvent.setup()
    render(<ManagerInviteStep onNext={jest.fn()} onSkip={jest.fn()} />, { wrapper: Wrapper })

    await user.click(screen.getByText('Add another'))
    const inputs = screen.getAllByPlaceholderText('colleague@company.com')
    expect(inputs).toHaveLength(2)
  })

  it('shows valid email badges', async () => {
    const user = userEvent.setup()
    render(<ManagerInviteStep onNext={jest.fn()} onSkip={jest.fn()} />, { wrapper: Wrapper })

    await user.type(screen.getByPlaceholderText('colleague@company.com'), 'alice@company.com')
    expect(screen.getByText('alice@company.com')).toBeInTheDocument()
  })

  it('shows Send invite button when valid email is entered', async () => {
    const user = userEvent.setup()
    render(<ManagerInviteStep onNext={jest.fn()} onSkip={jest.fn()} />, { wrapper: Wrapper })

    await user.type(screen.getByPlaceholderText('colleague@company.com'), 'alice@company.com')
    expect(screen.getByText('Send 1 invite')).toBeInTheDocument()
  })

  it('shows success message after sending invites', async () => {
    const user = userEvent.setup()
    render(<ManagerInviteStep onNext={jest.fn()} onSkip={jest.fn()} />, { wrapper: Wrapper })

    await user.type(screen.getByPlaceholderText('colleague@company.com'), 'alice@company.com')
    await user.click(screen.getByText('Send 1 invite'))

    await waitFor(() => {
      expect(screen.getByText(/Invites will be sent/)).toBeInTheDocument()
    })
  })

  it('calls onNext when Continue is clicked', async () => {
    const user = userEvent.setup()
    const onNext = jest.fn()
    render(<ManagerInviteStep onNext={onNext} onSkip={jest.fn()} />, { wrapper: Wrapper })

    await user.click(screen.getByText('Continue'))
    expect(onNext).toHaveBeenCalled()
  })

  it('calls onSkip when Skip for now is clicked', async () => {
    const user = userEvent.setup()
    const onSkip = jest.fn()
    render(<ManagerInviteStep onNext={jest.fn()} onSkip={onSkip} />, { wrapper: Wrapper })

    await user.click(screen.getByText('Skip for now'))
    expect(onSkip).toHaveBeenCalled()
  })

  it('can remove an email field', async () => {
    const user = userEvent.setup()
    render(<ManagerInviteStep onNext={jest.fn()} onSkip={jest.fn()} />, { wrapper: Wrapper })

    await user.click(screen.getByText('Add another'))
    expect(screen.getAllByPlaceholderText('colleague@company.com')).toHaveLength(2)

    await user.click(screen.getAllByLabelText('Remove email')[0])
    expect(screen.getAllByPlaceholderText('colleague@company.com')).toHaveLength(1)
  })
})

describe('ManagerSalesforceStep', () => {
  it('renders the Connect Salesforce UI', () => {
    render(<ManagerSalesforceStep onNext={jest.fn()} onSkip={jest.fn()} />, { wrapper: Wrapper })

    expect(screen.getByText('Connect Salesforce')).toBeInTheDocument()
    expect(screen.getByText('Connect with Salesforce')).toBeInTheDocument()
    expect(screen.getByText('Continue anyway')).toBeInTheDocument()
  })

  it('calls onSkip when Skip for now is clicked', async () => {
    const user = userEvent.setup()
    const onSkip = jest.fn()
    render(<ManagerSalesforceStep onNext={jest.fn()} onSkip={onSkip} />, { wrapper: Wrapper })

    await user.click(screen.getByText('Skip for now'))
    expect(onSkip).toHaveBeenCalled()
  })

  it('calls onNext when Continue anyway is clicked', async () => {
    const user = userEvent.setup()
    const onNext = jest.fn()
    render(<ManagerSalesforceStep onNext={onNext} onSkip={jest.fn()} />, { wrapper: Wrapper })

    await user.click(screen.getByText('Continue anyway'))
    expect(onNext).toHaveBeenCalled()
  })

  it('shows connected state when Salesforce status returns connected', async () => {
    const { api } = require('@/lib/client')
    api.crm.salesforce.status.mockResolvedValueOnce({ connected: true })

    render(<ManagerSalesforceStep onNext={jest.fn()} onSkip={jest.fn()} />, { wrapper: Wrapper })

    await waitFor(() => {
      expect(screen.getByText('Salesforce Connected')).toBeInTheDocument()
    })
  })
})
