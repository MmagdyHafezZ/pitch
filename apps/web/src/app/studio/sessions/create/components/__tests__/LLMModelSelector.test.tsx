/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MantineProvider } from '@mantine/core'
import { LLMModelSelector } from '../LLMModelSelector'

jest.mock('../ModelComparisonRow', () => ({
  ModelComparisonRow: ({ model }: any) => (
    <div data-testid="model-comparison-row">{model.name}</div>
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

const makeProvider = (models: any[]) => ({
  name: 'openai',
  enabled: true,
  models: models.map((m) => m.name),
  modelDetails: models,
})

beforeEach(() => {
  jest.clearAllMocks()
})

describe('LLMModelSelector', () => {
  it('returns null when provider is undefined', () => {
    render(
      <LLMModelSelector
        provider={undefined}
        sessionType="text"
        selectedModel={null}
        onModelChange={jest.fn()}
      />,
      { wrapper: Wrapper }
    )
    expect(screen.queryByText('Model')).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })

  it('shows alert when no compatible models for session type', () => {
    const provider = makeProvider([makeModel('gpt-4o', { supportsStreaming: false })])
    render(
      <LLMModelSelector
        provider={provider as any}
        sessionType="voice"
        selectedModel={null}
        onModelChange={jest.fn()}
      />,
      { wrapper: Wrapper }
    )
    expect(
      screen.getByText(/No compatible models available for voice sessions/)
    ).toBeInTheDocument()
  })

  it('renders the select input with models', () => {
    const provider = makeProvider([makeModel('gpt-4o'), makeModel('gpt-4o-mini')])
    render(
      <LLMModelSelector
        provider={provider as any}
        sessionType="text"
        selectedModel={null}
        onModelChange={jest.fn()}
      />,
      { wrapper: Wrapper }
    )
    expect(screen.getByText('Model')).toBeInTheDocument()
  })

  it('shows all text-based models for text session type', () => {
    const provider = makeProvider([
      makeModel('gpt-4o'),
      makeModel('gpt-4o-mini'),
      makeModel('streaming-only', { supportsStreaming: false }),
    ])
    render(
      <LLMModelSelector
        provider={provider as any}
        sessionType="text"
        selectedModel={null}
        onModelChange={jest.fn()}
      />,
      { wrapper: Wrapper }
    )
    expect(screen.getByText('Model')).toBeInTheDocument()
  })

  it('filters to streaming models for voice session type', () => {
    const provider = makeProvider([
      makeModel('gpt-4o', { supportsStreaming: true }),
      makeModel('non-streaming', { supportsStreaming: false }),
    ])
    render(
      <LLMModelSelector
        provider={provider as any}
        sessionType="voice"
        selectedModel="gpt-4o"
        onModelChange={jest.fn()}
      />,
      { wrapper: Wrapper }
    )
    expect(screen.getByTestId('model-comparison-row')).toBeInTheDocument()
  })

  it('filters to streaming models for video session type', () => {
    const provider = makeProvider([
      makeModel('streaming-model', { supportsStreaming: true }),
      makeModel('non-streaming-model', { supportsStreaming: false }),
    ])
    render(
      <LLMModelSelector
        provider={provider as any}
        sessionType="video"
        selectedModel="streaming-model"
        onModelChange={jest.fn()}
      />,
      { wrapper: Wrapper }
    )
    expect(screen.getByTestId('model-comparison-row')).toBeInTheDocument()
  })

  it('filters to streaming models for phone session type', () => {
    const provider = makeProvider([makeModel('streaming-phone', { supportsStreaming: true })])
    render(
      <LLMModelSelector
        provider={provider as any}
        sessionType="phone"
        selectedModel="streaming-phone"
        onModelChange={jest.fn()}
      />,
      { wrapper: Wrapper }
    )
    expect(screen.getByTestId('model-comparison-row')).toBeInTheDocument()
  })

  it('renders ModelComparisonRow when a model is selected', () => {
    const provider = makeProvider([makeModel('gpt-4o')])
    render(
      <LLMModelSelector
        provider={provider as any}
        sessionType="text"
        selectedModel="gpt-4o"
        onModelChange={jest.fn()}
      />,
      { wrapper: Wrapper }
    )
    expect(screen.getByTestId('model-comparison-row')).toBeInTheDocument()
  })

  it('does not render ModelComparisonRow when no model is selected', () => {
    const provider = makeProvider([makeModel('gpt-4o')])
    render(
      <LLMModelSelector
        provider={provider as any}
        sessionType="text"
        selectedModel={null}
        onModelChange={jest.fn()}
      />,
      { wrapper: Wrapper }
    )
    expect(screen.queryByTestId('model-comparison-row')).not.toBeInTheDocument()
  })

  it('shows streaming warning for non-streaming model in voice session', () => {
    const provider = makeProvider([
      makeModel('gpt-4o', { supportsStreaming: true }),
      makeModel('slow-model', { supportsStreaming: false }),
    ])
    render(
      <LLMModelSelector
        provider={provider as any}
        sessionType="text"
        selectedModel="slow-model"
        onModelChange={jest.fn()}
      />,
      { wrapper: Wrapper }
    )
    expect(screen.queryByText(/Warning: Selected model doesn/)).not.toBeInTheDocument()
  })
})
