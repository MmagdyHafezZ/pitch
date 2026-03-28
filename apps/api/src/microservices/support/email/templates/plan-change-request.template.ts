import type { SupportPlanChangeRequestTemplateData } from '@pitch/shared-backend/interfaces/support-email.interface';
import type { EmailTemplateRenderer } from './template.types';

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export const planChangeRequestTemplate: EmailTemplateRenderer = (
  input,
  context,
) => {
  const data = (input ?? {}) as SupportPlanChangeRequestTemplateData;
  const appName = context.appName || 'PITCH';

  const requester = data.requesterName?.trim()
    ? `${escapeHtml(data.requesterName)}${data.requesterEmail ? ` (${escapeHtml(data.requesterEmail)})` : ''}`
    : data.requesterEmail
      ? escapeHtml(data.requesterEmail)
      : 'A user';

  const requestedPlan = escapeHtml(data.requestedPlanName ?? 'a new plan');
  const interval = data.requestedInterval
    ? ` (${escapeHtml(data.requestedInterval)})`
    : '';
  const currentPlan = data.currentPlanName
    ? ` from <strong>${escapeHtml(data.currentPlanName)}</strong>`
    : '';

  const subject = `${appName} — Plan change request`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
    .header { background-color: #111827; padding: 36px 20px; text-align: center; }
    .header h1 { color: #ffffff; margin: 0; font-size: 22px; font-weight: 700; }
    .content { padding: 28px 20px; }
    .desc { color: #475569; font-size: 15px; line-height: 1.6; margin: 12px 0; }
    .pill { display: inline-block; background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px 14px; font-size: 14px; font-weight: 600; color: #0f172a; }
    .btn { display: inline-block; margin-top: 20px; padding: 12px 24px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; }
    .footer { background-color: #f8fafc; padding: 14px; text-align: center; border-top: 1px solid #e2e8f0; color: #94a3b8; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header"><h1>${appName}</h1></div>
    <div class="content">
      <p class="desc"><strong>New plan change request</strong></p>
      <p class="desc">${requester} has requested a plan change${currentPlan} to <span class="pill">${requestedPlan}${interval}</span>.</p>
      <p class="desc">Log in to the admin panel to review, approve, or reject this request.</p>
      ${data.reviewUrl ? `<a class="btn" href="${escapeHtml(data.reviewUrl)}">Review request</a>` : ''}
    </div>
    <div class="footer">Automated message from ${appName} • © ${new Date().getFullYear()} ${appName}</div>
  </div>
</body>
</html>`.trim();

  const text = `${subject}

${requester} has requested a plan change${data.currentPlanName ? ` from ${data.currentPlanName}` : ''} to ${data.requestedPlanName}${data.requestedInterval ? ` (${data.requestedInterval})` : ''}.

Log in to the admin panel to review, approve, or reject this request.${data.reviewUrl ? `\n${data.reviewUrl}` : ''}`.trim();

  return { subject, html, text };
};
