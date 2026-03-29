import {
  EmailConfigFactory,
  EmailService,
  GmailTransportFactory,
  MailComposer,
  type EmailServiceConfig,
  type SendEmailRequest,
} from '../../email/services/email.service';
import { SupportEmailTemplate } from '@pitch/shared-backend/interfaces/support-email.interface';

// ─── helpers ─────────────────────────────────────────────────────────────────

function baseConfig(
  overrides: Partial<EmailServiceConfig> = {},
): EmailServiceConfig {
  return {
    provider: 'none',
    defaultFromName: 'PITCH',
    defaultFromAddress: 'noreply@pitch.ai',
    devFallbackEnabled: true,
    appName: 'PITCH',
    nodeEnv: 'test',
    ...overrides,
  };
}

function textRequest(
  overrides: Partial<SendEmailRequest> = {},
): SendEmailRequest {
  return {
    to: 'user@example.com',
    subject: 'Test email',
    content: { kind: 'text', text: 'Hello world' },
    ...overrides,
  };
}

function htmlRequest(
  overrides: Partial<SendEmailRequest> = {},
): SendEmailRequest {
  return {
    to: 'user@example.com',
    subject: 'Test email',
    content: { kind: 'html', html: '<p>Hello</p>', textFallback: 'Hello' },
    ...overrides,
  };
}

// ─── EmailConfigFactory ───────────────────────────────────────────────────────

describe('EmailConfigFactory', () => {
  it('sets provider=google when both GMAIL_USER and GMAIL_APP_PASSWORD are set', () => {
    const cfg = EmailConfigFactory.fromEnv({
      GMAIL_USER: 'user@gmail.com',
      GMAIL_APP_PASSWORD: 'secret',
      NODE_ENV: 'production',
    });

    expect(cfg.provider).toBe('google');
    expect(cfg.gmailUser).toBe('user@gmail.com');
    expect(cfg.gmailPassword).toBe('secret');
  });

  it('sets provider=none when credentials are absent', () => {
    const cfg = EmailConfigFactory.fromEnv({ NODE_ENV: 'development' });
    expect(cfg.provider).toBe('none');
  });

  it('applies EMAIL_DEFAULT_FROM_NAME override', () => {
    const cfg = EmailConfigFactory.fromEnv({
      EMAIL_DEFAULT_FROM_NAME: 'My App',
    });
    expect(cfg.defaultFromName).toBe('My App');
  });

  it('defaults devFallbackEnabled to true', () => {
    const cfg = EmailConfigFactory.fromEnv({});
    expect(cfg.devFallbackEnabled).toBe(true);
  });

  it('sets devFallbackEnabled=false when EMAIL_DEV_FALLBACK=false', () => {
    const cfg = EmailConfigFactory.fromEnv({ EMAIL_DEV_FALLBACK: 'false' });
    expect(cfg.devFallbackEnabled).toBe(false);
  });

  it('reads webAppUrl and stagingWebAppUrl from env', () => {
    const cfg = EmailConfigFactory.fromEnv({
      WEB_APP_URL: 'https://app.pitch.ai',
      STAGING_WEB_APP_URL: 'https://staging.pitch.ai',
    });
    expect(cfg.webAppUrl).toBe('https://app.pitch.ai');
    expect(cfg.stagingWebAppUrl).toBe('https://staging.pitch.ai');
  });
});

// ─── GmailTransportFactory ────────────────────────────────────────────────────

describe('GmailTransportFactory', () => {
  it('returns undefined when credentials are missing', () => {
    const transporter = GmailTransportFactory.create(baseConfig());
    expect(transporter).toBeUndefined();
  });

  it('returns a transporter object when credentials are present', () => {
    const transporter = GmailTransportFactory.create(
      baseConfig({
        provider: 'google',
        gmailUser: 'user@gmail.com',
        gmailPassword: 'pass',
      }),
    );
    expect(transporter).toBeDefined();
    expect(typeof transporter?.sendMail).toBe('function');
  });
});

// ─── MailComposer ─────────────────────────────────────────────────────────────

