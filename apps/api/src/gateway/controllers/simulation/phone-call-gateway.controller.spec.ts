import { HttpException, HttpStatus } from '@nestjs/common';
import type { ClientProxy } from '@nestjs/microservices';
import { of, throwError } from 'rxjs';
import { PhoneCallGatewayController } from './phone-call-gateway.controller';
import {
  SIMULATION_SERVICE_PATTERNS,
  USER_SERVICE_PATTERNS,
} from '@pitch/shared-backend/interfaces/message-patterns.interface';
import type { UserClaims } from '@pitch/shared-backend/interfaces/user-claims.interface';

describe('PhoneCallGatewayController', () => {
  let controller: PhoneCallGatewayController;
  let simulationService: jest.Mocked<ClientProxy>;
  let userService: jest.Mocked<ClientProxy>;
  let simulationSend: jest.Mock;
  let userSend: jest.Mock;

  const userClaims: UserClaims = {
    id: 'user-1',
    email: 'user@example.com',
    name: 'User',
  };

  beforeEach(() => {
    simulationSend = jest.fn();
    userSend = jest.fn();
    simulationService = {
      send: simulationSend,
    } as unknown as jest.Mocked<ClientProxy>;
    userService = {
      send: userSend,
    } as unknown as jest.Mocked<ClientProxy>;

    controller = new PhoneCallGatewayController(simulationService, userService);
  });

  it('starts a Vapi phone call for a verified user', async () => {
    userService.send.mockReturnValue(
      of({
        verified: true,
        phoneNumber: '+15551234567',
      }) as never,
    );
    simulationService.send.mockReturnValue(
      of({
        callId: 'call-1',
        provider: 'vapi',
        sessionId: 'session-1',
      }) as never,
    );

    const result = await controller.startCall(
      { sessionId: 'session-1' },
      userClaims,
    );

    expect(userSend).toHaveBeenCalledWith(
      USER_SERVICE_PATTERNS.GET_MY_PHONE_VERIFICATION,
      { userClaims },
    );
    expect(simulationSend).toHaveBeenCalledWith(
      SIMULATION_SERVICE_PATTERNS.PHONE_CALL_START,
      {
        sessionId: 'session-1',
        phoneNumber: '+15551234567',
        userClaims,
      },
    );
    expect(result).toEqual({
      callId: 'call-1',
      provider: 'vapi',
      sessionId: 'session-1',
    });
  });

  it('forwards an optional firstMessage to the simulation service', async () => {
    userService.send.mockReturnValue(
      of({
        verified: true,
        phoneNumber: '+15551234567',
      }) as never,
    );
    simulationService.send.mockReturnValue(
      of({
        callId: 'call-1',
        provider: 'vapi',
        sessionId: 'session-1',
      }) as never,
    );

    await controller.startCall(
      {
        sessionId: 'session-1',
        firstMessage: 'Hello, this is your verification call.',
      },
      userClaims,
    );

    expect(simulationSend).toHaveBeenCalledWith(
      SIMULATION_SERVICE_PATTERNS.PHONE_CALL_START,
      {
        sessionId: 'session-1',
        firstMessage: 'Hello, this is your verification call.',
        phoneNumber: '+15551234567',
        userClaims,
      },
    );
  });

  it('starts a call with a temporarily verified phone number when explicitly requested', async () => {
    userService.send.mockReturnValue(
      of({
        verified: false,
        phoneNumber: null,
        temporaryVerifiedPhoneNumber: '+15557654321',
      }) as never,
    );
    simulationService.send.mockReturnValue(
      of({
        callId: 'call-1',
        provider: 'vapi',
        sessionId: 'session-1',
      }) as never,
    );

    const result = await controller.startCall(
      {
        sessionId: 'session-1',
        phoneNumber: '+15557654321',
      },
      userClaims,
    );

    expect(simulationSend).toHaveBeenCalledWith(
      SIMULATION_SERVICE_PATTERNS.PHONE_CALL_START,
      {
        sessionId: 'session-1',
        phoneNumber: '+15557654321',
        userClaims,
      },
    );
    expect(result).toEqual({
      callId: 'call-1',
      provider: 'vapi',
      sessionId: 'session-1',
    });
  });

  it('defaults to a temporarily verified phone number when no explicit number is provided', async () => {
    userService.send.mockReturnValue(
      of({
        verified: false,
        phoneNumber: null,
        temporaryVerifiedPhoneNumber: '+15557654321',
      }) as never,
    );
    simulationService.send.mockReturnValue(
      of({
        callId: 'call-1',
        provider: 'vapi',
        sessionId: 'session-1',
      }) as never,
    );

    const result = await controller.startCall(
      {
        sessionId: 'session-1',
      },
      userClaims,
    );

    expect(simulationSend).toHaveBeenCalledWith(
      SIMULATION_SERVICE_PATTERNS.PHONE_CALL_START,
      {
        sessionId: 'session-1',
        phoneNumber: '+15557654321',
        userClaims,
      },
    );
    expect(result).toEqual({
      callId: 'call-1',
      provider: 'vapi',
      sessionId: 'session-1',
    });
  });

  it('trims a requested verified phone number before forwarding it', async () => {
    userService.send.mockReturnValue(
      of({
        verified: true,
        phoneNumber: '+15551234567',
      }) as never,
    );
    simulationService.send.mockReturnValue(
      of({
        callId: 'call-1',
        provider: 'vapi',
        sessionId: 'session-1',
      }) as never,
    );

    await controller.startCall(
      {
        sessionId: 'session-1',
        phoneNumber: '  +15551234567  ',
      },
      userClaims,
    );

    expect(simulationSend).toHaveBeenCalledWith(
      SIMULATION_SERVICE_PATTERNS.PHONE_CALL_START,
      {
        sessionId: 'session-1',
        phoneNumber: '+15551234567',
        userClaims,
      },
    );
  });

  it('rejects unverified users before contacting simulation service', async () => {
    userService.send.mockReturnValue(
      of({
        verified: false,
        phoneNumber: null,
      }) as never,
    );

    let thrown: HttpException | null = null;
    try {
      await controller.startCall({ sessionId: 'session-1' }, userClaims);
    } catch (error) {
      thrown = error as HttpException;
    }

    expect(thrown).toBeInstanceOf(HttpException);
    expect(thrown?.message).toBe(
      'Verify your phone number before starting a phone call.',
    );
    expect(thrown?.getStatus()).toBe(HttpStatus.FORBIDDEN);
    expect(simulationSend).not.toHaveBeenCalled();
  });

  it('rejects users whose verification state is marked verified but has no stored number', async () => {
    userService.send.mockReturnValue(
      of({
        verified: true,
        phoneNumber: null,
      }) as never,
    );

    await expect(
      controller.startCall({ sessionId: 'session-1' }, userClaims),
    ).rejects.toThrow('Verify your phone number before starting a phone call.');

    expect(simulationSend).not.toHaveBeenCalled();
  });

  it('rejects a requested phone number that is not verified for the user', async () => {
    userService.send.mockReturnValue(
      of({
        verified: true,
        phoneNumber: '+15551234567',
        temporaryVerifiedPhoneNumber: '+15557654321',
      }) as never,
    );

    await expect(
      controller.startCall(
        { sessionId: 'session-1', phoneNumber: '+15550000000' },
        userClaims,
      ),
    ).rejects.toThrow('Verify your phone number before starting a phone call.');

    expect(simulationSend).not.toHaveBeenCalled();
  });

  it('normalizes downstream simulation errors into HTTP exceptions', async () => {
    userService.send.mockReturnValue(
      of({
        verified: true,
        phoneNumber: '+15551234567',
      }) as never,
    );
    simulationService.send.mockReturnValue(
      throwError(() => ({
        status: 503,
        message: 'Vapi unavailable',
      })) as never,
    );

    let thrown: HttpException | null = null;
    try {
      await controller.startCall({ sessionId: 'session-1' }, userClaims);
    } catch (error) {
      thrown = error as HttpException;
    }

    expect(thrown).toBeInstanceOf(HttpException);
    expect(thrown?.message).toBe('Vapi unavailable');
    expect(thrown?.getStatus()).toBe(503);
  });

  it('ends an active phone call through the simulation service', async () => {
    simulationService.send.mockReturnValue(
      of({
        ok: true,
        sessionId: 'session-1',
        provider: 'vapi',
        callId: 'call-1',
      }) as never,
    );

    const result = await controller.endCall(
      {
        sessionId: 'session-1',
        reason: 'user_requested_hangup',
      },
      userClaims,
    );

    expect(simulationSend).toHaveBeenCalledWith(
      SIMULATION_SERVICE_PATTERNS.PHONE_CALL_END,
      {
        sessionId: 'session-1',
        reason: 'user_requested_hangup',
        userClaims,
      },
    );
    expect(result).toEqual({
      ok: true,
      sessionId: 'session-1',
      provider: 'vapi',
      callId: 'call-1',
    });
  });

  it('normalizes downstream phone hangup errors into HTTP exceptions', async () => {
    simulationService.send.mockReturnValue(
      throwError(() => ({
        status: 409,
        message: 'No active phone call is registered.',
      })) as never,
    );

    let thrown: HttpException | null = null;
    try {
      await controller.endCall(
        {
          sessionId: 'session-1',
          reason: 'user_requested_hangup',
        },
        userClaims,
      );
    } catch (error) {
      thrown = error as HttpException;
    }

    expect(thrown).toBeInstanceOf(HttpException);
    expect(thrown?.message).toBe('No active phone call is registered.');
    expect(thrown?.getStatus()).toBe(409);
  });
});
