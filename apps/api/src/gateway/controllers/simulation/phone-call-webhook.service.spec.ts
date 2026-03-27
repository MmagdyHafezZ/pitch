/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { of, throwError } from 'rxjs';
import type { ClientProxy } from '@nestjs/microservices';
import { PhoneCallWebhookService } from './phone-call-webhook.service';

describe('PhoneCallWebhookService', () => {
  let service: PhoneCallWebhookService;
  let simulationService: jest.Mocked<Pick<ClientProxy, 'send'>>;
  let configService: { get: jest.Mock };

  beforeEach(() => {
    simulationService = {
      send: jest.fn(),
    };
    configService = {
      get: jest
        .fn()
        .mockReturnValue(
          'https://api.pitch.com/api/v1/simulation/phone-calls/twilio',
        ),
    };
    service = new PhoneCallWebhookService(
      simulationService as unknown as ClientProxy,
      configService as any,
    );
  });

  it('returns a failed TwiML response when session context is missing', async () => {
    const result = await service.processTwilioWebhook({}, {});

    expect(result).toMatchObject({
      status: 'failed',
      error: 'Missing session context',
    });
    expect(result.twiml).toContain('Missing session context');
    expect(simulationService.send).not.toHaveBeenCalled();
  });

  it('processes a Twilio webhook, trims speech, and builds the next action URL', async () => {
    simulationService.send.mockReturnValue(
      of({
        text: 'Hello & welcome',
      }) as ReturnType<ClientProxy['send']>,
    );

    const result = await service.processTwilioWebhook(
      {
        SpeechResult: '  I need help  ',
        CallSid: 'CA123',
      },
      {
        sessionId: 'session-1',
        userId: 'user-1',
      },
      {
        request: {
          protocol: 'http',
          forwardedProto: 'https',
          forwardedHost: 'admin.pitch.test',
          originalUrl:
            '/api/v1/simulation/phone-calls/twilio?sessionId=session-1&userId=user-1',
        },
      },
    );

    expect(result).toMatchObject({
      status: 'processed',
      sessionId: 'session-1',
      userId: 'user-1',
      replyText: 'Hello & welcome',
      actionUrl:
        'https://admin.pitch.test/api/v1/simulation/phone-calls/twilio?sessionId=session-1&userId=user-1',
      externalId: 'CA123',
    });
    expect(result.twiml).toContain('Hello &amp; welcome');
    expect(simulationService.send.mock.calls).toEqual([
      [
        'simulation.conversation.process',
        expect.objectContaining({
          sessionId: 'session-1',
          userId: 'user-1',
          payload: {
            text: 'I need help',
            startAsAssistant: false,
          },
        }),
      ],
    ]);
  });

  it('falls back to the assistant opener when no speech text is present', async () => {
    simulationService.send.mockReturnValue(
      of({}) as ReturnType<ClientProxy['send']>,
    );

    const result = await service.processTwilioWebhook(
      {},
      {
        sessionId: 'session-1',
        userId: 'user-1',
      },
    );

    expect(result.replyText).toBe('Thanks for sharing. How else can I help?');
    expect(simulationService.send.mock.calls).toEqual([
      [
        'simulation.conversation.process',
        expect.objectContaining({
          payload: {
            text: '',
            startAsAssistant: true,
          },
        }),
      ],
    ]);
  });

  it('returns an error TwiML response when conversation processing fails', async () => {
    simulationService.send.mockReturnValue(
      throwError(() => new Error('conversation failed')) as ReturnType<
        ClientProxy['send']
      >,
    );

    const result = await service.processTwilioWebhook(
      {},
      {
        sessionId: 'session-1',
        userId: 'user-1',
      },
    );

    expect(result).toMatchObject({
      status: 'failed',
      error: 'conversation failed',
      sessionId: 'session-1',
      userId: 'user-1',
    });
    expect(result.twiml).toContain(
      'Sorry, I ran into an issue processing that.',
    );
  });
});
