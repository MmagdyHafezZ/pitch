import { NotFoundException } from '@nestjs/common';
import { ScenarioService } from '../../services/scenario.service';
import type { ScenarioRepository } from '../../repositories/scenario.repository';
import type { LLMService } from '../../services/llm/llm.service';
import type { LLMRoutingConfigService } from '../../services/llm/llm-routing-config.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeScenarioRepo = (): jest.Mocked<ScenarioRepository> =>
  ({
    create: jest.fn(),
    findMany: jest.fn(),
    findById: jest.fn(),
  }) as unknown as jest.Mocked<ScenarioRepository>;

const makeLlmService = (): jest.Mocked<LLMService> =>
  ({
    complete: jest.fn(),
  }) as unknown as jest.Mocked<LLMService>;

const makeRoutingConfigService = (): jest.Mocked<LLMRoutingConfigService> =>
  ({
    getActiveConfig: jest.fn(),
  }) as unknown as jest.Mocked<LLMRoutingConfigService>;

const now = new Date('2026-03-24T00:00:00.000Z');

const stubScenario = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'sc-1',
  orgId: 'org-1',
  name: 'Generated Scenario',
  description: 'A sales scenario',
  config: { objective: 'Qualify lead' },
  createdAt: now,
  updatedAt: now,
  ...overrides,
});

const stubRequest = (overrides: Partial<Record<string, unknown>> = {}) => ({
  orgId: 'org-1',
  requestedBy: 'user-1',
  language: 'en-US',
  ...overrides,
});

const defaultRoutingConfig = {
  defaultRoute: { provider: 'openai', model: 'gpt-4o' },
};

// Mock the buildScenarioSystemPrompt function used inside the service
jest.mock('../../prompts/scenario.prompt', () => ({
  buildScenarioSystemPrompt: jest.fn().mockResolvedValue('system-prompt'),
}));

// ---------------------------------------------------------------------------
// generate()
// ---------------------------------------------------------------------------

