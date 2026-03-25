/**
 * @jest-environment jsdom
 */

import { render, screen } from '@/__tests__/utils/test-utils'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { ScenarioStep } from '../ScenarioStep'
import type {
  EditableScenarioDraft,
  Scenario,
  ScenarioListScope,
} from '@/features/scenarios/types/scenario.types'

function ScenarioStepHarness() {
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>('scenario-1')
  const [scenarioScope, setScenarioScope] = useState<ScenarioListScope>('mine')
  const [scenarioSearchQuery, setScenarioSearchQuery] = useState('')
  const [scenarioWorkspaceId, setScenarioWorkspaceId] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<EditableScenarioDraft[]>([])
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null)
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null)
  const [scenarioTopic, setScenarioTopic] = useState('Codex')
  const [scenarioObjective, setScenarioObjective] = useState('')
  const [scenarioContext, setScenarioContext] = useState('')
  const [aiRole, setAiRole] = useState('')
  const [userRole, setUserRole] = useState('')
  const [durationMinutes, setDurationMinutes] = useState(20)
  const [scenarioCount, setScenarioCount] = useState(3)

  const savedScenarios: Scenario[] = [
    {
      id: 'scenario-1',
      orgId: 'org-1',
      name: 'Preparing for a Codex Product Presentation',
      description: 'A buyer wants proof that Codex is worth adopting.',
      visibility: 'PRIVATE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      config: {
        objective: 'Convince the buyer that Codex is worth piloting.',
        background: 'The buyer is skeptical about integration cost.',
        tags: [],
        roles: {
          user: 'Account Executive',
          assistant: 'Technical stakeholder evaluating Codex',
        },
        durationMinutes: 20,
      },
      permissions: {
        canUse: true,
        canEdit: true,
        canDelete: true,
        canDuplicate: true,
      },
      isReadonlyLegacy: false,
    },
  ]

  return (
    <ScenarioStep
      teams={[]}
      savedScenariosLoading={false}
      savedScenarios={savedScenarios}
      scenarioScope={scenarioScope}
      onScenarioScopeChange={setScenarioScope}
      scenarioSearchQuery={scenarioSearchQuery}
      onScenarioSearchQueryChange={setScenarioSearchQuery}
      scenarioWorkspaceId={scenarioWorkspaceId}
      onScenarioWorkspaceChange={setScenarioWorkspaceId}
      selectedScenarioId={selectedScenarioId}
      onSelectSavedScenario={setSelectedScenarioId}
      onOpenGenerator={() => {
        setActiveDraftId(null)
        setSelectedScenarioId(null)
        setSelectedDraftId(null)
      }}
      drafts={drafts}
      activeDraftId={activeDraftId}
      selectedDraftId={selectedDraftId}
      onSelectDraft={setActiveDraftId}
      onChangeActiveDraft={(value) =>
        setDrafts((current) =>
          current.map((draft) => (draft.draftId === value.draftId ? value : draft))
        )
      }
      onUseActiveDraft={() => undefined}
      onSaveActiveDraft={() => undefined}
      onCreateDraft={() => undefined}
      isSavingDraft={false}
      scenarioTopic={scenarioTopic}
      setScenarioTopic={setScenarioTopic}
      scenarioObjective={scenarioObjective}
      setScenarioObjective={setScenarioObjective}
      scenarioContext={scenarioContext}
      setScenarioContext={setScenarioContext}
      aiRole={aiRole}
      setAiRole={setAiRole}
      userRole={userRole}
      setUserRole={setUserRole}
      durationMinutes={durationMinutes}
      setDurationMinutes={setDurationMinutes}
      scenarioCount={scenarioCount}
      setScenarioCount={setScenarioCount}
      onGenerate={() => undefined}
      isGenerating={false}
      allowTeamVisibility={false}
      errors={{}}
    />
  )
}

describe('ScenarioStep', () => {
  it('switches from a selected scenario preview into the generator when generate options is clicked', async () => {
    render(<ScenarioStepHarness />)

    expect(
      screen.getByRole('heading', { name: 'Preparing for a Codex Product Presentation' })
    ).toBeInTheDocument()

    await userEvent.setup().click(screen.getByRole('button', { name: /generate options/i }))

    expect(screen.getByRole('heading', { name: /generate scenarios/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/what do you want to practice\?/i)).toBeInTheDocument()
  })
})
