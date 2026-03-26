/* eslint-disable */
import { BadRequestException, HttpStatus } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { CalendarController } from './calendar.controller';

describe('CalendarController', () => {
  const createController = () => {
    const googleCalendar = {
      getConnectUrl: jest.fn(),
      handleCallback: jest.fn(),
      getStatus: jest.fn(),
      disconnect: jest.fn(),
      getEvents: jest.fn(),
    };
    const microsoftCalendar = {
      getConnectUrl: jest.fn(),
      handleCallback: jest.fn(),
      getStatus: jest.fn(),
      disconnect: jest.fn(),
      getEvents: jest.fn(),
    };
    const calendarQuery = {
      getUpcomingForUser: jest.fn(),
      listAllConnectedUsers: jest.fn(),
    };

    const controller = new CalendarController(
      googleCalendar as any,
      microsoftCalendar as any,
      calendarQuery as any,
    );

    return { controller, googleCalendar, microsoftCalendar, calendarQuery };
  };

  it('wraps google connect errors with RpcException', () => {
    const { controller, googleCalendar } = createController();
    googleCalendar.getConnectUrl.mockImplementation(() => {
      throw new BadRequestException('Google Calendar client ID not configured');
    });

    let thrown: unknown;

    try {
      controller.googleConnect({ userId: 'user-1' });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(RpcException);
    expect((thrown as RpcException).getError()).toEqual({
      message: 'Google Calendar client ID not configured',
      status: HttpStatus.BAD_REQUEST,
      code: undefined,
    });
  });
});
