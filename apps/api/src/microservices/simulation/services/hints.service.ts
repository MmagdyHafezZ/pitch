import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { normalizeError } from '@pitch/shared-backend/helpers/exceptions';
import { SimulationPrismaService } from '../prisma/simulation-prisma.service';
import { LLMRouterService } from './llm/llm-router.service';
import { HintsRepository } from '../repositories/hints.repository';
import {
  GenerateHintRequestDto,
  GenerateHintResponseDto,
  GetHintHistoryRequestDto,
  HintHistoryResponseDto,
  HintDto,
  HintType,
  HintStrategy,
} from '../dto/hints.dto';
import { LLMMessageDto, LLMConfigDto } from '../dto/llm.dto';
import { randomUUID } from 'crypto';
import type { IConversationContext } from '../schemas/mongodb/hint.schema';

interface HintConfig {
  enabled: boolean;
  strategy: HintStrategy;
  maxHintsPerRequest: number;
  inactivityThresholdSeconds: number;
  llmProvider: string | null;
  llmModel: string;
  temperature: number;
  maxTokens: number;
}

interface ConversationContext extends IConversationContext {
  messages: Array<{
    role: string;
    content: string;
    timestamp?: Date;
  }>;
  conversationLength: number;
  lastUserMessageAt?: Date;
  objectives?: string[];
  pendingObjectives?: string[];
}

interface ParsedHint {
  type: HintType;
  content: string;
  rationale?: string;
  score?: number;
}

interface ParsedHintsPayload {
  hints: ParsedHint[];
}

const hintTypeSet = new Set(Object.values(HintType));

const isHintType = (value: unknown): value is HintType =>
  typeof value === 'string' && hintTypeSet.has(value as HintType);

const isParsedHintsPayload = (value: unknown): value is ParsedHintsPayload => {
  if (!value || typeof value !== 'object') return false;
  const record = value as { hints?: unknown };
  if (!Array.isArray(record.hints)) return false;
  return record.hints.every((hint) => {
    if (!hint || typeof hint !== 'object') return false;
    const candidate = hint as {
      type?: unknown;
      content?: unknown;
      rationale?: unknown;
      score?: unknown;
    };
    if (!isHintType(candidate.type)) return false;
    if (typeof candidate.content !== 'string') return false;
    if (
      candidate.rationale !== undefined &&
      typeof candidate.rationale !== 'string'
    ) {
      return false;
    }
    if (candidate.score !== undefined && typeof candidate.score !== 'number') {
      return false;
    }
    return true;
  });
};

/**
 * Service for generating and managing conversation hints
 */
@Injectable()
export class HintsService {
  private readonly logger = new Logger(HintsService.name);

  constructor(
    private readonly hintsRepository: HintsRepository,
    private readonly prisma: SimulationPrismaService,
    private readonly llmRouter: LLMRouterService,
  ) {}

