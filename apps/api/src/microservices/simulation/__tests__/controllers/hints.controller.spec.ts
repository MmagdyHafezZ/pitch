import { Test, TestingModule } from '@nestjs/testing';
import { HintsController } from '../../controllers/hints.controller';
import { HintsService } from '../../services/hints.service';
import {
  GenerateHintRequestDto,
  GenerateHintResponseDto,
  GetHintHistoryRequestDto,
  HintHistoryResponseDto,
  HintStrategy,
  HintType,
} from '../../dto/hints.dto';
import { WsEnvelope, WsMessageType } from '../../dto/websocket.dto';

describe('HintsController', () => {
  let controller: HintsController;
  let service: jest.Mocked<HintsService>;

  const mockGenerateHintResponse: GenerateHintResponseDto = {
    sessionId: 'session_1',
    hints: [
      {
        id: 'hint_1',
        type: HintType.NEXT_TOPIC,
        content: 'Ask about their specific requirements.',
        rationale: 'Understanding requirements helps tailor the solution.',
        score: 0.9,
        generatedAt: new Date(),
      },
      {
        id: 'hint_2',
        type: HintType.FOLLOW_UP,
        content: 'What challenges are you currently facing?',
        rationale: 'Identifying pain points creates value.',
        score: 0.85,
        generatedAt: new Date(),
      },
    ],
    provider: 'openai',
    model: 'gpt-4o-mini',
    usage: {
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
    },
    generatedAt: new Date(),
    mongoId: 'hint_doc_1',
  };

  const mockHintHistory: HintHistoryResponseDto = {
    sessionId: 'session_1',
    history: [mockGenerateHintResponse],
    totalCount: 1,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HintsController],
      providers: [
        {
          provide: HintsService,
          useValue: {
            generateHints: jest.fn(),
            getHintHistory: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<HintsController>(HintsController);
    service = module.get<jest.Mocked<HintsService>>(HintsService);
  });

  describe('generateHints', () => {
    it('should generate hints successfully', async () => {
      const payload: GenerateHintRequestDto = {
        sessionId: 'session_1',
        userId: 'user_1',
        strategy: HintStrategy.REACTIVE,
        maxHints: 3,
      };

      const envelope: WsEnvelope<GenerateHintRequestDto> = {
        type: WsMessageType.CHAT_START,
        requestId: 'req_1',
        sessionId: 'session_1',
        userId: 'user_1',
        payload,
        timestamp: new Date().toISOString(),
      };

      service.generateHints.mockResolvedValue(mockGenerateHintResponse);

      const result = await controller.generateHints(envelope);

      expect(result).toEqual(mockGenerateHintResponse);
      expect(service.generateHints).toHaveBeenCalledWith({
        ...payload,
        userId: 'user_1',
      });
    });

    it('should use envelope userId when payload userId is not provided', async () => {
      const payload: GenerateHintRequestDto = {
        sessionId: 'session_1',
      };

      const envelope: WsEnvelope<GenerateHintRequestDto> = {
        type: WsMessageType.CHAT_START,
        requestId: 'req_1',
        sessionId: 'session_1',
        userId: 'envelope_user',
        payload,
        timestamp: new Date().toISOString(),
      };

      service.generateHints.mockResolvedValue(mockGenerateHintResponse);

      await controller.generateHints(envelope);

      expect(service.generateHints).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'envelope_user',
        }),
      );
    });

    it('should prefer payload userId over envelope userId', async () => {
      const payload: GenerateHintRequestDto = {
        sessionId: 'session_1',
        userId: 'payload_user',
      };

      const envelope: WsEnvelope<GenerateHintRequestDto> = {
        type: WsMessageType.CHAT_START,
        requestId: 'req_1',
        sessionId: 'session_1',
        userId: 'envelope_user',
        payload,
        timestamp: new Date().toISOString(),
      };

      service.generateHints.mockResolvedValue(mockGenerateHintResponse);

      await controller.generateHints(envelope);

      expect(service.generateHints).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'payload_user',
        }),
      );
    });

    it('should pass through all payload properties', async () => {
      const payload: GenerateHintRequestDto = {
        sessionId: 'session_1',
        turnId: 'turn_1',
        userId: 'user_1',
        orgId: 'org_1',
        strategy: HintStrategy.PROACTIVE,
        maxHints: 5,
        includeObjectives: true,
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there!' },
        ],
        llmConfigOverride: {
          provider: 'openai',
          model: 'gpt-4o',
          temperature: 0.9,
        },
      };

      const envelope: WsEnvelope<GenerateHintRequestDto> = {
        type: WsMessageType.CHAT_START,
        requestId: 'req_1',
        sessionId: 'session_1',
        userId: 'user_1',
        payload,
        timestamp: new Date().toISOString(),
      };

      service.generateHints.mockResolvedValue(mockGenerateHintResponse);

      await controller.generateHints(envelope);

      expect(service.generateHints).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'session_1',
          turnId: 'turn_1',
          userId: 'user_1',
          orgId: 'org_1',
          strategy: HintStrategy.PROACTIVE,
          maxHints: 5,
          includeObjectives: true,
          messages: payload.messages,
          llmConfigOverride: payload.llmConfigOverride,
        }),
      );
    });

    it('should propagate errors from service', async () => {
      const payload: GenerateHintRequestDto = {
        sessionId: 'session_1',
      };

      const envelope: WsEnvelope<GenerateHintRequestDto> = {
        type: WsMessageType.CHAT_START,
        requestId: 'req_1',
        sessionId: 'session_1',
        payload,
        timestamp: new Date().toISOString(),
      };

      const error = new Error('Service error');
      service.generateHints.mockRejectedValue(error);

      await expect(controller.generateHints(envelope)).rejects.toThrow(error);
    });
  });

  describe('getHintHistory', () => {
    it('should retrieve hint history successfully', async () => {
      const payload: GetHintHistoryRequestDto = {
        sessionId: 'session_1',
        userId: 'user_1',
        limit: 10,
      };

      const envelope: WsEnvelope<GetHintHistoryRequestDto> = {
        type: WsMessageType.CHAT_START,
        requestId: 'req_1',
        sessionId: 'session_1',
        userId: 'user_1',
        payload,
        timestamp: new Date().toISOString(),
      };

      service.getHintHistory.mockResolvedValue(mockHintHistory);

      const result = await controller.getHintHistory(envelope);

      expect(result).toEqual(mockHintHistory);
      expect(service.getHintHistory).toHaveBeenCalledWith({
        ...payload,
        userId: 'user_1',
      });
    });

    it('should use envelope userId when payload userId is not provided', async () => {
      const payload: GetHintHistoryRequestDto = {
        sessionId: 'session_1',
      };

      const envelope: WsEnvelope<GetHintHistoryRequestDto> = {
        type: WsMessageType.CHAT_START,
        requestId: 'req_1',
        sessionId: 'session_1',
        userId: 'envelope_user',
        payload,
        timestamp: new Date().toISOString(),
      };

      service.getHintHistory.mockResolvedValue(mockHintHistory);

      await controller.getHintHistory(envelope);

      expect(service.getHintHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'envelope_user',
        }),
      );
    });

    it('should filter by hint type when provided', async () => {
      const payload: GetHintHistoryRequestDto = {
        sessionId: 'session_1',
        userId: 'user_1',
        type: HintType.NEXT_TOPIC,
        limit: 5,
      };

      const envelope: WsEnvelope<GetHintHistoryRequestDto> = {
        type: WsMessageType.CHAT_START,
        requestId: 'req_1',
        sessionId: 'session_1',
        payload,
        timestamp: new Date().toISOString(),
      };

      service.getHintHistory.mockResolvedValue(mockHintHistory);

      await controller.getHintHistory(envelope);

      expect(service.getHintHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          type: HintType.NEXT_TOPIC,
          limit: 5,
        }),
      );
    });

    it('should propagate errors from service', async () => {
      const payload: GetHintHistoryRequestDto = {
        sessionId: 'session_1',
      };

      const envelope: WsEnvelope<GetHintHistoryRequestDto> = {
        type: WsMessageType.CHAT_START,
        requestId: 'req_1',
        sessionId: 'session_1',
        payload,
        timestamp: new Date().toISOString(),
      };

      const error = new Error('Service error');
      service.getHintHistory.mockRejectedValue(error);

      await expect(controller.getHintHistory(envelope)).rejects.toThrow(error);
    });
  });
});
