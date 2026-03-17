import { PhoneCallWebhookController } from './phone-call-webhook.controller';
import type { VapiContextService } from '@microservices/simulation/phone/vapi-context.service';
import type {
  PhoneConversationEngineService,
  PhoneConversationResult,
} from '@microservices/simulation/services/phone-conversation-engine.service';
import type { SessionService } from '@microservices/simulation/services/session.service';

describe('PhoneCallWebhookController', () => {
  let controller: PhoneCallWebhookController;
  let vapiContext: jest.Mocked<VapiContextService>;
  let phoneConversationEngine: jest.Mocked<PhoneConversationEngineService>;
  let sessionService: jest.Mocked<SessionService>;

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
    phoneConversationEngine = {
      generateTurn: jest.fn(),
    } as unknown as jest.Mocked<PhoneConversationEngineService>;
    sessionService = {
      end: jest.fn(),
    } as unknown as jest.Mocked<SessionService>;

    controller = new PhoneCallWebhookController(
      vapiContext,
      phoneConversationEngine,
      sessionService,
    );
  });

  it('returns an endCall tool response when the backend requests hangup', async () => {
    const result: PhoneConversationResult = {
      text: 'Thanks for your time today.',
      hangupRequested: true,
      hangupReason: 'conversation_completed',
      toolEvents: [],
    };
    phoneConversationEngine.generateTurn.mockResolvedValue(result);
    const res = {
      json: jest.fn(),
    } as any;

    await controller.handleVapiCustomLlm(
      'signed-token',
      {
        messages: [{ role: 'user', content: 'Goodbye' }],
      },
      res,
    );

    expect(phoneConversationEngine.generateTurn).toHaveBeenCalledWith({
      sessionId: 'session-1',
      userId: 'user-1',
      text: 'Goodbye',
      startAsAssistant: false,
    });
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        choices: [
          expect.objectContaining({
            finish_reason: 'tool_calls',
            message: expect.objectContaining({
              content: 'Thanks for your time today.',
              tool_calls: [
                expect.objectContaining({
                  function: expect.objectContaining({
                    name: 'endCall',
                  }),
                }),
              ],
            }),
          }),
        ],
      }),
    );
  });

  it('starts as assistant when Vapi has not yet supplied user speech', async () => {
    phoneConversationEngine.generateTurn.mockResolvedValue({
      text: 'Hello, thanks for taking the call.',
      hangupRequested: false,
      toolEvents: [],
    });
    const res = {
      json: jest.fn(),
    } as any;

    await controller.handleVapiCustomLlm(
      'signed-token',
      {
        messages: [],
      },
      res,
    );

    expect(phoneConversationEngine.generateTurn).toHaveBeenCalledWith({
      sessionId: 'session-1',
      userId: 'user-1',
      text: '',
      startAsAssistant: true,
    });
  });

  it('falls back to an emergency end-call response when the backend errors', async () => {
    phoneConversationEngine.generateTurn.mockRejectedValue(
      new Error('backend down'),
    );
    const res = {
      json: jest.fn(),
    } as any;

    await controller.handleVapiCustomLlm(
      'signed-token',
      {
        messages: [{ role: 'user', content: 'Hello?' }],
      },
      res,
    );

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        choices: [
          expect.objectContaining({
            finish_reason: 'tool_calls',
            message: expect.objectContaining({
              content:
                'I am sorry, something went wrong and I need to end the call now.',
            }),
          }),
        ],
      }),
    );
  });

  it('streams assistant text and the endCall tool when Vapi requests streaming', async () => {
    phoneConversationEngine.generateTurn.mockResolvedValue({
      text: 'We are all set.',
      hangupRequested: true,
      hangupReason: 'done',
      toolEvents: [],
    });
    const res = {
      status: jest.fn().mockReturnThis(),
      setHeader: jest.fn(),
      write: jest.fn(),
      end: jest.fn(),
    } as any;

    await controller.handleVapiCustomLlm(
      'signed-token',
      {
        stream: true,
        messages: [{ role: 'user', content: 'Thanks' }],
      },
      res,
    );

    expect(res.status).toHaveBeenCalled();
    expect(res.write).toHaveBeenCalledWith(
      expect.stringContaining('"content":"We are all set."'),
    );
    expect(res.write).toHaveBeenCalledWith(
      expect.stringContaining('"name":"endCall"'),
    );
    expect(res.write).toHaveBeenCalledWith('data: [DONE]\n\n');
    expect(res.end).toHaveBeenCalled();
  });

  it('ends the session when Vapi sends an end-of-call report', async () => {
    sessionService.end.mockResolvedValue({ id: 'session-1' } as any);

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

  it('ends the session when Vapi sends a hang event', async () => {
    sessionService.end.mockResolvedValue({ id: 'session-1' } as any);

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
});
