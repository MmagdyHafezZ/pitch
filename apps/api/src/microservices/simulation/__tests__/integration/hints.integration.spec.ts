import { Test, TestingModule } from '@nestjs/testing';
import { HintsService } from '../../services/hints.service';
import { HintsRepository } from '../../repositories/hints.repository';
import { SimulationPrismaService } from '../../prisma/simulation-prisma.service';
import { LLMRouterService } from '../../services/llm/llm-router.service';
import { MongoConnectionService } from '../../services/mongo/mongo-connection.service';
import {
  GenerateHintRequestDto,
  HintStrategy,
  HintType,
} from '../../dto/hints.dto';

/**
 * Integration tests for hints feature
 * Tests the full flow from request to storage
 */
describe('Hints Integration Tests', () => {
  let service: HintsService;
  let repository: HintsRepository;
  let prisma: jest.Mocked<SimulationPrismaService>;
  let llmRouter: jest.Mocked<LLMRouterService>;
  let mongoService: jest.Mocked<MongoConnectionService>;

  const mockModel = {
    create: jest.fn(),
    findById: jest.fn().mockReturnThis(),
    find: jest.fn().mockReturnThis(),
    countDocuments: jest.fn().mockReturnThis(),
    deleteOne: jest.fn().mockReturnThis(),
    deleteMany: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    lean: jest.fn(),
    exec: jest.fn(),
  };

  const mockHintConfig = {
    id: 'config_1',
    enabled: true,
    strategy: 'reactive',
    maxHintsPerRequest: 3,
    inactivityThresholdSeconds: 30,
    llmProvider: 'openai',
    llmModel: 'gpt-4o-mini',
    temperature: 0.7,
    maxTokens: 500,
  };

  const mockSessionMember = {
    id: 'member_1',
    sessionId: 'session_1',
    userId: 'user_1',
    messages: [
      {
        id: 'msg_1',
        role: 'user',
        content: 'I want to learn about sales techniques.',
        createdAt: new Date('2024-01-01T10:00:00Z'),
      },
      {
        id: 'msg_2',
        role: 'assistant',
        content: 'I can help you with that. What specific area interests you?',
        createdAt: new Date('2024-01-01T10:01:00Z'),
      },
    ],
    session: {
      id: 'session_1',
      orgId: 'org_1',
      type: 'text',
      status: 'active',
      scenario: {
        id: 'scenario_1',
        config: {
          objectives: [
            'Learn discovery techniques',
            'Practice objection handling',
            'Master closing strategies',
          ],
        },
      },
    },
  };

  const mockLLMResponse = {
    response: {
      content: JSON.stringify({
        hints: [
          {
            type: 'next_topic',
            content: 'Ask about their current sales process and challenges.',
            rationale:
              'Understanding current state helps identify improvement areas.',
            score: 0.95,
          },
          {
            type: 'follow_up',
            content: 'What metrics do you use to track sales performance?',
            rationale: 'Metrics reveal what matters most to them.',
            score: 0.88,
          },
          {
            type: 'objective',
            content: 'Consider focusing on discovery techniques first.',
            rationale: 'Aligns with session objectives.',
            score: 0.82,
          },
        ],
      }),
      usage: {
        promptTokens: 250,
        completionTokens: 120,
        totalTokens: 370,
        cost: 0.002,
      },
      finishReason: 'stop',
    },
    route: {
      provider: 'openai',
      model: 'gpt-4o-mini',
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HintsService,
        HintsRepository,
        {
          provide: SimulationPrismaService,
          useValue: {
            client: {
              hintConfig: {
                findMany: jest.fn(),
              },
              sessionMember: {
                findFirst: jest.fn(),
              },
            },
          },
        },
        {
          provide: LLMRouterService,
          useValue: {
            complete: jest.fn(),
          },
        },
        {
          provide: MongoConnectionService,
          useValue: {
            isConnected: jest.fn().mockReturnValue(true),
            getModel: jest.fn().mockReturnValue(mockModel),
          },
        },
      ],
    }).compile();

    service = module.get<HintsService>(HintsService);
    repository = module.get<HintsRepository>(HintsRepository);
    prisma = module.get<jest.Mocked<SimulationPrismaService>>(
      SimulationPrismaService,
    );
    llmRouter = module.get<jest.Mocked<LLMRouterService>>(LLMRouterService);
    mongoService = module.get<jest.Mocked<MongoConnectionService>>(
      MongoConnectionService,
    );

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('Full hint generation flow', () => {
    it('should generate hints end-to-end with database fetch', async () => {
      const request: GenerateHintRequestDto = {
        sessionId: 'session_1',
        userId: 'user_1',
        orgId: 'org_1',
        strategy: HintStrategy.REACTIVE,
        maxHints: 3,
        includeObjectives: true,
      };

      // Mock database responses
      (prisma.client.hintConfig.findMany as jest.Mock).mockResolvedValue([
        mockHintConfig as any,
      ]);
      (prisma.client.sessionMember.findFirst as jest.Mock).mockResolvedValue(
        mockSessionMember as any,
      );
      llmRouter.complete.mockResolvedValue(mockLLMResponse as any);

      const mockCreatedDoc = {
        _id: 'hint_doc_1',
        sessionId: 'session_1',
        userId: 'user_1',
        orgId: 'org_1',
        strategy: HintStrategy.REACTIVE,
        hints: expect.any(Array),
        generatedAt: new Date(),
        toObject: jest.fn().mockReturnThis(),
      };
      mockModel.create.mockResolvedValue(mockCreatedDoc);

      // Execute the full flow
      const result = await service.generateHints(request);

      // Verify configuration was fetched
      expect(prisma.client.hintConfig.findMany).toHaveBeenCalledWith({
        where: {
          isActive: true,
          OR: [
            { scope: 'session', sessionId: 'session_1' },
            { scope: 'user', userId: 'user_1' },
            { scope: 'org', orgId: 'org_1' },
            { scope: 'global' },
          ],
        },
        orderBy: [{ scope: 'asc' }],
      });

      // Verify session was fetched
      expect(prisma.client.sessionMember.findFirst).toHaveBeenCalledWith({
        where: {
          sessionId: 'session_1',
          userId: 'user_1',
        },
        include: {
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 40,
          },
          session: {
            include: {
              scenario: true,
              persona: true,
            },
          },
        },
      });

      // Verify LLM was called with correct parameters
      expect(llmRouter.complete).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'system',
              content: expect.stringContaining('user inactivity'),
            }),
            expect.objectContaining({
              role: 'user',
              content: expect.stringContaining('Session Objectives'),
            }),
          ]),
          config: expect.objectContaining({
            model: 'gpt-4o-mini',
            temperature: 0.7,
            maxTokens: 500,
          }),
        }),
        expect.objectContaining({
          orgId: 'org_1',
          userId: 'user_1',
          purpose: 'hints',
        }),
      );

      // Verify hints were stored in MongoDB
      expect(mockModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'session_1',
          userId: 'user_1',
          orgId: 'org_1',
          strategy: HintStrategy.REACTIVE,
          hints: expect.arrayContaining([
            expect.objectContaining({
              type: HintType.NEXT_TOPIC,
              content: expect.any(String),
            }),
          ]),
        }),
      );

      // Verify response structure
      expect(result).toMatchObject({
        sessionId: 'session_1',
        hints: expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(String),
            type: expect.any(String),
            content: expect.any(String),
            generatedAt: expect.any(Date),
          }),
        ]),
        provider: expect.any(String),
        model: expect.any(String),
        usage: expect.objectContaining({
          promptTokens: expect.any(Number),
          completionTokens: expect.any(Number),
          totalTokens: expect.any(Number),
        }),
        generatedAt: expect.any(Date),
      });

      expect(result.hints.length).toBeGreaterThan(0);
    });

    it('should handle provided messages without database fetch', async () => {
      const request: GenerateHintRequestDto = {
        sessionId: 'session_1',
        userId: 'user_1',
        messages: [
          { role: 'user', content: 'What are the best sales techniques?' },
          {
            role: 'assistant',
            content: 'There are several effective techniques...',
          },
          { role: 'user', content: 'Tell me more about discovery.' },
        ],
      };

      (prisma.client.hintConfig.findMany as jest.Mock).mockResolvedValue([
        mockHintConfig as any,
      ]);
      llmRouter.complete.mockResolvedValue(mockLLMResponse as any);
      mockModel.create.mockResolvedValue({
        _id: 'hint_doc_1',
        generatedAt: new Date(),
        toObject: jest.fn().mockReturnThis(),
      });

      const result = await service.generateHints(request);

      // Should NOT fetch session from database
      expect(prisma.client.sessionMember.findFirst).not.toHaveBeenCalled();

      // Should use provided messages
      expect(llmRouter.complete).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'user',
              content: expect.stringContaining(
                'What are the best sales techniques?',
              ),
            }),
          ]),
        }),
        expect.any(Object),
      );

      expect(result.hints).toBeDefined();
    });

    it('should retrieve hint history from repository', async () => {
      const mockHints = [
        {
          _id: 'hint_doc_1',
          sessionId: 'session_1',
          hints: [
            {
              id: 'hint_1',
              type: HintType.NEXT_TOPIC,
              content: 'First hint',
              generatedAt: new Date(),
            },
          ],
          llmConfig: { provider: 'openai', model: 'gpt-4o-mini' },
          generatedAt: new Date('2024-01-01T10:00:00Z'),
        },
        {
          _id: 'hint_doc_2',
          sessionId: 'session_1',
          hints: [
            {
              id: 'hint_2',
              type: HintType.FOLLOW_UP,
              content: 'Second hint',
              generatedAt: new Date(),
            },
          ],
          llmConfig: { provider: 'openai', model: 'gpt-4o-mini' },
          generatedAt: new Date('2024-01-01T11:00:00Z'),
        },
      ];

      mockModel.lean.mockResolvedValue(mockHints);
      mockModel.exec.mockResolvedValue(2);

      const result = await service.getHintHistory({
        sessionId: 'session_1',
        limit: 10,
      });

      expect(mockModel.find).toHaveBeenCalledWith({ sessionId: 'session_1' });
      expect(mockModel.sort).toHaveBeenCalledWith({ generatedAt: -1 });
      expect(mockModel.limit).toHaveBeenCalledWith(10);

      expect(result.sessionId).toBe('session_1');
      expect(result.history).toHaveLength(2);
      expect(result.totalCount).toBe(2);
    });

    it('should handle LLM errors gracefully', async () => {
      const request: GenerateHintRequestDto = {
        sessionId: 'session_1',
        userId: 'user_1',
      };

      (prisma.client.hintConfig.findMany as jest.Mock).mockResolvedValue([
        mockHintConfig as any,
      ]);
      (prisma.client.sessionMember.findFirst as jest.Mock).mockResolvedValue(
        mockSessionMember as any,
      );
      llmRouter.complete.mockRejectedValue(
        new Error('LLM service unavailable'),
      );

      await expect(service.generateHints(request)).rejects.toThrow(
        'LLM service unavailable',
      );
    });

    it('should use fallback hints when LLM returns invalid JSON', async () => {
      const request: GenerateHintRequestDto = {
        sessionId: 'session_1',
        userId: 'user_1',
      };

      (prisma.client.hintConfig.findMany as jest.Mock).mockResolvedValue([
        mockHintConfig as any,
      ]);
      (prisma.client.sessionMember.findFirst as jest.Mock).mockResolvedValue(
        mockSessionMember as any,
      );
      llmRouter.complete.mockResolvedValue({
        ...mockLLMResponse,
        response: {
          ...mockLLMResponse.response,
          content: 'Not valid JSON',
        },
      } as any);
      mockModel.create.mockResolvedValue({
        _id: 'hint_doc_1',
        generatedAt: new Date(),
        toObject: jest.fn().mockReturnThis(),
      });

      const result = await service.generateHints(request);

      // Should return fallback hint
      expect(result.hints).toHaveLength(1);
      expect(result.hints[0].type).toBe(HintType.NEXT_TOPIC);
      expect(result.hints[0].content).toContain('Continue the conversation');
    });

    it('should work with different hint strategies', async () => {
      const strategies: HintStrategy[] = [
        HintStrategy.PROACTIVE,
        HintStrategy.REACTIVE,
        HintStrategy.CONTEXTUAL,
      ];

      (prisma.client.hintConfig.findMany as jest.Mock).mockResolvedValue([
        mockHintConfig as any,
      ]);
      (prisma.client.sessionMember.findFirst as jest.Mock).mockResolvedValue(
        mockSessionMember as any,
      );
      llmRouter.complete.mockResolvedValue(mockLLMResponse as any);
      mockModel.create.mockResolvedValue({
        _id: 'hint_doc_1',
        generatedAt: new Date(),
        toObject: jest.fn().mockReturnThis(),
      });

      for (const strategy of strategies) {
        jest.clearAllMocks();

        const result = await service.generateHints({
          sessionId: 'session_1',
          userId: 'user_1',
          strategy,
        });

        expect(result.hints).toBeDefined();
        expect(mockModel.create).toHaveBeenCalledWith(
          expect.objectContaining({
            strategy,
          }),
        );
      }
    });
  });

  describe('Configuration hierarchy integration', () => {
    it('should use most specific configuration available', async () => {
      const globalConfig = {
        ...mockHintConfig,
        scope: 'global',
        llmModel: 'gpt-3.5-turbo',
      };
      const orgConfig = {
        ...mockHintConfig,
        scope: 'org',
        orgId: 'org_1',
        llmModel: 'gpt-4',
      };
      const sessionConfig = {
        ...mockHintConfig,
        scope: 'session',
        sessionId: 'session_1',
        llmModel: 'gpt-4o',
      };

      (prisma.client.hintConfig.findMany as jest.Mock).mockResolvedValue([
        globalConfig,
        orgConfig,
        sessionConfig,
      ] as any);
      (prisma.client.sessionMember.findFirst as jest.Mock).mockResolvedValue(
        mockSessionMember as any,
      );
      llmRouter.complete.mockResolvedValue(mockLLMResponse as any);
      mockModel.create.mockResolvedValue({
        _id: 'hint_doc_1',
        generatedAt: new Date(),
        toObject: jest.fn().mockReturnThis(),
      });

      await service.generateHints({
        sessionId: 'session_1',
        userId: 'user_1',
        orgId: 'org_1',
      });

      // Should use session config (most specific)
      expect(llmRouter.complete).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            model: 'gpt-4o',
          }),
        }),
        expect.any(Object),
      );
    });
  });

  describe('Error scenarios', () => {
    it('should handle session not found', async () => {
      (prisma.client.hintConfig.findMany as jest.Mock).mockResolvedValue([
        mockHintConfig as any,
      ]);
      (prisma.client.sessionMember.findFirst as jest.Mock).mockResolvedValue(
        null,
      );

      await expect(
        service.generateHints({
          sessionId: 'nonexistent_session',
          userId: 'user_1',
        }),
      ).rejects.toThrow('Session nonexistent_session not found');
    });

    it('should handle MongoDB connection error', async () => {
      mongoService.isConnected.mockReturnValue(false);

      await expect(
        repository.create({
          sessionId: 'session_1',
          strategy: HintStrategy.REACTIVE,
          hints: [],
          llmConfig: { provider: 'openai', model: 'gpt-4o-mini' },
          generatedAt: new Date(),
        }),
      ).rejects.toThrow('MongoDB connection is not initialized');
    });
  });
});
