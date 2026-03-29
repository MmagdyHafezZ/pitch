/** @jest-environment jsdom */
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MantineProvider } from '@mantine/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const mockPush = jest.fn()
const mockBack = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: mockBack }),
  useParams: () => ({ id: 'sess-1' }),
}))

const mockGetById = jest.fn()

jest.mock('@/lib/client', () => ({
  api: {
    sessions: {
      getById: (...args: any[]) => mockGetById(...args),
    },
  },
}))

jest.mock('@/features/auth', () => ({
  useAuth: () => ({ user: { id: 'u1', name: 'Test User' } }),
}))

jest.mock('@/components/ui/JsonViewer', () => ({
  JsonViewer: ({ data }: { data: any }) => (
    <pre data-testid="json-viewer">{JSON.stringify(data)}</pre>
  ),
}))

jest.mock('@/components/ui/LtiEmbedModal', () => ({
  LtiEmbedModal: ({ opened, onClose }: { opened: boolean; onClose: () => void }) =>
    opened ? (
      <div data-testid="lti-embed-modal">
        <button onClick={onClose}>Close</button>
      </div>
    ) : null,
}))

import SessionDetailPage from '../page'

const qc = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
})

function renderPage() {
  return render(
    <QueryClientProvider client={qc}>
      <MantineProvider>
        <SessionDetailPage />
      </MantineProvider>
    </QueryClientProvider>
  )
}

const mockSession = {
  id: 'sess-1',
  name: 'My Session',
  userId: 'u1',
  orgId: 'org1',
  type: 'text',
  tags: ['sales', 'discovery'],
  sessionConfig: {
    llm: { provider: 'openai', model: 'gpt-4o' },
    voice: { provider: 'elevenlabs', voice: 'Rachel' },
  },
  scenarioId: 'sc1',
  personaId: 'p1',
  scenario: { id: 'sc1', name: 'Discovery Call', description: 'Qualify the lead' },
  persona: { id: 'p1', name: 'Sales Coach' },
  status: 'active',
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-02T00:00:00.000Z',
  endedAt: null,
  language: 'English',
}

beforeEach(() => {
  jest.clearAllMocks()
  mockGetById.mockResolvedValue(mockSession)
})

describe('StudioSessionDetailPage', () => {
  it('shows loader while loading', () => {
    mockGetById.mockReturnValue(new Promise(() => {}))
    renderPage()
    expect(document.querySelector('[class*="loader"], [class*="Loader"]')).toBeInTheDocument()
  })

  it('shows error message when session fails to load', async () => {
    mockGetById.mockRejectedValue(new Error('Failed'))
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Failed to load session')).toBeInTheDocument()
    })
  })

  it('shows session not found when getById returns null', async () => {
    mockGetById.mockResolvedValue(null)
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Session not found')).toBeInTheDocument()
    })
  })

  it('renders session name and status', async () => {
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('My Session')).toBeInTheDocument()
    })
    const activeElements = screen.getAllByText('active')
    expect(activeElements.length).toBeGreaterThan(0)
  })

  it('renders session ID in monospace element', async () => {
    renderPage()

    await waitFor(() => {
      const idElements = screen.getAllByText('sess-1')
      expect(idElements.length).toBeGreaterThan(0)
    })
  })

  it('renders Sessions back button', async () => {
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Sessions')).toBeInTheDocument()
    })

    const user = userEvent.setup()
    await user.click(screen.getByText('Sessions'))
    expect(mockPush).toHaveBeenCalledWith('/studio/sessions')
  })

  it('renders Launch button', async () => {
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Launch')).toBeInTheDocument()
    })

    const user = userEvent.setup()
    await user.click(screen.getByText('Launch'))
    expect(mockPush).toHaveBeenCalledWith('/session/sess-1')
  })

  it('renders Edit button enabled for session owner', async () => {
    renderPage()

    await waitFor(() => {
      const editBtn = screen.getByText('Edit')
      expect(editBtn).toBeInTheDocument()
      expect(editBtn.closest('button')).not.toBeDisabled()
    })
  })

  it('renders scenario and persona info', async () => {
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Discovery Call')).toBeInTheDocument()
    })
    expect(screen.getByText('Sales Coach')).toBeInTheDocument()
  })

  it('renders tags', async () => {
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('sales')).toBeInTheDocument()
    })
    expect(screen.getByText('discovery')).toBeInTheDocument()
  })

  it('shows "No tags" when tags array is empty', async () => {
    mockGetById.mockResolvedValue({ ...mockSession, tags: [] })
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('No tags for this session.')).toBeInTheDocument()
    })
  })

  it('renders AI model settings', async () => {
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('openai')).toBeInTheDocument()
    })
    expect(screen.getByText('gpt-4o')).toBeInTheDocument()
  })

  it('renders session summary description', async () => {
    mockGetById.mockResolvedValue({
      ...mockSession,
      sessionConfig: { description: 'A custom description' },
    })
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('A custom description')).toBeInTheDocument()
    })
  })

  it('shows Go Back button on error state', async () => {
    mockGetById.mockRejectedValue(new Error('Failed'))
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Go Back')).toBeInTheDocument()
    })

    const user = userEvent.setup()
    await user.click(screen.getByText('Go Back'))
    expect(mockBack).toHaveBeenCalled()
  })

  it('renders fallback session name when name is empty', async () => {
    mockGetById.mockResolvedValue({ ...mockSession, name: null })
    renderPage()

    await waitFor(() => {
      expect(screen.getByText(/Session sess-1/)).toBeInTheDocument()
    })
  })

  it('uses phone retake URL for ended phone sessions', async () => {
    mockGetById.mockResolvedValue({ ...mockSession, type: 'phone', status: 'ended' })
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Launch')).toBeInTheDocument()
    })

    const user = userEvent.setup()
    await user.click(screen.getByText('Launch'))
    expect(mockPush).toHaveBeenCalledWith('/session/sess-1?entry=retake')
  })
})
