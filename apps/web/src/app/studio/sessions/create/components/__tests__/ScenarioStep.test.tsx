/** @jest-environment jsdom */
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MantineProvider } from '@mantine/core'
import { ScenarioStep } from '../ScenarioStep'

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

const makeScenario = (id: string, name: string, desc?: string) => ({
  id,
  name,
  description: desc ?? `Description for ${name}`,
  config: {},
})

const defaultProps = () => ({
  scenariosLoading: false,
  scenarios: [makeScenario('s1', 'Sales Pitch'), makeScenario('s2', 'Discovery Call')],
  selectedScenarioId: null as string | null,
  setSelectedScenarioId: jest.fn(),
  scenarioTopic: '',
  setScenarioTopic: jest.fn(),
  scenarioObjective: '',
  setScenarioObjective: jest.fn(),
  scenarioContext: '',
  setScenarioContext: jest.fn(),
  aiRole: '',
  setAiRole: jest.fn(),
  userRole: '',
  setUserRole: jest.fn(),
  durationMinutes: 30,
  setDurationMinutes: jest.fn(),
  scenarioCount: 1,
  setScenarioCount: jest.fn(),
  onGenerate: jest.fn(),
  isGenerating: false,
  errors: {} as Record<string, string>,
})

beforeEach(() => {
  jest.clearAllMocks()
})

