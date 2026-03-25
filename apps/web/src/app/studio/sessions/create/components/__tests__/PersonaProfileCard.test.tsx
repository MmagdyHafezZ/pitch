/**
 * @jest-environment jsdom
 */
import { render, screen } from '@/__tests__/utils/test-utils'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { PersonaProfileCard } from '../PersonaProfileCard'

const persona = {
  id: 'persona_1',
  name: 'Arden Vale',
  orgId: 'org_1',
  traits: {
    role: 'Chief Revenue Officer',
    level: 'Executive',
    personality: 'Direct, skeptical, and always pressing for commercial clarity.',
    background: 'Runs revenue operations and challenges weak implementation plans.',
    tone: 'Concise',
    patience: 'Low',
    communicationStyle: 'High-pressure',
    voice: {
      provider: 'openai',
      voiceName: 'alloy',
      language: 'en-US',
    },
  },
}

function TestCard(props: { onSelect: jest.Mock }) {
  const [infoOpen, setInfoOpen] = useState(false)

  return (
    <PersonaProfileCard
      persona={persona}
      avatarUrl={undefined}
      archetype="Executive"
      rarity="Rare"
      rarityColor="blue"
      voiceProfile="OpenAI / alloy"
      metrics={[
        { label: 'Empathy', value: 34 },
        { label: 'Assertiveness', value: 82 },
      ]}
      signatureTraits={['Time-boxed', 'Commercially driven']}
      isPreviewLoading={false}
      isPreviewPlaying={false}
      infoOpen={infoOpen}
      onInfoToggle={() => setInfoOpen((current) => !current)}
      onPreviewAudio={() => undefined}
      onSelect={props.onSelect}
    />
  )
}

describe('PersonaProfileCard', () => {
  it('toggles the details overlay and preserves card selection', async () => {
    const user = userEvent.setup()
    const onSelect = jest.fn()

    render(<TestCard onSelect={onSelect} />)

    expect(screen.getByText('Persona Intel')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /show persona details for arden vale/i }))

    expect(screen.getByText('Persona Intel')).toBeInTheDocument()
    expect(screen.getByText('Performance Bias')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /select persona arden vale/i }))

    expect(onSelect).toHaveBeenCalledTimes(1)
  })
})
