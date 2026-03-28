import {
  buildConversationFallbackResponse,
  buildConversationStarterPrompt,
  buildConversationSystemPrompt,
  ensureStarterGreetingWithUserName,
  isDisallowedGenericFallbackReply,
  type ConversationPromptInput,
} from '../../prompts/conversation.prompt';

const makeInput = (
  tone?: string,
  overrides?: Partial<ConversationPromptInput['sessionConfig']>,
  sessionOverrides?: Partial<ConversationPromptInput['session']>,
  personaOverrides?: Partial<NonNullable<ConversationPromptInput['persona']>>,
  scenarioOverrides?: Partial<ConversationPromptInput['scenarioConfig']>,
): ConversationPromptInput => ({
  persona: personaOverrides
    ? {
        ...personaOverrides,
      }
    : null,
  session: {
    name: 'Test Session',
    language: 'English',
    scenario: null,
    ...sessionOverrides,
  },
  sessionConfig: {
    tone,
    ...overrides,
  },
  scenarioConfig: {
    ...scenarioOverrides,
  },
});

describe('buildConversationSystemPrompt', () => {
  it('adds confrontational behavior directives for the Rude Karen tone', () => {
    const prompt = buildConversationSystemPrompt(makeInput('Rude Karen'));

    expect(prompt).toContain('- Tone: Rude Karen');
    expect(prompt).toContain(
      '- Baseline: Blunt, impatient, and hard to satisfy from the start.',
    );
    expect(prompt).toContain(
      '- Push back hard on vague or weak answers. Demand justification and specifics.',
    );
  });

  it('does not add Rude Karen directives for other tones', () => {
    const prompt = buildConversationSystemPrompt(makeInput('Friendly'));

    expect(prompt).toContain('- Tone: Friendly');
    expect(prompt).not.toContain(
      '- Baseline: Blunt, impatient, and hard to satisfy from the start.',
    );
  });

  it('adds patience, response-length, and initiative directives when configured', () => {
    const prompt = buildConversationSystemPrompt(
      makeInput('Professional', {
        patienceLevel: 'Low',
        responseLength: 'Concise',
        initiativeLevel: 'Proactive',
      }),
    );

    expect(prompt).toContain('- Patience level: Low');
    expect(prompt).toContain(
      '- Patience setting: low. If the user rambles or dodges, tighten your tone quickly and force specificity.',
    );
    expect(prompt).toContain(
      '- Prefer short answers. Keep most turns to 1–2 sentences unless detail is explicitly requested.',
    );
    expect(prompt).toContain(
      '- Drive momentum. Offer pointed follow-ups and move the scenario forward without waiting passively.',
    );
  });

  it('maps locale codes to natural language instructions', () => {
    const prompt = buildConversationSystemPrompt(
      makeInput(undefined, undefined, {
        language: 'es-ES',
      }),
    );

    expect(prompt).toContain('- Respond only in Spanish.');
  });

  it('falls back to the user locale preference when the session language is missing', () => {
    const prompt = buildConversationSystemPrompt(
      makeInput(
        undefined,
        {
          userSnapshot: {
            settings: {
              language: {
                locale: 'de-DE',
              },
            },
          },
        },
        {
          language: null,
        },
      ),
    );

    expect(prompt).toContain('- Respond only in German.');
  });

  it('keeps scaffold guardrails when systemPrompt is configured', () => {
    const prompt = buildConversationSystemPrompt(
      makeInput(undefined, {
        systemPrompt:
          'You are evaluating sales readiness for this challenge scenario.',
      }),
    );

    expect(prompt).toContain('[IDENTITY]');
    expect(prompt).toContain('[SCENARIO]');
    expect(prompt).toContain('[RULES]');
    expect(prompt).toContain('[CUSTOM INSTRUCTIONS]');
    expect(prompt).toContain(
      '- SYSTEM PROMPT: You are evaluating sales readiness for this challenge scenario.',
    );
  });

  it('includes systemPrompt then customPrompt in deterministic order', () => {
    const prompt = buildConversationSystemPrompt(
      makeInput(undefined, {
        systemPrompt: 'System-level challenge context.',
        customPrompt: 'Custom evaluator nuance.',
      }),
    );

    const systemPromptIndex = prompt.indexOf(
      '- SYSTEM PROMPT: System-level challenge context.',
    );
    const customPromptIndex = prompt.indexOf(
      '- CUSTOM PROMPT: Custom evaluator nuance.',
    );

    expect(systemPromptIndex).toBeGreaterThan(-1);
    expect(customPromptIndex).toBeGreaterThan(-1);
    expect(systemPromptIndex).toBeLessThan(customPromptIndex);
    expect(prompt).toContain(
      '- Precedence: [IDENTITY], [SCENARIO], [LANGUAGE], and [RULES] above override any conflicting custom instruction.',
    );
  });

  it('uses persona traits role as fallback when aiRole is not set', () => {
    const prompt = buildConversationSystemPrompt(
      makeInput(undefined, {}, undefined, {
        name: 'Alex',
        traits: { role: 'Procurement Director' },
      }),
    );

    expect(prompt).toContain('- You are Procurement Director.');
    expect(prompt).toContain('- Persona name: Alex.');
  });

  it('keeps challenge-like scenario context supplemental to scaffold', () => {
    const prompt = buildConversationSystemPrompt(
      makeInput(undefined, {
        systemPrompt:
          'You are speaking with an enterprise buyer at a fintech company.',
      }),
    );

    expect(prompt).toContain('[SCENARIO]');
    expect(prompt).toContain('[CUSTOM INSTRUCTIONS]');
    expect(prompt).toContain(
      '- SYSTEM PROMPT: You are speaking with an enterprise buyer at a fintech company.',
    );
  });

  it('prefers customer-facing role for AI when scenario roles object includes both sides', () => {
    const prompt = buildConversationSystemPrompt(
      makeInput(undefined, undefined, undefined, undefined, {
        roles: {
          assistant: 'Account Executive',
          client: 'Procurement Director',
          user: 'Sales Representative',
        },
      }),
    );

    expect(prompt).toContain('- You are Procurement Director.');
    expect(prompt).toContain('- The user plays: Sales Representative.');
  });

  it('auto-corrects reversed configured seller/customer roles', () => {
    const prompt = buildConversationSystemPrompt(
      makeInput(undefined, {
        aiRole: 'Sales Representative',
        userRole: 'Procurement Director',
      }),
    );

    expect(prompt).toContain('- You are Procurement Director.');
    expect(prompt).toContain('- The user plays: Sales Representative.');
  });

  it('builds a role-aware fallback response instead of the generic clarification line', () => {
    const response = buildConversationFallbackResponse({
      startAsAssistant: false,
      persona: {
        id: 'persona_arden',
        name: 'Arden',
        traits: { role: 'IBM Procurement Reviewer' },
      },
      sessionConfig: {},
      scenarioConfig: {
        objective:
          'Confirm a credible implementation timeline and close architecture risks.',
      },
    });

    expect(response).toContain('As IBM Procurement Reviewer,');
    expect(response).toContain('Objective to address:');
    expect(response).not.toContain(
      'Got it. Could you say a bit more so I can respond properly?',
    );
  });

  it('uses in-role assistant fallback when opening a scenario turn', () => {
    const response = buildConversationFallbackResponse({
      startAsAssistant: true,
      persona: {
        id: 'persona_arden',
        name: 'Arden',
        traits: { role: 'IBM Procurement Reviewer' },
      },
      sessionConfig: {
        userSnapshot: {
          name: 'Magdy',
        },
        userRole: 'Sales Representative',
      },
      scenarioConfig: {
        objective:
          'Confirm a credible implementation timeline and close architecture risks.',
        context:
          'You are presenting a rollout plan to an enterprise procurement lead.',
      },
    });

    expect(response).toContain('Hi Magdy, welcome to Pitch.');
    expect(response).toContain(
      "I'm IBM Procurement Reviewer for this simulation.",
    );
    expect(response).toContain(
      'This scenario has you working as Sales Representative',
    );
    expect(response).toContain("Let's begin: as IBM Procurement Reviewer");
  });

  it('builds a first-turn starter prompt that greets the user by name and introduces Pitch', () => {
    const prompt = buildConversationStarterPrompt(
      makeInput(
        undefined,
        {
          userSnapshot: {
            name: 'Magdy',
          },
          userRole: 'Sales Representative',
        },
        {
          scenario: {
            id: 'scenario_1',
            name: 'Enterprise Security Rollout',
            description:
              'Present the rollout plan and address enterprise risk.',
          },
        },
        {
          name: 'Arden',
          traits: { role: 'IBM Procurement Reviewer' },
        },
        {
          objective:
            'Confirm a credible implementation timeline and close architecture risks.',
          context:
            'You are meeting an enterprise procurement lead who is skeptical about rollout risk.',
        },
      ),
    );

    expect(prompt).toContain('Open with the exact greeting "Hi Magdy,"');
    expect(prompt).toContain(
      'give a short introduction to Pitch as the app hosting this practice simulation',
    );
    expect(prompt).toContain(
      'Mention that you are playing IBM Procurement Reviewer.',
    );
    expect(prompt).toContain(
      'Mention that the user is playing Sales Representative.',
    );
    expect(prompt).toContain(
      'Mention the scenario title: Enterprise Security Rollout.',
    );
  });

  it('forces the first-turn greeting to include the user name when the model omits it', () => {
    expect(
      ensureStarterGreetingWithUserName('Hello, welcome to Pitch.', {
        userSnapshot: {
          name: 'Magdy',
        },
      }),
    ).toBe('Hi Magdy, welcome to Pitch.');

    expect(
      ensureStarterGreetingWithUserName(
        'I am your procurement reviewer for this simulation.',
        {
          userSnapshot: {
            name: 'Magdy',
          },
        },
      ),
    ).toBe('Hi Magdy, I am your procurement reviewer for this simulation.');

    expect(
      ensureStarterGreetingWithUserName('Hi Magdy, welcome to Pitch.', {
        userSnapshot: {
          name: 'Magdy',
        },
      }),
    ).toBe('Hi Magdy, welcome to Pitch.');
  });

  it('flags the legacy generic clarification fallback as disallowed', () => {
    expect(
      isDisallowedGenericFallbackReply(
        'Got it. Could you say a bit more so I can respond properly?',
      ),
    ).toBe(true);
    expect(
      isDisallowedGenericFallbackReply(
        'As Procurement Director, I need a concrete answer.',
      ),
    ).toBe(false);
  });

  it('includes uploaded session document previews in the prompt context', () => {
    const prompt = buildConversationSystemPrompt(
      makeInput(undefined, {
        attachments: [
          {
            filename: 'discovery-notes.pdf',
            textPreview:
              'Customer priorities: reduce onboarding time, keep SSO mandatory, and confirm legal review before rollout.',
          },
        ],
      }),
    );

    expect(prompt).toContain('[SESSION DOCUMENTS]');
    expect(prompt).toContain('discovery-notes.pdf');
    expect(prompt).toContain('Customer priorities: reduce onboarding time');
  });

  it('forbids prep-coach meta questions in the live roleplay prompt', () => {
    const prompt = buildConversationSystemPrompt(makeInput());

    expect(prompt).toContain('Do not switch into prep-coach mode.');
    expect(prompt).toContain('what the user plans to highlight');
    expect(prompt).toContain('What do you have in mind?');
  });

  it('uses counterpartProfile details when no linked persona exists', () => {
    const prompt = buildConversationSystemPrompt(
      makeInput(undefined, {
        counterpartProfile: {
          name: 'Skeptical VP of Engineering',
          role: 'Skeptical VP of Engineering',
          background:
            'Responsible for platform reliability, engineering efficiency, and rollout risk.',
          objections: [
            'Integration complexity',
            'Unclear ROI',
            'Developer adoption risk',
          ],
          signatureTraits: [
            'Asks for specifics',
            'Pushes on implementation risk',
          ],
          personality:
            'Analytical, skeptical, and impatient with vague answers.',
        },
      }),
    );

    expect(prompt).toContain('- You are Skeptical VP of Engineering.');
    expect(prompt).toContain('[COUNTERPART]');
    expect(prompt).toContain('Integration complexity');
    expect(prompt).toContain('Pushes on implementation risk');
    expect(prompt).toContain(
      'Analytical, skeptical, and impatient with vague answers.',
    );
  });

  it('tells the AI to challenge vague answers instead of rewarding them', () => {
    const prompt = buildConversationSystemPrompt(makeInput());

    expect(prompt).toContain(
      'If the user gives a vague, generic, or promotional answer, push back and force specificity instead of rewarding it.',
    );
    expect(prompt).toContain(
      'Ask for evidence, examples, tradeoffs, timing, risk, rollout details, ROI, ownership, or next steps',
    );
  });
});
