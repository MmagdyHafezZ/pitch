import type { SupportVerificationCodeTemplateData } from '@pitch/shared-backend/interfaces/support-email.interface';
import type { EmailTemplateRenderer } from './template.types';

function asVerificationData(
  data: SupportVerificationCodeTemplateData | undefined,
): SupportVerificationCodeTemplateData {
  if (!data?.code || typeof data.code !== 'string') {
    throw new Error('Verification code template requires a string code');
  }

  return data;
}

export const verificationCodeTemplate: EmailTemplateRenderer = (
  input,
  context,
) => {
  const data = asVerificationData(input as SupportVerificationCodeTemplateData);
  const appName = context.appName || 'PITCH';
  const expires = data.expiresMinutes ?? 10;
  const purpose = data.purpose || 'login';

  const headline =
    purpose === 'register'
      ? 'Finish creating your account'
      : purpose === 'admin'
        ? 'Admin sign-in verification'
        : 'Sign-in verification';

  const subject = `${appName} - Verification Code`;
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verification Code</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
    .header { background-color: #111827; padding: 36px 20px; text-align: center; }
    .header h1 { color: #ffffff; margin: 0; font-size: 22px; font-weight: 700; }
    .content { padding: 28px 20px; }
    .desc { color: #475569; font-size: 15px; line-height: 1.6; margin: 12px 0; }
    .codeWrap { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 22px; text-align: center; margin: 22px 0; }
    .code { font-size: 34px; font-weight: 800; color: #0f172a; letter-spacing: 8px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; }
    .warn { background-color: #fff7ed; border-left: 4px solid #fb923c; padding: 12px; margin: 18px 0; border-radius: 8px; color: #9a3412; font-size: 13px; }
    .footer { background-color: #f8fafc; padding: 14px; text-align: center; border-top: 1px solid #e2e8f0; color: #94a3b8; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${appName}</h1>
    </div>
    <div class="content">
      <p class="desc"><strong>${headline}</strong></p>
      <p class="desc">Use the code below to continue:</p>

      <div class="codeWrap">
        <div class="code">${data.code}</div>
      </div>

      <div class="warn">
        This code expires in ${expires} minutes. If you did not request this, ignore this email.
      </div>

      <p class="desc">Do not share this code with anyone.</p>
    </div>
    <div class="footer">Automated message from ${appName} • © ${new Date().getFullYear()} ${appName}</div>
  </div>
</body>
</html>
  `.trim();

  const text = `
${appName} - Verification Code

${headline}

Code: ${data.code}

Expires in ${expires} minutes.
If you did not request this, ignore this email.
Do not share this code with anyone.
  `.trim();

  return { subject, html, text };
};
