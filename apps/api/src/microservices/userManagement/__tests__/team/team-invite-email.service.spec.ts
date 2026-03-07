import { InternalServerErrorException } from '@nestjs/common';
import type { ClientProxy } from '@nestjs/microservices';
import { of, throwError } from 'rxjs';
import { SUPPORT_SERVICE_PATTERNS } from '@pitch/shared-backend/interfaces/message-patterns.interface';
import { SupportEmailTemplate } from '@pitch/shared-backend/interfaces/support-email.interface';
import { TeamInviteEmailService } from '../../team/services/team-invite-email.service';

describe('TeamInviteEmailService', () => {
  const createClientProxyMock = (): jest.Mocked<ClientProxy> =>
    ({
      send: jest.fn(),
    }) as unknown as jest.Mocked<ClientProxy>;

  it('dispatches signup invite via support template pattern', async () => {
    const client = createClientProxyMock();
    client.send.mockReturnValueOnce(
      of({
        ok: true,
        provider: 'none',
      }),
    );

    const service = new TeamInviteEmailService(client);

    await expect(
      service.sendSignupInvite({
        email: 'new-user@example.com',
        signupUrl: 'https://app.pitch.ai/signup?invite=abc123',
        invitedByName: 'Admin User',
        teamName: 'Engineering',
      }),
    ).resolves.toBeUndefined();

    expect(client.send).toHaveBeenCalledWith(
      SUPPORT_SERVICE_PATTERNS.EMAIL_SEND_TEMPLATE,
      {
        to: 'new-user@example.com',
        template: SupportEmailTemplate.USER_SIGNUP_INVITE,
        data: {
          signupUrl: 'https://app.pitch.ai/signup?invite=abc123',
          invitedByName: 'Admin User',
          teamName: 'Engineering',
        },
      },
    );
  });

  it('throws internal server error when support call fails', async () => {
    const client = createClientProxyMock();
    client.send.mockReturnValueOnce(throwError(() => new Error('rmq down')));

    const service = new TeamInviteEmailService(client);
    const promise = service.sendSignupInvite({
      email: 'new-user@example.com',
    });

    await expect(promise).rejects.toThrow(InternalServerErrorException);
    await expect(promise).rejects.toThrow('Failed to send signup invite email');
  });

  it('throws internal server error when support service returns ok=false', async () => {
    const client = createClientProxyMock();
    client.send.mockReturnValueOnce(
      of({
        ok: false,
        provider: 'google',
        error: 'SMTP disabled',
      }),
    );

    const service = new TeamInviteEmailService(client);
    const promise = service.sendSignupInvite({
      email: 'new-user@example.com',
    });

    await expect(promise).rejects.toThrow(InternalServerErrorException);
    await expect(promise).rejects.toThrow('SMTP disabled');
  });
});
