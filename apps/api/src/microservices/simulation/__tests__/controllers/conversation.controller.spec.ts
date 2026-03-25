import { Test, TestingModule } from '@nestjs/testing';
import { of, throwError } from 'rxjs';
import { ConversationController } from '../../controllers/conversation.controller';
import { LLMRouterService } from '../../services/llm/llm-router.service';
import { TtsService } from '../../tts/tts.service';
import { SimulationPrismaService } from '../../prisma/simulation-prisma.service';
import { StageDetectorService } from '../../services/stage-detector.service';
import { StreamingConversationService } from '../../services/streaming-conversation.service';
import { ConversationOrchestrationService } from '../../services/conversation-orchestration.service';
import { AssessmentService } from '../../assessment/assessment.service';
import { WsEnvelope, WsMessageType } from '../../dto/websocket.dto';
import { ConversationStartPayload } from '../../dto/websocket.dto';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockLlmRouter = { stream: jest.fn() };
const mockTtsService = { synthesize: jest.fn() };
const mockPrisma = { client: {} };
const mockStageDetector = { detect: jest.fn() };
const mockStreamingConversation = { stream: jest.fn() };
const mockConversationOrchestration = { stream: jest.fn() };
const mockAssessmentService = { assess: jest.fn() };

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeEnvelope(
  partial: Partial<ConversationStartPayload> = {},
): WsEnvelope<ConversationStartPayload> {
  return {
    type: WsMessageType.CONVERSATION_START,
    requestId: 'req-1',
    sessionId: 'session-1',
    userId: 'user-1',
    payload: {
      text: 'Hello, how are you?',
      ...partial,
    },
    timestamp: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('ConversationController', () => {
  let controller: ConversationController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ConversationController],
      providers: [
        { provide: LLMRouterService, useValue: mockLlmRouter },
        { provide: TtsService, useValue: mockTtsService },
        { provide: SimulationPrismaService, useValue: mockPrisma },
        { provide: StageDetectorService, useValue: mockStageDetector },
        {
          provide: StreamingConversationService,
          useValue: mockStreamingConversation,
        },
        {
          provide: ConversationOrchestrationService,
          useValue: mockConversationOrchestration,
        },
        { provide: AssessmentService, useValue: mockAssessmentService },
      ],
    }).compile();

    controller = module.get<ConversationController>(ConversationController);
  });

  // -------------------------------------------------------------------------
  // streamConversation — the only public @MessagePattern handler
  // -------------------------------------------------------------------------
  describe('streamConversation', () => {
    it('delegates to ConversationOrchestrationService.stream and returns the Observable', () => {
      const events = [
        { type: 'delta', data: { delta: 'Hello' } },
        { type: 'complete', data: {} },
      ];
      const stream$ = of(...events);
      mockConversationOrchestration.stream.mockReturnValue(stream$);

      const envelope = makeEnvelope();
      const result$ = controller.streamConversation(envelope);

      expect(mockConversationOrchestration.stream).toHaveBeenCalledTimes(1);
      expect(mockConversationOrchestration.stream).toHaveBeenCalledWith(
        envelope,
      );
      expect(result$).toBe(stream$);
    });

    it('emits all events from the orchestration observable in order', (done) => {
      const events = [
        { type: 'delta', data: { delta: 'Hi' } },
        { type: 'delta', data: { delta: ' there' } },
        { type: 'complete', data: { fullText: 'Hi there' } },
      ];
      mockConversationOrchestration.stream.mockReturnValue(of(...events));

      const envelope = makeEnvelope();
      const emitted: unknown[] = [];

      controller.streamConversation(envelope).subscribe({
        next: (ev) => emitted.push(ev),
        complete: () => {
          expect(emitted).toEqual(events);
          done();
        },
      });
    });

    it('propagates errors emitted by the orchestration observable', (done) => {
      const error = new Error('Orchestration failed');
      mockConversationOrchestration.stream.mockReturnValue(
        throwError(() => error),
      );

      const envelope = makeEnvelope();

      controller.streamConversation(envelope).subscribe({
        error: (err) => {
          expect(err).toBe(error);
          done();
        },
      });
    });

    it('works with startAsAssistant flag in the payload', () => {
      const stream$ = of({ type: 'complete', data: {} });
      mockConversationOrchestration.stream.mockReturnValue(stream$);

      const envelope = makeEnvelope({ startAsAssistant: true });
      controller.streamConversation(envelope);

      expect(mockConversationOrchestration.stream).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({ startAsAssistant: true }),
        }),
      );
    });

    it('forwards the full envelope including requestId and sessionId', () => {
      const stream$ = of();
      mockConversationOrchestration.stream.mockReturnValue(stream$);

      const envelope = makeEnvelope();
      controller.streamConversation(envelope);

      expect(mockConversationOrchestration.stream).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: 'req-1',
          sessionId: 'session-1',
          userId: 'user-1',
        }),
      );
    });

    it('does not call any other injected service directly', () => {
      mockConversationOrchestration.stream.mockReturnValue(of());

      controller.streamConversation(makeEnvelope());

      expect(mockLlmRouter.stream).not.toHaveBeenCalled();
      expect(mockTtsService.synthesize).not.toHaveBeenCalled();
      expect(mockStageDetector.detect).not.toHaveBeenCalled();
      expect(mockStreamingConversation.stream).not.toHaveBeenCalled();
      expect(mockAssessmentService.assess).not.toHaveBeenCalled();
    });
  });
});
