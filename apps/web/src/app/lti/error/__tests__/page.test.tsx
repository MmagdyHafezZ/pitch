/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MantineProvider } from '@mantine/core'

const mockPush = jest.fn()
const mockGet = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn() }),
  useSearchParams: () => ({
    get: mockGet,
    toString: jest.fn().mockReturnValue(''),
  }),
}))

import LtiErrorPage from '../page'

function renderPage() {
  return render(
    <MantineProvider>
      <LtiErrorPage />
    </MantineProvider>
  )
}

beforeEach(() => {
  jest.clearAllMocks()
  mockGet.mockReturnValue(null)
})

describe('LtiErrorPage', () => {
  it('renders the error page title', () => {
    renderPage()
    expect(screen.getByText('LTI Launch Error')).toBeInTheDocument()
  })

  it('shows default launch_failed message when no reason', () => {
    mockGet.mockReturnValue(null)
    renderPage()
    expect(screen.getByText(/The LTI launch could not be completed/)).toBeInTheDocument()
  })

  it('shows launch_failed message for launch_failed reason', () => {
    mockGet.mockReturnValue('launch_failed')
    renderPage()
    expect(screen.getByText(/The LTI launch could not be completed/)).toBeInTheDocument()
  })

  it('shows invalid_state message', () => {
    mockGet.mockReturnValue('invalid_state')
    renderPage()
    expect(screen.getByText(/OIDC state was invalid/)).toBeInTheDocument()
  })

  it('shows missing_email message', () => {
    mockGet.mockReturnValue('missing_email')
    renderPage()
    expect(screen.getByText(/did not provide an email address/)).toBeInTheDocument()
  })

  it('falls back to launch_failed for unknown reason', () => {
    mockGet.mockReturnValue('unknown_reason')
    renderPage()
    expect(screen.getByText(/The LTI launch could not be completed/)).toBeInTheDocument()
  })

  it('shows contact support text', () => {
    renderPage()
    expect(screen.getByText(/contact your instructor or PITCH support/)).toBeInTheDocument()
  })

  it('navigates to login when sign in manually is clicked', async () => {
    renderPage()
    const user = userEvent.setup()
    await user.click(screen.getByText('Sign in manually'))
    expect(mockPush).toHaveBeenCalledWith('/auth/login')
  })
})
