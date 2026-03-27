import { PhoneCallWebhookController } from './phone-call-webhook.controller';
import type { VapiContextService } from '@microservices/simulation/phone/vapi-context.service';
import type { PhoneCallService } from '@microservices/simulation/phone/phone-call.service';
import type { SessionService } from '@microservices/simulation/services/session.service';
import type { ConversationOrchestrationService } from '@microservices/simulation/services/conversation-orchestration.service';
import type { ConversationStreamEvent } from '@microservices/simulation/dto/conversation-stream.types';
import { of } from 'rxjs';

type MockJsonResponse = {
  status: jest.Mock;
  json: jest.Mock;
};

type MockBinaryResponse = {
  setHeader: jest.Mock;
  status: jest.Mock;
  send: jest.Mock;
};

type MockSseResponse = {
  setHeader: jest.Mock;
  flushHeaders: jest.Mock;
  write: jest.Mock;
  end: jest.Mock;
  writableEnded: boolean;
};

describe('PhoneCallWebhookController', () => {
  const streamOf = (...events: ConversationStreamEvent[]) => of(...events);

  let controller: PhoneCallWebhookController;
  let vapiContext: jest.Mocked<VapiContextService>;
  let sessionService: jest.Mocked<SessionService>;
  let phoneCallService: jest.Mocked<PhoneCallService>;
  let conversationOrchestration: jest.Mocked<ConversationOrchestrationService>;
  let verifyToken: jest.Mock;
  let sessionEnd: jest.Mock;
  let synthesizePhoneCallAudio: jest.Mock;
  let syncPhoneCallRuntimeFromWebhook: jest.Mock;
  let endActiveCall: jest.Mock;
  let conversationStream: jest.MockedFunction<
    ConversationOrchestrationService['stream']
  >;

  beforeEach(() => {
    verifyToken = jest.fn().mockReturnValue({
      sessionId: 'session-1',
      userId: 'user-1',
      purpose: 'phone-call',
      iat: 1,
      exp: 2,
    });
    vapiContext = {
      verifyToken,
    } as unknown as jest.Mocked<VapiContextService>;

    sessionEnd = jest.fn();
    sessionService = {
      end: sessionEnd,
    } as unknown as jest.Mocked<SessionService>;

    synthesizePhoneCallAudio = jest.fn();
    syncPhoneCallRuntimeFromWebhook = jest.fn().mockResolvedValue(undefined);
    endActiveCall = jest.fn().mockResolvedValue({
      ok: true,
      callId: 'call-1',
      provider: 'vapi',
      sessionId: 'session-1',
    });
    phoneCallService = {
      synthesizePhoneCallAudio,
      syncPhoneCallRuntimeFromWebhook,
      endActiveCall,
    } as unknown as jest.Mocked<PhoneCallService>;

    conversationStream = jest.fn();
    conversationOrchestration = {
      stream: conversationStream,
    } as unknown as jest.Mocked<ConversationOrchestrationService>;

    controller = new PhoneCallWebhookController(
      vapiContext,
      sessionService,
      phoneCallService,
      conversationOrchestration,
    );
  });

  it('returns PCM audio for Vapi voice requests', async () => {
    const audioBuffer = Buffer.from([1, 2, 3, 4]);
    phoneCallService.synthesizePhoneCallAudio.mockResolvedValue({
      audioBuffer,
      contentType: 'audio/pcm;rate=24000;channels=1',
    });

    const res: MockBinaryResponse = {
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
      res as never,
    );

    expect(synthesizePhoneCallAudio).toHaveBeenCalledWith({
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

  it('accepts nested Vapi voice-request payloads', async () => {
    const audioBuffer = Buffer.from([5, 6, 7, 8]);
    phoneCallService.synthesizePhoneCallAudio.mockResolvedValue({
      audioBuffer,
      contentType: 'audio/pcm;rate=16000;channels=1',
    });

    const res: MockBinaryResponse = {
      setHeader: jest.fn(),
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };

    await controller.handleVapiVoiceRequest(
      'signed-token',
      {
        message: {
          type: 'voice-request',
          text: 'Nested hello from PITCH.',
          sampleRate: 16000,
        },
      },
      res as never,
    );

    expect(synthesizePhoneCallAudio).toHaveBeenCalledWith({
      sessionId: 'session-1',
      userId: 'user-1',
      text: 'Nested hello from PITCH.',
      sampleRate: 16000,
    });
    expect(res.send).toHaveBeenCalledWith(audioBuffer);
  });

  it('returns OpenAI-compatible chat completions from the PITCH conversation engine', async () => {
    conversationStream.mockReturnValue(
      streamOf(
        { type: 'delta', data: { delta: 'Hello there.' } },
        {
          type: 'completed',
          data: {
            fullText: 'Hello there.',
            totalSentences: 1,
          },
        },
        {
          type: 'hangup_requested',
          data: { reason: 'Verification complete' },
        },
      ),
    );

    const res: MockJsonResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await controller.handleVapiChatCompletions(
      'signed-token',
      {
        model: 'pitch-phone-engine',
        stream: false,
        messages: [{ role: 'user', content: 'Hi there' }],
      },
      res as never,
    );

    expect(conversationStream).toHaveBeenCalledTimes(1);
    const envelope = conversationStream.mock.calls[0]?.[0] as {
      type: string;
      sessionId: string;
      userId: string;
      payload: {
        text: string;
        startAsAssistant: boolean;
        skipTts: boolean;
      };
    };
    expect(envelope).toMatchObject({
      type: 'conversation.start',
      sessionId: 'session-1',
      userId: 'user-1',
      payload: {
        text: 'Hi there',
        startAsAssistant: false,
        skipTts: true,
      },
    });
    expect(endActiveCall).toHaveBeenCalledWith({
      sessionId: 'session-1',
      userId: 'user-1',
      reason: 'Verification complete',
    });
    expect(sessionEnd).toHaveBeenCalledWith(
      'session-1',
      { reason: 'phone_call_completed:assistant-ended-call' },
      'user-1',
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        object: 'chat.completion',
        model: 'pitch-phone-engine',
        choices: [
          expect.objectContaining({
            message: {
              role: 'assistant',
              content: 'Hello there.',
            },
          }),
        ],
      }),
    );
  });

  it('forwards a model-authored starter prompt when Vapi asks the assistant to speak first', async () => {
    conversationStream.mockReturnValue(
      streamOf({
        type: 'completed',
        data: {
          fullText: 'Hello, this is your verification call.',
          totalSentences: 1,
        },
      }),
    );

    const res: MockJsonResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await controller.handleVapiChatCompletions(
      'signed-token',
      {
        model: 'pitch-phone-engine',
        stream: false,
        messages: [
          {
            role: 'system',
            content:
              '[PITCH_STARTER_PROMPT] Hello, this is your verification call.',
          },
        ],
      },
      res as never,
    );

    expect(conversationStream).toHaveBeenCalledTimes(1);
    const starterEnvelope = conversationStream.mock.calls[0]?.[0] as {
      type: string;
      sessionId: string;
      userId: string;
      payload: {
        text: string;
        startAsAssistant: boolean;
        starterPrompt: string;
        skipTts: boolean;
      };
    };
    expect(starterEnvelope).toMatchObject({
      type: 'conversation.start',
      sessionId: 'session-1',
      userId: 'user-1',
      payload: {
        text: '',
        startAsAssistant: true,
        starterPrompt: 'Hello, this is your verification call.',
        skipTts: true,
      },
    });
  });

  it('streams OpenAI-compatible SSE chunks and ends the phone call when the model asks to hang up', async () => {
    conversationStream.mockReturnValue(
      streamOf(
        { type: 'delta', data: { delta: 'Hello' } },
        { type: 'delta', data: { delta: ' there.' } },
        {
          type: 'hangup_requested',
          data: { reason: 'Verification complete' },
        },
        {
          type: 'completed',
          data: {
            fullText: 'Hello there.',
            totalSentences: 1,
          },
        },
      ),
    );

    const res: MockSseResponse = {
      setHeader: jest.fn(),
      flushHeaders: jest.fn(),
      write: jest.fn(),
      end: jest.fn(),
      writableEnded: false,
    };

    await controller.handleVapiChatCompletions(
      'signed-token',
      {
        model: 'pitch-phone-engine',
        stream: true,
        messages: [{ role: 'user', content: 'Hi there' }],
      },
      res as never,
    );

    await new Promise((resolve) => setImmediate(resolve));

    expect(res.flushHeaders).toHaveBeenCalled();
    expect(res.write).toHaveBeenCalledWith(
      expect.stringContaining('"object":"chat.completion.chunk"'),
    );
    expect(res.write).toHaveBeenCalledWith('data: [DONE]\n\n');
    expect(res.end).toHaveBeenCalled();
    expect(endActiveCall).toHaveBeenCalledWith({
      sessionId: 'session-1',
      userId: 'user-1',
      reason: 'Verification complete',
    });
    expect(sessionEnd).toHaveBeenCalledWith(
      'session-1',
      { reason: 'phone_call_completed:assistant-ended-call' },
      'user-1',
    );
  });

  it('returns ok for transcript events without ending the session', async () => {
    const response = await controller.handleVapiServerEvent('signed-token', {
      message: {
        type: 'transcript',
        transcript: 'Verification successful.',
      },
    });

    expect(verifyToken).toHaveBeenCalledWith('signed-token');
    expect(syncPhoneCallRuntimeFromWebhook).not.toHaveBeenCalled();
    expect(sessionEnd).not.toHaveBeenCalled();
    expect(response).toEqual({ ok: true });
  });

  it('ends the session for terminal failure status updates', async () => {
    sessionEnd.mockResolvedValue({ id: 'session-1' } as never);

    const response = await controller.handleVapiServerEvent('signed-token', {
      message: {
        type: 'status-update',
        status: 'failed',
        endedReason: 'upstream-timeout',
        call: {
          id: 'call-2',
        },
      },
    });

    expect(syncPhoneCallRuntimeFromWebhook).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'session-1',
        callId: 'call-2',
        status: 'failed',
        endedReason: 'upstream-timeout',
      }),
    );
    expect(sessionEnd).toHaveBeenCalledWith(
      'session-1',
      { reason: 'phone_call_terminated:failed:upstream-timeout' },
      'user-1',
    );
    expect(response).toEqual({ ok: true });
  });

  it('ends the session when Vapi sends an end-of-call report', async () => {
    sessionEnd.mockResolvedValue({ id: 'session-1' } as never);

    const response = await controller.handleVapiServerEvent('signed-token', {
      message: {
        type: 'end-of-call-report',
        endedReason: 'assistant-ended-call',
      },
    });

    expect(sessionEnd).toHaveBeenCalledWith(
      'session-1',
      { reason: 'phone_call_completed:assistant-ended-call' },
      'user-1',
    );
    expect(response).toEqual({ ok: true });
  });

  it('ends the session when Vapi sends a terminal status update', async () => {
    sessionEnd.mockResolvedValue({ id: 'session-1' } as never);

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

    expect(syncPhoneCallRuntimeFromWebhook).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'session-1',
        callId: 'call-1',
        status: 'ended',
        endedReason: 'customer-ended-call',
        controlUrl: 'https://control.vapi.ai/call-1/control',
        listenUrl: 'wss://control.vapi.ai/call-1/listen',
      }),
    );
    expect(sessionEnd).toHaveBeenCalledWith(
      'session-1',
      { reason: 'phone_call_completed:customer-ended-call' },
      'user-1',
    );
    expect(response).toEqual({ ok: true });
  });

  it('ends the session when Vapi sends a hang event', async () => {
    sessionEnd.mockResolvedValue({ id: 'session-1' } as never);

    await controller.handleVapiServerEvent('signed-token', {
      message: {
        type: 'hang',
      },
    });

    expect(sessionEnd).toHaveBeenCalledWith(
      'session-1',
      { reason: 'phone_call_hang' },
      'user-1',
    );
  });

  it('does not throw when session shutdown fails', async () => {
    sessionEnd.mockRejectedValue(new Error('already closed'));

    await expect(
      controller.handleVapiServerEvent('signed-token', {
        message: {
          type: 'hang',
        },
      }),
    ).resolves.toEqual({ ok: true });
  });
});
