/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MantineProvider } from '@mantine/core'
import { StyleStep } from '../StyleStep'

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

const defaultProps = () => ({
  tone: 'Formal',
  setTone: jest.fn(),
  speechRate: 'Conversational',
  setSpeechRate: jest.fn(),
  responseLength: 'Balanced',
  setResponseLength: jest.fn(),
  patienceLevel: 'Medium',
  setPatienceLevel: jest.fn(),
  initiativeLevel: 'Balanced',
  setInitiativeLevel: jest.fn(),
  difficulty: 5,
  setDifficulty: jest.fn(),
  multiTurnEnabled: true,
  setMultiTurnEnabled: jest.fn(),
})

beforeEach(() => {
  jest.clearAllMocks()
})

describe('StyleStep', () => {
  it('renders the header with title', () => {
    render(<StyleStep {...defaultProps()} />, { wrapper: Wrapper })
    expect(screen.getByText('Session Configuration')).toBeInTheDocument()
  })

  it('renders all tone options', () => {
    render(<StyleStep {...defaultProps()} />, { wrapper: Wrapper })
    expect(screen.getByText('Formal')).toBeInTheDocument()
    expect(screen.getByText('Professional')).toBeInTheDocument()
    expect(screen.getByText('Friendly')).toBeInTheDocument()
    expect(screen.getByText('Casual')).toBeInTheDocument()
    expect(screen.getByText('Rude Karen')).toBeInTheDocument()
  })

  it('calls setTone when clicking a tone option', async () => {
    const user = userEvent.setup()
    const props = defaultProps()
    render(<StyleStep {...props} />, { wrapper: Wrapper })
    await user.click(screen.getByText('Friendly'))
    expect(props.setTone).toHaveBeenCalledWith('Friendly')
  })

  it('renders all speech pace options', () => {
    render(<StyleStep {...defaultProps()} />, { wrapper: Wrapper })
    expect(screen.getByText('Measured')).toBeInTheDocument()
    expect(screen.getByText('Conversational')).toBeInTheDocument()
    expect(screen.getByText('Fast')).toBeInTheDocument()
  })

  it('calls setSpeechRate when clicking a pace option', async () => {
    const user = userEvent.setup()
    const props = defaultProps()
    render(<StyleStep {...props} />, { wrapper: Wrapper })
    await user.click(screen.getByText('Fast'))
    expect(props.setSpeechRate).toHaveBeenCalledWith('Fast')
  })

  it('renders all response length options', () => {
    render(<StyleStep {...defaultProps()} />, { wrapper: Wrapper })
    expect(screen.getByText('Concise')).toBeInTheDocument()
    expect(screen.getAllByText('Balanced').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Detailed')).toBeInTheDocument()
  })

  it('calls setResponseLength when clicking a length option', async () => {
    const user = userEvent.setup()
    const props = defaultProps()
    render(<StyleStep {...props} />, { wrapper: Wrapper })
    await user.click(screen.getByText('Detailed'))
    expect(props.setResponseLength).toHaveBeenCalledWith('Detailed')
  })

  it('renders all patience options', () => {
    render(<StyleStep {...defaultProps()} />, { wrapper: Wrapper })
    expect(screen.getByText('Low patience')).toBeInTheDocument()
    expect(screen.getByText('Balanced patience')).toBeInTheDocument()
    expect(screen.getByText('High patience')).toBeInTheDocument()
  })

  it('calls setPatienceLevel when clicking a patience option', async () => {
    const user = userEvent.setup()
    const props = defaultProps()
    render(<StyleStep {...props} />, { wrapper: Wrapper })
    await user.click(screen.getByText('Low patience'))
    expect(props.setPatienceLevel).toHaveBeenCalledWith('Low')
  })

  it('renders all initiative options', () => {
    render(<StyleStep {...defaultProps()} />, { wrapper: Wrapper })
    expect(screen.getByText('Reactive')).toBeInTheDocument()
    expect(screen.getAllByText('Balanced').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Proactive')).toBeInTheDocument()
  })

  it('calls setInitiativeLevel when clicking an initiative option', async () => {
    const user = userEvent.setup()
    const props = defaultProps()
    render(<StyleStep {...props} />, { wrapper: Wrapper })
    await user.click(screen.getByText('Proactive'))
    expect(props.setInitiativeLevel).toHaveBeenCalledWith('Proactive')
  })

  it('renders all difficulty options', () => {
    render(<StyleStep {...defaultProps()} />, { wrapper: Wrapper })
    expect(screen.getByText('Warm-up')).toBeInTheDocument()
    expect(screen.getByText('Focused')).toBeInTheDocument()
    expect(screen.getByText('Challenging')).toBeInTheDocument()
    expect(screen.getByText('Elite')).toBeInTheDocument()
  })

  it('calls setDifficulty when clicking a difficulty option', async () => {
    const user = userEvent.setup()
    const props = defaultProps()
    render(<StyleStep {...props} />, { wrapper: Wrapper })
    await user.click(screen.getByText('Challenging'))
    expect(props.setDifficulty).toHaveBeenCalledWith(7)
  })

  it('shows difficulty range labels', () => {
    render(<StyleStep {...defaultProps()} />, { wrapper: Wrapper })
    expect(screen.getByText('Range 1-3')).toBeInTheDocument()
    expect(screen.getByText('Range 4-6')).toBeInTheDocument()
    expect(screen.getByText('Range 7-8')).toBeInTheDocument()
    expect(screen.getByText('Range 9-10')).toBeInTheDocument()
  })

  it('renders multi-turn mode options', () => {
    render(<StyleStep {...defaultProps()} />, { wrapper: Wrapper })
    expect(screen.getByText('Enabled')).toBeInTheDocument()
    expect(screen.getByText('Single turn')).toBeInTheDocument()
  })

  it('calls setMultiTurnEnabled when toggling multi-turn', async () => {
    const user = userEvent.setup()
    const props = defaultProps()
    render(<StyleStep {...props} />, { wrapper: Wrapper })
    await user.click(screen.getByText('Single turn'))
    expect(props.setMultiTurnEnabled).toHaveBeenCalledWith(false)
  })

  it('renders descriptions for tone options', () => {
    render(<StyleStep {...defaultProps()} />, { wrapper: Wrapper })
    expect(screen.getByText('Structured, objective, and direct.')).toBeInTheDocument()
    expect(screen.getByText('Warm, supportive, and calm.')).toBeInTheDocument()
  })

  it('renders descriptions for difficulty options', () => {
    render(<StyleStep {...defaultProps()} />, { wrapper: Wrapper })
    expect(screen.getByText('Gentle guidance and easy prompts.')).toBeInTheDocument()
    expect(screen.getByText('High stakes, no hints.')).toBeInTheDocument()
  })

  it('shows accent note about persona', () => {
    render(<StyleStep {...defaultProps()} />, { wrapper: Wrapper })
    expect(
      screen.getByText('Accent and voice are inherited from the persona you selected.')
    ).toBeInTheDocument()
  })
})
