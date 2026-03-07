import { EmailRpcController } from '../../email/controllers/email.controller';
import { EmailService } from '../../email/services/email.service';
import { toRpcException } from '@pitch/shared-backend/helpers/exceptions';
import { RpcException } from '@nestjs/microservices';
import { SupportEmailTemplate } from '@pitch/shared-backend/interfaces/support-email.interface';

jest.mock('@pitch/shared-backend/helpers/exceptions', () => ({
  toRpcException: jest.fn(
    (error: unknown) =>
      new RpcException(error instanceof Error ? error.message : 'rpc-error'),
  ),
}));

describe('EmailRpcController', () => {
  type EmailServiceMock = {
    sendVerificationCode: jest.MockedFunction<
      EmailService['sendVerificationCode']
    >;
    sendTemplate: jest.MockedFunction<EmailService['sendTemplate']>;
  };

  const createEmailServiceMock = (): EmailServiceMock => ({
    sendVerificationCode: jest.fn() as jest.MockedFunction<
      EmailService['sendVerificationCode']
    >,
    sendTemplate: jest.fn() as jest.MockedFunction<
      EmailService['sendTemplate']
    >,
  });

  const toRpcExceptionMock = jest.mocked(toRpcException);

  beforeEach(() => {
    jest.clearAllMocks();
    toRpcExceptionMock.mockReset();
  });

  it('delegates verification code requests to email service', async () => {
    const emailService = createEmailServiceMock();
    emailService.sendVerificationCode.mockResolvedValue({
      ok: true,
      provider: 'none',
    });
    const controller = new EmailRpcController(
      emailService as unknown as EmailService,
    );

    await expect(
      controller.sendVerificationCode({
        email: 'user@example.com',
        code: '123456',
        purpose: 'register',
      }),
    ).resolves.toEqual({
      ok: true,
      provider: 'none',
    });

    expect(emailService.sendVerificationCode).toHaveBeenCalledWith(
      'user@example.com',
      '123456',
      'register',
    );
  });

  it('delegates template requests to email service', async () => {
    const emailService = createEmailServiceMock();
    emailService.sendTemplate.mockResolvedValue({
      ok: true,
      provider: 'google',
      messageId: 'message-1',
    });
    const controller = new EmailRpcController(
      emailService as unknown as EmailService,
    );

    await expect(
      controller.sendTemplate({
        to: 'new-user@example.com',
        template: SupportEmailTemplate.USER_SIGNUP_INVITE,
        data: {
          signupUrl: 'https://app.pitch.ai/signup?invite=abc123',
          teamName: 'Engineering',
          invitedByName: 'Admin User',
        },
      }),
    ).resolves.toEqual({
      ok: true,
      provider: 'google',
      messageId: 'message-1',
    });

    expect(emailService.sendTemplate).toHaveBeenCalledWith(
      'new-user@example.com',
      SupportEmailTemplate.USER_SIGNUP_INVITE,
      {
        signupUrl: 'https://app.pitch.ai/signup?invite=abc123',
        teamName: 'Engineering',
        invitedByName: 'Admin User',
      },
    );
  });

  it('wraps verification code errors via toRpcException', async () => {
    const emailService = createEmailServiceMock();
    const controller = new EmailRpcController(
      emailService as unknown as EmailService,
    );
    const error = new Error('failed');
    const rpcError = new RpcException('rpc-failed');

    emailService.sendVerificationCode.mockRejectedValue(error);
    toRpcExceptionMock.mockReturnValueOnce(rpcError as any);

    await expect(
      controller.sendVerificationCode({
        email: 'user@example.com',
        code: '123456',
      }),
    ).rejects.toThrow(rpcError);
    expect(toRpcExceptionMock).toHaveBeenCalledWith(error);
  });

  it('wraps template errors via toRpcException', async () => {
    const emailService = createEmailServiceMock();
    const controller = new EmailRpcController(
      emailService as unknown as EmailService,
    );
    const error = new Error('failed');
    const rpcError = new RpcException('rpc-failed');

    emailService.sendTemplate.mockRejectedValue(error);
    toRpcExceptionMock.mockReturnValueOnce(rpcError as any);

    await expect(
      controller.sendTemplate({
        to: 'new-user@example.com',
        template: SupportEmailTemplate.USER_SIGNUP_INVITE,
      }),
    ).rejects.toThrow(rpcError);
    expect(toRpcExceptionMock).toHaveBeenCalledWith(error);
  });
});
