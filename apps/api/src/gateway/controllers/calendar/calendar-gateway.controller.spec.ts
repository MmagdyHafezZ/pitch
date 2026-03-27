import { HttpException, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import type { ClientProxy } from '@nestjs/microservices';
import { lastValueFrom, of, throwError } from 'rxjs';
import { CalendarGatewayController } from './calendar-gateway.controller';

describe('CalendarGatewayController', () => {
  const createClientProxyMock = (): jest.Mocked<ClientProxy> =>
    ({
      send: jest.fn(),
    }) as unknown as jest.Mocked<ClientProxy>;

  let crmService: jest.Mocked<ClientProxy>;
  let simulationService: jest.Mocked<ClientProxy>;
  let controller: CalendarGatewayController;

  beforeEach(() => {
    crmService = createClientProxyMock();
    simulationService = createClientProxyMock();
    controller = new CalendarGatewayController(crmService, simulationService);
  });

  it('proxies google connect requests', async () => {
    crmService.send.mockReturnValueOnce(
      of({ authUrl: 'https://accounts.google.com' }) as any,
    );

    const result: unknown = await lastValueFrom(
      controller.getGoogleConnectUrl('user-1'),
    );

    expect(result).toEqual({ authUrl: 'https://accounts.google.com' });
    expect(crmService.send.mock.calls).toContainEqual([
      'calendar.google.connect',
      {
        userId: 'user-1',
      },
    ]);
  });

  it('maps google connect errors with numeric statusCode payloads', async () => {
    crmService.send.mockReturnValueOnce(
      throwError(() => ({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Google Calendar client ID not configured',
      })) as any,
    );

    let thrown: unknown;

    try {
      await lastValueFrom(controller.getGoogleConnectUrl('user-1'));
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(HttpException);
    expect((thrown as HttpException).getStatus()).toBe(HttpStatus.BAD_REQUEST);
    expect((thrown as HttpException).message).toBe(
      'Google Calendar client ID not configured',
    );
  });

  it('falls back to 500 when rpc error status is not numeric', async () => {
    crmService.send.mockReturnValueOnce(
      throwError(() => ({
        status: 'error',
        message: 'Internal server error',
      })) as any,
    );

    let thrown: unknown;

    try {
      await lastValueFrom(controller.getGoogleConnectUrl('user-1'));
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(HttpException);
    expect((thrown as HttpException).getStatus()).toBe(
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
    expect((thrown as HttpException).message).toBe('Internal server error');
  });

  it('returns HttpException instances for malformed rpc payloads', async () => {
    crmService.send.mockReturnValueOnce(
      throwError(() => ({
        status: 'error',
        message: 'Internal server error',
      })) as any,
    );

    await expect(
      lastValueFrom(controller.getGoogleConnectUrl('user-1')),
    ).rejects.toBeInstanceOf(HttpException);
  });

  it('redirects google callback to the frontend calendar page', async () => {
    crmService.send.mockReturnValueOnce(of({ success: true }) as any);
    const redirect = jest.fn();
    const res = {
      redirect,
    } as Pick<Response, 'redirect'> as Response;

    await controller.handleGoogleCallback('code-1', 'user-1', undefined, res);

    expect(redirect).toHaveBeenCalledWith(
      'http://localhost:3000/studio/calendar?connected=google',
    );
  });
});
