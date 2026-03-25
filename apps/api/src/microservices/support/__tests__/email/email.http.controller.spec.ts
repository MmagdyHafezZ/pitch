import { EmailHttpController } from '../../email/http-controllers/email.http.controller';
import { EmailService } from '../../email/services/email.service';
import { SupportEmailTemplate } from '@pitch/shared-backend/interfaces/support-email.interface';

describe('EmailHttpController', () => {
  type EmailServiceMock = {
    sendVerificationCode: jest.MockedFunction<
      EmailService['sendVerificationCode']
    >;
    sendTemplate: jest.MockedFunction<EmailService['sendTemplate']>;
    send: jest.MockedFunction<EmailService['send']>;
  };

  const createEmailServiceMock = (): EmailServiceMock => ({
    sendVerificationCode: jest.fn(),
    sendTemplate: jest.fn(),
    send: jest.fn(),
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── sendVerificationCode ───────────────────────────────────────────────────

  it('delegates verification code request to email service', async () => {
    const emailService = createEmailServiceMock();
    emailService.sendVerificationCode.mockResolvedValue({
      ok: true,
      provider: 'none',
    });
    const controller = new EmailHttpController(
      emailService as unknown as EmailService,
    );

    const result = await controller.sendVerificationCode({
      email: 'user@example.com',
      code: '123456',
      purpose: 'login',
    });

    expect(result).toEqual({ ok: true, provider: 'none' });
    expect(emailService.sendVerificationCode).toHaveBeenCalledWith(
      'user@example.com',
      '123456',
      'login',
    );
  });

  it('passes undefined purpose when not provided in dto', async () => {
    const emailService = createEmailServiceMock();
    emailService.sendVerificationCode.mockResolvedValue({
      ok: true,
      provider: 'none',
    });
    const controller = new EmailHttpController(
      emailService as unknown as EmailService,
    );

    await controller.sendVerificationCode({
      email: 'user@example.com',
      code: '654321',
    } as any);

    expect(emailService.sendVerificationCode).toHaveBeenCalledWith(
      'user@example.com',
      '654321',
      undefined,
    );
  });

  it('rethrows errors from sendVerificationCode', async () => {
    const emailService = createEmailServiceMock();
    const error = new Error('Service failure');
    emailService.sendVerificationCode.mockRejectedValue(error);
    const controller = new EmailHttpController(
      emailService as unknown as EmailService,
    );

    await expect(
      controller.sendVerificationCode({
        email: 'u@e.com',
        code: '000000',
      }),
    ).rejects.toThrow(error);
  });

  // ── sendTemplate ───────────────────────────────────────────────────────────

  it('delegates template request to email service', async () => {
    const emailService = createEmailServiceMock();
    emailService.sendTemplate.mockResolvedValue({
      ok: true,
      provider: 'google',
      messageId: 'msg-1',
    });
    const controller = new EmailHttpController(
      emailService as unknown as EmailService,
    );

    const result = await controller.sendTemplate({
      to: 'new-user@example.com',
      template: SupportEmailTemplate.USER_SIGNUP_INVITE,
      data: {
        signupUrl: 'https://app.pitch.ai/signup?invite=abc',
        teamName: 'Engineering',
      },
    });

    expect(result).toEqual({
      ok: true,
      provider: 'google',
      messageId: 'msg-1',
    });
    expect(emailService.sendTemplate).toHaveBeenCalledWith(
      'new-user@example.com',
      SupportEmailTemplate.USER_SIGNUP_INVITE,
      {
        signupUrl: 'https://app.pitch.ai/signup?invite=abc',
        teamName: 'Engineering',
      },
    );
  });

  it('rethrows errors from sendTemplate', async () => {
    const emailService = createEmailServiceMock();
    const error = new Error('Template failure');
    emailService.sendTemplate.mockRejectedValue(error);
    const controller = new EmailHttpController(
      emailService as unknown as EmailService,
    );

    await expect(
      controller.sendTemplate({
        to: 'u@e.com',
        template: SupportEmailTemplate.VERIFICATION_CODE,
      }),
    ).rejects.toThrow(error);
  });

  // ── send (generic) ─────────────────────────────────────────────────────────

  it('delegates a text email request to email service', async () => {
    const emailService = createEmailServiceMock();
    emailService.send.mockResolvedValue({ ok: true, provider: 'none' });
    const controller = new EmailHttpController(
      emailService as unknown as EmailService,
    );

    const result = await controller.send({
      to: 'u@example.com',
      subject: 'Test subject',
      content: { kind: 'text', text: 'Hello world' },
    });

    expect(result).toEqual({ ok: true, provider: 'none' });
    expect(emailService.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'u@example.com',
        subject: 'Test subject',
        content: { kind: 'text', text: 'Hello world' },
      }),
    );
  });

  it('delegates an html email request to email service', async () => {
    const emailService = createEmailServiceMock();
    emailService.send.mockResolvedValue({
      ok: true,
      provider: 'google',
      messageId: 'msg-2',
    });
    const controller = new EmailHttpController(
      emailService as unknown as EmailService,
    );

    const result = await controller.send({
      to: 'u@example.com',
      subject: 'HTML Subject',
      content: { kind: 'html', html: '<p>Hi</p>', textFallback: 'Hi' },
    });

    expect(result).toEqual({
      ok: true,
      provider: 'google',
      messageId: 'msg-2',
    });
    expect(emailService.send).toHaveBeenCalledWith(
      expect.objectContaining({
        content: { kind: 'html', html: '<p>Hi</p>', textFallback: 'Hi' },
      }),
    );
  });

  it('passes from override when present in dto', async () => {
    const emailService = createEmailServiceMock();
    emailService.send.mockResolvedValue({ ok: true, provider: 'none' });
    const controller = new EmailHttpController(
      emailService as unknown as EmailService,
    );

    await controller.send({
      to: 'u@example.com',
      subject: 'Subject',
      content: { kind: 'text', text: 'Body' },
      from: { name: 'Admin', address: 'admin@pitch.ai' },
    });

    expect(emailService.send).toHaveBeenCalledWith(
      expect.objectContaining({
        from: { name: 'Admin', address: 'admin@pitch.ai' },
      }),
    );
  });

  it('sets from to undefined when not provided in dto', async () => {
    const emailService = createEmailServiceMock();
    emailService.send.mockResolvedValue({ ok: true, provider: 'none' });
    const controller = new EmailHttpController(
      emailService as unknown as EmailService,
    );

    await controller.send({
      to: 'u@example.com',
      subject: 'Subject',
      content: { kind: 'text', text: 'Body' },
    });

    expect(emailService.send).toHaveBeenCalledWith(
      expect.objectContaining({ from: undefined }),
    );
  });

  it('rethrows errors from send', async () => {
    const emailService = createEmailServiceMock();
    const error = new Error('Send failure');
    emailService.send.mockRejectedValue(error);
    const controller = new EmailHttpController(
      emailService as unknown as EmailService,
    );

    await expect(
      controller.send({
        to: 'u@example.com',
        subject: 'Subject',
        content: { kind: 'text', text: 'Body' },
      }),
    ).rejects.toThrow(error);
  });

  it('handles array recipient in send', async () => {
    const emailService = createEmailServiceMock();
    emailService.send.mockResolvedValue({ ok: true, provider: 'none' });
    const controller = new EmailHttpController(
      emailService as unknown as EmailService,
    );

    await controller.send({
      to: ['a@example.com', 'b@example.com'],
      subject: 'Multi recipient',
      content: { kind: 'text', text: 'Hello' },
    });

    expect(emailService.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: ['a@example.com', 'b@example.com'] }),
    );
  });
});
