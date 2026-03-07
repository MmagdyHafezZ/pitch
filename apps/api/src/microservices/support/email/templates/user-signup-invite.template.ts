import type { SupportUserSignupInviteTemplateData } from '@pitch/shared-backend/interfaces/support-email.interface';
import type {
  EmailTemplateContext,
  EmailTemplateRenderer,
} from './template.types';

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function resolveSignupUrl(
  data: SupportUserSignupInviteTemplateData,
  context: EmailTemplateContext,
): string {
  if (typeof data.signupUrl === 'string' && data.signupUrl.trim().length > 0) {
    return data.signupUrl.trim();
  }

  const baseUrl =
    context.webAppUrl || context.stagingWebAppUrl || 'http://localhost:3000';

  return `${baseUrl.replace(/\/+$/, '')}/auth/register`;
}

function asInviteData(
  data: SupportUserSignupInviteTemplateData | undefined,
): SupportUserSignupInviteTemplateData {
  if (!data) {
    return {};
  }

  return data;
}

export const userSignupInviteTemplate: EmailTemplateRenderer = (
  input,
  context,
) => {
  const data = asInviteData(input as SupportUserSignupInviteTemplateData);
  const appName = context.appName || 'PITCH';
  const teamName = data.teamName?.trim();
  const invitedByName = data.invitedByName?.trim();
  const signupUrl = resolveSignupUrl(data, context);

  const escapedTeamName = teamName ? escapeHtml(teamName) : undefined;
  const escapedInvitedBy = invitedByName
    ? escapeHtml(invitedByName)
    : undefined;
  const escapedSignupUrl = escapeHtml(signupUrl);

  const subject = teamName
    ? `${appName} - You're invited to join ${teamName}`
    : `${appName} - You're invited to sign up`;

  const intro = escapedTeamName
    ? `You have been invited to join <strong>${escapedTeamName}</strong> on ${appName}.`
    : `You have been invited to create your account on ${appName}.`;
  const invitedByLine = escapedInvitedBy
    ? `<p class="desc"><strong>${escapedInvitedBy}</strong> sent you this invitation.</p>`
    : '';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sign Up Invitation</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
    .header { background-color: #111827; padding: 36px 20px; text-align: center; }
    .header h1 { color: #ffffff; margin: 0; font-size: 22px; font-weight: 700; }
    .content { padding: 28px 20px; }
    .desc { color: #475569; font-size: 15px; line-height: 1.6; margin: 12px 0; }
    .ctaWrap { text-align: center; margin: 24px 0; }
    .cta { display: inline-block; background-color: #0f172a; color: #ffffff !important; text-decoration: none; padding: 12px 22px; border-radius: 8px; font-weight: 700; }
    .muted { color: #64748b; font-size: 13px; line-height: 1.5; word-break: break-all; }
    .footer { background-color: #f8fafc; padding: 14px; text-align: center; border-top: 1px solid #e2e8f0; color: #94a3b8; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${appName}</h1>
    </div>
    <div class="content">
      <p class="desc"><strong>Complete your signup</strong></p>
      <p class="desc">${intro}</p>
      ${invitedByLine}

      <div class="ctaWrap">
        <a class="cta" href="${escapedSignupUrl}" target="_blank" rel="noopener noreferrer">Create your account</a>
      </div>

      <p class="muted">If the button does not work, copy and paste this link into your browser:</p>
      <p class="muted">${escapedSignupUrl}</p>
    </div>
    <div class="footer">Automated message from ${appName} • © ${new Date().getFullYear()} ${appName}</div>
  </div>
</body>
</html>
  `.trim();

  const text = `
${subject}

You have been invited to ${teamName ? `join ${teamName}` : `sign up for ${appName}`}.
${invitedByName ? `${invitedByName} sent you this invitation.` : ''}

Create your account here:
${signupUrl}
  `.trim();

  return { subject, html, text };
};
