/* eslint-disable */
import { of } from 'rxjs';
import { CalendarSyncSchedulerService } from './calendar-sync-scheduler.service';
import {
  CRM_SERVICE_PATTERNS,
  USER_SERVICE_PATTERNS,
} from '@pitch/shared-backend/interfaces/message-patterns.interface';
import type { ClientProxy } from '@nestjs/microservices';

describe('CalendarSyncSchedulerService', () => {
  const createClientProxyMock = (): jest.Mocked<ClientProxy> =>
    ({
      send: jest.fn(),
      emit: jest.fn(),
    }) as unknown as jest.Mocked<ClientProxy>;

  it('syncs connected users locally instead of emitting an unmapped CRM event', async () => {
    const crmClient = createClientProxyMock();
    const simulationClient = createClientProxyMock();
    const userClient = createClientProxyMock();
    crmClient.send.mockReturnValueOnce(
      of([
        { userId: 'user-1', providers: ['google'] },
        { userId: 'user-2', providers: ['microsoft'] },
      ]),
    );

    const service = new CalendarSyncSchedulerService(
      crmClient,
      simulationClient,
      userClient,
    );
    const syncUserCalendarSpy = jest
      .spyOn(service, 'syncUserCalendar')
      .mockResolvedValue(undefined);

    await service.syncCalendarEvents();

    expect(crmClient.send).toHaveBeenCalledWith(
      CRM_SERVICE_PATTERNS.CALENDAR_LIST_ALL_CONNECTED,
      {},
    );
    expect(syncUserCalendarSpy).toHaveBeenNthCalledWith(1, {
      userId: 'user-1',
      providers: ['google'],
    });
    expect(syncUserCalendarSpy).toHaveBeenNthCalledWith(2, {
      userId: 'user-2',
      providers: ['microsoft'],
    });
    expect(crmClient.emit).not.toHaveBeenCalled();
  });

  it('creates a session for events without an existing linked session', async () => {
    const crmClient = createClientProxyMock();
    const simulationClient = createClientProxyMock();
    const userClient = createClientProxyMock();

    userClient.send.mockReturnValueOnce(
      of({
        settings: {
          calendar: {
            mode: 'auto',
            lookAheadDays: 3,
            defaultSessionType: 'voice',
          },
        },
      }),
    );
    crmClient.send.mockReturnValueOnce(
      of([
        {
          id: 'event-1',
          title: 'Discovery Call',
          start: new Date().toISOString(),
          end: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        },
      ]),
    );
    simulationClient.send.mockReturnValueOnce(of(null));
    simulationClient.emit.mockReturnValueOnce(of(undefined));

    const service = new CalendarSyncSchedulerService(
      crmClient,
      simulationClient,
      userClient,
    );

    await service.syncUserCalendar({
      userId: 'user-1',
      providers: ['google'],
    });

    expect(userClient.send).toHaveBeenCalledWith(
      USER_SERVICE_PATTERNS.GET_MY_SETTINGS,
      { userId: 'user-1' },
    );
    expect(crmClient.send).toHaveBeenCalledWith(
      CRM_SERVICE_PATTERNS.CALENDAR_GET_UPCOMING,
      {
        userId: 'user-1',
        lookAheadDays: 3,
      },
    );
    expect(simulationClient.send).toHaveBeenCalledWith(
      'simulation.session.findByCalendarEvent',
      {
        calendarEventId: 'event-1',
        userId: 'user-1',
      },
    );
    expect(simulationClient.emit).toHaveBeenCalledWith(
      'simulation.calendar.session.createFromEvent',
      expect.objectContaining({
        userId: 'user-1',
        orgId: 'user-1',
        mode: 'auto',
        sessionType: 'voice',
      }),
    );
  });
});
