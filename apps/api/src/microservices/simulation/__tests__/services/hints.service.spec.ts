import { Test, TestingModule } from '@nestjs/testing';
import { HintsService } from '../../services/hints.service';
import { HintsRepository } from '../../repositories/hints.repository';
import { SimulationPrismaService } from '../../prisma/simulation-prisma.service';
import { LLMRouterService } from '../../services/llm/llm-router.service';
import {
  GenerateHintRequestDto,
  HintStrategy,
  HintType,
} from '../../dto/hints.dto';
import { NotFoundException } from '@nestjs/common';

describe('HintsService', () => {
  let service: HintsService;
  let repository: jest.Mocked<HintsRepository>;
  let prisma: jest.Mocked<SimulationPrismaService>;
  let llmRouter: jest.Mocked<LLMRouterService>;

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
        content: 'Hello, I need help with my sales pitch.',
        createdAt: new Date(),
      },
      {
        id: 'msg_2',
        role: 'assistant',
        content: 'I can help you with that. What product are you selling?',
        createdAt: new Date(),
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
            'Understand customer needs',
            'Present product benefits',
            'Handle objections',
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
            content: 'Ask about the specific features they are interested in.',
            rationale:
              'Understanding feature preferences helps tailor the pitch.',
            score: 0.9,
          },
          {
            type: 'follow_up',
            content:
              'What challenges are you trying to solve with this product?',
            rationale:
              'Identifying pain points creates a compelling value proposition.',
            score: 0.85,
          },
        ],
      }),
      usage: {
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
        cost: 0.001,
      },
      finishReason: 'stop',
    },
    route: {
      provider: 'openai',
      model: 'gpt-4o-mini',
    },
  };

  const mockHintDocument = {
    _id: 'hint_doc_1',
    id: 'hint_doc_1',
    sessionId: 'session_1',
    userId: 'user_1',
    orgId: 'org_1',
    strategy: HintStrategy.REACTIVE,
    hints: [
      {
        id: 'hint_1',
        type: HintType.NEXT_TOPIC,
        content: 'Ask about the specific features they are interested in.',
        rationale: 'Understanding feature preferences helps tailor the pitch.',
        score: 0.9,
      },
    ],
    llmConfig: {
      provider: 'openai',
      model: 'gpt-4o-mini',
      temperature: 0.7,
      maxTokens: 500,
    },
    usage: {
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
      cost: 0.001,
    },
    generatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HintsService,
        {
          provide: HintsRepository,
          useValue: {
            create: jest.fn(),
            findBySessionId: jest.fn(),
            findBySessionIdAndType: jest.fn(),
            countBySessionId: jest.fn(),
            countBySessionIdAndType: jest.fn(),
          },
        },
        {
          provide: SimulationPrismaService,
          useValue: {
            client: {
              hintConfig: {
                findMany: jest.fn(),
              },
              iteration: {
                findFirst: jest.fn().mockResolvedValue(null),
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
      ],
    }).compile();

    service = module.get<HintsService>(HintsService);
    repository = module.get<jest.Mocked<HintsRepository>>(HintsRepository);
    prisma = module.get<jest.Mocked<SimulationPrismaService>>(
      SimulationPrismaService,
    );
    llmRouter = module.get<jest.Mocked<LLMRouterService>>(LLMRouterService);
  });

  describe('generateHints', () => {
    it('should generate hints successfully with default configuration', async () => {
      const request: GenerateHintRequestDto = {
        sessionId: 'session_1',
        userId: 'user_1',
        orgId: 'org_1',
      };

      (prisma.client.hintConfig.findMany as jest.Mock).mockResolvedValue([
        mockHintConfig as any,
      ]);
      (prisma.client.sessionMember.findFirst as jest.Mock).mockResolvedValue(
        mockSessionMember as any,
      );
      llmRouter.complete.mockResolvedValue(mockLLMResponse as any);
      repository.create.mockResolvedValue(mockHintDocument as any);

      const result = await service.generateHints(request);

      expect(result).toBeDefined();
      expect(result.hints).toHaveLength(2);
      expect(result.hints[0].type).toBe(HintType.NEXT_TOPIC);
      expect(result.provider).toBe('openai');
      expect(result.model).toBe('gpt-4o-mini');
      expect(result.usage).toBeDefined();
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'session_1',
          userId: 'user_1',
          orgId: 'org_1',
          strategy: 'reactive',
        }),
      );
    });

    it('should use provided messages instead of fetching from database', async () => {
      const request: GenerateHintRequestDto = {
        sessionId: 'session_1',
        userId: 'user_1',
        messages: [
          { role: 'user', content: 'Tell me about your product' },
          {
            role: 'assistant',
            content: 'Our product helps with sales automation',
          },
        ],
      };

      (prisma.client.hintConfig.findMany as jest.Mock).mockResolvedValue([
        mockHintConfig as any,
      ]);
      llmRouter.complete.mockResolvedValue(mockLLMResponse as any);
      repository.create.mockResolvedValue(mockHintDocument as any);

      await service.generateHints(request);

      expect(prisma.client.sessionMember.findFirst).not.toHaveBeenCalled();
      expect(llmRouter.complete).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'system',
            }),
            expect.objectContaining({
              role: 'user',
              content: expect.stringContaining('Tell me about your product'),
            }),
          ]),
        }),
        expect.any(Object),
      );
    });

    it('should respect maxHints parameter', async () => {
      const request: GenerateHintRequestDto = {
        sessionId: 'session_1',
        userId: 'user_1',
        maxHints: 5,
      };

      (prisma.client.hintConfig.findMany as jest.Mock).mockResolvedValue([
        mockHintConfig as any,
      ]);
      (prisma.client.sessionMember.findFirst as jest.Mock).mockResolvedValue(
        mockSessionMember as any,
      );
      llmRouter.complete.mockResolvedValue(mockLLMResponse as any);
      repository.create.mockResolvedValue(mockHintDocument as any);

      await service.generateHints(request);

      expect(llmRouter.complete).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'system',
              content: expect.stringContaining('Generate up to 5 hints'),
            }),
          ]),
        }),
        expect.any(Object),
      );
    });

    it('should use LLM config override when provided', async () => {
      const request: GenerateHintRequestDto = {
        sessionId: 'session_1',
        userId: 'user_1',
        llmConfigOverride: {
          provider: 'openai',
          model: 'gpt-4o',
          temperature: 0.9,
          maxTokens: 1000,
        },
      };

      (prisma.client.hintConfig.findMany as jest.Mock).mockResolvedValue([
        mockHintConfig as any,
      ]);
      (prisma.client.sessionMember.findFirst as jest.Mock).mockResolvedValue(
        mockSessionMember as any,
      );
      llmRouter.complete.mockResolvedValue(mockLLMResponse as any);
      repository.create.mockResolvedValue(mockHintDocument as any);

      await service.generateHints(request);

      expect(llmRouter.complete).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            provider: 'openai',
            model: 'gpt-4o',
            temperature: 0.9,
            maxTokens: 1000,
          }),
        }),
        expect.any(Object),
      );
    });

    it('should return empty hints when disabled in configuration', async () => {
      const request: GenerateHintRequestDto = {
        sessionId: 'session_1',
        userId: 'user_1',
      };

      const disabledConfig = {
        ...mockHintConfig,
        enabled: false,
        scope: 'global',
      };
      (prisma.client.hintConfig.findMany as jest.Mock).mockResolvedValue([
        disabledConfig,
      ] as any);

      const result = await service.generateHints(request);

      expect(result.hints).toHaveLength(0);
      expect(result.provider).toBe('none');
      expect(result.model).toBe('none');
      expect(llmRouter.complete).not.toHaveBeenCalled();
      expect(prisma.client.sessionMember.findFirst).not.toHaveBeenCalled();
    });

    it('should include session objectives when requested', async () => {
      const request: GenerateHintRequestDto = {
        sessionId: 'session_1',
        userId: 'user_1',
        includeObjectives: true,
      };

      (prisma.client.hintConfig.findMany as jest.Mock).mockResolvedValue([
        mockHintConfig as any,
      ]);
      (prisma.client.sessionMember.findFirst as jest.Mock).mockResolvedValue(
        mockSessionMember as any,
      );
      llmRouter.complete.mockResolvedValue(mockLLMResponse as any);
      repository.create.mockResolvedValue(mockHintDocument as any);

      await service.generateHints(request);

      expect(llmRouter.complete).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'user',
              content: expect.stringContaining('Session Objectives'),
            }),
          ]),
        }),
        expect.any(Object),
      );
    });

    it('should handle different hint strategies', async () => {
      const strategies: Array<{
        strategy: HintStrategy;
        expectedText: string;
      }> = [
        {
          strategy: HintStrategy.PROACTIVE,
          expectedText: 'proactively to guide the conversation forward',
        },
        {
          strategy: HintStrategy.REACTIVE,
          expectedText: 'in response to user inactivity',
        },
        {
          strategy: HintStrategy.CONTEXTUAL,
          expectedText: 'based on the current conversation context',
        },
      ];

      for (const { strategy, expectedText } of strategies) {
        jest.clearAllMocks();

        const request: GenerateHintRequestDto = {
          sessionId: 'session_1',
          userId: 'user_1',
          strategy,
        };

        (prisma.client.hintConfig.findMany as jest.Mock).mockResolvedValue([
          mockHintConfig as any,
        ]);
        (prisma.client.sessionMember.findFirst as jest.Mock).mockResolvedValue(
          mockSessionMember as any,
        );
        llmRouter.complete.mockResolvedValue(mockLLMResponse as any);
        repository.create.mockResolvedValue(mockHintDocument as any);

        await service.generateHints(request);

        expect(llmRouter.complete).toHaveBeenCalled();
        const call = llmRouter.complete.mock.calls[0][0];
        expect(call.messages[0].content).toContain(expectedText);
      }
    });

    it('should throw NotFoundException when session does not exist', async () => {
      const request: GenerateHintRequestDto = {
        sessionId: 'nonexistent_session',
        userId: 'user_1',
      };

      (prisma.client.hintConfig.findMany as jest.Mock).mockResolvedValue([
        mockHintConfig as any,
      ]);
      (prisma.client.sessionMember.findFirst as jest.Mock).mockResolvedValue(
        null,
      );

      await expect(service.generateHints(request)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should handle invalid JSON response from LLM gracefully', async () => {
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
          content: 'Invalid JSON response',
        },
      } as any);
      repository.create.mockResolvedValue(mockHintDocument as any);

      const result = await service.generateHints(request);

      // Should return fallback hint
      expect(result.hints).toHaveLength(1);
      expect(result.hints[0].type).toBe(HintType.NEXT_TOPIC);
      expect(result.hints[0].content).toContain('Continue the conversation');
    });

    it('should use default config when no config found', async () => {
      const request: GenerateHintRequestDto = {
        sessionId: 'session_1',
        userId: 'user_1',
      };

      (prisma.client.hintConfig.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.client.sessionMember.findFirst as jest.Mock).mockResolvedValue(
        mockSessionMember as any,
      );
      llmRouter.complete.mockResolvedValue(mockLLMResponse as any);
      repository.create.mockResolvedValue(mockHintDocument as any);

      const result = await service.generateHints(request);

      expect(result).toBeDefined();
      expect(llmRouter.complete).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            model: 'gpt-4o-mini',
            temperature: 0.7,
          }),
        }),
        expect.any(Object),
      );
    });
  });

  describe('getHintHistory', () => {
    it('should retrieve hint history for a session', async () => {
      const request = {
        sessionId: 'session_1',
        userId: 'user_1',
      };

      const mockHistory = [mockHintDocument, mockHintDocument];
      repository.findBySessionId.mockResolvedValue(mockHistory as any);
      repository.countBySessionId.mockResolvedValue(2);

      const result = await service.getHintHistory(request);

      expect(result.sessionId).toBe('session_1');
      expect(result.history).toHaveLength(2);
      expect(result.totalCount).toBe(2);
      expect(repository.findBySessionId).toHaveBeenCalledWith('session_1', 10);
    });

    it('should filter by hint type when provided', async () => {
      const request = {
        sessionId: 'session_1',
        userId: 'user_1',
        type: HintType.NEXT_TOPIC,
      };

      const mockHistory = [mockHintDocument];
      repository.findBySessionIdAndType.mockResolvedValue(mockHistory as any);
      repository.countBySessionIdAndType.mockResolvedValue(1);

      const result = await service.getHintHistory(request);

      expect(result.history).toHaveLength(1);
      expect(repository.findBySessionIdAndType).toHaveBeenCalledWith(
        'session_1',
        HintType.NEXT_TOPIC,
        10,
      );
    });

    it('should respect limit parameter', async () => {
      const request = {
        sessionId: 'session_1',
        userId: 'user_1',
        limit: 5,
      };

      repository.findBySessionId.mockResolvedValue([]);
      repository.countBySessionId.mockResolvedValue(0);

      await service.getHintHistory(request);

      expect(repository.findBySessionId).toHaveBeenCalledWith('session_1', 5);
    });

    it('should return empty history when no hints exist', async () => {
      const request = {
        sessionId: 'session_1',
        userId: 'user_1',
      };

      repository.findBySessionId.mockResolvedValue([]);
      repository.countBySessionId.mockResolvedValue(0);

      const result = await service.getHintHistory(request);

      expect(result.history).toHaveLength(0);
      expect(result.totalCount).toBe(0);
    });
  });

  describe('configuration hierarchy', () => {
    it('should prioritize session config over user config', async () => {
      const sessionConfig = {
        ...mockHintConfig,
        scope: 'session',
        sessionId: 'session_1',
        llmModel: 'gpt-4o',
      };
      const userConfig = {
        ...mockHintConfig,
        scope: 'user',
        userId: 'user_1',
        llmModel: 'gpt-3.5-turbo',
      };

      (prisma.client.hintConfig.findMany as jest.Mock).mockResolvedValue([
        sessionConfig,
        userConfig,
      ] as any);
      (prisma.client.sessionMember.findFirst as jest.Mock).mockResolvedValue(
        mockSessionMember as any,
      );
      llmRouter.complete.mockResolvedValue(mockLLMResponse as any);
      repository.create.mockResolvedValue(mockHintDocument as any);

      await service.generateHints({
        sessionId: 'session_1',
        userId: 'user_1',
      });

      expect(llmRouter.complete).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            model: 'gpt-4o',
          }),
        }),
        expect.any(Object),
      );
    });

    it('should fallback to org config when no session or user config exists', async () => {
      const orgConfig = {
        ...mockHintConfig,
        scope: 'org',
        orgId: 'org_1',
        llmModel: 'gpt-4o-mini',
      };

      (prisma.client.hintConfig.findMany as jest.Mock).mockResolvedValue([
        orgConfig,
      ] as any);
      (prisma.client.sessionMember.findFirst as jest.Mock).mockResolvedValue(
        mockSessionMember as any,
      );
      llmRouter.complete.mockResolvedValue(mockLLMResponse as any);
      repository.create.mockResolvedValue(mockHintDocument as any);

      await service.generateHints({
        sessionId: 'session_1',
        userId: 'user_1',
        orgId: 'org_1',
      });

      expect(llmRouter.complete).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            model: 'gpt-4o-mini',
          }),
        }),
        expect.any(Object),
      );
    });
  });

  describe('LLM repair flow', () => {
    it('should retry with repair prompt when first parse fails, and succeed on second attempt', async () => {
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

      // First call returns garbage, second (repair) returns valid JSON
      llmRouter.complete
        .mockResolvedValueOnce({
          ...mockLLMResponse,
          response: { ...mockLLMResponse.response, content: 'not json at all' },
        } as any)
        .mockResolvedValueOnce(mockLLMResponse as any);
      repository.create.mockResolvedValue(mockHintDocument as any);

      const result = await service.generateHints(request);

      expect(llmRouter.complete).toHaveBeenCalledTimes(2);
      expect(result.hints).toHaveLength(2);
    });

    it('should use fallback hints when both initial and repair parse fail', async () => {
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
        response: { ...mockLLMResponse.response, content: 'invalid' },
      } as any);
      repository.create.mockResolvedValue(mockHintDocument as any);

      const result = await service.generateHints(request);

      expect(llmRouter.complete).toHaveBeenCalledTimes(2);
      expect(result.hints.length).toBeGreaterThanOrEqual(1);
      expect(result.hints[0].type).toBe(HintType.NEXT_TOPIC);
    });
  });

  describe('fallback hints', () => {
    it('should suggest answering latest assistant question when present', async () => {
      const request: GenerateHintRequestDto = {
        sessionId: 'session_1',
        userId: 'user_1',
      };

      (prisma.client.hintConfig.findMany as jest.Mock).mockResolvedValue([
        mockHintConfig as any,
      ]);
      (prisma.client.sessionMember.findFirst as jest.Mock).mockResolvedValue({
        ...mockSessionMember,
        messages: [
          ...mockSessionMember.messages,
          {
            id: 'msg_3',
            role: 'assistant',
            content: 'What is your budget for this quarter?',
            createdAt: new Date(),
          },
        ],
      } as any);

      llmRouter.complete.mockResolvedValue({
        ...mockLLMResponse,
        response: { ...mockLLMResponse.response, content: 'garbage' },
      } as any);
      repository.create.mockResolvedValue(mockHintDocument as any);

      const result = await service.generateHints(request);

      expect(result.hints.length).toBeGreaterThanOrEqual(1);
      expect(result.hints[0].content).toContain('answering');
    });
  });

  describe('formatConversationForLLM (indirectly via generateHints)', () => {
    it('should include SESSION CONTEXT when userRole and aiRole are available', async () => {
      const request: GenerateHintRequestDto = {
        sessionId: 'session_1',
        userId: 'user_1',
        messages: [
          { role: 'user', content: 'Tell me about the product' },
          { role: 'assistant', content: 'Our product does X' },
        ],
      };

      (prisma.client.hintConfig.findMany as jest.Mock).mockResolvedValue([
        mockHintConfig as any,
      ]);
      // Add session delegate to prisma client for session config lookup
      (prisma.client as any).session = {
        findUnique: jest.fn().mockResolvedValue({
          id: 'session_1',
          sessionConfig: {
            userRole: 'Sales Rep',
            aiRole: 'Marketing Manager',
            scenario: { topic: 'CRM Software', objective: 'Close the deal' },
          },
          scenario: null,
        }),
      };
      llmRouter.complete.mockResolvedValue(mockLLMResponse as any);
      repository.create.mockResolvedValue(mockHintDocument as any);

      await service.generateHints(request);

      const userMessage = llmRouter.complete.mock.calls[0][0].messages.find(
        (m: any) => m.role === 'user',
      );
      expect(userMessage.content).toContain('SESSION CONTEXT');
      expect(userMessage.content).toContain('Sales Rep');
      expect(userMessage.content).toContain('Marketing Manager');
    });

    it('should include objectives in formatted context when provided', async () => {
      const request: GenerateHintRequestDto = {
        sessionId: 'session_1',
        userId: 'user_1',
        includeObjectives: true,
      };

      (prisma.client.hintConfig.findMany as jest.Mock).mockResolvedValue([
        mockHintConfig as any,
      ]);
      (prisma.client.sessionMember.findFirst as jest.Mock).mockResolvedValue(
        mockSessionMember as any,
      );
      llmRouter.complete.mockResolvedValue(mockLLMResponse as any);
      repository.create.mockResolvedValue(mockHintDocument as any);

      await service.generateHints(request);

      const userContent = llmRouter.complete.mock.calls[0][0].messages.find(
        (m: any) => m.role === 'user',
      )?.content;
      expect(userContent).toContain('Session Objectives');
    });

    it('should include conversation length and latest messages in formatted output', async () => {
      const request: GenerateHintRequestDto = {
        sessionId: 'session_1',
        userId: 'user_1',
        messages: [
          { role: 'user', content: 'Hi there' },
          { role: 'assistant', content: 'Hello! How can I help?' },
        ],
      };

      (prisma.client.hintConfig.findMany as jest.Mock).mockResolvedValue([
        mockHintConfig as any,
      ]);
      llmRouter.complete.mockResolvedValue(mockLLMResponse as any);
      repository.create.mockResolvedValue(mockHintDocument as any);

      await service.generateHints(request);

      const userContent = llmRouter.complete.mock.calls[0][0].messages.find(
        (m: any) => m.role === 'user',
      )?.content;
      expect(userContent).toContain('Conversation Length: 2');
      expect(userContent).toContain('Hi there');
      expect(userContent).toContain('Hello! How can I help?');
    });
  });

  describe('getConversationContext iteration path', () => {
    it('should use iteration delegate when available on prisma client', async () => {
      const request: GenerateHintRequestDto = {
        sessionId: 'session_1',
        userId: 'user_1',
      };

      (prisma.client.hintConfig.findMany as jest.Mock).mockResolvedValue([
        mockHintConfig as any,
      ]);

      // Add iteration delegate to prisma client
      (prisma.client as any).iteration = {
        findFirst: jest.fn().mockResolvedValue({
          id: 'iter-1',
          messages: [
            { role: 'user', content: 'Hello', createdAt: new Date() },
            {
              role: 'assistant',
              content: 'Hi, what can I help with?',
              createdAt: new Date(),
            },
          ],
          session: { scenario: null },
        }),
      };

      llmRouter.complete.mockResolvedValue(mockLLMResponse as any);
      repository.create.mockResolvedValue(mockHintDocument as any);

      const result = await service.generateHints(request);

      expect(result.hints).toBeDefined();
      expect((prisma.client as any).iteration.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ sessionId: 'session_1' }),
        }),
      );
    });
  });

  describe('error propagation', () => {
    it('should propagate error from LLM router', async () => {
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
  });

  describe('hint config strategy validation', () => {
    it('should fallback to REACTIVE when strategy is invalid', async () => {
      const request: GenerateHintRequestDto = {
        sessionId: 'session_1',
        userId: 'user_1',
      };

      const invalidStrategyConfig = {
        ...mockHintConfig,
        strategy: 'invalid_strategy',
        scope: 'global',
      };

      (prisma.client.hintConfig.findMany as jest.Mock).mockResolvedValue([
        invalidStrategyConfig,
      ] as any);
      (prisma.client.sessionMember.findFirst as jest.Mock).mockResolvedValue(
        mockSessionMember as any,
      );
      llmRouter.complete.mockResolvedValue(mockLLMResponse as any);
      repository.create.mockResolvedValue(mockHintDocument as any);

      const result = await service.generateHints(request);

      expect(result).toBeDefined();
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ strategy: 'reactive' }),
      );
    });
  });
});
