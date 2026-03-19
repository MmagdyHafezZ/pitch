/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/unbound-method */
import { HttpException, HttpStatus } from '@nestjs/common';
import type { ClientProxy } from '@nestjs/microservices';
import { of } from 'rxjs';
import { lastValueFrom } from 'rxjs';
import { USER_SERVICE_PATTERNS } from '@pitch/shared-backend/interfaces/message-patterns.interface';
import type { UserClaims } from '@pitch/shared-backend/interfaces/user-claims.interface';
import { UserGatewayController } from './user-gateway.controller';

describe('UserGatewayController', () => {
  let controller: UserGatewayController;
  let clientProxy: jest.Mocked<ClientProxy>;

  const userClaims: UserClaims = {
    id: 'user-1',
    email: 'user@example.com',
    name: 'User',
  };

  beforeEach(() => {
    clientProxy = {
      send: jest.fn(),
    } as unknown as jest.Mocked<ClientProxy>;

    controller = new UserGatewayController(clientProxy);
  });

  it('gets current user settings', async () => {
    clientProxy.send.mockReturnValue(
      of({ appearance: { colorMode: 'dark' } }) as any,
    );

    const result = await lastValueFrom(controller.getMySettings(userClaims));

    expect(result).toEqual({ appearance: { colorMode: 'dark' } });
    expect(clientProxy.send).toHaveBeenCalledWith(
      USER_SERVICE_PATTERNS.GET_MY_SETTINGS,
      { userClaims },
    );
  });

  it('updates current user settings from wrapped payload', async () => {
    clientProxy.send.mockReturnValue(
      of({ browser: { compactMode: true } }) as any,
    );

    const result = await lastValueFrom(
      controller.updateMySettings(
        { settings: { browser: { compactMode: true } } } as any,
        userClaims,
      ),
    );

    expect(result).toEqual({ browser: { compactMode: true } });
    expect(clientProxy.send).toHaveBeenCalledWith(
      USER_SERVICE_PATTERNS.UPDATE_MY_SETTINGS,
      {
        settings: { browser: { compactMode: true } },
        userClaims,
      },
    );
  });

  it('updates current user settings from raw payload', async () => {
    clientProxy.send.mockReturnValue(
      of({ language: { locale: 'English (US)' } }) as any,
    );

    await lastValueFrom(
      controller.updateMySettings(
        { language: { locale: 'English (US)' } } as any,
        userClaims,
      ),
    );

    expect(clientProxy.send).toHaveBeenCalledWith(
      USER_SERVICE_PATTERNS.UPDATE_MY_SETTINGS,
      {
        settings: { language: { locale: 'English (US)' } },
        userClaims,
      },
    );
  });

  it('gets current user phone verification status', async () => {
    clientProxy.send.mockReturnValue(
      of({ verified: false, pendingPhoneNumber: '+15551234567' }) as any,
    );

    const result = await lastValueFrom(
      controller.getMyPhoneVerification(userClaims),
    );

    expect(result).toEqual({
      verified: false,
      pendingPhoneNumber: '+15551234567',
    });
    expect(clientProxy.send).toHaveBeenCalledWith(
      USER_SERVICE_PATTERNS.GET_MY_PHONE_VERIFICATION,
      { userClaims },
    );
  });

  it('requests phone verification', async () => {
    clientProxy.send.mockReturnValue(
      of({ verified: false, pendingPhoneNumber: '+15551234567' }) as any,
    );

    const result = await lastValueFrom(
      controller.requestPhoneVerification(
        { phoneNumber: '+15551234567' },
        userClaims,
      ),
    );

    expect(result).toEqual({
      verified: false,
      pendingPhoneNumber: '+15551234567',
    });
    expect(clientProxy.send).toHaveBeenCalledWith(
      USER_SERVICE_PATTERNS.REQUEST_PHONE_VERIFICATION,
      {
        phoneNumber: '+15551234567',
        userClaims,
      },
    );
  });

  it('resends phone verification', async () => {
    clientProxy.send.mockReturnValue(
      of({ verified: false, pendingPhoneNumber: '+15551234567' }) as any,
    );

    const result = await lastValueFrom(
      controller.resendPhoneVerification(userClaims),
    );

    expect(result).toEqual({
      verified: false,
      pendingPhoneNumber: '+15551234567',
    });
    expect(clientProxy.send).toHaveBeenCalledWith(
      USER_SERVICE_PATTERNS.RESEND_PHONE_VERIFICATION,
      { userClaims },
    );
  });

  it('verifies a phone verification code', async () => {
    clientProxy.send.mockReturnValue(
      of({ verified: true, phoneNumber: '+15551234567' }) as any,
    );

    const result = await lastValueFrom(
      controller.verifyPhoneVerification(
        { code: '123456', saveForFutureUse: false },
        userClaims,
      ),
    );

    expect(result).toEqual({
      verified: true,
      phoneNumber: '+15551234567',
    });
    expect(clientProxy.send).toHaveBeenCalledWith(
      USER_SERVICE_PATTERNS.VERIFY_PHONE_VERIFICATION,
      {
        code: '123456',
        saveForFutureUse: false,
        userClaims,
      },
    );
  });

  it('updates avatar using avatarUrl', async () => {
    clientProxy.send.mockReturnValue(
      of({ avatar: 'https://cdn.example/avatar.png' }) as any,
    );

    const result = await lastValueFrom(
      controller.updateMyAvatar(
        undefined,
        { avatarUrl: 'https://cdn.example/avatar.png' },
        userClaims,
      ),
    );

    expect(result).toEqual({ avatar: 'https://cdn.example/avatar.png' });
    expect(clientProxy.send).toHaveBeenCalledWith(
      USER_SERVICE_PATTERNS.UPDATE_USER,
      {
        userId: 'user-1',
        avatar: 'https://cdn.example/avatar.png',
        userClaims,
      },
    );
  });

  it('updates avatar using uploaded file and encodes as data URL', async () => {
    clientProxy.send.mockReturnValue(of({ avatar: 'ok' }) as any);
    const file = {
      mimetype: 'image/png',
      buffer: Buffer.from('avatar-bytes'),
    };

    await lastValueFrom(controller.updateMyAvatar(file, {}, userClaims));

    expect(clientProxy.send).toHaveBeenCalledWith(
      USER_SERVICE_PATTERNS.UPDATE_USER,
      {
        userId: 'user-1',
        avatar: `data:image/png;base64,${Buffer.from('avatar-bytes').toString('base64')}`,
        userClaims,
      },
    );
  });

  it('rejects unsupported avatar upload mime types', () => {
    expect(() =>
      controller.updateMyAvatar(
        { mimetype: 'text/plain', buffer: Buffer.from('x') },
        {},
        userClaims,
      ),
    ).toThrow(
      new HttpException(
        'Invalid image type. Allowed: jpeg, png, webp, gif',
        HttpStatus.BAD_REQUEST,
      ),
    );
    expect(clientProxy.send).not.toHaveBeenCalled();
  });

  it('rejects missing avatar payload', () => {
    expect(() => controller.updateMyAvatar(undefined, {}, userClaims)).toThrow(
      new HttpException(
        'Provide an image file (`file`) or an `avatarUrl`',
        HttpStatus.BAD_REQUEST,
      ),
    );
    expect(clientProxy.send).not.toHaveBeenCalled();
  });
});
