/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MantineProvider } from '@mantine/core'
import { createRef } from 'react'
import { AIBrainStep } from '../AIBrainStep'

jest.mock('../LLMProviderSelector', () => ({
  LLMProviderSelector: ({ providers, selectedProvider, onProviderChange }: any) => (
    <div data-testid="llm-provider-selector">
      {providers.map((p: any) => (
        <button
          key={p.name}
          data-testid={`provider-${p.name}`}
          onClick={() => onProviderChange(p.name)}
        >
          {p.name}
        </button>
      ))}
      {selectedProvider && <span data-testid="selected-provider">{selectedProvider}</span>}
    </div>
  ),
}))

jest.mock('../CostEstimator', () => ({
  CostEstimator: ({ model }: any) => (
    <div data-testid="cost-estimator">{model ? model.name : 'no model'}</div>
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

const makeProvider = (name: string, models: any[] = []) => ({
  name,
  enabled: true,
  models: models.map((m) => m.name),
  modelDetails: models,
})

const makeModel = (name: string, overrides: Record<string, any> = {}) => ({
  name,
  pricing: { inputTokensPerMillion: 5, outputTokensPerMillion: 15 },
  maxTokens: 128000,
  maxOutputTokens: 4096,
  supportsStreaming: true,
  supportsTools: true,
  supportsVision: false,
  supportsAudio: false,
  supportedModalities: ['text'] as string[],
  ...overrides,
})

const defaultProps = () => ({
  llmProvidersLoading: false,
  llmProvidersData: {
    providers: [
      makeProvider('openai', [makeModel('gpt-4o'), makeModel('gpt-4o-mini', { maxTokens: 16000 })]),
    ],
  },
  llmProvider: 'openai',
  setLlmProvider: jest.fn(),
  setLlmModel: jest.fn(),
  setModelSearch: jest.fn(),
  errors: {} as Record<string, string>,
  modelSearch: '',
  llmModel: 'gpt-4o',
  scrollModels: jest.fn(),
  modelScrollRef: createRef<HTMLDivElement>(),
})

beforeEach(() => {
  jest.clearAllMocks()
})

describe('AIBrainStep', () => {
  it('renders the header with title', () => {
    render(<AIBrainStep {...defaultProps()} />, { wrapper: Wrapper })
    expect(screen.getByText('AI Brain Control Deck')).toBeInTheDocument()
  })

  it('renders Smart Routing and Safe Defaults badges', () => {
    render(<AIBrainStep {...defaultProps()} />, { wrapper: Wrapper })
    expect(screen.getByText('Smart Routing')).toBeInTheDocument()
    expect(screen.getByText('Safe Defaults')).toBeInTheDocument()
  })

  it('shows loading state when providers are loading', () => {
    render(<AIBrainStep {...defaultProps()} llmProvidersLoading={true} />, { wrapper: Wrapper })
    expect(screen.getByText('Loading AI models...')).toBeInTheDocument()
  })

  it('shows alert when no providers are available', () => {
    render(<AIBrainStep {...defaultProps()} llmProvidersData={{ providers: [] }} />, {
      wrapper: Wrapper,
    })
    expect(screen.getByText('No providers available')).toBeInTheDocument()
  })

  it('shows alert when llmProvidersData is undefined', () => {
    render(<AIBrainStep {...defaultProps()} llmProvidersData={undefined} />, { wrapper: Wrapper })
    expect(screen.getByText('No providers available')).toBeInTheDocument()
  })

  it('renders the LLM provider selector', () => {
    render(<AIBrainStep {...defaultProps()} />, { wrapper: Wrapper })
    expect(screen.getByTestId('llm-provider-selector')).toBeInTheDocument()
  })

  it('renders model cards when provider is selected', () => {
    render(<AIBrainStep {...defaultProps()} />, { wrapper: Wrapper })
    expect(screen.getAllByText('gpt-4o').length).toBeGreaterThan(0)
    expect(screen.getAllByText('gpt-4o-mini').length).toBeGreaterThan(0)
  })

  it('shows "Selected" badge on the active model', () => {
    render(<AIBrainStep {...defaultProps()} />, { wrapper: Wrapper })
    expect(screen.getByText('Selected')).toBeInTheDocument()
  })

  it('calls setLlmModel when a model card is clicked', async () => {
    const user = userEvent.setup()
    const props = defaultProps()
    render(<AIBrainStep {...props} />, { wrapper: Wrapper })
    await user.click(screen.getByText('gpt-4o-mini'))
    expect(props.setLlmModel).toHaveBeenCalledWith('gpt-4o-mini')
  })

  it('renders model token info', () => {
    render(<AIBrainStep {...defaultProps()} />, { wrapper: Wrapper })
    expect(screen.getByText(/Max tokens: 128000/)).toBeInTheDocument()
  })

  it('renders model pricing info', () => {
    render(<AIBrainStep {...defaultProps()} />, { wrapper: Wrapper })
    expect(screen.getAllByText(/Input \$5\/M tok/).length).toBeGreaterThan(0)
  })

  it('renders streaming/tools/vision/audio capability info', () => {
    render(<AIBrainStep {...defaultProps()} />, { wrapper: Wrapper })
    expect(screen.getAllByText(/Streaming enabled/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Tools supported/).length).toBeGreaterThan(0)
  })

  it('filters models by search term', () => {
    const props = { ...defaultProps(), modelSearch: 'mini' }
    render(<AIBrainStep {...props} />, { wrapper: Wrapper })
    expect(screen.getByText('gpt-4o-mini')).toBeInTheDocument()
    expect(screen.queryByText('Max tokens: 128000')).not.toBeInTheDocument()
  })

  it('shows "no matching models" when search yields no results', () => {
    const props = { ...defaultProps(), modelSearch: 'nonexistent' }
    render(<AIBrainStep {...props} />, { wrapper: Wrapper })
    expect(
      screen.getByText('No matching text-generation models for this provider.')
    ).toBeInTheDocument()
  })

  it('shows prompt to choose a provider when no provider is selected', () => {
    const props = { ...defaultProps(), llmProvider: null }
    render(<AIBrainStep {...props} />, { wrapper: Wrapper })
    expect(screen.getByText('Choose a provider to browse models.')).toBeInTheDocument()
  })

  it('shows cost estimator prompt when no model is selected', () => {
    const props = { ...defaultProps(), llmModel: null }
    render(<AIBrainStep {...props} />, { wrapper: Wrapper })
    expect(screen.getByText('Select a provider and model to see pricing.')).toBeInTheDocument()
  })

  it('renders CostEstimator when provider and model are selected', () => {
    render(<AIBrainStep {...defaultProps()} />, { wrapper: Wrapper })
    expect(screen.getByTestId('cost-estimator')).toBeInTheDocument()
  })

  it('displays LLM provider error', () => {
    const props = { ...defaultProps(), errors: { llmProvider: 'LLM provider is required' } }
    render(<AIBrainStep {...props} />, { wrapper: Wrapper })
    expect(screen.getByText('LLM provider is required')).toBeInTheDocument()
  })

  it('displays LLM model error', () => {
    const props = { ...defaultProps(), errors: { llmModel: 'LLM model is required' } }
    render(<AIBrainStep {...props} />, { wrapper: Wrapper })
    expect(screen.getByText('LLM model is required')).toBeInTheDocument()
  })

  it('calls scrollModels when arrow buttons are clicked', async () => {
    const user = userEvent.setup()
    const props = defaultProps()
    render(<AIBrainStep {...props} />, { wrapper: Wrapper })
    const buttons = screen.getAllByRole('button')
    const leftArrow = buttons.find((b) => b.querySelector('.tabler-icon-chevron-left'))
    const rightArrow = buttons.find((b) => b.querySelector('.tabler-icon-chevron-right'))
    if (leftArrow) {
      await user.click(leftArrow)
      expect(props.scrollModels).toHaveBeenCalledWith('left')
    }
    if (rightArrow) {
      await user.click(rightArrow)
      expect(props.scrollModels).toHaveBeenCalledWith('right')
    }
  })

  it('updates model search on typing', async () => {
    const user = userEvent.setup()
    const props = defaultProps()
    render(<AIBrainStep {...props} />, { wrapper: Wrapper })
    const searchInput = screen.getByPlaceholderText('Search text-generation models')
    await user.type(searchInput, 'gpt')
    expect(props.setModelSearch).toHaveBeenCalled()
  })

  it('shows hidden model count when non-text models exist', () => {
    const provider = makeProvider('openai', [
      makeModel('gpt-4o'),
      { ...makeModel('whisper-1'), supportedModalities: ['audio'] },
    ])
    const props = {
      ...defaultProps(),
      llmProvidersData: { providers: [provider] },
    }
    render(<AIBrainStep {...props} />, { wrapper: Wrapper })
    expect(
      screen.getByText(/audio, TTS, realtime, or transcription models are hidden/)
    ).toBeInTheDocument()
  })

  it('calls onProviderChange and resets model on provider switch', async () => {
    const user = userEvent.setup()
    const props = {
      ...defaultProps(),
      llmProvidersData: {
        providers: [
          makeProvider('openai', [makeModel('gpt-4o')]),
          makeProvider('anthropic', [makeModel('claude-3')]),
        ],
      },
    }
    render(<AIBrainStep {...props} />, { wrapper: Wrapper })
    await user.click(screen.getByTestId('provider-anthropic'))
    expect(props.setLlmProvider).toHaveBeenCalledWith('anthropic')
    expect(props.setLlmModel).toHaveBeenCalledWith(null)
  })

  it('renders modality badges on model cards', () => {
    const props = {
      ...defaultProps(),
      llmProvidersData: {
        providers: [
          makeProvider('openai', [makeModel('gpt-4o', { supportedModalities: ['text', 'image'] })]),
        ],
      },
    }
    render(<AIBrainStep {...props} />, { wrapper: Wrapper })
    expect(screen.getByText('text')).toBeInTheDocument()
    expect(screen.getByText('image')).toBeInTheDocument()
  })
})