describe('MailComposer', () => {
  it('composes a text email with default from address', () => {
    const cfg = baseConfig({
      defaultFromName: 'PITCH',
      defaultFromAddress: 'noreply@pitch.ai',
    });
    const mail = MailComposer.compose(cfg, textRequest());

    expect(mail.to).toBe('user@example.com');
    expect(mail.subject).toBe('Test email');
    expect(mail.text).toBe('Hello world');
    expect(mail.html).toBeUndefined();
    expect(mail.from).toEqual({ name: 'PITCH', address: 'noreply@pitch.ai' });
  });

  it('composes an html email and strips tags for text fallback', () => {
    const cfg = baseConfig();
    const mail = MailComposer.compose(
      cfg,
      htmlRequest({ content: { kind: 'html', html: '<p>Hello</p>' } }),
    );

    expect(mail.html).toBe('<p>Hello</p>');
    expect(mail.text).toBeTruthy();
    expect(mail.text).not.toContain('<p>');
  });

  it('uses textFallback over automatic strip when provided', () => {
    const cfg = baseConfig();
    const mail = MailComposer.compose(
      cfg,
      htmlRequest({
        content: {
          kind: 'html',
          html: '<p>Hello</p>',
          textFallback: 'Custom fallback',
        },
      }),
    );

    expect(mail.text).toBe('Custom fallback');
  });

  it('accepts a string from override', () => {
    const cfg = baseConfig();
    const mail = MailComposer.compose(
      cfg,
      textRequest({ from: 'sender@pitch.ai' }),
    );

    expect(mail.from).toBe('sender@pitch.ai');
  });

  it('accepts an object from override', () => {
    const cfg = baseConfig();
    const mail = MailComposer.compose(
      cfg,
      textRequest({ from: { name: 'Admin', address: 'admin@pitch.ai' } }),
    );

    expect(mail.from).toEqual({ name: 'Admin', address: 'admin@pitch.ai' });
  });

  it('falls back to cfg.defaultReplyTo when replyTo is not in the request', () => {
    const cfg = baseConfig({ defaultReplyTo: 'support@pitch.ai' });
    const mail = MailComposer.compose(cfg, textRequest());
    expect(mail.replyTo).toBe('support@pitch.ai');
  });

  it('request replyTo overrides cfg.defaultReplyTo', () => {
    const cfg = baseConfig({ defaultReplyTo: 'support@pitch.ai' });
    const mail = MailComposer.compose(
      cfg,
      textRequest({ replyTo: 'custom@pitch.ai' }),
    );
    expect(mail.replyTo).toBe('custom@pitch.ai');
  });

  it('strips style and script tags when building text fallback', () => {
    const cfg = baseConfig();
    const mail = MailComposer.compose(cfg, {
      to: 'u@e.com',
      subject: 's',
      content: {
        kind: 'html',
        html: '<style>body{}</style><script>alert(1)</script><p>Safe content</p>',
      },
    });

    expect(mail.text).not.toContain('<style>');
    expect(mail.text).not.toContain('<script>');
    expect(mail.text).toContain('Safe content');
  });
});

// ─── EmailService ─────────────────────────────────────────────────────────────

