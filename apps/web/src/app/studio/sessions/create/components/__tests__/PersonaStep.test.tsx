/** @jest-environment jsdom */
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MantineProvider } from '@mantine/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRef } from 'react'
import { PersonaStep } from '../PersonaStep'

jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
  LayoutGroup: ({ children }: any) => <>{children}</>,
}))

jest.mock('@mantine/notifications', () => ({
  notifications: { show: jest.fn() },
}))

jest.mock('@/lib/client', () => ({
  api: {
    personas: {
      getPreviewAudio: jest.fn().mockRejectedValue(new Error('no audio')),
    },
  },
}))

jest.mock('../CreatePersonaModal', () => ({
  CreatePersonaModal: ({ opened }: any) =>
    opened ? <div data-testid="create-persona-modal">Create Modal</div> : null,
}))

jest.mock('../PersonaProfileCard', () => ({
  PersonaProfileCard: ({ persona, onSelect, onInfoToggle, onPreviewAudio }: any) => (
    <div data-testid={`persona-card-${persona.id}`}>
      <span>{persona.name}</span>
      <button onClick={onSelect} data-testid={`select-${persona.id}`}>
        Select
      </button>
      <button onClick={onInfoToggle} data-testid={`info-${persona.id}`}>
        Info
      </button>
      <button onClick={onPreviewAudio} data-testid={`preview-${persona.id}`}>
        Preview
      </button>
    </div>
  ),
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

const makePersona = (id: string, name: string, traitsOverride?: Record<string, any>) => ({
  id,
  name,
  orgId: 'org-1',
  traits: {
    role: 'VP of Sales',
    level: 'Executive',
    personality: 'Direct and challenging.',
    voice: { provider: 'openai', voiceName: 'alloy', language: 'en-US' },
    archetype: 'Buyer',
    rarity: 'Rare',
    signatureTraits: ['Skeptical', 'Data-driven'],
    metrics: { empathy: 40, assertiveness: 80 },
    ...traitsOverride,
  },
})

const defaultProps = () => ({
  personasLoading: false,
  personas: [makePersona('p1', 'Alice'), makePersona('p2', 'Bob'), makePersona('p3', 'Carlos')],
  filteredPersonas: [
    makePersona('p1', 'Alice'),
    makePersona('p2', 'Bob'),
    makePersona('p3', 'Carlos'),
  ],
  personaSearch: '',
  setPersonaSearch: jest.fn(),
  scrollPersona: jest.fn(),
  personaScrollRef: createRef<HTMLDivElement>(),
  selectedPersona: null,
  setSelectedPersona: jest.fn(),
  errors: {} as Record<string, string>,
  selectedPersonaData: null,
  ttsProviders: [],
  onCreatePersona: jest.fn().mockResolvedValue({ id: 'new', name: 'New', orgId: 'org-1' }),
  createDisabledReason: null,
})

beforeEach(() => {
  jest.clearAllMocks()
})

describe('PersonaStep', () => {
  it('shows loading state when personas are loading', () => {
    const props = { ...defaultProps(), personasLoading: true }
    render(<PersonaStep {...props} />, { wrapper: Wrapper })
    expect(screen.getByText('Loading personas...')).toBeInTheDocument()
  })

  it('shows empty state when no personas exist', () => {
    const props = { ...defaultProps(), personas: [], filteredPersonas: [] }
    render(<PersonaStep {...props} />, { wrapper: Wrapper })
    expect(screen.getByText('No personas available')).toBeInTheDocument()
    expect(screen.getByText('No personas found yet. Create one to continue.')).toBeInTheDocument()
    expect(screen.getByText('Create Persona Here')).toBeInTheDocument()
  })

  it('renders persona cards in the carousel', () => {
    render(<PersonaStep {...defaultProps()} />, { wrapper: Wrapper })
    expect(screen.getByTestId('persona-card-p1')).toBeInTheDocument()
    expect(screen.getByTestId('persona-card-p2')).toBeInTheDocument()
    expect(screen.getByTestId('persona-card-p3')).toBeInTheDocument()
  })

  it('renders header with title and description', () => {
    render(<PersonaStep {...defaultProps()} />, { wrapper: Wrapper })
    expect(screen.getByText('Select AI Persona')).toBeInTheDocument()
    expect(screen.getByText('Match the persona to your training scenario.')).toBeInTheDocument()
  })

  it('renders the search input', () => {
    render(<PersonaStep {...defaultProps()} />, { wrapper: Wrapper })
    expect(
      screen.getByPlaceholderText('Search personas by name, role, or archetype')
    ).toBeInTheDocument()
  })

  it('calls setPersonaSearch when typing in search', async () => {
    const user = userEvent.setup()
    const props = defaultProps()
    render(<PersonaStep {...props} />, { wrapper: Wrapper })

    const input = screen.getByPlaceholderText('Search personas by name, role, or archetype')
    await user.type(input, 'a')
    expect(props.setPersonaSearch).toHaveBeenCalled()
  })

  it('calls setSelectedPersona when a persona card is selected', async () => {
    const user = userEvent.setup()
    const props = defaultProps()
    render(<PersonaStep {...props} />, { wrapper: Wrapper })

    await user.click(screen.getByTestId('select-p2'))
    expect(props.setSelectedPersona).toHaveBeenCalledWith('p2')
  })

  it('excludes selected persona from the carousel list', () => {
    const props = {
      ...defaultProps(),
      selectedPersona: 'p1',
      selectedPersonaData: makePersona('p1', 'Alice'),
    }
    render(<PersonaStep {...props} />, { wrapper: Wrapper })

    expect(screen.queryByTestId('persona-card-p1')).not.toBeInTheDocument()
    expect(screen.getByTestId('persona-card-p2')).toBeInTheDocument()
    expect(screen.getByTestId('persona-card-p3')).toBeInTheDocument()
  })

  it('shows the selected persona preview panel', () => {
    const props = {
      ...defaultProps(),
      selectedPersona: 'p1',
      selectedPersonaData: makePersona('p1', 'Alice'),
    }
    render(<PersonaStep {...props} />, { wrapper: Wrapper })

    expect(screen.getByText('Persona selected')).toBeInTheDocument()
  })

  it('shows empty dropzone when no persona is selected', () => {
    render(<PersonaStep {...defaultProps()} />, { wrapper: Wrapper })
    expect(screen.getByText('Choose your character')).toBeInTheDocument()
    expect(
      screen.getByText('Select a persona to dock their full dossier here.')
    ).toBeInTheDocument()
  })

  it('calls scrollPersona when scroll arrows exist', async () => {
    const user = userEvent.setup()
    const props = defaultProps()
    render(<PersonaStep {...props} />, { wrapper: Wrapper })

    const buttons = screen.getAllByRole('button')
    const leftArrow = buttons.find((b) => b.querySelector('.tabler-icon-chevron-left'))
    const rightArrow = buttons.find((b) => b.querySelector('.tabler-icon-chevron-right'))

    if (leftArrow) {
      await user.click(leftArrow)
      expect(props.scrollPersona).toHaveBeenCalledWith('left')
    }
    if (rightArrow) {
      await user.click(rightArrow)
      expect(props.scrollPersona).toHaveBeenCalledWith('right')
    }
  })

  it('shows "No personas match" message when filtered list is empty but personas exist', () => {
    const props = {
      ...defaultProps(),
      filteredPersonas: [],
    }
    render(<PersonaStep {...props} />, { wrapper: Wrapper })
    expect(screen.getByText('No personas match your search.')).toBeInTheDocument()
  })

  it('shows contextual message when filtered list is empty and a persona is already selected', () => {
    const props = {
      ...defaultProps(),
      filteredPersonas: [makePersona('p1', 'Alice')],
      selectedPersona: 'p1',
      selectedPersonaData: makePersona('p1', 'Alice'),
    }
    render(<PersonaStep {...props} />, { wrapper: Wrapper })

    expect(
      screen.getByText(
        'Your selected persona is shown below. Adjust the search or create another persona to compare more options.'
      )
    ).toBeInTheDocument()
  })

  it('opens create persona modal when button is clicked', async () => {
    const user = userEvent.setup()
    render(<PersonaStep {...defaultProps()} />, { wrapper: Wrapper })

    await user.click(screen.getByText('Create Persona Here'))
    expect(screen.getByTestId('create-persona-modal')).toBeInTheDocument()
  })

  it('displays persona error message when present', () => {
    const props = {
      ...defaultProps(),
      errors: { persona: 'Please select a persona' },
    }
    render(<PersonaStep {...props} />, { wrapper: Wrapper })
    expect(screen.getByText('Please select a persona')).toBeInTheDocument()
  })

  it('shows selected persona voice and role details in preview', () => {
    const persona = makePersona('p1', 'Alice')
    const props = {
      ...defaultProps(),
      selectedPersona: 'p1',
      selectedPersonaData: persona,
    }
    render(<PersonaStep {...props} />, { wrapper: Wrapper })

    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Voice Profile')).toBeInTheDocument()
    expect(screen.getByText('Signature Traits')).toBeInTheDocument()
    expect(screen.getByText('Comparison Metrics')).toBeInTheDocument()
  })

  it('shows Play voice button in selected persona preview', () => {
    const persona = makePersona('p1', 'Alice')
    const props = {
      ...defaultProps(),
      selectedPersona: 'p1',
      selectedPersonaData: persona,
    }
    render(<PersonaStep {...props} />, { wrapper: Wrapper })
    expect(screen.getByText('Play voice')).toBeInTheDocument()
  })

  it('deselects persona when clicking the preview panel', async () => {
    const user = userEvent.setup()
    const persona = makePersona('p1', 'Alice')
    const props = {
      ...defaultProps(),
      selectedPersona: 'p1',
      selectedPersonaData: persona,
    }
    render(<PersonaStep {...props} />, { wrapper: Wrapper })

    const voiceProfileHeader = screen.getByText('Voice Profile')
    const previewPanel = voiceProfileHeader.closest('[class]')
    if (previewPanel?.parentElement?.parentElement) {
      await user.click(previewPanel.parentElement.parentElement)
    }

    expect(props.setSelectedPersona).toHaveBeenCalledWith(null)
  })
})
