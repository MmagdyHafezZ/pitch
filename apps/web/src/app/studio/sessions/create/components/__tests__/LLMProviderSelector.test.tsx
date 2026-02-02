/**
 * @jest-environment jsdom
 */
import { render, screen } from '@/__tests__/utils/test-utils'
import userEvent from '@testing-library/user-event'
import { LLMProviderSelector } from '../LLMProviderSelector'
import type { LLMProviderInfo } from '@/features/sessions/types/sessions.types'

const mockProviders: LLMProviderInfo[] = [
  {
    name: 'openai',
    enabled: true,
    models: ['gpt-4o', 'gpt-4o-mini'],
    modelDetails: [
      {
        name: 'gpt-4o',
        pricing: {
          inputTokensPerMillion: 5.0,
          outputTokensPerMillion: 15.0,
        },
        maxTokens: 128000,
        maxOutputTokens: 4096,
        supportsStreaming: true,
        supportsTools: true,
        supportsVision: true,
        supportsAudio: false,
        supportedModalities: ['text', 'image'],
      },
    ],
  },
  {
    name: 'watsonx',
    enabled: true,
    models: ['granite-13b'],
    modelDetails: [
      {
        name: 'granite-13b',
        pricing: {
          inputTokensPerMillion: 0,
          outputTokensPerMillion: 0,
        },
        maxTokens: 8192,
        maxOutputTokens: 2048,
        supportsStreaming: false,
        supportsTools: false,
        supportsVision: false,
        supportsAudio: false,
        supportedModalities: ['text'],
      },
    ],
  },
]

describe('LLMProviderSelector', () => {
  it('renders provider cards with model counts', () => {
    const mockOnChange = jest.fn()

    render(
      <LLMProviderSelector
        providers={mockProviders}
        selectedProvider={null}
        onProviderChange={mockOnChange}
      />
    )

    expect(screen.getByText(/openai/i)).toBeInTheDocument()
    expect(screen.getByText(/watsonx/i)).toBeInTheDocument()
    expect(screen.getByText(/2 models/i)).toBeInTheDocument()
    expect(screen.getByText(/1 model/i)).toBeInTheDocument()
  })

  it('calls onProviderChange when provider is clicked', async () => {
    const mockOnChange = jest.fn()
    const user = userEvent.setup()

    render(
      <LLMProviderSelector
        providers={mockProviders}
        selectedProvider={null}
        onProviderChange={mockOnChange}
      />
    )

    const openaiCard = screen.getByText(/openai/i).closest('.mantine-Card-root')
    expect(openaiCard).toBeTruthy()
    if (openaiCard) {
      await user.click(openaiCard)
    }

    expect(mockOnChange).toHaveBeenCalledWith('openai')
  })

  it('shows no providers message when list is empty', () => {
    const mockOnChange = jest.fn()

    render(
      <LLMProviderSelector providers={[]} selectedProvider={null} onProviderChange={mockOnChange} />
    )

    expect(screen.getByText(/no.*llm providers available/i)).toBeInTheDocument()
  })

  it('highlights selected provider', () => {
    const mockOnChange = jest.fn()

    const { container } = render(
      <LLMProviderSelector
        providers={mockProviders}
        selectedProvider="openai"
        onProviderChange={mockOnChange}
      />
    )

    // Check if the selected provider card has the blue border
    const openaiCard = screen.getByText(/openai/i).closest('.mantine-Card-root')
    expect(openaiCard).toHaveStyle({
      border: '2px solid var(--mantine-color-dark-6)',
    })
  })
})
