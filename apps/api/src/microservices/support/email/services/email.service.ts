/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

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
  static create(cfg: EmailServiceConfig): nodemailer.Transporter | undefined {
    if (!cfg.gmailUser || !cfg.gmailPassword) return undefined;

    return nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: { user: cfg.gmailUser, pass: cfg.gmailPassword },
      requireTLS: true,
    });
  }
}

/** Normalizes mail options (from, replyTo, content, etc.) */
export class MailComposer {
  static compose(
    cfg: EmailServiceConfig,
    req: SendEmailRequest,
  ): nodemailer.SendMailOptions {
    const from = this.normalizeFrom(cfg, req.from);
    const replyTo = req.replyTo ?? cfg.defaultReplyTo;

    const mail: nodemailer.SendMailOptions = {
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
 * Purpose: "templates" are pure functions.
 * You can move this to /emails/templates later without touching EmailService.
 */
export namespace PitchEmailTemplates {
  export function verificationCode(args: {
    appName?: string;
    code: string;
    expiresMinutes?: number;
    purpose?: string; // "login" | "register" | "admin" | etc.
  }): { subject: string; html: string; text: string } {
    const appName = args.appName || 'PITCH';
    const expires = args.expiresMinutes ?? 10;
    const purpose = args.purpose || 'login';

    const subject = `${appName} - Verification Code`;
    const headline =
      purpose === 'register'
        ? 'Finish creating your account'
        : purpose === 'admin'
          ? 'Admin sign-in verification'
          : 'Sign-in verification';

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
        <div class="code">${args.code}</div>
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

Code: ${args.code}

Expires in ${expires} minutes.
If you did not request this, ignore this email.
Do not share this code with anyone.
    `.trim();

    return { subject, html, text };
  }
}

/**
 * EmailService: orchestration only (config + transport + compose + send)
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  private readonly cfg: EmailServiceConfig;
  private readonly transporter?: nodemailer.Transporter;

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

  async sendVerificationCode(
    to: string,
    code: string,
  ): Promise<SendEmailResult> {
    const t = PitchEmailTemplates.verificationCode({
      appName: this.cfg.appName,
      code,
      expiresMinutes: 10,
    });

    return this.send({
      to,
      subject: t.subject,
      content: { kind: 'html', html: t.html, textFallback: t.text },
      from: {
        name: `${this.cfg.appName} Admin`,
        address:
          this.cfg.defaultFromAddress ||
          this.cfg.gmailUser ||
          'noreply@pitch.ai',
      },
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
