/**
 * @jest-environment jsdom
 */

import { createRef } from 'react'
import { render, screen } from '@/__tests__/utils/test-utils'
import { PersonaStep } from '../PersonaStep'

describe('PersonaStep', () => {
  it('shows the fixed Pablo presenter card for video sessions', () => {
    render(
      <PersonaStep
        sessionType="video"
        personasLoading={false}
        personas={[]}
        filteredPersonas={[]}
        personaSearch=""
        setPersonaSearch={() => undefined}
        scrollPersona={() => undefined}
        personaScrollRef={createRef<HTMLDivElement>()}
        selectedPersona={null}
        setSelectedPersona={() => undefined}
        errors={{}}
        selectedPersonaData={null}
        ttsProviders={[]}
        onCreatePersona={async () => {
          throw new Error('not used in video mode')
        }}
      />
    )

    expect(screen.getByRole('heading', { name: /select video presenter/i })).toBeInTheDocument()
    expect(screen.getByText(/video sessions use pablo as the fixed presenter/i)).toBeInTheDocument()
    expect(screen.getByText('Pablo')).toBeInTheDocument()
    expect(
      screen.queryByPlaceholderText(/search personas by name, role, or archetype/i)
    ).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /create persona here/i })).not.toBeInTheDocument()
  })
})
