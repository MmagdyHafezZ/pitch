import { LLMRoutingConfigService } from '../../services/llm/llm-routing-config.service';

const findFirstMock = jest.fn();
const findUniqueMock = jest.fn();
const updateMock = jest.fn();
const createMock = jest.fn();

const createPrisma = () => ({
  client: {
    llmRoutingConfig: {
      findFirst: findFirstMock,
      findUnique: findUniqueMock,
      update: updateMock,
      create: createMock,
    },
  },
});

const validConfig = {
  version: 1,
  mode: 'manual',
  defaultRoute: { provider: 'openai', model: 'gpt-4o' },
  fallbacks: [{ provider: 'watsonx', model: 'granite-13b-chat-v2' }],
  providers: { openai: { defaultModel: 'gpt-4o' } },
  strategy: {
    mode: 'manual',
    select: 'balanced',
    retryOn: ['RATE_LIMIT'],
    maxAttempts: 2,
  },
};

describe('LLMRoutingConfigService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getActiveConfig', () => {
    it('returns cached config on second call within TTL', async () => {
      findFirstMock.mockResolvedValue({ config: validConfig });

      const prisma = createPrisma();
      const svc = new LLMRoutingConfigService(prisma as any);

      const first = await svc.getActiveConfig({});
      const second = await svc.getActiveConfig({});

      expect(first).toEqual(second);
      expect(findFirstMock).toHaveBeenCalledTimes(1); // cached on second call
    });

    it('uses different cache keys for different lookups', async () => {
      findFirstMock.mockResolvedValue({ config: validConfig });

      const prisma = createPrisma();
      const svc = new LLMRoutingConfigService(prisma as any);

      await svc.getActiveConfig({ orgId: 'org-1' });
      await svc.getActiveConfig({ orgId: 'org-2' });

      expect(findFirstMock).toHaveBeenCalledTimes(2);
    });

    it('returns default config when no DB record exists', async () => {
      findFirstMock.mockResolvedValue(null);

      const prisma = createPrisma();
      const svc = new LLMRoutingConfigService(prisma as any);

      const result = await svc.getActiveConfig({});

      expect(result.defaultRoute.provider).toBe('openai');
      expect(result.defaultRoute.model).toBe('gpt-4o');
    });

    describe('scope resolution', () => {
      it('uses explicit scope when provided', async () => {
        findFirstMock.mockResolvedValue({ config: validConfig });

        const prisma = createPrisma();
        const svc = new LLMRoutingConfigService(prisma as any);

        await svc.getActiveConfig({ scope: 'global' });

        expect(findFirstMock).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({ scope: 'global' }),
          }),
        );
      });

      it('cascades user → org → global when no scope given', async () => {
        // user: null, org: null, global: has config
        findFirstMock
          .mockResolvedValueOnce(null) // user lookup
          .mockResolvedValueOnce(null) // org lookup
          .mockResolvedValueOnce({ config: validConfig }); // global lookup

        const prisma = createPrisma();
        const svc = new LLMRoutingConfigService(prisma as any);

        const result = await svc.getActiveConfig({
          userId: 'user-1',
          orgId: 'org-1',
        });

        expect(result.defaultRoute.provider).toBe('openai');
        expect(findFirstMock).toHaveBeenCalledTimes(3);
      });

      it('returns user-scoped config when userId matches', async () => {
        findFirstMock.mockResolvedValueOnce({ config: validConfig });

        const prisma = createPrisma();
        const svc = new LLMRoutingConfigService(prisma as any);

        const result = await svc.getActiveConfig({ userId: 'user-1' });

        expect(result).toBeDefined();
        expect(findFirstMock).toHaveBeenCalledTimes(1);
      });

      it('falls through to org when user config is absent', async () => {
        findFirstMock
          .mockResolvedValueOnce(null) // user
          .mockResolvedValueOnce({ config: validConfig }); // org

        const prisma = createPrisma();
        const svc = new LLMRoutingConfigService(prisma as any);

        const result = await svc.getActiveConfig({
          userId: 'user-1',
          orgId: 'org-1',
        });

        expect(result).toBeDefined();
        expect(findFirstMock).toHaveBeenCalledTimes(2);
      });

      it('uses orgId alone when no userId provided', async () => {
        findFirstMock.mockResolvedValueOnce({ config: validConfig });

        const prisma = createPrisma();
        const svc = new LLMRoutingConfigService(prisma as any);

        await svc.getActiveConfig({ orgId: 'org-1' });

        expect(findFirstMock).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({ scope: 'org' }),
          }),
        );
      });
    });
  });

  describe('invalidateCache', () => {
    it('removes matching cache entries so next call re-fetches', async () => {
      findFirstMock.mockResolvedValue({ config: validConfig });

      const prisma = createPrisma();
      const svc = new LLMRoutingConfigService(prisma as any);

      await svc.getActiveConfig({ scope: 'global' });
      expect(findFirstMock).toHaveBeenCalledTimes(1);

      svc.invalidateCache('global');

      await svc.getActiveConfig({ scope: 'global' });
      expect(findFirstMock).toHaveBeenCalledTimes(2);
    });

    it('does not crash when no matching cache entry exists', () => {
      const prisma = createPrisma();
      const svc = new LLMRoutingConfigService(prisma as any);
      expect(() => svc.invalidateCache('org', 'org-1')).not.toThrow();
    });
  });

  describe('upsertConfig', () => {
    it('creates a new record when none exists', async () => {
      findFirstMock.mockResolvedValue(null);
      createMock.mockResolvedValue({});

      const prisma = createPrisma();
      const svc = new LLMRoutingConfigService(prisma as any);

      const result = await svc.upsertConfig({
        scope: 'global',
        config: validConfig as any,
      });

      expect(createMock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ scope: 'global' }),
        }),
      );
      expect(result.defaultRoute.provider).toBe('openai');
    });

    it('updates an existing record when one is found', async () => {
      findFirstMock.mockResolvedValue({ id: 'existing-id' });
      updateMock.mockResolvedValue({});

      const prisma = createPrisma();
      const svc = new LLMRoutingConfigService(prisma as any);

      await svc.upsertConfig({
        scope: 'global',
        config: validConfig as any,
      });

      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'existing-id' },
        }),
      );
      expect(createMock).not.toHaveBeenCalled();
    });

    it('defaults scope to global when not provided', async () => {
      findFirstMock.mockResolvedValue(null);
      createMock.mockResolvedValue({});

      const prisma = createPrisma();
      const svc = new LLMRoutingConfigService(prisma as any);

      await svc.upsertConfig({ config: validConfig as any });

      expect(createMock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ scope: 'global' }),
        }),
      );
    });

    it('defaults name to "default" and isActive to true', async () => {
      findFirstMock.mockResolvedValue(null);
      createMock.mockResolvedValue({});

      const prisma = createPrisma();
      const svc = new LLMRoutingConfigService(prisma as any);

      await svc.upsertConfig({ config: validConfig as any });

      expect(createMock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ name: 'default', isActive: true }),
        }),
      );
    });

    it('sets orgId to null for global scope', async () => {
      findFirstMock.mockResolvedValue(null);
      createMock.mockResolvedValue({});

      const prisma = createPrisma();
      const svc = new LLMRoutingConfigService(prisma as any);

      await svc.upsertConfig({
        scope: 'global',
        orgId: 'should-be-ignored',
        config: validConfig as any,
      });

      expect(createMock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ orgId: null }),
        }),
      );
    });

    it('sets userId to null for org scope', async () => {
      findFirstMock.mockResolvedValue(null);
      createMock.mockResolvedValue({});

      const prisma = createPrisma();
      const svc = new LLMRoutingConfigService(prisma as any);

      await svc.upsertConfig({
        scope: 'org',
        orgId: 'org-1',
        userId: 'should-be-ignored',
        config: validConfig as any,
      });

      expect(createMock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId: null, orgId: 'org-1' }),
        }),
      );
    });

    it('invalidates cache after upsert', async () => {
      findFirstMock
        .mockResolvedValueOnce({ config: validConfig }) // initial getActiveConfig
        .mockResolvedValueOnce(null) // upsert findFirst
        .mockResolvedValueOnce({ config: validConfig }); // re-fetch after invalidation

      createMock.mockResolvedValue({});

      const prisma = createPrisma();
      const svc = new LLMRoutingConfigService(prisma as any);

      await svc.getActiveConfig({ scope: 'global' });
      expect(findFirstMock).toHaveBeenCalledTimes(1);

      await svc.upsertConfig({ scope: 'global', config: validConfig as any });

      // Cache should be invalidated; next call should re-fetch
      await svc.getActiveConfig({ scope: 'global' });
      expect(findFirstMock).toHaveBeenCalledTimes(3); // 1 initial + 1 upsert + 1 re-fetch
    });
  });

  describe('normalizeConfig', () => {
    it('returns default config when input is null', async () => {
      findFirstMock.mockResolvedValue({ config: null });

      const prisma = createPrisma();
      const svc = new LLMRoutingConfigService(prisma as any);

      const result = await svc.getActiveConfig({ scope: 'global' });
      expect(result.defaultRoute.provider).toBe('openai');
    });

    it('returns default config when defaultRoute is missing', async () => {
      findFirstMock.mockResolvedValue({
        config: { version: 1, mode: 'manual' }, // no defaultRoute
      });

      const prisma = createPrisma();
      const svc = new LLMRoutingConfigService(prisma as any);

      const result = await svc.getActiveConfig({ scope: 'global' });
      expect(result.defaultRoute.provider).toBe('openai');
    });

    it('lowercases provider names in defaultRoute', async () => {
      findFirstMock.mockResolvedValue({
        config: {
          ...validConfig,
          defaultRoute: { provider: 'OpenAI', model: 'gpt-4o' },
        },
      });

      const prisma = createPrisma();
      const svc = new LLMRoutingConfigService(prisma as any);

      const result = await svc.getActiveConfig({ scope: 'global' });
      expect(result.defaultRoute.provider).toBe('openai');
    });

    it('lowercases provider names in fallbacks', async () => {
      findFirstMock.mockResolvedValue({
        config: {
          ...validConfig,
          fallbacks: [{ provider: 'WatsonX', model: 'granite-13b' }],
        },
      });

      const prisma = createPrisma();
      const svc = new LLMRoutingConfigService(prisma as any);

      const result = await svc.getActiveConfig({ scope: 'global' });
      expect(result.fallbacks?.[0].provider).toBe('watsonx');
    });

    it('lowercases provider keys in providers map', async () => {
      findFirstMock.mockResolvedValue({
        config: {
          ...validConfig,
          providers: { OpenAI: { defaultModel: 'gpt-4o' } },
        },
      });

      const prisma = createPrisma();
      const svc = new LLMRoutingConfigService(prisma as any);

      const result = await svc.getActiveConfig({ scope: 'global' });
      expect(Object.keys(result.providers ?? {})).toContain('openai');
      expect(Object.keys(result.providers ?? {})).not.toContain('OpenAI');
    });

    it('lowercases alias keys', async () => {
      findFirstMock.mockResolvedValue({
        config: {
          ...validConfig,
          aliases: { Fast: { provider: 'openai', model: 'gpt-4o-mini' } },
        },
      });

      const prisma = createPrisma();
      const svc = new LLMRoutingConfigService(prisma as any);

      const result = await svc.getActiveConfig({ scope: 'global' });
      expect(Object.keys(result.aliases ?? {})).toContain('fast');
    });

    it('uses default model when model is missing in defaultRoute', async () => {
      findFirstMock.mockResolvedValue({
        config: {
          ...validConfig,
          defaultRoute: { provider: 'openai' }, // model absent
        },
      });

      const prisma = createPrisma();
      const svc = new LLMRoutingConfigService(prisma as any);

      const result = await svc.getActiveConfig({ scope: 'global' });
      expect(result.defaultRoute.model).toBe('gpt-4o');
    });

    it('always returns version: 1', async () => {
      findFirstMock.mockResolvedValue({
        config: { ...validConfig, version: 99 },
      });

      const prisma = createPrisma();
      const svc = new LLMRoutingConfigService(prisma as any);

      const result = await svc.getActiveConfig({ scope: 'global' });
      expect(result.version).toBe(1);
    });

    it('merges strategy with defaults', async () => {
      findFirstMock.mockResolvedValue({
        config: {
          ...validConfig,
          strategy: { select: 'cost' },
        },
      });

      const prisma = createPrisma();
      const svc = new LLMRoutingConfigService(prisma as any);

      const result = await svc.getActiveConfig({ scope: 'global' });
      expect(result.strategy?.select).toBe('cost');
      expect(result.strategy?.maxAttempts).toBe(2); // from default
    });
  });
});
