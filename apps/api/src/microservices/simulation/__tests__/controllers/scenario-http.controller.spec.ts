import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ScenarioHttpController } from '../../controllers/scenario-http.controller';
import { ScenarioService } from '../../services/scenario.service';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockScenario = {
  id: 'scenario-1',
  title: 'Enterprise SaaS Pitch',
  orgId: 'org-1',
  description: 'Practice pitching to an enterprise buyer',
  config: { durationMinutes: 30 },
  createdAt: new Date('2024-01-01'),
};

const mockScenarioList = {
  scenarios: [mockScenario],
  total: 1,
};

const mockScenarioService = {
  generate: jest.fn(),
  generateBatch: jest.fn(),
  findAll: jest.fn(),
  findById: jest.fn(),
};

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('ScenarioHttpController', () => {
  let controller: ScenarioHttpController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ScenarioHttpController],
      providers: [{ provide: ScenarioService, useValue: mockScenarioService }],
    }).compile();

    controller = module.get<ScenarioHttpController>(ScenarioHttpController);
  });

  // -------------------------------------------------------------------------
  // generateScenario
  // -------------------------------------------------------------------------
  describe('generateScenario', () => {
    it('generates a scenario and returns it', async () => {
      const payload = {
        orgId: 'org-1',
        topic: 'SaaS sales',
        difficulty: 'INTERMEDIATE',
      } as any;

      mockScenarioService.generate.mockResolvedValue(mockScenario);

      const result = await controller.generateScenario(payload);

      expect(mockScenarioService.generate).toHaveBeenCalledWith(payload);
      expect(result).toEqual(mockScenario);
    });

    it('propagates BadRequestException on invalid payload', async () => {
      const payload = { orgId: '' } as any;
      const error = new Error('Validation failed');
      mockScenarioService.generate.mockRejectedValue(error);

      await expect(controller.generateScenario(payload)).rejects.toThrow(
        'Validation failed',
      );
    });

    it('propagates internal server errors', async () => {
      mockScenarioService.generate.mockRejectedValue(
        new Error('LLM unavailable'),
      );

      await expect(controller.generateScenario({} as any)).rejects.toThrow(
        'LLM unavailable',
      );
    });
  });

  // -------------------------------------------------------------------------
  // generateScenarioBatch
  // -------------------------------------------------------------------------
  describe('generateScenarioBatch', () => {
    it('generates multiple scenarios and returns the list', async () => {
      const payload = {
        orgId: 'org-1',
        count: 3,
        topics: ['SaaS', 'E-commerce', 'FinTech'],
      } as any;

      const batchResult = {
        scenarios: [mockScenario, { ...mockScenario, id: 'scenario-2' }],
        total: 2,
      };
      mockScenarioService.generateBatch.mockResolvedValue(batchResult);

      const result = await controller.generateScenarioBatch(payload);

      expect(mockScenarioService.generateBatch).toHaveBeenCalledWith(payload);
      expect(result).toEqual(batchResult);
    });

    it('propagates errors from the service', async () => {
      const payload = { count: 0 } as any;
      mockScenarioService.generateBatch.mockRejectedValue(
        new Error('Batch generation failed'),
      );

      await expect(controller.generateScenarioBatch(payload)).rejects.toThrow(
        'Batch generation failed',
      );
    });

    it('handles a batch of one scenario', async () => {
      const payload = { orgId: 'org-1', count: 1 } as any;
      mockScenarioService.generateBatch.mockResolvedValue({
        scenarios: [mockScenario],
        total: 1,
      });

      const result = await controller.generateScenarioBatch(payload);

      expect(result.scenarios).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------------------
  // listScenarios
  // -------------------------------------------------------------------------
  describe('listScenarios', () => {
    it('returns all scenarios when orgId is not provided', async () => {
      mockScenarioService.findAll.mockResolvedValue(mockScenarioList);

      const result = await controller.listScenarios(undefined);

      expect(mockScenarioService.findAll).toHaveBeenCalledWith(undefined);
      expect(result).toEqual(mockScenarioList);
    });

    it('filters scenarios by orgId when provided', async () => {
      mockScenarioService.findAll.mockResolvedValue(mockScenarioList);

      const result = await controller.listScenarios('org-1');

      expect(mockScenarioService.findAll).toHaveBeenCalledWith('org-1');
      expect(result).toEqual(mockScenarioList);
    });

    it('returns empty list when no scenarios match', async () => {
      mockScenarioService.findAll.mockResolvedValue({
        scenarios: [],
        total: 0,
      });

      const result = await controller.listScenarios('org-empty');

      expect((result as any).scenarios).toHaveLength(0);
    });

    it('propagates errors from the service', async () => {
      mockScenarioService.findAll.mockRejectedValue(new Error('DB error'));

      await expect(controller.listScenarios('org-1')).rejects.toThrow(
        'DB error',
      );
    });
  });

  // -------------------------------------------------------------------------
  // getScenario
  // -------------------------------------------------------------------------
  describe('getScenario', () => {
    it('returns a scenario for a valid id', async () => {
      mockScenarioService.findById.mockResolvedValue(mockScenario);

      const result = await controller.getScenario('scenario-1');

      expect(mockScenarioService.findById).toHaveBeenCalledWith('scenario-1');
      expect(result).toEqual(mockScenario);
    });

    it('propagates NotFoundException when scenario does not exist', async () => {
      mockScenarioService.findById.mockRejectedValue(
        new NotFoundException('Scenario not found'),
      );

      await expect(controller.getScenario('missing-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('propagates generic errors', async () => {
      mockScenarioService.findById.mockRejectedValue(
        new Error('Unexpected DB error'),
      );

      await expect(controller.getScenario('scenario-1')).rejects.toThrow(
        'Unexpected DB error',
      );
    });
  });
});
