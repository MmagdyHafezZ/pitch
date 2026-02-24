import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { LLMRouterService } from './llm/llm-router.service';
import { buildStageDetectorSystemPrompt } from '../prompts/stage-detector.prompt';

export interface ConversationStage {
  order: number;
  label: string;
  description?: string;
  keywords?: string[];
}

export interface StageDetectionResult {
  currentStage: ConversationStage;
  confidence: number;
  stageTransition: boolean;
  previousStageIndex?: number;
  currentStageIndex: number;
  reasoning?: string;
}

@Injectable()
export class StageDetectorService {
  private readonly logger = new Logger(StageDetectorService.name);

  constructor(private readonly llmRouter: LLMRouterService) {}

  /**
   * Detect current conversation stage using LLM analysis
   */
  async detectStage(
    conversationHistory: Array<{ role: string; content: string }>,
    plannedStages: ConversationStage[],
    sessionId: string,
    userId?: string,
  ): Promise<StageDetectionResult> {
    try {
      // Quick keyword-based detection first (fast path)
      const keywordResult = this.detectStageByKeywords(
        conversationHistory,
        plannedStages,
      );

      // For high-confidence keyword matches, skip LLM analysis
      if (keywordResult.confidence > 0.8) {
        return keywordResult;
      }

      // Use LLM for more nuanced detection (slow path)
      return await this.detectStageWithLLM(
        conversationHistory,
        plannedStages,
        sessionId,
        userId,
      );
    } catch (error) {
      this.logger.error('Stage detection failed, using fallback', error);
      return this.getFallbackStageDetection(conversationHistory, plannedStages);
    }
  }

  /**
   * Fast keyword-based stage detection
   */
  private detectStageByKeywords(
    conversationHistory: Array<{ role: string; content: string }>,
    plannedStages: ConversationStage[],
  ): StageDetectionResult {
    if (conversationHistory.length === 0 || plannedStages.length === 0) {
      return {
        currentStage: plannedStages[0],
        currentStageIndex: 0,
        confidence: 1.0,
        stageTransition: false,
      };
    }

    // Get last few messages for context (last 4 messages)
    const recentMessages = conversationHistory.slice(-4);
    const recentText = recentMessages
      .map((m) => m.content.toLowerCase())
      .join(' ');

    // Default keyword patterns for common sales stages
    const stagePatterns = this.getDefaultStagePatterns();

    let bestMatch = 0;
    let bestScore = 0;

    plannedStages.forEach((stage, index) => {
      const stageKeywords = stage.keywords || [];
      const defaultKeywords = stagePatterns[stage.label.toLowerCase()] || [];
      const allKeywords = [...stageKeywords, ...defaultKeywords];

      let score = 0;
      allKeywords.forEach((keyword) => {
        if (recentText.includes(keyword.toLowerCase())) {
          score++;
        }
      });

      // Normalize score
      const normalizedScore =
        allKeywords.length > 0 ? score / allKeywords.length : 0;

      if (normalizedScore > bestScore) {
        bestScore = normalizedScore;
        bestMatch = index;
      }
    });

    // Determine if this is a stage transition
    const estimatedProgress =
      conversationHistory.length / (plannedStages.length * 3);
    const expectedStageIndex = Math.min(
      plannedStages.length - 1,
      Math.floor(estimatedProgress * plannedStages.length),
    );

    const stageTransition = bestMatch !== expectedStageIndex;

    return {
      currentStage: plannedStages[bestMatch],
      currentStageIndex: bestMatch,
      confidence: Math.min(0.9, bestScore),
      stageTransition,
      previousStageIndex: stageTransition ? expectedStageIndex : undefined,
    };
  }

  /**
   * LLM-based stage detection for more accurate results
   */
  private async detectStageWithLLM(
    conversationHistory: Array<{ role: string; content: string }>,
    plannedStages: ConversationStage[],
    sessionId: string,
    userId?: string,
  ): Promise<StageDetectionResult> {
    const stagesList = plannedStages
      .map((s, i) => `${i}. ${s.label}: ${s.description || ''}`)
      .join('\n');

    const recentMessages = conversationHistory.slice(-6);
    const conversationText = recentMessages
      .map((m) => `${m.role}: ${m.content}`)
      .join('\n');

    const systemPrompt = await buildStageDetectorSystemPrompt(stagesList);

    const userPrompt = `Analyze this recent conversation:

${conversationText}

Which stage is this conversation in?`;

    try {
      const response = await this.llmRouter.complete(
        {
          sessionId: `stage-detect:${sessionId}`,
          userId,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          config: {
            model: 'gpt-4o-mini',
            temperature: 0.3,
            maxTokens: 200,
          },
        },
        {
          userId,
          requestId: randomUUID(),
          purpose: 'stage_detection',
        },
      );

      const result = this.parseStageDetectionResponse(
        response.response.content ?? '',
        plannedStages,
      );

      // Check if this is a stage transition
      const estimatedIndex = Math.min(
        plannedStages.length - 1,
        Math.floor(
          (conversationHistory.length / (plannedStages.length * 3)) *
            plannedStages.length,
        ),
      );

      const stageTransition = result.currentStageIndex !== estimatedIndex;

      return {
        ...result,
        stageTransition,
        previousStageIndex: stageTransition ? estimatedIndex : undefined,
      };
    } catch (error) {
      this.logger.error('LLM stage detection failed', error);
      return this.getFallbackStageDetection(conversationHistory, plannedStages);
    }
  }

