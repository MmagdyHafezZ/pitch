import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import {
  SupportEmailTemplate,
  type SupportEmailTemplateData,
} from '@pitch/shared-backend/interfaces/support-email.interface';
import { renderEmailTemplate } from '../templates';

/**
 * PITCH Email System (Gmail SMTP)
 *
 * Goals:
 * - Modular: transport/config/content/templates are separated
 * - Configurable: everything comes from env + overrides per request
 * - Purpose-driven: generic send + optional purpose-specific helpers
 *
 * Env:
 * - EMAIL_PROVIDER=google (optional, only google supported here)
 * - GMAIL_USER (required in prod)
 * - GMAIL_APP_PASSWORD (required in prod)
 *
 * Defaults:
 * - EMAIL_DEFAULT_FROM_NAME="PITCH"
 * - EMAIL_DEFAULT_FROM_ADDRESS=<GMAIL_USER>
 * - EMAIL_REPLY_TO=""
 * - EMAIL_DEV_FALLBACK=true (logs in non-prod if no creds)
 *
 * Optional routing URLs:
 * - WEB_APP_URL
 * - STAGING_WEB_APP_URL
 */

export type EmailProvider = 'google' | 'none';

/** Where the email is coming from */
export type EmailFrom =
  | string
  | {
      name?: string;
      address: string;
    };

/** Email content definition */
export type EmailContent =
  | { kind: 'text'; text: string }
  | { kind: 'html'; html: string; textFallback?: string };

/** Core request */
export interface SendEmailRequest {
  to: string | string[];
  subject: string;
  content: EmailContent;

  from?: EmailFrom;
  replyTo?: string;
  cc?: string | string[];
  bcc?: string | string[];

  headers?: Record<string, string>;
  attachments?: Array<{
    filename: string;
    content: string | Buffer;
    contentType?: string;
    cid?: string;
    encoding?: string;
  }>;
}

/** Result */
export interface SendEmailResult {
  ok: boolean;
  provider: EmailProvider;
  messageId?: string;
  error?: string;
}

type EmailTransporter = {
  sendMail: (mail: MailOptions) => Promise<{ messageId?: string }>;
  verify: () => Promise<boolean>;
};

interface MailOptions {
  from?: string | { name: string; address: string };
  to: string | string[];
  subject: string;
  replyTo?: string;
  cc?: string | string[];
  bcc?: string | string[];
  headers?: Record<string, string>;
  attachments?: Array<{
    filename: string;
    content: string | Buffer;
    contentType?: string;
    cid?: string;
    encoding?: string;
  }>;
  text?: string;
  html?: string;
}

/** Simple, testable configuration object */
export interface EmailServiceConfig {
  provider: EmailProvider;
  gmailUser?: string;
  gmailPassword?: string;

  defaultFromName: string;
  defaultFromAddress?: string;
  defaultReplyTo?: string;

  devFallbackEnabled: boolean;
  appName: string;

  webAppUrl?: string;
  stagingWebAppUrl?: string;
  nodeEnv?: string;
}

/** Factory: environment -> config */
export class EmailConfigFactory {
  static fromEnv(env: NodeJS.ProcessEnv = process.env): EmailServiceConfig {
    const gmailUser = env.GMAIL_USER;
    const gmailPassword = env.GMAIL_APP_PASSWORD;

    const nodeEnv = env.NODE_ENV || 'development';
    const devFallbackEnabled =
      (env.EMAIL_DEV_FALLBACK ?? 'true').toLowerCase() === 'true';

    const defaultFromName = env.EMAIL_DEFAULT_FROM_NAME || 'PITCH';
    const defaultFromAddress = env.EMAIL_DEFAULT_FROM_ADDRESS || gmailUser;
    const defaultReplyTo = env.EMAIL_REPLY_TO || undefined;

    const provider: EmailProvider =
      gmailUser && gmailPassword ? 'google' : 'none';
    console.log('Email provider set to:', provider);
    console.log('GMAIL_USER:', gmailUser ? 'configured' : 'not configured');
    console.log(
      'GMAIL_APP_PASSWORD:',
      gmailPassword ? 'configured' : 'not configured',
    );
    return {
      provider,
      gmailUser,
      gmailPassword,

      defaultFromName,
      defaultFromAddress,
      defaultReplyTo,

      devFallbackEnabled,
      appName: 'PITCH',

      webAppUrl: env.WEB_APP_URL,
      stagingWebAppUrl: env.STAGING_WEB_APP_URL,
      nodeEnv,
    };
  }
}

/** Isolated transport builder (easy to swap later) */
export class GmailTransportFactory {
  static create(cfg: EmailServiceConfig): EmailTransporter | undefined {
    if (!cfg.gmailUser || !cfg.gmailPassword) return undefined;

    const nodemailerModule = nodemailer as unknown as {
      createTransport: (options: {
        host: string;
        port: number;
        secure: boolean;
        auth: { user: string; pass: string };
        requireTLS: boolean;
      }) => EmailTransporter;
    };
    const transporter = nodemailerModule.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: { user: cfg.gmailUser, pass: cfg.gmailPassword },
      requireTLS: true,
    });
    return transporter;
  }
}

