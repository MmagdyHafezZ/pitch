import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { act } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { useAdminStore } from '../stores/admin.store'

const mockReplace = jest.fn()
const mockPush = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace, push: mockPush }),
  usePathname: () => '/admin',
}))

jest.mock('@/features/auth/stores/auth.store', () => ({
  useAuthStore: (selector: any) =>
    selector({
      user: { id: '1', email: 'admin@test.com', settings: { onboarding: { completed: true } } },
    }),
}))

jest.mock('../stores/error-log.store', () => ({
  initializeErrorInterceptor: jest.fn(),
}))

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <MantineProvider>
      <Notifications />
      {children}
    </MantineProvider>
  )
}

describe('AdminLayout', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Reset admin store before each test
    act(() => {
      useAdminStore.setState({ isAdmin: null, checking: false })
    })
  })

  it('shows loader while admin check is in-flight', () => {
    act(() => {
      useAdminStore.setState({ isAdmin: null, checking: true })
    })

    const AdminLayout = require('../layout').default

    act(() => {
      render(
        <Wrapper>
          <AdminLayout>
            <div data-testid="children">Child Content</div>
          </AdminLayout>
        </Wrapper>
      )
    })

    expect(screen.queryByTestId('children')).not.toBeInTheDocument()
  })

  it('renders children for admin user', () => {
    act(() => {
      useAdminStore.setState({ isAdmin: true, checking: false })
    })

    const AdminLayout = require('../layout').default

    act(() => {
      render(
        <Wrapper>
          <AdminLayout>
            <div data-testid="children">Child Content</div>
          </AdminLayout>
        </Wrapper>
      )
    })

    expect(screen.getByTestId('children')).toBeInTheDocument()
  })

  it('redirects non-admin user to /studio/home', async () => {
    act(() => {
      useAdminStore.setState({ isAdmin: false, checking: false })
    })

    const AdminLayout = require('../layout').default

    act(() => {
      render(
        <Wrapper>
          <AdminLayout>
            <div data-testid="children">Child Content</div>
          </AdminLayout>
        </Wrapper>
      )
    })

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/studio/home')
    })
  })

  it('renders Errors nav item for admin', () => {
    act(() => {
      useAdminStore.setState({ isAdmin: true, checking: false })
    })

    const AdminLayout = require('../layout').default

    act(() => {
      render(
        <Wrapper>
          <AdminLayout>
            <div>content</div>
          </AdminLayout>
        </Wrapper>
      )
    })

    expect(screen.getByText('Errors')).toBeInTheDocument()
  })

  it('does not render children when not admin', () => {
    act(() => {
      useAdminStore.setState({ isAdmin: false, checking: false })
    })

    const AdminLayout = require('../layout').default

    act(() => {
      render(
        <Wrapper>
          <AdminLayout>
            <div data-testid="children">Child Content</div>
          </AdminLayout>
        </Wrapper>
      )
    })

    expect(screen.queryByTestId('children')).not.toBeInTheDocument()
  })
})
