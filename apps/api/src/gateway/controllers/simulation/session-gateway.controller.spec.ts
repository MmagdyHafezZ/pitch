import { HttpException, HttpStatus } from '@nestjs/common';
import type { ClientProxy } from '@nestjs/microservices';
import { of, throwError } from 'rxjs';
import { SessionGatewayController } from './session-gateway.controller';
import { SIMULATION_SERVICE_PATTERNS } from '@pitch/shared-backend/interfaces/message-patterns.interface';
import type { UserClaims } from '@pitch/shared-backend/interfaces/user-claims.interface';
import type { SessionService } from '@microservices/simulation/services/session.service';

describe('SessionGatewayController', () => {
  let controller: SessionGatewayController;
  let simulationService: jest.Mocked<ClientProxy>;
  let sessionService: jest.Mocked<SessionService>;

  const userClaims: UserClaims = {
    id: 'user-1',
    email: 'user@example.com',
    name: 'User',
  };

  beforeEach(() => {
    simulationService = {
      send: jest.fn(),
    } as unknown as jest.Mocked<ClientProxy>;

    sessionService = {
      restart: jest.fn(),
    } as unknown as jest.Mocked<SessionService>;

    controller = new SessionGatewayController(
      simulationService,
      sessionService,
    );
  });

  it('restarts a session through the simulation RPC handler when available', async () => {
    simulationService.send.mockReturnValue(
      of({
        id: 'session-1',
        status: 'active',
      }) as never,
    );

    const result = await controller.restartSession(
      'session-1',
      { reason: 'restart_from_scratch' },
      userClaims,
    );

    expect(simulationService.send).toHaveBeenCalledWith(
      SIMULATION_SERVICE_PATTERNS.RESTART_SESSION,
      {
        id: 'session-1',
        reason: 'restart_from_scratch',
        userClaims,
      },
    );
    expect(sessionService.restart).not.toHaveBeenCalled();
    expect(result).toEqual({
      id: 'session-1',
      status: 'active',
    });
  });

  it('falls back to the in-process session service when the RPC handler is missing', async () => {
    simulationService.send.mockReturnValue(
      throwError(() => ({
        status: 500,
        message:
          'There is no matching message handler defined in the remote service.',
      })) as never,
    );
    sessionService.restart.mockResolvedValue({
      id: 'session-1',
      status: 'active',
    } as never);

    const result = await controller.restartSession(
      'session-1',
      { reason: 'restart_from_scratch' },
      userClaims,
    );

    expect(sessionService.restart).toHaveBeenCalledWith(
      'session-1',
      { reason: 'restart_from_scratch' },
      'user-1',
    );
    expect(result).toEqual({
      id: 'session-1',
      status: 'active',
    });
  });

  it('still surfaces non-handler downstream errors as HTTP exceptions', async () => {
    simulationService.send.mockReturnValue(
      throwError(() => ({
        status: 404,
        message: 'Session not found',
      })) as never,
    );

    let thrown: HttpException | null = null;
    try {
      await controller.restartSession(
        'session-1',
        { reason: 'restart_from_scratch' },
        userClaims,
      );
    } catch (error) {
      thrown = error as HttpException;
    }

    expect(thrown).toBeInstanceOf(HttpException);
    expect(thrown?.message).toBe('Session not found');
    expect(thrown?.getStatus()).toBe(HttpStatus.NOT_FOUND);
    expect(sessionService.restart).not.toHaveBeenCalled();
  });
});
