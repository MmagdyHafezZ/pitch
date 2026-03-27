/**
 * @jest-environment jsdom
 */
import userEvent from '@testing-library/user-event'
import { render, screen } from '@/__tests__/utils/test-utils'
import { AppSidebar, type SidebarLink } from '../AppSideBar'

const mockPush = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}))

jest.mock('@/components/ui/WeekCalendar', () => ({
  WeekCalendar: () => <div data-testid="week-calendar" />,
}))

jest.mock('@/components/ui/CoinQuotaWidget', () => ({
  CoinQuotaWidget: () => <div data-testid="coin-quota-widget" />,
}))

jest.mock('../SettingsModal', () => ({
  SettingsModal: () => null,
}))

const getNavControl = (label: string) => {
  const text = screen.getByText(label)
  const control = text.closest('button') ?? text.closest('a')
  expect(control).not.toBeNull()
  return control as HTMLElement
}

const baseProps = {
  active: 'Dashboard',
  setActive: jest.fn(),
  selectedDate: new Date('2026-03-26T00:00:00.000Z'),
  setSelectedDate: jest.fn(),
}

describe('AppSideBar', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('uses provided hrefs for admin sidebar main links', async () => {
    const user = userEvent.setup()
    const mainLinks: SidebarLink[] = [
      { icon: () => null, label: 'Dashboard', href: '/studio/admin' },
      { icon: () => null, label: 'System', href: '/studio/admin/system' },
      { icon: () => null, label: 'Users', href: '/studio/admin/users' },
    ]

    render(
      <AppSidebar {...baseProps} mainLinks={mainLinks} showAdmin={false} showTeamConfig={false} />
    )

    await user.click(getNavControl('System'))

    expect(mockPush).toHaveBeenCalledWith('/studio/admin/system')
  })

  it('renders and routes secondary links with their explicit hrefs', async () => {
    const user = userEvent.setup()
    const secondaryLinks: SidebarLink[] = [
      { icon: () => null, label: 'Back to Workspace', href: '/studio/home' },
    ]

    render(
      <AppSidebar
        {...baseProps}
        mainLinks={[{ icon: () => null, label: 'Dashboard', href: '/studio/admin' }]}
        secondaryLinks={secondaryLinks}
        showAdmin={false}
        showTeamConfig={false}
      />
    )

    await user.click(getNavControl('Back to Workspace'))

    expect(mockPush).toHaveBeenCalledWith('/studio/home')
  })

  it('routes the bottom admin shortcut to the studio admin dashboard', async () => {
    const user = userEvent.setup()

    render(
      <AppSidebar
        {...baseProps}
        mainLinks={[{ icon: () => null, label: 'Home', href: '/studio/home' }]}
        showAdmin
        showTeamConfig={false}
      />
    )

    await user.click(getNavControl('Admin'))

    expect(mockPush).toHaveBeenCalledWith('/studio/admin')
  })
})
