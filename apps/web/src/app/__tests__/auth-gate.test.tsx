/**
 * @jest-environment jsdom
 */
import { render, screen, waitFor } from '@/__tests__/utils/test-utils'
import { AuthGate } from '../auth-gate'

const mockReplace = jest.fn()
const mockRefreshAccessToken = jest.fn()
const mockUsePathname = jest.fn()
const mockUseSearchParams = jest.fn()
const mockUseAuthStore = jest.fn()
const mockAuthState = {
  token: 'token-1',
  refreshAccessToken: mockRefreshAccessToken,
}

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
  usePathname: () => mockUsePathname(),
  useSearchParams: () => mockUseSearchParams(),
}))

jest.mock('@/features/auth/stores/auth.store', () => ({
  useAuthStore: Object.assign(
    (selector: (state: typeof mockAuthState) => unknown) => mockUseAuthStore(selector),
    {
      getState: () => mockAuthState,
    }
  ),
}))

describe('AuthGate', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseAuthStore.mockImplementation((selector: (state: any) => unknown) =>
      selector({
        ...mockAuthState,
        refreshAccessToken: mockRefreshAccessToken.mockResolvedValue(true),
      })
    )
  })

  it('does not redirect away from invite auth page when already authenticated', async () => {
    mockUsePathname.mockReturnValue('/auth/register')
    mockUseSearchParams.mockReturnValue({
      get: (key: string) => (key === 'teamId' ? 'team-1' : null),
    })

    render(
      <AuthGate>
        <div>Child</div>
      </AuthGate>
    )

    expect(await screen.findByText('Child')).toBeInTheDocument()
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('redirects authenticated users away from non-invite auth pages', async () => {
    mockUsePathname.mockReturnValue('/auth/register')
    mockUseSearchParams.mockReturnValue({
      get: () => null,
    })

    render(
      <AuthGate>
        <div>Child</div>
      </AuthGate>
    )

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/studio/home')
    })
  })
})