describe('ScenarioService.generate', () => {
  it('calls LLM, persists scenario, and returns mapped response', async () => {
    const repo = makeScenarioRepo();
    const llm = makeLlmService();
    const routing = makeRoutingConfigService();
    const service = new ScenarioService(repo, llm, routing);

    routing.getActiveConfig.mockResolvedValue(defaultRoutingConfig as any);
    llm.complete.mockResolvedValue({
      content: JSON.stringify({
        name: 'My Scenario',
        description: 'Practice discovery calls',
        config: { tags: ['sales'] },
      }),
    } as any);
    repo.create.mockResolvedValue(stubScenario({ name: 'My Scenario' }) as any);

    const result = await service.generate(stubRequest() as any);

    expect(llm.complete).toHaveBeenCalledTimes(1);
    expect(repo.create).toHaveBeenCalledTimes(1);
    expect(result.id).toBe('sc-1');
    expect(result.createdAt).toBe(now.toISOString());
  });

  it('uses fallback name when LLM content has no parseable JSON', async () => {
    const repo = makeScenarioRepo();
    const llm = makeLlmService();
    const routing = makeRoutingConfigService();
    const service = new ScenarioService(repo, llm, routing);

    routing.getActiveConfig.mockResolvedValue(defaultRoutingConfig as any);
    llm.complete.mockResolvedValue({
      content: 'Sorry, I could not generate a scenario right now.',
    } as any);
    repo.create.mockResolvedValue(stubScenario() as any);

    await service.generate(stubRequest({ name: 'Seed Name' }) as any);

    const createArg = repo.create.mock.calls[0][0] as any;
    expect(createArg.name).toBe('Seed Name');
  });

  it('uses "Generated Scenario" as fallback when no name provided and LLM fails to parse', async () => {
    const repo = makeScenarioRepo();
    const llm = makeLlmService();
    const routing = makeRoutingConfigService();
    const service = new ScenarioService(repo, llm, routing);

    routing.getActiveConfig.mockResolvedValue(defaultRoutingConfig as any);
    llm.complete.mockResolvedValue({ content: 'no json here' } as any);
    repo.create.mockResolvedValue(stubScenario() as any);

    await service.generate(stubRequest() as any);

    const createArg = repo.create.mock.calls[0][0] as any;
    expect(createArg.name).toBe('Generated Scenario');
  });

  it('falls back to openai/gpt-4o when routing config has no defaultRoute', async () => {
    const repo = makeScenarioRepo();
    const llm = makeLlmService();
    const routing = makeRoutingConfigService();
    const service = new ScenarioService(repo, llm, routing);

    routing.getActiveConfig.mockResolvedValue({ defaultRoute: null } as any);
    llm.complete.mockResolvedValue({ content: '' } as any);
    repo.create.mockResolvedValue(stubScenario() as any);

    await service.generate(stubRequest() as any);

    const llmArg = llm.complete.mock.calls[0][0] as any;
    expect(llmArg.config.provider).toBe('openai');
    expect(llmArg.config.model).toBe('gpt-4o');
  });

  it('parses JSON wrapped in a fenced code block', async () => {
    const repo = makeScenarioRepo();
    const llm = makeLlmService();
    const routing = makeRoutingConfigService();
    const service = new ScenarioService(repo, llm, routing);

    routing.getActiveConfig.mockResolvedValue(defaultRoutingConfig as any);
    llm.complete.mockResolvedValue({
      content:
        '```json\n{"name":"Fenced Scenario","description":"from fence"}\n```',
    } as any);
    repo.create.mockResolvedValue(
      stubScenario({ name: 'Fenced Scenario' }) as any,
    );

    await service.generate(stubRequest() as any);

    const createArg = repo.create.mock.calls[0][0] as any;
    expect(createArg.name).toBe('Fenced Scenario');
  });

  it('handles LLM returning invalid JSON gracefully (uses fallback)', async () => {
    const repo = makeScenarioRepo();
    const llm = makeLlmService();
    const routing = makeRoutingConfigService();
    const service = new ScenarioService(repo, llm, routing);

    routing.getActiveConfig.mockResolvedValue(defaultRoutingConfig as any);
    llm.complete.mockResolvedValue({ content: '{broken json}}' } as any);
    repo.create.mockResolvedValue(stubScenario() as any);

    await service.generate(stubRequest() as any);

    // Should not throw, just use fallback name
    expect(repo.create).toHaveBeenCalledTimes(1);
  });

  it('merges base config with parsed config from LLM', async () => {
    const repo = makeScenarioRepo();
    const llm = makeLlmService();
    const routing = makeRoutingConfigService();
    const service = new ScenarioService(repo, llm, routing);

    routing.getActiveConfig.mockResolvedValue(defaultRoutingConfig as any);
    llm.complete.mockResolvedValue({
      content: JSON.stringify({
        name: 'Merged',
        config: { extra: 'value' },
      }),
    } as any);
    repo.create.mockResolvedValue(stubScenario() as any);

    await service.generate(
      stubRequest({ objective: 'Sell more', tags: ['sales'] }) as any,
    );

    const createArg = repo.create.mock.calls[0][0] as any;
    expect(createArg.config).toMatchObject({
      objective: 'Sell more',
      tags: ['sales'],
      extra: 'value',
    });
  });
});

// ---------------------------------------------------------------------------
// generateBatch()
// ---------------------------------------------------------------------------

describe('ScenarioService.generateBatch', () => {
  it('generates exactly count scenarios', async () => {
    const repo = makeScenarioRepo();
    const llm = makeLlmService();
    const routing = makeRoutingConfigService();
    const service = new ScenarioService(repo, llm, routing);

    routing.getActiveConfig.mockResolvedValue(defaultRoutingConfig as any);
    llm.complete.mockResolvedValue({ content: '' } as any);
    repo.create.mockResolvedValue(stubScenario() as any);

    const result = await service.generateBatch(
      stubRequest({ count: 3 }) as any,
    );

    expect(result.total).toBe(3);
    expect(result.scenarios).toHaveLength(3);
    expect(repo.create).toHaveBeenCalledTimes(3);
  });

  it('defaults count to 3 when not provided', async () => {
    const repo = makeScenarioRepo();
    const llm = makeLlmService();
    const routing = makeRoutingConfigService();
    const service = new ScenarioService(repo, llm, routing);

    routing.getActiveConfig.mockResolvedValue(defaultRoutingConfig as any);
    llm.complete.mockResolvedValue({ content: '' } as any);
    repo.create.mockResolvedValue(stubScenario() as any);

    const result = await service.generateBatch(stubRequest() as any);

    expect(result.scenarios).toHaveLength(3);
  });

  it('clamps count to minimum of 1', async () => {
    const repo = makeScenarioRepo();
    const llm = makeLlmService();
    const routing = makeRoutingConfigService();
    const service = new ScenarioService(repo, llm, routing);

    routing.getActiveConfig.mockResolvedValue(defaultRoutingConfig as any);
    llm.complete.mockResolvedValue({ content: '' } as any);
    repo.create.mockResolvedValue(stubScenario() as any);

    const result = await service.generateBatch(
      stubRequest({ count: 0 }) as any,
    );

    expect(result.scenarios).toHaveLength(1);
  });

  it('clamps count to maximum of 5', async () => {
    const repo = makeScenarioRepo();
    const llm = makeLlmService();
    const routing = makeRoutingConfigService();
    const service = new ScenarioService(repo, llm, routing);

    routing.getActiveConfig.mockResolvedValue(defaultRoutingConfig as any);
    llm.complete.mockResolvedValue({ content: '' } as any);
    repo.create.mockResolvedValue(stubScenario() as any);

    const result = await service.generateBatch(
      stubRequest({ count: 10 }) as any,
    );

    expect(result.scenarios).toHaveLength(5);
  });
});

