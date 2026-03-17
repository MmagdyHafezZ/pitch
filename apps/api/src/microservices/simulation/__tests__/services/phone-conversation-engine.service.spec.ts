import { Observable, of, throwError } from 'rxjs';
import { PhoneConversationEngineService } from '../../services/phone-conversation-engine.service';

describe('PhoneConversationEngineService', () => {
  let service: PhoneConversationEngineService;
  let conversationOrchestration: {
    stream: jest.Mock<Observable<unknown>, [unknown]>;
  };

  beforeEach(() => {
    conversationOrchestration = {
      stream: jest.fn(),
    };

    service = new PhoneConversationEngineService(
      conversationOrchestration as any,
    );
  });

  it('aggregates deltas, tool events, progress, and hangup requests into one phone turn result', async () => {
    conversationOrchestration.stream.mockReturnValue(
      of(
        { type: 'delta', data: { delta: 'Hello ' } },
        {
          type: 'tool_executed',
          data: { tool: 'lookup_account', args: { accountId: 'acct-1' } },
        },
        { type: 'delta', data: { delta: 'there' } },
        { type: 'hangup_requested', data: { reason: 'done' } },
        {
          type: 'completed',
          data: {
            fullText: 'Hello there',
            totalSentences: 1,
            progress: 80,
          },
        },
      ) as Observable<unknown>,
    );

    const result = await service.generateTurn({
      sessionId: 'session-1',
      userId: 'user-1',
      text: 'Hi',
    });

    expect(conversationOrchestration.stream).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'session-1',
        userId: 'user-1',
        payload: expect.objectContaining({
          text: 'Hi',
          startAsAssistant: false,
        }),
      }),
    );
    expect(result).toEqual({
      text: 'Hello there',
      hangupRequested: true,
      hangupReason: 'done',
      toolEvents: [
        {
          tool: 'lookup_account',
          args: { accountId: 'acct-1' },
        },
      ],
      progress: 80,
    });
  });

  it('rejects when conversation orchestration fails', async () => {
    conversationOrchestration.stream.mockReturnValue(
      throwError(() => new Error('stream failed')) as Observable<unknown>,
    );

    await expect(
      service.generateTurn({
        sessionId: 'session-1',
        userId: 'user-1',
        text: 'Hi',
      }),
    ).rejects.toThrow('stream failed');
  });
});
