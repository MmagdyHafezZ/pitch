import { SupportEmailTemplate } from '@pitch/shared-backend/interfaces/support-email.interface';
import { userSignupInviteTemplate } from './user-signup-invite.template';
import { verificationCodeTemplate } from './verification-code.template';
import type {
  EmailTemplateContext,
  EmailTemplateRenderer,
  RenderedEmailTemplate,
} from './template.types';
import type { SupportEmailTemplateData } from '@pitch/shared-backend/interfaces/support-email.interface';

const TEMPLATE_RENDERERS: Record<SupportEmailTemplate, EmailTemplateRenderer> =
  {
    [SupportEmailTemplate.VERIFICATION_CODE]: verificationCodeTemplate,
    [SupportEmailTemplate.USER_SIGNUP_INVITE]: userSignupInviteTemplate,
  };

export function renderEmailTemplate(
  template: SupportEmailTemplate,
  data: SupportEmailTemplateData | undefined,
  context: EmailTemplateContext,
): RenderedEmailTemplate {
  const renderer = TEMPLATE_RENDERERS[template];
  if (!renderer) {
    throw new Error(`Unsupported email template: ${template}`);
  }

  return renderer(data, context);
}
