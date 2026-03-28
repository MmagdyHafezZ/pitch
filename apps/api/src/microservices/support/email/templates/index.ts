import { SupportEmailTemplate } from '@pitch/shared-backend/interfaces/support-email.interface';
import { studioAccessDecisionTemplate } from './studio-access-decision.template';
import { userSignupInviteTemplate } from './user-signup-invite.template';
import { verificationCodeTemplate } from './verification-code.template';
import { planChangeRequestTemplate } from './plan-change-request.template';
import { planChangeDecisionTemplate } from './plan-change-decision.template';
import type {
  EmailTemplateContext,
  EmailTemplateRenderer,
  RenderedEmailTemplate,
} from './template.types';
import type { SupportEmailTemplateData } from '@pitch/shared-backend/interfaces/support-email.interface';

const TEMPLATE_RENDERERS: Record<SupportEmailTemplate, EmailTemplateRenderer> =
  {
    [SupportEmailTemplate.VERIFICATION_CODE]: verificationCodeTemplate,
    [SupportEmailTemplate.STUDIO_ACCESS_DECISION]: studioAccessDecisionTemplate,
    [SupportEmailTemplate.USER_SIGNUP_INVITE]: userSignupInviteTemplate,
    [SupportEmailTemplate.PLAN_CHANGE_REQUEST]: planChangeRequestTemplate,
    [SupportEmailTemplate.PLAN_CHANGE_DECISION]: planChangeDecisionTemplate,
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
