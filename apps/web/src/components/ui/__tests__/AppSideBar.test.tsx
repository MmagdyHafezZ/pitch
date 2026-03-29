/**
 * @jest-environment jsdom
 */
import React from 'react'
import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AppSidebar } from '../AppSideBar'

const mockPush = jest.fn()
const mockCheck = jest.fn()

let mockIsAdmin = false

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
  }),
}))

jest.mock('@/app/admin/stores/admin.store', () => ({
  useAdminStore: () => ({
    get isAdmin() {
      return mockIsAdmin
    },
    check: mockCheck,
  }),
}))

jest.mock('@/components/ui/WeekCalendar', () => ({
  WeekCalendar: ({ value, onChange }: any) => (
    <div data-testid="week-calendar" onClick={() => onChange(new Date('2026-03-25'))}>
      WeekCalendar
    </div>
  ),
}))

jest.mock('@/components/ui/SettingsModal', () => ({
  SettingsModal: ({ opened, onClose }: any) =>
    opened ? <div data-testid="settings-modal">Settings Modal</div> : null,
}))

jest.mock('@/features/i18n/I18nProvider', () => ({
  useI18n: () => ({
    t: (key: string) => key,
    locale: 'en',
    setLocale: jest.fn(),
  }),
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

describe('AppSidebar', () => {
  const defaultProps = {
    active: 'Home' as const,
    setActive: jest.fn(),
    selectedDate: null as Date | null,
    setSelectedDate: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockIsAdmin = false
  })

  it('renders all default navigation links', () => {
    render(<AppSidebar {...defaultProps} />, { wrapper: Wrapper })

    expect(screen.getByText('nav.home')).toBeInTheDocument()
    expect(screen.getByText('nav.sessions')).toBeInTheDocument()
    expect(screen.getByText('nav.analytics')).toBeInTheDocument()
    expect(screen.getByText('nav.challenges')).toBeInTheDocument()
    expect(screen.getByText('nav.teamConfig')).toBeInTheDocument()
  })

  it('calls check on mount', () => {
    render(<AppSidebar {...defaultProps} />, { wrapper: Wrapper })
    expect(mockCheck).toHaveBeenCalled()
  })

  it('navigates when a nav link is clicked', async () => {
    const user = userEvent.setup()
    render(<AppSidebar {...defaultProps} />, { wrapper: Wrapper })

    await user.click(screen.getByText('nav.sessions'))

    expect(defaultProps.setActive).toHaveBeenCalledWith('Sessions')
    expect(mockPush).toHaveBeenCalledWith('/studio/sessions')
  })

  it('navigates to the correct URL for Team Config', async () => {
    const user = userEvent.setup()
    render(<AppSidebar {...defaultProps} />, { wrapper: Wrapper })

    await user.click(screen.getByText('nav.teamConfig'))

    expect(defaultProps.setActive).toHaveBeenCalledWith('Team Config')
    expect(mockPush).toHaveBeenCalledWith('/studio/team-config')
  })

  it('hides Team Config when showTeamConfig is false', () => {
    render(<AppSidebar {...defaultProps} showTeamConfig={false} />, { wrapper: Wrapper })

    expect(screen.queryByText('nav.teamConfig')).not.toBeInTheDocument()
    expect(screen.getByText('nav.home')).toBeInTheDocument()
  })

  it('renders the WeekCalendar', () => {
    render(<AppSidebar {...defaultProps} />, { wrapper: Wrapper })
    expect(screen.getByTestId('week-calendar')).toBeInTheDocument()
  })

  it('does not show Admin link when user is not admin', () => {
    render(<AppSidebar {...defaultProps} />, { wrapper: Wrapper })
    expect(screen.queryByText('Admin')).not.toBeInTheDocument()
  })

  it('calls onNavigate when a link is clicked', async () => {
    const onNavigate = jest.fn()
    const user = userEvent.setup()
    render(<AppSidebar {...defaultProps} onNavigate={onNavigate} />, { wrapper: Wrapper })

    await user.click(screen.getByText('nav.home'))

    expect(onNavigate).toHaveBeenCalled()
  })

  it('renders with custom mainLinks', () => {
    const { IconHome } = require('@tabler/icons-react')
    render(<AppSidebar {...defaultProps} mainLinks={[{ icon: IconHome, label: 'Home' }]} />, {
      wrapper: Wrapper,
    })

    expect(screen.getByText('nav.home')).toBeInTheDocument()
    expect(screen.queryByText('nav.sessions')).not.toBeInTheDocument()
  })

  it('shows Admin link when user is admin', () => {
    mockIsAdmin = true
    render(<AppSidebar {...defaultProps} />, { wrapper: Wrapper })

    expect(screen.getByText('Admin')).toBeInTheDocument()
  })
})