  /**
   * Generate hints based on conversation context
   */
  async generateHints(
    request: GenerateHintRequestDto,
  ): Promise<GenerateHintResponseDto> {
    this.logger.log(
      `Generating hints for session ${request.sessionId} with strategy ${request.strategy || 'reactive'}`,
    );

    try {
      // 1. Get hint configuration
      const hintConfig = await this.getHintConfig(
        request.sessionId,
        request.userId,
        request.orgId,
      );

      if (!hintConfig.enabled) {
        this.logger.warn('Hints are disabled for this session/user/org');
        return {
          sessionId: request.sessionId,
          turnId: request.turnId,
          hints: [],
          provider: 'none',
          model: 'none',
          generatedAt: new Date(),
        };
      }

      // 2. Get conversation context
      const conversationContext = await this.getConversationContext(
        request.sessionId,
        request.turnId,
        request.messages,
        request.includeObjectives,
        request.userId,
      );

      // 3. Build system prompt for hint generation
      const systemPrompt = this.buildHintGenerationPrompt(
        request.strategy || hintConfig.strategy,
        conversationContext,
        request.maxHints || hintConfig.maxHintsPerRequest,
      );

      // 4. Prepare LLM request
      const provider =
        request.llmConfigOverride?.provider ??
        hintConfig.llmProvider ??
        undefined;
      const llmConfig: LLMConfigDto = {
        provider,
        model:
          request.llmConfigOverride?.model ||
          hintConfig.llmModel ||
          'gpt-4o-mini',
        temperature:
          request.llmConfigOverride?.temperature || hintConfig.temperature,
        maxTokens: request.llmConfigOverride?.maxTokens || hintConfig.maxTokens,
        stream: false,
      };

      const llmMessages: LLMMessageDto[] = [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: this.formatConversationForLLM(conversationContext),
        },
      ];

      // 5. Generate hints using LLM
      const { response: llmResponse, route } = await this.llmRouter.complete(
        {
          messages: llmMessages,
          config: llmConfig,
          sessionId: request.sessionId,
          sessionMemberId: request.turnId,
          userId: request.userId,
        },
        {
          orgId: request.orgId,
          userId: request.userId,
          requestId: randomUUID(),
          purpose: 'hints',
        },
      );

      // 6. Parse LLM response into hints
      const hints = this.parseHintsFromLLMResponse(
        llmResponse.content ?? '',
        conversationContext,
      );

      // 7. Store hints in MongoDB
      const savedHint = await this.hintsRepository.create({
        sessionId: request.sessionId,
        turnId: request.turnId,
        userId: request.userId,
        orgId: request.orgId,
        strategy: request.strategy || hintConfig.strategy,
        hints: hints,
        llmConfig: {
          provider: route?.provider || llmConfig.provider || 'unknown',
          model: route?.model || llmConfig.model,
          temperature: llmConfig.temperature,
          maxTokens: llmConfig.maxTokens,
        },
        usage: llmResponse.usage
          ? {
              promptTokens: llmResponse.usage.promptTokens,
              completionTokens: llmResponse.usage.completionTokens,
              totalTokens: llmResponse.usage.totalTokens,
              cost: llmResponse.usage.costUsd || 0,
            }
          : undefined,
        conversationContext: conversationContext,
        generatedAt: new Date(),
        requestId: randomUUID(),
      });

      this.logger.log(
        `Generated ${hints.length} hints for session ${request.sessionId}`,
      );

      return {
        sessionId: request.sessionId,
        turnId: request.turnId,
        hints: hints,
        provider: route?.provider || llmConfig.provider || 'unknown',
        model: route?.model || llmConfig.model,
        usage: llmResponse.usage,
        generatedAt: savedHint.generatedAt,
        mongoId: savedHint._id,
      };
    } catch (error) {
      const err = normalizeError(error);
      this.logger.error(
        `Error generating hints for session ${request.sessionId}: ${err.message}`,
        err.stack,
      );
      throw error;
    }
  }

  /**
   * Get hint history for a session
   */
  async getHintHistory(
    request: GetHintHistoryRequestDto,
  ): Promise<HintHistoryResponseDto> {
    const limit = request.limit || 10;

    const [history, totalCount] = await Promise.all([
      request.type
        ? this.hintsRepository.findBySessionIdAndType(
            request.sessionId,
            request.type,
            limit,
          )
        : this.hintsRepository.findBySessionId(request.sessionId, limit),
      request.type
        ? this.hintsRepository.countBySessionIdAndType(
            request.sessionId,
            request.type,
          )
        : this.hintsRepository.countBySessionId(request.sessionId),
    ]);

    return {
      sessionId: request.sessionId,
      history: history.map((doc) => ({
        sessionId: doc.sessionId,
        turnId: doc.turnId,
        hints: doc.hints.map((h) => ({
          id: h.id,
          type: h.type,
          content: h.content,
          rationale: h.rationale,
          score: h.score,
          generatedAt: doc.generatedAt,
          context: h.context,
        })),
        provider: doc.llmConfig.provider,
        model: doc.llmConfig.model,
        usage: doc.usage,
        generatedAt: doc.generatedAt,
        mongoId: doc._id,
      })),
      totalCount,
    };
  }

  /**
   * Get hint configuration with fallback hierarchy: session -> user -> org -> global
   */
  private async getHintConfig(
    sessionId: string,
    userId?: string,
    orgId?: string,
  ): Promise<HintConfig> {
    // Try to find active config in order of specificity
    const configs = await this.prisma.client.hintConfig.findMany({
      where: {
        isActive: true,
        OR: [
          { scope: 'session', sessionId },
          { scope: 'user', userId },
          { scope: 'org', orgId },
          { scope: 'global' },
        ],
      },
      orderBy: [
        // Order by specificity
        { scope: 'asc' }, // session < user < org < global alphabetically
      ],
    });

    // Find most specific config
    const sessionConfig = configs.find((c) => c.scope === 'session');
    const userConfig = configs.find((c) => c.scope === 'user');
    const orgConfig = configs.find((c) => c.scope === 'org');
    const globalConfig = configs.find((c) => c.scope === 'global');

    const config = sessionConfig || userConfig || orgConfig || globalConfig;

    if (!config) {
      // Return default config
      return {
        enabled: true,
        strategy: HintStrategy.REACTIVE,
        maxHintsPerRequest: 3,
        inactivityThresholdSeconds: 30,
        llmProvider: null,
        llmModel: 'gpt-4o-mini',
        temperature: 0.7,
        maxTokens: 500,
      };
    }

    const strategy = Object.values(HintStrategy).includes(
      config.strategy as HintStrategy,
    )
      ? (config.strategy as HintStrategy)
      : HintStrategy.REACTIVE;

    return {
      enabled: config.enabled,
      strategy,
      maxHintsPerRequest: config.maxHintsPerRequest,
      inactivityThresholdSeconds: config.inactivityThresholdSeconds,
      llmProvider: config.llmProvider,
      llmModel: config.llmModel ?? 'gpt-4o-mini',
      temperature: config.temperature ?? 0.7,
      maxTokens: config.maxTokens ?? 500,
    };
  }

  /**
   * Get conversation context from session
   */
  private async getConversationContext(
    sessionId: string,
    turnId?: string,
    providedMessages?: LLMMessageDto[],
    includeObjectives?: boolean,
    userId?: string,
  ): Promise<ConversationContext> {
    // If messages are provided, use them
    if (providedMessages && providedMessages.length > 0) {
      return {
        messages: providedMessages.map((m) => ({
          role: m.role,
          content:
            typeof m.content === 'string'
              ? m.content
              : JSON.stringify(m.content),
        })),
        conversationLength: providedMessages.length,
      };
    }

    // Otherwise, fetch from database
    const sessionMember = await this.prisma.client.sessionMember.findFirst({
      where: {
        sessionId,
        ...(userId ? { userId } : {}),
      },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 40,
        },
        session: {
          include: {
            scenario: includeObjectives,
            persona: includeObjectives,
          },
        },
      },
    });

    if (!sessionMember) {
      throw new NotFoundException(`Session ${sessionId} not found`);
    }

    const messages = sessionMember.messages
      .map((msg) => ({
        role: String(msg.role),
        content: typeof msg.content === 'string' ? msg.content : '',
        timestamp: msg.createdAt,
      }))
      .reverse();

    const lastUserMessage = messages
      .filter((m) => m.role === 'user')
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      )[0];

    const context: ConversationContext = {
      messages: messages.reverse(), // Chronological order
      conversationLength: messages.length,
      lastUserMessageAt: lastUserMessage?.timestamp,
    };

    if (includeObjectives && sessionMember.session?.scenario) {
      // Extract objectives from scenario config if available
      const scenarioConfig = sessionMember.session.scenario.config as Record<
        string,
        unknown
      > | null;
      const objectives = scenarioConfig?.objectives;
      if (Array.isArray(objectives)) {
        context.objectives = objectives
          .map((objective) =>
            typeof objective === 'string' ? objective : String(objective),
          )
          .filter(Boolean);
      }
    }

    return context;
  }

  /**
   * Build system prompt for hint generation
   */
  private buildHintGenerationPrompt(
    strategy: HintStrategy,
    context: ConversationContext,
    maxHints: number,
  ): string {
    let strategyGuidance = '';

    switch (strategy) {
      case HintStrategy.PROACTIVE:
        strategyGuidance =
          'Generate hints proactively to guide the conversation forward, anticipating what the user might need to discuss next.';
        break;
      case HintStrategy.REACTIVE:
        strategyGuidance =
          'Generate hints in response to user inactivity or lack of engagement, helping them re-engage with the conversation.';
        break;
      case HintStrategy.CONTEXTUAL:
        strategyGuidance =
          'Generate hints based on the current conversation context, identifying gaps or areas that need more exploration.';
        break;
      default:
        strategyGuidance = 'Generate helpful hints to guide the conversation.';
    }

    return `You are an AI assistant helping users have better conversations. Your task is to generate helpful hints that guide the user on what to talk about next.

${strategyGuidance}

Hint Types:
- "next_topic": Suggest the next logical topic to discuss
- "clarification": Ask for clarification on something mentioned
- "follow_up": Suggest a follow-up question or point
- "transition": Help transition to a new topic
- "objective": Remind about session objectives (if applicable)

Generate up to ${maxHints} hints in JSON format with the following structure:
{
  "hints": [
    {
      "type": "next_topic|clarification|follow_up|transition|objective",
      "content": "The hint text that will be shown to the user",
      "rationale": "Why this hint is relevant right now",
      "score": 0.0-1.0
    }
  ]
}

Guidelines:
- Each hint should be concise (1-2 sentences)
- Hints should be actionable and specific
- Score reflects relevance (0.0 = low, 1.0 = high)
- Order hints by relevance (most relevant first)
- Consider conversation flow and natural progression
- Be empathetic and encouraging
${context.objectives ? '- Align hints with session objectives when relevant' : ''}

Respond ONLY with valid JSON, no additional text.`;
  }

  /**
   * Format conversation context for LLM
   */
  private formatConversationForLLM(context: ConversationContext): string {
    let formatted = 'Current Conversation:\n\n';

    if (context.messages && context.messages.length > 0) {
      formatted += context.messages
        .map(
          (msg, idx) =>
            `${idx + 1}. [${msg.role.toUpperCase()}]: ${msg.content}`,
        )
        .join('\n');
    } else {
      formatted += '[No messages yet]';
    }

    if (context.objectives) {
      formatted += '\n\nSession Objectives:\n';
      formatted += context.objectives
        .map((obj, idx) => `${idx + 1}. ${obj}`)
        .join('\n');
    }

    if (context.conversationLength !== undefined) {
      formatted += `\n\nConversation Length: ${context.conversationLength} messages`;
    }

    if (context.lastUserMessageAt) {
      const timeSince =
        Date.now() - new Date(context.lastUserMessageAt).getTime();
      formatted += `\nTime Since Last User Message: ${Math.floor(timeSince / 1000)}s`;
    }

    return formatted;
  }

  /**
   * Parse hints from LLM response
   */
  private parseHintsFromLLMResponse(
    content: string,
    context: ConversationContext,
  ): HintDto[] {
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in LLM response');
      }

      const parsed = JSON.parse(jsonMatch[0]) as unknown;
      if (!isParsedHintsPayload(parsed)) {
        throw new Error('Invalid hints format in LLM response');
      }

      return parsed.hints.map((hint) => ({
        id: randomUUID(),
        type: hint.type,
        content: hint.content,
        rationale: hint.rationale,
        score: hint.score,
        generatedAt: new Date(),
        context: {
          conversationLength: context.conversationLength,
          lastUserMessage:
            context.messages?.[context.messages.length - 1]?.content,
          inactivityDuration: context.lastUserMessageAt
            ? Math.floor(
                (Date.now() - new Date(context.lastUserMessageAt).getTime()) /
                  1000,
              )
            : undefined,
          missingObjectives: context.pendingObjectives,
        },
      }));
    } catch (error) {
      const err = normalizeError(error);
      this.logger.error(
        `Error parsing hints from LLM response: ${err.message}`,
        err.stack,
      );
      // Fallback: return a generic hint
      return [
        {
          id: randomUUID(),
          type: HintType.NEXT_TOPIC,
          content:
            'Continue the conversation by exploring the topics discussed so far.',
          generatedAt: new Date(),
        },
      ];
    }
  }
}
