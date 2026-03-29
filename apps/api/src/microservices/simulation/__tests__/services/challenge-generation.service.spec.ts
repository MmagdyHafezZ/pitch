import { ChallengeGenerationService } from '../../services/challenge-generation.service';

jest.mock('openai', () => {
  const mockCreate = jest.fn();
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: mockCreate,
      },
    },
  }));
});

describe('ChallengeGenerationService', () => {
  let service: ChallengeGenerationService;
  let mockCreate: jest.Mock;

  const validChallenge = {
    title: 'Enterprise SaaS Pitch',
    description: 'Pitch a CRM solution to a skeptical VP of Sales.',
    topic: 'SaaS CRM',
    scenarioPrompt:
      'You are pitching to the VP of Sales at Acme Corp. They currently use spreadsheets. The company has 200 employees.',
    evaluatorPersonaPrompt:
      'You are a skeptical VP of Sales. Challenge ROI claims. You are analytical.',
  };

  beforeEach(() => {
    service = new ChallengeGenerationService();
    mockCreate = (service as any).openai.chat.completions.create;
    mockCreate.mockReset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('generate()', () => {
    it('should generate a valid challenge for DAILY BEGINNER', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: JSON.stringify(validChallenge) } }],
      });

      const result = await service.generate('DAILY', 'BEGINNER');

      expect(result.title).toBe('Enterprise SaaS Pitch');
      expect(result.description).toBeDefined();
      expect(result.topic).toBe('SaaS CRM');
      expect(result.scenarioPrompt).toBeDefined();
      expect(result.evaluatorPersonaPrompt).toBeDefined();

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4o-mini',
          temperature: 0.85,
          response_format: { type: 'json_object' },
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'user',
              content: expect.stringContaining('quick 5-minute'),
            }),
          ]),
        }),
      );
    });

    it('should generate a challenge for WEEKLY INTERMEDIATE', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: JSON.stringify(validChallenge) } }],
      });

      const result = await service.generate('WEEKLY', 'INTERMEDIATE');

      expect(result).toBeDefined();
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: expect.stringContaining('extended 15-minute'),
            }),
          ]),
        }),
      );
    });

    it('should generate a challenge for MONTHLY EXPERT', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: JSON.stringify(validChallenge) } }],
      });

      const result = await service.generate('MONTHLY', 'EXPERT');

      expect(result).toBeDefined();
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: expect.stringContaining('complex enterprise'),
            }),
          ]),
        }),
      );
    });

    it('should include MASTER difficulty context', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: JSON.stringify(validChallenge) } }],
      });

      await service.generate('DAILY', 'MASTER');

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: expect.stringContaining('C-suite executive'),
            }),
          ]),
        }),
      );
    });

    it('should throw when response is incomplete (missing title)', async () => {
      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                description: 'Some desc',
                topic: 'Topic',
                scenarioPrompt: '',
                evaluatorPersonaPrompt: '',
              }),
            },
          },
        ],
      });

      await expect(service.generate('DAILY', 'BEGINNER')).rejects.toThrow(
        'Incomplete challenge generation response',
      );
    });

    it('should throw when response is incomplete (missing scenarioPrompt)', async () => {
      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                title: 'Good Title',
                description: 'Some desc',
                topic: 'Topic',
                scenarioPrompt: '',
                evaluatorPersonaPrompt: 'Valid persona',
              }),
            },
          },
        ],
      });

      await expect(service.generate('DAILY', 'BEGINNER')).rejects.toThrow(
        'Incomplete challenge generation response',
      );
    });

    it('should throw when response is incomplete (missing evaluatorPersonaPrompt)', async () => {
      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                title: 'Good Title',
                description: 'Some desc',
                topic: 'Topic',
                scenarioPrompt: 'Valid scenario',
                evaluatorPersonaPrompt: '',
              }),
            },
          },
        ],
      });

      await expect(service.generate('DAILY', 'BEGINNER')).rejects.toThrow(
        'Incomplete challenge generation response',
      );
    });

    it('should handle empty choices from OpenAI', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: '{}' } }],
      });

      await expect(service.generate('DAILY', 'BEGINNER')).rejects.toThrow(
        'Incomplete challenge generation response',
      );
    });

    it('should handle null content from OpenAI', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: null } }],
      });

      // JSON.parse('{}') → {} which has no title → throws incomplete
      await expect(service.generate('DAILY', 'BEGINNER')).rejects.toThrow();
    });

    it('should propagate OpenAI API errors', async () => {
      mockCreate.mockRejectedValue(new Error('Rate limit exceeded'));

      await expect(service.generate('DAILY', 'BEGINNER')).rejects.toThrow(
        'Rate limit exceeded',
      );
    });
  });
});
