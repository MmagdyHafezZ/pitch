import type { SupportPlanChangeDecisionTemplateData } from '@pitch/shared-backend/interfaces/support-email.interface';
import type { EmailTemplateRenderer } from './template.types';

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export const planChangeDecisionTemplate: EmailTemplateRenderer = (
  input,
  context,
) => {
  const data = (input ?? {}) as SupportPlanChangeDecisionTemplateData;
  const appName = context.appName || 'PITCH';
  const approved = data.decision === 'approved';

  const recipientName = data.recipientName?.trim();
  const greeting = recipientName
    ? `Hi ${escapeHtml(recipientName)},`
    : 'Hello,';
  const planName = data.planName
    ? escapeHtml(data.planName)
    : 'the requested plan';

  const subject = approved
    ? `${appName} — Your plan change was approved`
    : `${appName} — Plan change request update`;

  const bodyHtml = approved
    ? `<p class="desc">Your plan change request has been <strong style="color:#16a34a;">approved</strong>.</p>
       <p class="desc">Your subscription has been updated to <strong>${planName}</strong>. The new plan is now active.</p>`
    : `<p class="desc">Your plan change request to <strong>${planName}</strong> was reviewed and was not approved at this time.</p>
       <p class="desc">If you believe this should be revisited, please contact an administrator.</p>`;

  const bodyText = approved
    ? `Your plan change request has been approved.\nYour subscription has been updated to ${data.planName ?? 'the requested plan'}. The new plan is now active.`
    : `Your plan change request to ${data.planName ?? 'the requested plan'} was reviewed and was not approved at this time.\nIf you believe this should be revisited, please contact an administrator.`;

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
    .footer { background-color: #f8fafc; padding: 14px; text-align: center; border-top: 1px solid #e2e8f0; color: #94a3b8; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header"><h1>${appName}</h1></div>
    <div class="content">
      <p class="desc"><strong>${escapeHtml(greeting)}</strong></p>
      ${bodyHtml}
    </div>
    <div class="footer">Automated message from ${appName} • © ${new Date().getFullYear()} ${appName}</div>
  </div>
</body>
</html>`.trim();

  const text = `${subject}\n\n${greeting}\n\n${bodyText}`.trim();

  return { subject, html, text };
};