  /**
   * Parse LLM response for stage detection
   */
  private parseStageDetectionResponse(
    content: string,
    plannedStages: ConversationStage[],
  ): StageDetectionResult {
    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]) as unknown;
      const payload =
        parsed && typeof parsed === 'object'
          ? (parsed as Record<string, unknown>)
          : {};
      const stageIndex =
        typeof payload.stageIndex === 'number' ? payload.stageIndex : 0;
      const confidence =
        typeof payload.confidence === 'number' ? payload.confidence : 0.5;
      const reasoning =
        typeof payload.reasoning === 'string' ? payload.reasoning : undefined;
      const boundedStageIndex = Math.max(
        0,
        Math.min(plannedStages.length - 1, stageIndex),
      );

      return {
        currentStage: plannedStages[boundedStageIndex],
        currentStageIndex: boundedStageIndex,
        confidence: Math.max(0, Math.min(1, confidence)),
        stageTransition: false, // Will be set by caller
        reasoning,
      };
    } catch (error) {
      throw new Error(`Failed to parse stage detection response: ${error}`);
    }
  }

  /**
   * Fallback stage detection based on conversation length
   */
  private getFallbackStageDetection(
    conversationHistory: Array<{ role: string; content: string }>,
    plannedStages: ConversationStage[],
  ): StageDetectionResult {
    const turnCount = conversationHistory.length;
    const estimatedStageIndex = Math.min(
      plannedStages.length - 1,
      Math.floor(
        (turnCount / (plannedStages.length * 3)) * plannedStages.length,
      ),
    );

    return {
      currentStage: plannedStages[estimatedStageIndex],
      currentStageIndex: estimatedStageIndex,
      confidence: 0.6,
      stageTransition: false,
    };
  }

  /**
   * Default keyword patterns for common conversation stages
   */
  private getDefaultStagePatterns(): Record<string, string[]> {
    return {
      introduction: [
        'hello',
        'hi',
        'nice to meet',
        'how are you',
        'thanks for',
        'appreciate',
        'good morning',
        'good afternoon',
      ],
      discovery: [
        'tell me about',
        'what are',
        'describe',
        'challenges',
        'pain points',
        'currently using',
        'how do you',
        'what is your',
        'understand',
        'needs',
      ],
      presentation: [
        'our solution',
        'we offer',
        'feature',
        'benefit',
        'helps you',
        'allows',
        'can help',
        'designed to',
        'provides',
      ],
      'objection handling': [
        'concern',
        'worried',
        'but',
        'however',
        'expensive',
        'cost',
        'budget',
        'not sure',
        'hesitant',
        'what if',
      ],
      closing: [
        'next steps',
        'move forward',
        'get started',
        'sign up',
        'contract',
        'agreement',
        'decision',
        'ready to',
        'commitment',
      ],
    };
  }

  /**
   * Predict next stage based on current progress
   */
  predictNextStage(
    currentStageIndex: number,
    plannedStages: ConversationStage[],
    conversationHistory: Array<{ role: string; content: string }>,
  ): {
    nextStage: ConversationStage | null;
    estimatedTurnsUntilTransition: number;
    confidence: number;
  } {
    if (currentStageIndex >= plannedStages.length - 1) {
      return {
        nextStage: null,
        estimatedTurnsUntilTransition: 0,
        confidence: 1.0,
      };
    }

    const nextStage = plannedStages[currentStageIndex + 1];

    // Estimate turns per stage based on total stages and conversation so far
    const avgTurnsPerStage = Math.max(
      3,
      conversationHistory.length / (currentStageIndex + 1),
    );
    const estimatedTurns = Math.round(avgTurnsPerStage * 0.7); // Assume 70% through current stage

    return {
      nextStage,
      estimatedTurnsUntilTransition: estimatedTurns,
      confidence: 0.7,
    };
  }
}