describe('ScenarioStep', () => {
  it('renders the header with title', () => {
    render(<ScenarioStep {...defaultProps()} />, { wrapper: Wrapper })
    expect(screen.getByText('Scenario & Topic')).toBeInTheDocument()
  })

  it('renders the topic input', () => {
    render(<ScenarioStep {...defaultProps()} />, { wrapper: Wrapper })
    expect(screen.getByPlaceholderText('Q1 sales onboarding')).toBeInTheDocument()
  })

  it('calls setScenarioTopic on typing', async () => {
    const user = userEvent.setup()
    const props = defaultProps()
    render(<ScenarioStep {...props} />, { wrapper: Wrapper })
    const input = screen.getByPlaceholderText('Q1 sales onboarding')
    await user.type(input, 'A')
    expect(props.setScenarioTopic).toHaveBeenCalled()
  })

  it('renders the objective textarea', () => {
    render(<ScenarioStep {...defaultProps()} />, { wrapper: Wrapper })
    expect(screen.getByPlaceholderText('What should the learner accomplish?')).toBeInTheDocument()
  })

  it('renders the context textarea', () => {
    render(<ScenarioStep {...defaultProps()} />, { wrapper: Wrapper })
    expect(
      screen.getByPlaceholderText('Add any background, constraints, or roleplay detail')
    ).toBeInTheDocument()
  })

  it('renders role inputs', () => {
    render(<ScenarioStep {...defaultProps()} />, { wrapper: Wrapper })
    expect(screen.getByPlaceholderText('Customer / Partner / CTO')).toBeInTheDocument()
    expect(
      screen.getByPlaceholderText('Account executive / Founder / Sales rep')
    ).toBeInTheDocument()
  })

  it('renders duration input', () => {
    render(<ScenarioStep {...defaultProps()} />, { wrapper: Wrapper })
    expect(screen.getByText('Session length (minutes)')).toBeInTheDocument()
  })

  it('shows scenario topic error', () => {
    const props = { ...defaultProps(), errors: { scenarioTopic: 'Topic is needed' } }
    render(<ScenarioStep {...props} />, { wrapper: Wrapper })
    expect(screen.getByText('Topic is needed')).toBeInTheDocument()
  })

  it('shows duration error', () => {
    const props = { ...defaultProps(), errors: { durationMinutes: 'Must be 5-180' } }
    render(<ScenarioStep {...props} />, { wrapper: Wrapper })
    expect(screen.getByText('Must be 5-180')).toBeInTheDocument()
  })

  it('renders scenario library with scenario cards', () => {
    render(<ScenarioStep {...defaultProps()} />, { wrapper: Wrapper })
    expect(screen.getByText('Scenario library')).toBeInTheDocument()
    expect(screen.getByText('Sales Pitch')).toBeInTheDocument()
    expect(screen.getByText('Discovery Call')).toBeInTheDocument()
  })

  it('calls setSelectedScenarioId when clicking a scenario', async () => {
    const user = userEvent.setup()
    const props = defaultProps()
    render(<ScenarioStep {...props} />, { wrapper: Wrapper })
    await user.click(screen.getByText('Sales Pitch'))
    expect(props.setSelectedScenarioId).toHaveBeenCalledWith('s1')
  })

  it('shows selected scenario differently', () => {
    const props = { ...defaultProps(), selectedScenarioId: 's1' }
    render(<ScenarioStep {...props} />, { wrapper: Wrapper })
    expect(screen.getByText('Sales Pitch')).toBeInTheDocument()
    expect(screen.getByText('Description for Sales Pitch')).toBeInTheDocument()
  })

  it('shows loading state for scenarios', () => {
    const props = { ...defaultProps(), scenariosLoading: true, scenarios: [] }
    render(<ScenarioStep {...props} />, { wrapper: Wrapper })
    expect(screen.getByText('Loading scenarios...')).toBeInTheDocument()
    expect(screen.getByText('Loading your scenarios...')).toBeInTheDocument()
  })

  it('shows empty state when no scenarios exist', () => {
    const props = { ...defaultProps(), scenarios: [] }
    render(<ScenarioStep {...props} />, { wrapper: Wrapper })
    expect(screen.getByText('No scenarios available yet.')).toBeInTheDocument()
  })

  it('renders the Generate button', () => {
    render(<ScenarioStep {...defaultProps()} />, { wrapper: Wrapper })
    expect(screen.getByRole('button', { name: /generate/i })).toBeInTheDocument()
  })

  it('disables Generate button when topic is empty', () => {
    render(<ScenarioStep {...defaultProps()} />, { wrapper: Wrapper })
    expect(screen.getByRole('button', { name: /generate/i })).toBeDisabled()
  })

  it('enables Generate button when topic has content', () => {
    const props = { ...defaultProps(), scenarioTopic: 'Sales' }
    render(<ScenarioStep {...props} />, { wrapper: Wrapper })
    expect(screen.getByRole('button', { name: /generate/i })).not.toBeDisabled()
  })

  it('calls onGenerate when Generate button is clicked', async () => {
    const user = userEvent.setup()
    const props = { ...defaultProps(), scenarioTopic: 'Sales' }
    render(<ScenarioStep {...props} />, { wrapper: Wrapper })
    await user.click(screen.getByRole('button', { name: /generate/i }))
    expect(props.onGenerate).toHaveBeenCalled()
  })

  it('shows loading state on Generate button when generating', () => {
    const props = { ...defaultProps(), scenarioTopic: 'Sales', isGenerating: true }
    render(<ScenarioStep {...props} />, { wrapper: Wrapper })
    const btn = screen.getByRole('button', { name: /generate/i })
    expect(btn).toBeInTheDocument()
  })

  it('filters scenarios by search query', async () => {
    const user = userEvent.setup()
    render(<ScenarioStep {...defaultProps()} />, { wrapper: Wrapper })
    const searchInput = screen.getByPlaceholderText('Search for specific scenario')
    await user.type(searchInput, 'Sales')
    await waitFor(() => {
      expect(screen.getByText('Sales Pitch')).toBeInTheDocument()
    })
  })

  it('shows "no match" message for empty filter result', async () => {
    const user = userEvent.setup()
    render(<ScenarioStep {...defaultProps()} />, { wrapper: Wrapper })
    const searchInput = screen.getByPlaceholderText('Search for specific scenario')
    await user.type(searchInput, 'zzzznonexistent')
    await waitFor(() => {
      expect(screen.getByText(/No scenarios match/)).toBeInTheDocument()
    })
  })

  it('shows scenario count text', () => {
    render(<ScenarioStep {...defaultProps()} />, { wrapper: Wrapper })
    expect(screen.getByText('Showing 2 of 2 scenarios')).toBeInTheDocument()
  })

  it('shows "No description provided." for scenarios without descriptions', () => {
    const props = {
      ...defaultProps(),
      scenarios: [{ id: 's1', name: 'No Desc', config: {} }],
    }
    render(<ScenarioStep {...props} />, { wrapper: Wrapper })
    expect(screen.getByText('No description provided.')).toBeInTheDocument()
  })
})