describe('EmailService', () => {
  // EmailService reads process.env at construction time, so we manipulate
  // the env before each instantiation and restore it afterwards.

  const originalEnv = { ...process.env };

  afterEach(() => {
    // Restore original env
    Object.keys(process.env).forEach((k) => {
      if (!(k in originalEnv)) delete process.env[k];
    });
    Object.assign(process.env, originalEnv);
  });

  function makeServiceNoProvider(): EmailService {
    delete process.env.GMAIL_USER;
    delete process.env.GMAIL_APP_PASSWORD;
    process.env.NODE_ENV = 'test';
    process.env.EMAIL_DEV_FALLBACK = 'true';
    return new EmailService();
  }

  // ── getConfig ─────────────────────────────────────────────────────────────

  it('getConfig returns the config derived from env', () => {
    const service = makeServiceNoProvider();
    const cfg = service.getConfig();
    expect(cfg).toHaveProperty('provider');
    expect(cfg).toHaveProperty('appName', 'PITCH');
  });

  // ── send — no provider, dev fallback enabled ──────────────────────────────

  it('send returns ok=true with provider=none in dev when no credentials configured', async () => {
    const service = makeServiceNoProvider();
    const result = await service.send(textRequest());
    expect(result).toEqual({ ok: true, provider: 'none' });
  });

  it('send returns ok=false with error when no provider in production', async () => {
    delete process.env.GMAIL_USER;
    delete process.env.GMAIL_APP_PASSWORD;
    process.env.NODE_ENV = 'production';
    const service = new EmailService();

    const result = await service.send(textRequest());

    expect(result.ok).toBe(false);
    expect(result.provider).toBe('none');
    expect(result.error).toMatch(/not configured/i);
  });

  it('send returns ok=false when no provider and dev fallback disabled', async () => {
    delete process.env.GMAIL_USER;
    delete process.env.GMAIL_APP_PASSWORD;
    process.env.NODE_ENV = 'development';
    process.env.EMAIL_DEV_FALLBACK = 'false';
    const service = new EmailService();

    const result = await service.send(textRequest());

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/dev fallback disabled/i);
  });

  it('send logs multiple recipients in dev fallback', async () => {
    const service = makeServiceNoProvider();
    const result = await service.send({
      ...textRequest(),
      to: ['a@test.com', 'b@test.com'],
    });
    expect(result).toEqual({ ok: true, provider: 'none' });
  });

  it('send handles html content in dev fallback without textFallback', async () => {
    const service = makeServiceNoProvider();
    const result = await service.send(
      htmlRequest({ content: { kind: 'html', html: '<p>Hello</p>' } }),
    );
    expect(result).toEqual({ ok: true, provider: 'none' });
  });

  // ── send — with Google provider ───────────────────────────────────────────

  it('send delegates to transporter and returns ok=true with messageId', async () => {
    process.env.GMAIL_USER = 'user@gmail.com';
    process.env.GMAIL_APP_PASSWORD = 'secret';
    process.env.NODE_ENV = 'test';
    const service = new EmailService();

    // Inject a mocked transporter
    const mockTransporter = {
      sendMail: jest.fn().mockResolvedValue({ messageId: 'msg-1' }),
      verify: jest.fn().mockResolvedValue(true),
    };
    (service as any).transporter = mockTransporter;
    (service as any).cfg = { ...(service as any).cfg, provider: 'google' };

    const result = await service.send(textRequest());

    expect(result).toEqual({
      ok: true,
      provider: 'google',
      messageId: 'msg-1',
    });
    expect(mockTransporter.sendMail).toHaveBeenCalledTimes(1);
  });

  it('send catches transporter errors and returns ok=false', async () => {
    const service = makeServiceNoProvider();
    const mockTransporter = {
      sendMail: jest.fn().mockRejectedValue(new Error('SMTP error')),
      verify: jest.fn(),
    };
    (service as any).transporter = mockTransporter;
    (service as any).cfg = { ...(service as any).cfg, provider: 'google' };

    const result = await service.send(textRequest());

    expect(result.ok).toBe(false);
    expect(result.error).toBe('SMTP error');
  });

  // ── testConnection ────────────────────────────────────────────────────────

  it('testConnection returns ok=true with provider=none in dev', async () => {
    const service = makeServiceNoProvider();
    const result = await service.testConnection();
    expect(result).toEqual({ ok: true, provider: 'none' });
  });

  it('testConnection returns ok=false with error in production when not configured', async () => {
    delete process.env.GMAIL_USER;
    delete process.env.GMAIL_APP_PASSWORD;
    process.env.NODE_ENV = 'production';
    const service = new EmailService();

    const result = await service.testConnection();

    expect(result.ok).toBe(false);
    expect(result.error).toBe('Not configured');
  });

  it('testConnection calls transporter.verify when provider=google', async () => {
    const service = makeServiceNoProvider();
    const mockTransporter = {
      sendMail: jest.fn(),
      verify: jest.fn().mockResolvedValue(true),
    };
    (service as any).transporter = mockTransporter;
    (service as any).cfg = { ...(service as any).cfg, provider: 'google' };

    const result = await service.testConnection();

    expect(mockTransporter.verify).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ ok: true, provider: 'google' });
  });

  it('testConnection returns ok=false when transporter.verify throws', async () => {
    const service = makeServiceNoProvider();
    const mockTransporter = {
      sendMail: jest.fn(),
      verify: jest.fn().mockRejectedValue(new Error('SMTP down')),
    };
    (service as any).transporter = mockTransporter;
    (service as any).cfg = { ...(service as any).cfg, provider: 'google' };

    const result = await service.testConnection();

    expect(result.ok).toBe(false);
    expect(result.error).toBe('SMTP down');
  });

  // ── sendVerificationCode ──────────────────────────────────────────────────

  it('sendVerificationCode delegates to sendTemplate with verification_code template', async () => {
    const service = makeServiceNoProvider();
    const sendTemplateSpy = jest
      .spyOn(service, 'sendTemplate')
      .mockResolvedValue({ ok: true, provider: 'none' });

    await service.sendVerificationCode('u@example.com', '123456', 'login');

    expect(sendTemplateSpy).toHaveBeenCalledWith(
      'u@example.com',
      SupportEmailTemplate.VERIFICATION_CODE,
      { code: '123456', purpose: 'login', expiresMinutes: 10 },
    );
  });

  it('sendVerificationCode defaults purpose to login', async () => {
    const service = makeServiceNoProvider();
    const sendTemplateSpy = jest
      .spyOn(service, 'sendTemplate')
      .mockResolvedValue({ ok: true, provider: 'none' });

    await service.sendVerificationCode('u@example.com', '999999');

    expect(sendTemplateSpy).toHaveBeenCalledWith(
      'u@example.com',
      SupportEmailTemplate.VERIFICATION_CODE,
      { code: '999999', purpose: 'login', expiresMinutes: 10 },
    );
  });

  // ── sendTemplate ──────────────────────────────────────────────────────────

  it('sendTemplate renders and sends via the send method', async () => {
    const service = makeServiceNoProvider();
    const sendSpy = jest
      .spyOn(service, 'send')
      .mockResolvedValue({ ok: true, provider: 'none' });

    await service.sendTemplate(
      'u@example.com',
      SupportEmailTemplate.VERIFICATION_CODE,
      { code: '111111', purpose: 'register', expiresMinutes: 15 },
    );

    expect(sendSpy).toHaveBeenCalledTimes(1);
    const callArg = sendSpy.mock.calls[0][0];
    expect(callArg.to).toBe('u@example.com');
    expect(callArg.content.kind).toBe('html');
  });
});
