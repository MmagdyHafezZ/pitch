import { PhoneCallWebhookController } from './phone-call-webhook.controller';
import type { VapiContextService } from '@microservices/simulation/phone/vapi-context.service';
import type { PhoneCallService } from '@microservices/simulation/phone/phone-call.service';
import type { SessionService } from '@microservices/simulation/services/session.service';

describe('PhoneCallWebhookController', () => {
  let controller: PhoneCallWebhookController;
  let vapiContext: jest.Mocked<VapiContextService>;
  let sessionService: jest.Mocked<SessionService>;
  let phoneCallService: jest.Mocked<PhoneCallService>;

  beforeEach(() => {
    vapiContext = {
      verifyToken: jest.fn().mockReturnValue({
        sessionId: 'session-1',
        userId: 'user-1',
        purpose: 'phone-call',
        iat: 1,
        exp: 2,
      }),
    } as unknown as jest.Mocked<VapiContextService>;

    sessionService = {
      end: jest.fn(),
    } as unknown as jest.Mocked<SessionService>;

    phoneCallService = {
      synthesizePhoneCallAudio: jest.fn(),
      syncPhoneCallRuntimeFromWebhook: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<PhoneCallService>;

    controller = new PhoneCallWebhookController(
      vapiContext,
      sessionService,
      phoneCallService,
    );
  });

  it('returns PCM audio for Vapi voice requests', async () => {
    const audioBuffer = Buffer.from([1, 2, 3, 4]);
    phoneCallService.synthesizePhoneCallAudio.mockResolvedValue({
      audioBuffer,
      contentType: 'audio/pcm;rate=24000;channels=1',
    });

    const res = {
      setHeader: jest.fn(),
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };

    await controller.handleVapiVoiceRequest(
      'signed-token',
      {
        type: 'voice-request',
        text: 'Hello from PITCH.',
        sampleRate: 24000,
      },
      res as any,
    );

    expect(phoneCallService.synthesizePhoneCallAudio).toHaveBeenCalledWith({
      sessionId: 'session-1',
      userId: 'user-1',
      text: 'Hello from PITCH.',
      sampleRate: 24000,
    });
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'application/octet-stream',
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith(audioBuffer);
  });

  it('returns ok for transcript events without ending the session', async () => {
    const response = await controller.handleVapiServerEvent('signed-token', {
      message: {
        type: 'transcript',
        transcript: 'Verification successful.',
      },
    });

    expect(vapiContext.verifyToken).toHaveBeenCalledWith('signed-token');
    expect(
      phoneCallService.syncPhoneCallRuntimeFromWebhook,
    ).not.toHaveBeenCalled();
    expect(sessionService.end).not.toHaveBeenCalled();
    expect(response).toEqual({ ok: true });
  });

  it('ends the session when Vapi sends an end-of-call report', async () => {
    sessionService.end.mockResolvedValue({ id: 'session-1' } as never);

    const response = await controller.handleVapiServerEvent('signed-token', {
      message: {
        type: 'end-of-call-report',
        endedReason: 'assistant-ended-call',
      },
    });

    expect(sessionService.end).toHaveBeenCalledWith(
      'session-1',
      { reason: 'phone_call_completed:assistant-ended-call' },
      'user-1',
    );
    expect(response).toEqual({ ok: true });
  });

  it('ends the session when Vapi sends a terminal status update', async () => {
    sessionService.end.mockResolvedValue({ id: 'session-1' } as never);

    const response = await controller.handleVapiServerEvent('signed-token', {
      message: {
        type: 'status-update',
        status: 'ended',
        endedReason: 'customer-ended-call',
        call: {
          id: 'call-1',
          monitor: {
            controlUrl: 'https://control.vapi.ai/call-1/control',
            listenUrl: 'wss://control.vapi.ai/call-1/listen',
          },
        },
      },
    });

    expect(
      phoneCallService.syncPhoneCallRuntimeFromWebhook,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'session-1',
        callId: 'call-1',
        status: 'ended',
        endedReason: 'customer-ended-call',
        controlUrl: 'https://control.vapi.ai/call-1/control',
        listenUrl: 'wss://control.vapi.ai/call-1/listen',
      }),
    );
    expect(sessionService.end).toHaveBeenCalledWith(
      'session-1',
      { reason: 'phone_call_completed:customer-ended-call' },
      'user-1',
    );
    expect(response).toEqual({ ok: true });
  });

  it('ends the session when Vapi sends a hang event', async () => {
    sessionService.end.mockResolvedValue({ id: 'session-1' } as never);

    await controller.handleVapiServerEvent('signed-token', {
      message: {
        type: 'hang',
      },
    });

    expect(sessionService.end).toHaveBeenCalledWith(
      'session-1',
      { reason: 'phone_call_hang' },
      'user-1',
    );
  });

  it('does not throw when session shutdown fails', async () => {
    sessionService.end.mockRejectedValue(new Error('already closed'));

    await expect(
      controller.handleVapiServerEvent('signed-token', {
        message: {
          type: 'hang',
        },
      }),
    ).resolves.toEqual({ ok: true });
  });
});
