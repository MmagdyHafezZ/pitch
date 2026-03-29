import { buildSystemPrompt, type ChatContext } from '../coach.prompts';

describe('buildSystemPrompt', () => {
  it('includes core sections when no context is provided', () => {
    const prompt = buildSystemPrompt();

    expect(prompt).toContain('PITCH AI Coach');
    expect(prompt).toContain('NAVIGATION');
    expect(prompt).toContain('COMMON TASKS');
    expect(prompt).toContain('SALES COACHING');
    expect(prompt).toContain('UI ACTIONS');
    expect(prompt).toContain('FILE ATTACHMENTS');
    expect(prompt).toContain('DOCUMENT GENERATION');
  });

  it('includes all feature sections when page is undefined', () => {
    const prompt = buildSystemPrompt({});

    expect(prompt).toContain('HOME DASHBOARD');
    expect(prompt).toContain('SESSIONS');
    expect(prompt).toContain('CREATE SESSION');
    expect(prompt).toContain('LIVE SESSION');
    expect(prompt).toContain('ANALYTICS');
    expect(prompt).toContain('CHALLENGES');
    expect(prompt).toContain('TEAM CONFIGURATION');
  });

  it('includes only home section for /studio/home', () => {
    const prompt = buildSystemPrompt({ page: '/studio/home' });

    expect(prompt).toContain('HOME DASHBOARD');
    expect(prompt).not.toContain('CREATE SESSION');
    expect(prompt).not.toContain('TEAM CONFIGURATION');
  });

  it('includes only sessions section for /studio/sessions', () => {
    const prompt = buildSystemPrompt({ page: '/studio/sessions' });

    expect(prompt).toContain('FEATURE: SESSIONS');
    expect(prompt).toContain('PERSONAS');
    expect(prompt).toContain('SCENARIOS');
    expect(prompt).not.toContain('HOME DASHBOARD');
    expect(prompt).not.toContain('CHALLENGES');
  });

  it('includes create session sections for /studio/sessions/create', () => {
    const prompt = buildSystemPrompt({ page: '/studio/sessions/create' });

    expect(prompt).toContain('CREATE SESSION');
    expect(prompt).toContain('PERSONAS');
    expect(prompt).toContain('SCENARIOS');
    expect(prompt).toContain('CRM INTEGRATION');
    expect(prompt).not.toContain('HOME DASHBOARD');
  });

  it('includes live session sections for /session/{id}', () => {
    const prompt = buildSystemPrompt({ page: '/session/abc123' });

    expect(prompt).toContain('LIVE SESSION');
    expect(prompt).toContain('HINTS SYSTEM');
    expect(prompt).toContain('PERSONAS');
    expect(prompt).not.toContain('HOME DASHBOARD');
  });

  it('includes performance section for /session/{id}/performance', () => {
    const prompt = buildSystemPrompt({ page: '/session/abc123/performance' });

    expect(prompt).toContain('LIVE SESSION');
    expect(prompt).toContain('PERFORMANCE');
    expect(prompt).toContain('HINTS SYSTEM');
    expect(prompt).not.toContain('HOME DASHBOARD');
  });

  it('includes analytics section for /studio/analytics', () => {
    const prompt = buildSystemPrompt({ page: '/studio/analytics' });

    expect(prompt).toContain('ANALYTICS');
    expect(prompt).not.toContain('HOME DASHBOARD');
    expect(prompt).not.toContain('TEAM CONFIGURATION');
  });

  it('includes challenges section for /studio/challenges', () => {
    const prompt = buildSystemPrompt({ page: '/studio/challenges' });

    expect(prompt).toContain('CHALLENGES');
    expect(prompt).not.toContain('HOME DASHBOARD');
  });

  it('includes team config section for /studio/team-config', () => {
    const prompt = buildSystemPrompt({ page: '/studio/team-config' });

    expect(prompt).toContain('TEAM CONFIGURATION');
    expect(prompt).not.toContain('HOME DASHBOARD');
    expect(prompt).not.toContain('ANALYTICS');
  });

  it('includes onboarding section for /onboarding', () => {
    const prompt = buildSystemPrompt({ page: '/onboarding' });

    expect(prompt).toContain('ONBOARDING WIZARD');
    expect(prompt).not.toContain('HOME DASHBOARD');
  });

  it('falls back to all sections for unrecognized pages', () => {
    const prompt = buildSystemPrompt({ page: '/unknown/route' });

    expect(prompt).toContain('HOME DASHBOARD');
    expect(prompt).toContain('ANALYTICS');
    expect(prompt).toContain('CHALLENGES');
  });

  it('appends current page context when page is provided', () => {
    const prompt = buildSystemPrompt({ page: '/studio/home' });

    expect(prompt).toContain('CURRENT CONTEXT');
    expect(prompt).toContain('/studio/home');
  });

  it('does not append current context when page is absent', () => {
    const prompt = buildSystemPrompt();

    expect(prompt).not.toContain('CURRENT CONTEXT');
  });

  it('appends live session context with recent turns', () => {
    const context: ChatContext = {
      page: '/session/abc',
      sessionId: 'sess-123',
      recentTurns: [
        { role: 'user', text: 'Hello' },
        { role: 'assistant', text: 'Hi there' },
      ],
    };

    const prompt = buildSystemPrompt(context);

    expect(prompt).toContain('LIVE SESSION CONTEXT');
    expect(prompt).toContain('sess-123');
    expect(prompt).toContain('USER: Hello');
    expect(prompt).toContain('ASSISTANT: Hi there');
  });

  it('does not append session context without sessionId', () => {
    const prompt = buildSystemPrompt({
      page: '/session/abc',
      recentTurns: [{ role: 'user', text: 'Hello' }],
    });

    expect(prompt).not.toContain('LIVE SESSION CONTEXT');
  });

  it('does not append session context without recentTurns', () => {
    const prompt = buildSystemPrompt({
      page: '/session/abc',
      sessionId: 'sess-123',
    });

    expect(prompt).not.toContain('LIVE SESSION CONTEXT');
  });

  it('does not append session context with empty recentTurns', () => {
    const prompt = buildSystemPrompt({
      page: '/session/abc',
      sessionId: 'sess-123',
      recentTurns: [],
    });

    expect(prompt).not.toContain('LIVE SESSION CONTEXT');
  });

  it('includes scoring section in the prompt', () => {
    const prompt = buildSystemPrompt();

    expect(prompt).toContain('SCORING SYSTEM');
  });

  it('includes session types section', () => {
    const prompt = buildSystemPrompt();

    expect(prompt).toContain('SESSION TYPES');
  });
});
