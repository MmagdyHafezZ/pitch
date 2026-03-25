import type { SupportStudioAccessDecisionTemplateData } from '@pitch/shared-backend/interfaces/support-email.interface';
import type { EmailTemplateRenderer } from './template.types';

function asDecisionData(
  data: SupportStudioAccessDecisionTemplateData | undefined,
): SupportStudioAccessDecisionTemplateData {
  if (!data?.decision) {
    throw new Error('Studio access decision template requires a decision');
  }

  return data;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export const studioAccessDecisionTemplate: EmailTemplateRenderer = (
  input,
  context,
) => {
  const data = asDecisionData(input as SupportStudioAccessDecisionTemplateData);
  const appName = context.appName || 'PITCH';
  const recipientName = data.recipientName?.trim();
  const greeting = recipientName ? `Hi ${recipientName},` : 'Hello,';
  const roleLabel =
    data.role === 'ADMIN'
      ? 'admin'
      : data.role === 'MEMBER'
        ? 'regular user'
        : 'user';

  const subject =
    data.decision === 'approved'
      ? `${appName} - Studio access approved`
      : `${appName} - Studio access request update`;

  const bodyHtml =
    data.decision === 'approved'
      ? `<p class="desc">Your Studio access request has been approved.</p>
         <p class="desc">You were approved as a <strong>${escapeHtml(roleLabel)}</strong>${typeof data.quota === 'number' ? ` with <strong>${data.quota}</strong> coins allocated to your workspace.` : '.'}</p>
         <p class="desc">You can return to Studio and start using it.</p>`
      : `<p class="desc">Your Studio access request was reviewed and was not approved at this time.</p>
         <p class="desc">If you believe this should be revisited, contact a super admin.</p>`;

  const bodyText =
    data.decision === 'approved'
      ? `Your Studio access request has been approved.\nYou were approved as a ${roleLabel}${typeof data.quota === 'number' ? ` with ${data.quota} coins allocated to your workspace.` : '.'}\nYou can return to Studio and start using it.`
      : 'Your Studio access request was reviewed and was not approved at this time.\nIf you believe this should be revisited, contact a super admin.';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Studio access decision</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
    .header { background-color: #111827; padding: 36px 20px; text-align: center; }
    .header h1 { color: #ffffff; margin: 0; font-size: 22px; font-weight: 700; }
    .content { padding: 28px 20px; }
    .desc { color: #475569; font-size: 15px; line-height: 1.6; margin: 12px 0; }
    .footer { background-color: #f8fafc; padding: 14px; text-align: center; border-top: 1px solid #e2e8f0; color: #94a3b8; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${appName}</h1>
    </div>
    <div class="content">
      <p class="desc"><strong>${escapeHtml(greeting)}</strong></p>
      ${bodyHtml}
    </div>
    <div class="footer">Automated message from ${appName} • © ${new Date().getFullYear()} ${appName}</div>
  </div>
</body>
</html>
  `.trim();

  const text = `
${subject}

${greeting}

${bodyText}
  `.trim();

  return { subject, html, text };
};
