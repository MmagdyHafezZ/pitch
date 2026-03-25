/** @jest-environment jsdom */
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MantineProvider } from '@mantine/core'

const mockGetCredentials = jest.fn()
const mockRegisterPlatform = jest.fn()

jest.mock('@/lib/client', () => ({
  api: {
    lti: {
      getCredentials: (...args: unknown[]) => mockGetCredentials(...args),
      registerPlatform: (...args: unknown[]) => mockRegisterPlatform(...args),
    },
  },
}))

import { LtiEmbedModal } from '../LtiEmbedModal'

function Wrapper({ children }: { children: React.ReactNode }) {
  return <MantineProvider>{children}</MantineProvider>
}

const credentials = {
  v13: {
    launchUrl: 'https://example.com/launch',
    oidcLoginUrl: 'https://example.com/oidc',
    jwksUrl: 'https://example.com/jwks',
    redirectUri: 'https://example.com/redirect',
    publicKeyPem: null,
  },
  v11: { launchUrl: 'https://example.com/v11-launch' },
}

describe('LtiEmbedModal', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('does not render content when closed', () => {
    mockGetCredentials.mockResolvedValue(credentials)
    render(<LtiEmbedModal opened={false} onClose={jest.fn()} sessionId="s1" />, {
      wrapper: Wrapper,
    })
    expect(screen.queryByText('Embed in LMS')).not.toBeInTheDocument()
  })

  it('shows loading state while fetching credentials', () => {
    mockGetCredentials.mockReturnValue(new Promise(() => {}))
    render(<LtiEmbedModal opened={true} onClose={jest.fn()} sessionId="s1" />, {
      wrapper: Wrapper,
    })
    expect(screen.getByText('Loading credentials…')).toBeInTheDocument()
  })

  it('displays error alert when credentials fail to load', async () => {
    mockGetCredentials.mockRejectedValue(new Error('fail'))
    render(<LtiEmbedModal opened={true} onClose={jest.fn()} sessionId="s1" />, {
      wrapper: Wrapper,
    })
    await waitFor(() => {
      expect(screen.getByText('Failed to load LTI credentials.')).toBeInTheDocument()
    })
  })

  it('renders credential fields after successful load', async () => {
    mockGetCredentials.mockResolvedValue(credentials)
    render(<LtiEmbedModal opened={true} onClose={jest.fn()} sessionId="s1" />, {
      wrapper: Wrapper,
    })
    await waitFor(() => {
      expect(screen.getByText('Launch URL')).toBeInTheDocument()
    })
    expect(screen.getAllByText('Auth URL').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByDisplayValue(credentials.v13.launchUrl)).toBeInTheDocument()
  })

  it('renders public keyset URL when publicKeyPem is null', async () => {
    mockGetCredentials.mockResolvedValue(credentials)
    render(<LtiEmbedModal opened={true} onClose={jest.fn()} sessionId="s1" />, {
      wrapper: Wrapper,
    })
    await waitFor(() => {
      expect(screen.getByText('Public Keyset URL (JWKS)')).toBeInTheDocument()
    })
  })

  it('renders public key field when publicKeyPem is present', async () => {
    const withPem = {
      ...credentials,
      v13: {
        ...credentials.v13,
        publicKeyPem: '-----BEGIN PUBLIC KEY-----\nABC\n-----END PUBLIC KEY-----',
      },
    }
    mockGetCredentials.mockResolvedValue(withPem)
    render(<LtiEmbedModal opened={true} onClose={jest.fn()} sessionId="s1" />, {
      wrapper: Wrapper,
    })
    await waitFor(() => {
      expect(screen.getByText('Public Key')).toBeInTheDocument()
    })
  })

  it('shows registration form with required fields', async () => {
    mockGetCredentials.mockResolvedValue(credentials)
    render(<LtiEmbedModal opened={true} onClose={jest.fn()} sessionId="s1" />, {
      wrapper: Wrapper,
    })
    await waitFor(() => {
      expect(screen.getByText('Register')).toBeInTheDocument()
    })
    expect(screen.getByLabelText(/Credential Name/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Keyset URL/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Issuer/)).toBeInTheDocument()
  })
})
