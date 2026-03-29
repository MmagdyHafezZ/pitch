import { userSignupInviteTemplate } from '../../email/templates/user-signup-invite.template';

describe('userSignupInviteTemplate', () => {
  it('renders invite content with provided signup URL', () => {
    const result = userSignupInviteTemplate(
      {
        signupUrl: 'https://app.pitch.ai/signup?invite=abc123',
        teamName: 'Engineering',
        invitedByName: 'Admin User',
        expiresMinutes: 15,
      },
      {
        appName: 'PITCH',
        webAppUrl: 'https://app.pitch.ai',
      },
    );

    expect(result.subject).toBe("PITCH - You're invited to join Engineering");
    expect(result.html).toContain('https://app.pitch.ai/signup?invite=abc123');
    expect(result.text).toContain('https://app.pitch.ai/signup?invite=abc123');
    expect(result.text).toContain('Admin User sent you this invitation.');
    expect(result.text).toContain('This invitation expires in 15 minutes.');
  });

  it('falls back to WEB_APP_URL/signup when signupUrl is not provided', () => {
    const result = userSignupInviteTemplate(
      {
        teamName: 'Engineering',
      },
      {
        appName: 'PITCH',
        webAppUrl: 'https://app.pitch.ai/',
      },
    );

    expect(result.html).toContain('https://app.pitch.ai/auth/register');
    expect(result.text).toContain('https://app.pitch.ai/auth/register');
    expect(result.text).toContain('This invitation expires in 15 minutes.');
  });

  it('escapes dynamic HTML fields to prevent HTML injection', () => {
    const result = userSignupInviteTemplate(
      {
        signupUrl: 'https://app.pitch.ai/signup?invite=abc123',
        teamName: '<b>Engineering</b>',
        invitedByName: 'Admin <script>alert(1)</script>',
      },
      {
        appName: 'PITCH',
        webAppUrl: 'https://app.pitch.ai',
      },
    );

    expect(result.html).toContain(
      '<strong>Admin &lt;script&gt;alert(1)&lt;/script&gt;</strong> sent you this invitation.',
    );
    expect(result.html).not.toContain('<script>alert(1)</script>');
    expect(result.html).toContain(
      'join <strong>&lt;b&gt;Engineering&lt;/b&gt;</strong> on PITCH.',
    );
  });

  it('uses generic subject when teamName is not provided', () => {
    const result = userSignupInviteTemplate(
      {},
      { appName: 'PITCH', webAppUrl: 'https://app.pitch.ai' },
    );

    expect(result.subject).toBe("PITCH - You're invited to sign up");
  });

  it('uses generic intro when teamName is not provided', () => {
    const result = userSignupInviteTemplate(
      {},
      { appName: 'PITCH', webAppUrl: 'https://app.pitch.ai' },
    );

    expect(result.html).toContain(
      'You have been invited to create your account on PITCH.',
    );
  });

  it('does not include invited-by line when invitedByName is absent', () => {
    const result = userSignupInviteTemplate(
      { teamName: 'Engineering' },
      { appName: 'PITCH', webAppUrl: 'https://app.pitch.ai' },
    );

    expect(result.html).not.toContain('sent you this invitation.');
  });

  it('defaults expiresMinutes to 15 when not provided', () => {
    const result = userSignupInviteTemplate(
      { signupUrl: 'https://app.pitch.ai/auth/register' },
      { appName: 'PITCH' },
    );

    expect(result.html).toContain('15 minutes');
    expect(result.text).toContain('This invitation expires in 15 minutes.');
  });

  it('clamps expiresMinutes to 1 when a non-finite value is provided', () => {
    const result = userSignupInviteTemplate(
      { expiresMinutes: Infinity },
      { appName: 'PITCH', webAppUrl: 'https://app.pitch.ai' },
    );

    expect(result.html).toContain('15 minutes');
  });

  it('uses stagingWebAppUrl as fallback when webAppUrl is absent', () => {
    const result = userSignupInviteTemplate(
      {},
      {
        appName: 'PITCH',
        stagingWebAppUrl: 'https://staging.pitch.ai',
      },
    );

    expect(result.html).toContain('https://staging.pitch.ai/auth/register');
  });

  it('falls back to localhost when no URL is configured', () => {
    const result = userSignupInviteTemplate({}, { appName: 'PITCH' });

    expect(result.html).toContain('http://localhost:3000/auth/register');
  });

  it('handles undefined data gracefully', () => {
    const result = userSignupInviteTemplate(undefined, { appName: 'PITCH' });

    expect(result.subject).toBe("PITCH - You're invited to sign up");
    expect(result.html).toBeDefined();
    expect(result.text).toBeDefined();
  });

  it('returns all three required fields: subject, html, text', () => {
    const result = userSignupInviteTemplate(
      { signupUrl: 'https://app.pitch.ai/auth/register' },
      { appName: 'PITCH' },
    );

    expect(result).toHaveProperty('subject');
    expect(result).toHaveProperty('html');
    expect(result).toHaveProperty('text');
  });

  it('strips trailing slashes from webAppUrl before appending register path', () => {
    const result = userSignupInviteTemplate(
      {},
      { appName: 'PITCH', webAppUrl: 'https://app.pitch.ai///' },
    );

    expect(result.html).toContain('https://app.pitch.ai/auth/register');
    expect(result.html).not.toContain('///auth/register');
  });
});
