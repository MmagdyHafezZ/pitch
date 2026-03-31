/**
 * @jest-environment jsdom
 */

import type { ComponentProps } from 'react'
import { createRef } from 'react'
import { fireEvent, render, screen } from '@/__tests__/utils/test-utils'
import { PersonaStep } from '../PersonaStep'

describe('PersonaStep', () => {
  const renderVideoPersonaStep = (overrides: Partial<ComponentProps<typeof PersonaStep>> = {}) =>
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
        ttsProvider="elevenlabs"
        setTtsProvider={() => undefined}
        ttsVoice="George - Warm, Captivating Storyteller"
        setTtsVoice={() => undefined}
        ttsModel={null}
        ttsProviders={[]}
        onCreatePersona={async () => {
          throw new Error('not used in video mode')
        }}
        {...overrides}
      />
    )

  it('shows Pablo as the only persona option for video sessions using the standard layout', () => {
    renderVideoPersonaStep()

    expect(screen.getByRole('heading', { name: /select ai persona/i })).toBeInTheDocument()
    expect(screen.getByText(/match the persona to your training scenario/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /select persona pablo/i })).toBeInTheDocument()
    expect(screen.getAllByText('Pablo').length).toBeGreaterThan(0)
    expect(
      screen.getAllByText(/elevenlabs \/ george - warm, captivating storyteller/i).length
    ).toBeGreaterThan(0)
    expect(
      screen.queryByPlaceholderText(/search personas by name, role, or archetype/i)
    ).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /create persona here/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /test voice/i })).toBeInTheDocument()
  })

  it('keeps the video presenter locked instead of changing persona selection', () => {
    const setSelectedPersona = jest.fn()

    renderVideoPersonaStep({ setSelectedPersona })

    fireEvent.click(screen.getByRole('button', { name: /select persona pablo/i }))

    expect(setSelectedPersona).not.toHaveBeenCalled()
    expect(screen.getByText(/voice profile/i)).toBeInTheDocument()
    expect(screen.getAllByText(/signature traits/i).length).toBeGreaterThan(0)
  })

  it('renders the video presenter details even without persona library results', () => {
    renderVideoPersonaStep({
      personas: [],
      filteredPersonas: [],
    })

    expect(screen.getAllByText(/video presenter/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/always on camera/i).length).toBeGreaterThan(0)
    expect(screen.queryByText(/no personas available/i)).not.toBeInTheDocument()
  })
})
