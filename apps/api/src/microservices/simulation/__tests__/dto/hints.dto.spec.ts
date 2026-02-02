import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import {
  GenerateHintRequestDto,
  GetHintHistoryRequestDto,
  HintStrategy,
  HintType,
} from '../../dto/hints.dto';

describe('Hints DTOs', () => {
  describe('GenerateHintRequestDto', () => {
    it('should pass validation with valid data', async () => {
      const data = {
        sessionId: 'session_123',
        turnId: 'turn_456',
        strategy: HintStrategy.REACTIVE,
        maxHints: 3,
        includeObjectives: true,
        userId: 'user_789',
        orgId: 'org_123',
      };

      const dto = plainToInstance(GenerateHintRequestDto, data);
      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    });

    it('should pass validation with minimal required data', async () => {
      const data = {
        sessionId: 'session_123',
      };

      const dto = plainToInstance(GenerateHintRequestDto, data);
      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    });

    it('should fail validation when sessionId is missing', async () => {
      const data = {
        userId: 'user_789',
      };

      const dto = plainToInstance(GenerateHintRequestDto, data);
      const errors = await validate(dto);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('sessionId');
    });

    it('should fail validation when sessionId is not a string', async () => {
      const data = {
        sessionId: 12345,
      };

      const dto = plainToInstance(GenerateHintRequestDto, data);
      const errors = await validate(dto);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('sessionId');
    });

    it('should validate strategy enum values', async () => {
      const validStrategies = [
        HintStrategy.PROACTIVE,
        HintStrategy.REACTIVE,
        HintStrategy.CONTEXTUAL,
      ];

      for (const strategy of validStrategies) {
        const data = {
          sessionId: 'session_123',
          strategy,
        };

        const dto = plainToInstance(GenerateHintRequestDto, data);
        const errors = await validate(dto);

        expect(errors).toHaveLength(0);
      }
    });

    it('should fail validation with invalid strategy', async () => {
      const data = {
        sessionId: 'session_123',
        strategy: 'invalid_strategy',
      };

      const dto = plainToInstance(GenerateHintRequestDto, data);
      const errors = await validate(dto);

      expect(errors.length).toBeGreaterThan(0);
      const strategyError = errors.find((e) => e.property === 'strategy');
      expect(strategyError).toBeDefined();
    });

    it('should validate maxHints constraints', async () => {
      // Valid value
      let data = {
        sessionId: 'session_123',
        maxHints: 5,
      };

      let dto = plainToInstance(GenerateHintRequestDto, data);
      let errors = await validate(dto);
      expect(errors).toHaveLength(0);

      // Below minimum (should fail)
      data = {
        sessionId: 'session_123',
        maxHints: 0,
      };

      dto = plainToInstance(GenerateHintRequestDto, data);
      errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);

      // Above maximum (should fail)
      data = {
        sessionId: 'session_123',
        maxHints: 11,
      };

      dto = plainToInstance(GenerateHintRequestDto, data);
      errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should fail validation when maxHints is not a number', async () => {
      const data = {
        sessionId: 'session_123',
        maxHints: 'five',
      };

      const dto = plainToInstance(GenerateHintRequestDto, data);
      const errors = await validate(dto);

      expect(errors.length).toBeGreaterThan(0);
      const maxHintsError = errors.find((e) => e.property === 'maxHints');
      expect(maxHintsError).toBeDefined();
    });

    it('should validate boolean fields', async () => {
      const data = {
        sessionId: 'session_123',
        includeObjectives: true,
      };

      const dto = plainToInstance(GenerateHintRequestDto, data);
      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    });

    it('should fail validation when includeObjectives is not a boolean', async () => {
      const data = {
        sessionId: 'session_123',
        includeObjectives: 'yes',
      };

      const dto = plainToInstance(GenerateHintRequestDto, data);
      const errors = await validate(dto);

      expect(errors.length).toBeGreaterThan(0);
    });

    it('should validate array of messages', async () => {
      const data = {
        sessionId: 'session_123',
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there!' },
        ],
      };

      const dto = plainToInstance(GenerateHintRequestDto, data);
      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    });

    it('should fail validation with invalid messages array', async () => {
      const data = {
        sessionId: 'session_123',
        messages: [{ role: 'invalid_role', content: 'Hello' }],
      };

      const dto = plainToInstance(GenerateHintRequestDto, data);
      const errors = await validate(dto);

      expect(errors.length).toBeGreaterThan(0);
    });

    it('should validate llmConfigOverride as object', async () => {
      const data = {
        sessionId: 'session_123',
        llmConfigOverride: {
          provider: 'openai',
          model: 'gpt-4o-mini',
          temperature: 0.7,
          maxTokens: 500,
        },
      };

      const dto = plainToInstance(GenerateHintRequestDto, data);
      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    });
  });

  describe('GetHintHistoryRequestDto', () => {
    it('should pass validation with valid data', async () => {
      const data = {
        sessionId: 'session_123',
        limit: 10,
        type: HintType.NEXT_TOPIC,
        userId: 'user_789',
      };

      const dto = plainToInstance(GetHintHistoryRequestDto, data);
      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    });

    it('should pass validation with minimal data', async () => {
      const data = {
        sessionId: 'session_123',
      };

      const dto = plainToInstance(GetHintHistoryRequestDto, data);
      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    });

    it('should fail validation when sessionId is missing', async () => {
      const data = {
        limit: 10,
      };

      const dto = plainToInstance(GetHintHistoryRequestDto, data);
      const errors = await validate(dto);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('sessionId');
    });

    it('should validate limit constraints', async () => {
      // Valid values
      const validLimits = [1, 50, 100];
      for (const limit of validLimits) {
        const data = {
          sessionId: 'session_123',
          limit,
        };

        const dto = plainToInstance(GetHintHistoryRequestDto, data);
        const errors = await validate(dto);
        expect(errors).toHaveLength(0);
      }

      // Invalid values
      const invalidLimits = [0, -1, 101];
      for (const limit of invalidLimits) {
        const data = {
          sessionId: 'session_123',
          limit,
        };

        const dto = plainToInstance(GetHintHistoryRequestDto, data);
        const errors = await validate(dto);
        expect(errors.length).toBeGreaterThan(0);
      }
    });

    it('should validate type enum values', async () => {
      const validTypes = [
        HintType.NEXT_TOPIC,
        HintType.CLARIFICATION,
        HintType.FOLLOW_UP,
        HintType.TRANSITION,
        HintType.OBJECTIVE,
      ];

      for (const type of validTypes) {
        const data = {
          sessionId: 'session_123',
          type,
        };

        const dto = plainToInstance(GetHintHistoryRequestDto, data);
        const errors = await validate(dto);

        expect(errors).toHaveLength(0);
      }
    });

    it('should fail validation with invalid type', async () => {
      const data = {
        sessionId: 'session_123',
        type: 'invalid_type',
      };

      const dto = plainToInstance(GetHintHistoryRequestDto, data);
      const errors = await validate(dto);

      expect(errors.length).toBeGreaterThan(0);
      const typeError = errors.find((e) => e.property === 'type');
      expect(typeError).toBeDefined();
    });
  });

  describe('HintStrategy enum', () => {
    it('should have correct enum values', () => {
      expect(HintStrategy.PROACTIVE).toBe('proactive');
      expect(HintStrategy.REACTIVE).toBe('reactive');
      expect(HintStrategy.CONTEXTUAL).toBe('contextual');
    });
  });

  describe('HintType enum', () => {
    it('should have correct enum values', () => {
      expect(HintType.NEXT_TOPIC).toBe('next_topic');
      expect(HintType.CLARIFICATION).toBe('clarification');
      expect(HintType.FOLLOW_UP).toBe('follow_up');
      expect(HintType.TRANSITION).toBe('transition');
      expect(HintType.OBJECTIVE).toBe('objective');
    });
  });
});
