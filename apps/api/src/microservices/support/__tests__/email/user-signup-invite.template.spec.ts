import { userSignupInviteTemplate } from '../../email/templates/user-signup-invite.template';

describe('userSignupInviteTemplate', () => {
  it('renders invite content with provided signup URL', () => {
    const result = userSignupInviteTemplate(
      {
        signupUrl: 'https://app.pitch.ai/signup?invite=abc123',
        teamName: 'Engineering',
        invitedByName: 'Admin User',
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

    expect(result.html).toContain('https://app.pitch.ai/signup');
    expect(result.text).toContain('https://app.pitch.ai/signup');
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
});
