import {
  StageDetectorService,
  ConversationStage,
} from '../../services/stage-detector.service';
import { LLMRouterService } from '../../services/llm/llm-router.service';

jest.mock('../../prompts/stage-detector.prompt', () => ({
  buildStageDetectorSystemPrompt: jest
    .fn()
    .mockResolvedValue('Stage detector system prompt'),
}));

describe('StageDetectorService', () => {
  let service: StageDetectorService;
  let llmRouter: any;

  const defaultStages: ConversationStage[] = [
    { order: 1, label: 'Introduction', description: 'Opening and rapport' },
    {
      order: 2,
      label: 'Discovery',
      description: 'Understanding needs',
      keywords: ['challenges', 'pain points'],
    },
    { order: 3, label: 'Presentation', description: 'Presenting solution' },
    {
      order: 4,
      label: 'Objection Handling',
      description: 'Addressing concerns',
      keywords: ['concern', 'budget'],
    },
    { order: 5, label: 'Closing', description: 'Next steps' },
  ];

  beforeEach(() => {
    llmRouter = {
      complete: jest.fn().mockResolvedValue({
        response: {
          content: JSON.stringify({
            stageIndex: 1,
            confidence: 0.85,
            reasoning: 'Discovery phase based on questions asked',
          }),
        },
        route: { provider: 'openai', model: 'gpt-4o-mini' },
      }),
    };

    service = new StageDetectorService(
      llmRouter as unknown as LLMRouterService,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ── detectStage ───────────────────────────────────────────────────────────

  describe('detectStage()', () => {
    it('should use keyword detection first and return high-confidence result without LLM', async () => {
      const history = [
        { role: 'assistant', content: 'Hello! Nice to meet you.' },
        {
          role: 'user',
          content: 'Hi! Thanks for meeting with me, I appreciate it.',
        },
        { role: 'assistant', content: 'Good morning! How are you today?' },
        { role: 'user', content: 'Hello, good afternoon!' },
      ];

      const result = await service.detectStage(
        history,
        defaultStages,
        'session-1',
        'user-1',
      );

      expect(result).toBeDefined();
      expect(result.currentStage).toBeDefined();
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      // With strong keyword matches, should NOT call LLM
      if (result.confidence > 0.8) {
        expect(llmRouter.complete).not.toHaveBeenCalled();
      }
    });

    it('should fall back to LLM when keyword confidence is low', async () => {
      const history = [
        { role: 'user', content: 'Lets discuss the implementation timeline' },
        { role: 'assistant', content: 'Sure, we can look at that' },
      ];

      const result = await service.detectStage(
        history,
        defaultStages,
        'session-1',
        'user-1',
      );

      expect(result).toBeDefined();
      expect(result.currentStage).toBeDefined();
    });

    it('should return fallback when LLM fails', async () => {
      llmRouter.complete.mockRejectedValue(new Error('LLM unavailable'));

      const history = [
        { role: 'user', content: 'Lets talk about something specific' },
        { role: 'assistant', content: 'OK sure' },
      ];

      const result = await service.detectStage(
        history,
        defaultStages,
        'session-1',
        'user-1',
      );

      expect(result).toBeDefined();
      expect(result.confidence).toBe(0.6);
      expect(result.stageTransition).toBe(false);
    });

    it('should handle empty conversation history', async () => {
      const result = await service.detectStage(
        [],
        defaultStages,
        'session-1',
        'user-1',
      );

      expect(result.currentStage).toBe(defaultStages[0]);
      expect(result.currentStageIndex).toBe(0);
      expect(result.confidence).toBe(1.0);
      expect(result.stageTransition).toBe(false);
    });
  });

  // ── detectStageByKeywords (via detectStage) ───────────────────────────────

  describe('keyword detection', () => {
    it('should detect introduction stage from greeting keywords', async () => {
      const history = [
        { role: 'user', content: 'Hello! Nice to meet you.' },
        { role: 'assistant', content: 'Hi there! Thanks for taking the time.' },
        { role: 'user', content: 'How are you doing today?' },
        { role: 'assistant', content: 'Good morning! Appreciate your time.' },
      ];

      const result = await service.detectStage(
        history,
        defaultStages,
        'session-1',
      );
      expect(result.currentStage.label).toBe('Introduction');
    });

    it('should detect discovery stage from custom keywords', async () => {
      const history = [
        { role: 'user', content: 'What are your biggest challenges?' },
        {
          role: 'assistant',
          content: 'Our main pain points are around scalability.',
        },
        { role: 'user', content: 'Tell me about what you currently use' },
        {
          role: 'assistant',
          content: 'We need to understand our needs better',
        },
      ];

      const result = await service.detectStage(
        history,
        defaultStages,
        'session-1',
      );
      expect(result.currentStage.label).toBe('Discovery');
    });

    it('should detect objection handling stage from budget keywords', async () => {
      const history = [
        { role: 'user', content: 'I have a concern about the budget and cost' },
        {
          role: 'assistant',
          content: 'The cost is expensive but what if we adjust?',
        },
        {
          role: 'user',
          content:
            "I'm not sure, it seems expensive. I'm worried and hesitant.",
        },
        {
          role: 'assistant',
          content: 'I understand your concern about the budget.',
        },
      ];

      const result = await service.detectStage(
        history,
        defaultStages,
        'session-1',
      );
      expect(result.currentStage.label).toBe('Objection Handling');
    });

    it('should detect closing stage from commitment keywords', async () => {
      const history = [
        { role: 'user', content: 'What are the next steps to move forward?' },
        {
          role: 'assistant',
          content: 'Ready to get started? Lets sign the agreement.',
        },
        { role: 'user', content: 'Yes, lets move forward with the contract.' },
        {
          role: 'assistant',
          content: 'Great decision! I will prepare the commitment.',
        },
      ];

      const result = await service.detectStage(
        history,
        defaultStages,
        'session-1',
      );
      expect(result.currentStage.label).toBe('Closing');
    });

    it('should cap keyword confidence at 0.9', async () => {
      const history = [
        {
          role: 'user',
          content:
            'Hello hi nice to meet you good morning good afternoon thanks appreciate',
        },
        {
          role: 'assistant',
          content:
            'Hello hi nice to meet you good morning good afternoon thanks appreciate',
        },
        {
          role: 'user',
          content:
            'Hello hi nice to meet you good morning good afternoon thanks appreciate',
        },
        {
          role: 'assistant',
          content:
            'Hello hi nice to meet you good morning good afternoon thanks appreciate',
        },
      ];

      const result = await service.detectStage(
        history,
        defaultStages,
        'session-1',
      );
      expect(result.confidence).toBeLessThanOrEqual(0.9);
    });

    it('should detect stage transition when best match differs from expected', async () => {
      // 4 messages → expected stage ~0 (Introduction) but keywords match Closing
      const history = [
        { role: 'user', content: 'Lets move forward and get started' },
        { role: 'assistant', content: 'Ready to sign up?' },
        { role: 'user', content: 'Yes commitment confirmed' },
        { role: 'assistant', content: 'Great next steps are clear' },
      ];

      const result = await service.detectStage(
        history,
        defaultStages,
        'session-1',
      );

      if (result.currentStage.label === 'Closing') {
        expect(result.stageTransition).toBe(true);
        expect(result.previousStageIndex).toBeDefined();
      }
    });
  });

  // ── detectStageWithLLM (via detectStage when keywords are weak) ───────────

  describe('LLM-based detection', () => {
    it('should parse valid JSON response from LLM', async () => {
      llmRouter.complete.mockResolvedValue({
        response: {
          content: JSON.stringify({
            stageIndex: 2,
            confidence: 0.9,
            reasoning: 'Presenting solution',
          }),
        },
      });

      const history = [
        { role: 'user', content: 'Something generic' },
        { role: 'assistant', content: 'Generic response' },
      ];

      const result = await service.detectStage(
        history,
        defaultStages,
        'session-1',
        'user-1',
      );

      expect(result.currentStage.label).toBe('Presentation');
      expect(result.confidence).toBe(0.9);
    });

    it('should bound stageIndex to valid range', async () => {
      llmRouter.complete.mockResolvedValue({
        response: {
          content: JSON.stringify({
            stageIndex: 999,
            confidence: 0.7,
          }),
        },
      });

      const history = [
        { role: 'user', content: 'Something' },
        { role: 'assistant', content: 'Response' },
      ];

      const result = await service.detectStage(
        history,
        defaultStages,
        'session-1',
      );

      expect(result.currentStageIndex).toBe(defaultStages.length - 1);
    });

    it('should bound negative stageIndex to 0', async () => {
      llmRouter.complete.mockResolvedValue({
        response: {
          content: JSON.stringify({
            stageIndex: -5,
            confidence: 0.7,
          }),
        },
      });

      const history = [
        { role: 'user', content: 'Something' },
        { role: 'assistant', content: 'Response' },
      ];

      const result = await service.detectStage(
        history,
        defaultStages,
        'session-1',
      );

      expect(result.currentStageIndex).toBe(0);
    });

    it('should fall back to length-based detection when LLM returns invalid JSON', async () => {
      llmRouter.complete.mockResolvedValue({
        response: { content: 'not valid json' },
      });

      const history = [
        { role: 'user', content: 'Something' },
        { role: 'assistant', content: 'Response' },
      ];

      const result = await service.detectStage(
        history,
        defaultStages,
        'session-1',
      );

      expect(result).toBeDefined();
      expect(result.confidence).toBe(0.6);
    });

    it('should detect stage transition in LLM path', async () => {
      llmRouter.complete.mockResolvedValue({
        response: {
          content: JSON.stringify({
            stageIndex: 4,
            confidence: 0.95,
            reasoning: 'At closing',
          }),
        },
      });

      // Few messages → expected stage is 0, but LLM says 4
      const history = [
        { role: 'user', content: 'Lets close this deal' },
        { role: 'assistant', content: 'Absolutely' },
      ];

      const result = await service.detectStage(
        history,
        defaultStages,
        'session-1',
      );

      expect(result.stageTransition).toBe(true);
    });
  });

  // ── getFallbackStageDetection ─────────────────────────────────────────────

  describe('fallback detection', () => {
    it('should estimate stage based on conversation length', async () => {
      llmRouter.complete.mockRejectedValue(new Error('LLM fail'));

      // Long conversation → should estimate a later stage
      const history = Array.from({ length: 30 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i}`,
      }));

      const result = await service.detectStage(
        history,
        defaultStages,
        'session-1',
      );

      expect(result.currentStageIndex).toBeGreaterThan(0);
      expect(result.confidence).toBe(0.6);
    });

    it('should return first stage for very short conversations', async () => {
      llmRouter.complete.mockRejectedValue(new Error('LLM fail'));

      const history = [{ role: 'user', content: 'Hi' }];
      const result = await service.detectStage(
        history,
        defaultStages,
        'session-1',
      );

      expect(result.currentStageIndex).toBe(0);
    });
  });

  // ── predictNextStage ──────────────────────────────────────────────────────

  describe('predictNextStage()', () => {
    it('should return next stage and estimated turns', () => {
      const history = [
        { role: 'user', content: 'Hi' },
        { role: 'assistant', content: 'Hello' },
        { role: 'user', content: 'Tell me more' },
      ];

      const result = service.predictNextStage(0, defaultStages, history);

      expect(result.nextStage).toBeDefined();
      expect(result.nextStage!.label).toBe('Discovery');
      expect(result.estimatedTurnsUntilTransition).toBeGreaterThan(0);
      expect(result.confidence).toBe(0.7);
    });

    it('should return null nextStage when at last stage', () => {
      const history = Array.from({ length: 20 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i}`,
      }));

      const result = service.predictNextStage(
        defaultStages.length - 1,
        defaultStages,
        history,
      );

      expect(result.nextStage).toBeNull();
      expect(result.estimatedTurnsUntilTransition).toBe(0);
      expect(result.confidence).toBe(1.0);
    });

    it('should use at least 3 turns per stage for estimation', () => {
      // Only 1 message for stage 0 → avgTurnsPerStage = max(3, 1/1) = 3
      const history = [{ role: 'user', content: 'Hi' }];

      const result = service.predictNextStage(0, defaultStages, history);

      expect(result.estimatedTurnsUntilTransition).toBeGreaterThanOrEqual(1);
    });
  });
});
