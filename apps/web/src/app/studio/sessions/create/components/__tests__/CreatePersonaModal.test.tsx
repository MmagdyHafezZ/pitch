/**
 * @jest-environment jsdom
 */
import { render, screen, waitFor } from '@/__tests__/utils/test-utils'
import userEvent from '@testing-library/user-event'
import { CreatePersonaModal } from '../CreatePersonaModal'

const ttsProviders = [
  {
    name: 'openai',
    description: 'OpenAI',
    voices: ['alloy', 'sage'],
    models: ['gpt-4o-mini-tts', 'tts-1-hd'],
  },
]

describe('CreatePersonaModal', () => {
  it('submits a controlled persona payload with the selected TTS model', async () => {
    const user = userEvent.setup()
    const onClose = jest.fn()
    const onCreatePersona = jest.fn().mockResolvedValue({
      id: 'persona_1',
      name: 'Arden - Skeptical CTO',
      orgId: 'org_123',
      traits: null,
    })

    render(
      <CreatePersonaModal
        opened
        onClose={onClose}
        onCreatePersona={onCreatePersona}
        ttsProviders={ttsProviders}
      />
    )

    await user.type(screen.getByPlaceholderText('Arden - Skeptical CTO'), 'Arden - Skeptical CTO')
    await user.type(
      screen.getByPlaceholderText('Chief Technology Officer'),
      'Chief Technology Officer'
    )
    await user.type(
      screen.getByLabelText(/personality/i),
      'Detail-heavy, skeptical, and focused on architecture integrity.'
    )
    await user.type(
      screen.getByLabelText(/background/i),
      'Owns platform decisions and expects implementation depth before agreeing.'
    )

    await user.click(screen.getByRole('button', { name: /create persona$/i }))

    await waitFor(() => {
      expect(onCreatePersona).toHaveBeenCalledWith({
        name: 'Arden - Skeptical CTO',
        traits: expect.objectContaining({
          role: 'Chief Technology Officer',
          voiceProfile: 'OpenAI / alloy',
          voice: {
            provider: 'openai',
            voiceName: 'alloy',
            language: 'en-US',
            model: 'gpt-4o-mini-tts',
          },
        }),
      })
    })

    expect(onClose).toHaveBeenCalled()
  })

  it('surfaces backend errors instead of failing silently', async () => {
    const user = userEvent.setup()
    const onCreatePersona = jest.fn().mockRejectedValue(new Error('Persona name already exists'))

    render(
      <CreatePersonaModal
        opened
        onClose={jest.fn()}
        onCreatePersona={onCreatePersona}
        ttsProviders={ttsProviders}
      />
    )

    await user.type(screen.getByPlaceholderText('Arden - Skeptical CTO'), 'Arden - Skeptical CTO')
    await user.type(
      screen.getByPlaceholderText('Chief Technology Officer'),
      'Chief Technology Officer'
    )
    await user.type(
      screen.getByLabelText(/personality/i),
      'Detail-heavy, skeptical, and focused on architecture integrity.'
    )
    await user.type(
      screen.getByLabelText(/background/i),
      'Owns platform decisions and expects implementation depth before agreeing.'
    )

    await user.click(screen.getByRole('button', { name: /create persona$/i }))

    expect(await screen.findByText('Persona name already exists')).toBeInTheDocument()
  })
})