/** Normalizes mail options (from, replyTo, content, etc.) */
export class MailComposer {
  static compose(cfg: EmailServiceConfig, req: SendEmailRequest): MailOptions {
    const from = this.normalizeFrom(cfg, req.from);
    const replyTo = req.replyTo ?? cfg.defaultReplyTo;

    const mail: MailOptions = {
      from,
      to: req.to,
      subject: req.subject,
      replyTo,
      cc: req.cc,
      bcc: req.bcc,
      headers: req.headers,
      attachments: req.attachments,
    };

    if (req.content.kind === 'text') {
      mail.text = req.content.text;
    } else {
      mail.html = req.content.html;
      mail.text = req.content.textFallback ?? this.stripHtml(req.content.html);
    }

    return mail;
  }

  private static normalizeFrom(
    cfg: EmailServiceConfig,
    from?: EmailFrom,
  ): string | { name: string; address: string } {
    const address =
      cfg.defaultFromAddress || cfg.gmailUser || 'noreply@pitch.ai';
    const name = cfg.defaultFromName || cfg.appName;

    if (!from) return { name, address };
    if (typeof from === 'string') return from;

    return {
      name: from.name || name,
      address: from.address || address,
    };
  }

  private static stripHtml(html: string): string {
    return html
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/[ \t]+\n/g, '\n')
      .trim();
  }
}

/**
 * EmailService: orchestration only (config + transport + compose + send)
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  private readonly cfg: EmailServiceConfig;
  private readonly transporter?: EmailTransporter;

  constructor() {
    this.cfg = EmailConfigFactory.fromEnv(process.env);
    this.transporter = GmailTransportFactory.create(this.cfg);

    if (this.cfg.provider === 'google') {
      this.logger.log('PITCH Gmail email service initialized');
    } else {
      this.logger.warn(
        'PITCH email service not configured. Set GMAIL_USER and GMAIL_APP_PASSWORD.',
      );
    }
  }

  getConfig(): EmailServiceConfig {
    return this.cfg;
  }

  /**
   * Core entry point. Everything routes through this.
   * - Overrides: you can override defaults by passing req.from/replyTo/etc.
   * - Single responsibility: compose + send.
   */
  async send(req: SendEmailRequest): Promise<SendEmailResult> {
    try {
      if (!this.transporter || this.cfg.provider === 'none') {
        return this.handleNoProvider(req);
      }

      const mail = MailComposer.compose(this.cfg, req);
      const info = await this.transporter.sendMail(mail);

      return {
        ok: true,
        provider: 'google',
        messageId: info.messageId,
      };
    } catch (error) {
      this.logger.error('Failed to send email:', error as Error);
      return {
        ok: false,
        provider: this.cfg.provider,
        error: (error as Error)?.message || 'Unknown error',
      };
    }
  }

  /**
   * Health check
   */
  async testConnection(): Promise<SendEmailResult> {
    try {
      if (!this.transporter || this.cfg.provider === 'none') {
        if ((this.cfg.nodeEnv || '').toLowerCase() === 'production') {
          return { ok: false, provider: 'none', error: 'Not configured' };
        }
        return { ok: true, provider: 'none' };
      }

      await this.transporter.verify();
      return { ok: true, provider: 'google' };
    } catch (error) {
      this.logger.error('SMTP verify failed:', error as Error);
      return {
        ok: false,
        provider: this.cfg.provider,
        error: (error as Error)?.message || 'Unknown error',
      };
    }
  }

  // ---------------------------
  // Purpose-specific helpers (optional)
  // These are just wrappers around send()
  // ---------------------------

  async sendTemplate(
    to: string | string[],
    template: SupportEmailTemplate,
    data?: SupportEmailTemplateData,
  ): Promise<SendEmailResult> {
    const rendered = renderEmailTemplate(template, data, {
      appName: this.cfg.appName,
      webAppUrl: this.cfg.webAppUrl,
      stagingWebAppUrl: this.cfg.stagingWebAppUrl,
    });

    return this.send({
      to,
      subject: rendered.subject,
      content: {
        kind: 'html',
        html: rendered.html,
        textFallback: rendered.text,
      },
      from: {
        name: `${this.cfg.appName} Admin`,
        address:
          this.cfg.defaultFromAddress ||
          this.cfg.gmailUser ||
          'noreply@pitch.ai',
      },
    });
  }

  async sendVerificationCode(
    to: string,
    code: string,
    purpose = 'login',
  ): Promise<SendEmailResult> {
    return this.sendTemplate(to, SupportEmailTemplate.VERIFICATION_CODE, {
      code,
      purpose,
      expiresMinutes: 10,
    });
  }

  private handleNoProvider(
    req: SendEmailRequest,
  ): SendEmailResult | Promise<SendEmailResult> {
    const isProd = (this.cfg.nodeEnv || '').toLowerCase() === 'production';

    if (isProd) {
      const msg = 'Email service not configured for production';
      this.logger.error(msg);
      return { ok: false, provider: 'none', error: msg };
    }

    if (this.cfg.devFallbackEnabled) {
      const to = Array.isArray(req.to) ? req.to.join(', ') : req.to;
      const content =
        req.content.kind === 'text'
          ? req.content.text
          : req.content.textFallback ||
            '(html email - no text fallback provided)';

      this.logger.log(
        `DEV EMAIL (no provider configured)\nTo: ${to}\nSubject: ${req.subject}\n\n${content}`,
      );

      return { ok: true, provider: 'none' };
    }

    const msg = 'Email service not configured (dev fallback disabled)';
    this.logger.error(msg);
    return { ok: false, provider: 'none', error: msg };
  }
}
