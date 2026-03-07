import type { SupportEmailTemplateData } from '@pitch/shared-backend/interfaces/support-email.interface';

export interface EmailTemplateContext {
  appName: string;
  webAppUrl?: string;
  stagingWebAppUrl?: string;
}

export interface RenderedEmailTemplate {
  subject: string;
  html: string;
  text: string;
}

export type EmailTemplateRenderer = (
  data: SupportEmailTemplateData | undefined,
  context: EmailTemplateContext,
) => RenderedEmailTemplate;