// ---------------------------------------------------------------------------
// findAll()
// ---------------------------------------------------------------------------

describe('ScenarioService.findAll', () => {
  it('returns all scenarios mapped to response DTOs', async () => {
    const repo = makeScenarioRepo();
    const service = new ScenarioService(
      repo,
      makeLlmService(),
      makeRoutingConfigService(),
    );

    repo.findMany.mockResolvedValue([stubScenario()] as any);

    const result = await service.findAll();

    expect(repo.findMany).toHaveBeenCalledWith(undefined);
    expect(result.total).toBe(1);
    expect(result.scenarios[0].id).toBe('sc-1');
  });

  it('filters by orgId when provided', async () => {
    const repo = makeScenarioRepo();
    const service = new ScenarioService(
      repo,
      makeLlmService(),
      makeRoutingConfigService(),
    );

    repo.findMany.mockResolvedValue([]);

    await service.findAll('org-42');

    expect(repo.findMany).toHaveBeenCalledWith({ orgId: 'org-42' });
  });

  it('returns empty list when repository returns none', async () => {
    const repo = makeScenarioRepo();
    const service = new ScenarioService(
      repo,
      makeLlmService(),
      makeRoutingConfigService(),
    );

    repo.findMany.mockResolvedValue([]);

    const result = await service.findAll();

    expect(result).toEqual({ scenarios: [], total: 0 });
  });

  it('maps null description to undefined', async () => {
    const repo = makeScenarioRepo();
    const service = new ScenarioService(
      repo,
      makeLlmService(),
      makeRoutingConfigService(),
    );

    repo.findMany.mockResolvedValue([
      stubScenario({ description: null }),
    ] as any);

    const result = await service.findAll();

    expect(result.scenarios[0].description).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// findById()
// ---------------------------------------------------------------------------

describe('ScenarioService.findById', () => {
  it('returns the scenario mapped to DTO', async () => {
    const repo = makeScenarioRepo();
    const service = new ScenarioService(
      repo,
      makeLlmService(),
      makeRoutingConfigService(),
    );

    repo.findById.mockResolvedValue(stubScenario() as any);

    const result = await service.findById('sc-1');

    expect(repo.findById).toHaveBeenCalledWith('sc-1');
    expect(result.id).toBe('sc-1');
    expect(result.createdAt).toBe(now.toISOString());
    expect(result.updatedAt).toBe(now.toISOString());
  });

  it('throws NotFoundException when scenario does not exist', async () => {
    const repo = makeScenarioRepo();
    const service = new ScenarioService(
      repo,
      makeLlmService(),
      makeRoutingConfigService(),
    );

    repo.findById.mockResolvedValue(null);

    await expect(service.findById('missing')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('maps null config to undefined', async () => {
    const repo = makeScenarioRepo();
    const service = new ScenarioService(
      repo,
      makeLlmService(),
      makeRoutingConfigService(),
    );

    repo.findById.mockResolvedValue(stubScenario({ config: null }) as any);

    const result = await service.findById('sc-1');

    expect(result.config).toBeUndefined();
  });
});
