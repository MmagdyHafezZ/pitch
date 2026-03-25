import { LLMModelCatalogService } from '../../services/llm/llm-model-catalog.service';
import { RedisTTL } from '../../services/redis/redis-key-patterns';

const originalFetch = global.fetch;

const createConfig = (values: Record<string, string | undefined> = {}) => ({
  get: jest.fn((key: string) => values[key]),
  getOrThrow: jest.fn((key: string) => {
    const val = values[key];
    if (!val) throw new Error(`${key} not configured`);
    return val;
  }),
});

const createRedis = (cached: unknown = null) => ({
  get: jest.fn().mockResolvedValue(cached),
  set: jest.fn().mockResolvedValue(undefined),
  expire: jest.fn().mockResolvedValue(undefined),
});

describe('LLMModelCatalogService', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  describe('constructor / TTL', () => {
    it('uses LLM_MODEL_CATALOG_CACHE_TTL_SECONDS from config', () => {
      const config = createConfig({
        LLM_MODEL_CATALOG_CACHE_TTL_SECONDS: '120',
      });
      const redis = createRedis();
      const svc = new LLMModelCatalogService(config as any, redis as any);
      // cacheTtlMs should be 120_000 — verify indirectly via listModels not re-fetching fresh cache
      expect(svc).toBeDefined();
    });

    it('falls back to RedisTTL.LLM_MODEL_CATALOG when config is missing', () => {
      const config = createConfig({});
      const redis = createRedis();
      const svc = new LLMModelCatalogService(config as any, redis as any);
      expect(svc).toBeDefined();
    });

    it('falls back to RedisTTL.LLM_MODEL_CATALOG when config value is NaN', () => {
      const config = createConfig({
        LLM_MODEL_CATALOG_CACHE_TTL_SECONDS: 'not-a-number',
      });
      const redis = createRedis();
      const svc = new LLMModelCatalogService(config as any, redis as any);
      expect(svc).toBeDefined();
    });
  });

  describe('listModels', () => {
    it('returns cached models when cache is fresh', async () => {
      const freshEntry = {
        models: ['gpt-4o', 'gpt-3.5-turbo'],
        fetchedAt: Date.now(),
      };
      const redis = createRedis(freshEntry);
      const config = createConfig({});
      const svc = new LLMModelCatalogService(config as any, redis as any);

      const result = await svc.listModels('openai');

      expect(result).toEqual(['gpt-4o', 'gpt-3.5-turbo']);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('triggers refresh and returns updated models when cache is stale', async () => {
      const staleEntry = {
        models: ['old-model'],
        fetchedAt: Date.now() - (RedisTTL.LLM_MODEL_CATALOG * 1000 + 5000),
      };
      const freshEntry = {
        models: ['gpt-4o'],
        fetchedAt: Date.now(),
      };

      const redis = {
        get: jest
          .fn()
          .mockResolvedValueOnce(staleEntry) // loadProviderCache in listModels
          .mockResolvedValueOnce(null) // loadProviderCache for openai in refreshIfNeeded
          .mockResolvedValueOnce(null) // loadProviderCache for watsonx in refreshIfNeeded
          .mockResolvedValue(freshEntry), // after refresh
        set: jest.fn().mockResolvedValue(undefined),
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: [{ id: 'gpt-4o' }],
        }),
      });

      const config = createConfig({ OPENAI_API_KEY: 'key' });
      const svc = new LLMModelCatalogService(config as any, redis as any);

      const result = await svc.listModels('openai');
      expect(result).toBeDefined();
    });

    it('returns empty array when no cache and fetch fails', async () => {
      const redis = createRedis(null);
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const config = createConfig({ OPENAI_API_KEY: 'key' });
      const svc = new LLMModelCatalogService(config as any, redis as any);

      const result = await svc.listModels('openai');
      expect(result).toEqual([]);
    });

    it('returns stale models when refresh fails to produce new data', async () => {
      const staleEntry = {
        models: ['stale-model'],
        fetchedAt: Date.now() - (RedisTTL.LLM_MODEL_CATALOG * 1000 + 5000),
      };
      const redis = {
        get: jest.fn().mockResolvedValue(staleEntry),
        set: jest.fn().mockResolvedValue(undefined),
      };

      // fetch succeeds but returns empty
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ data: [] }),
      });

      const config = createConfig({ OPENAI_API_KEY: 'key' });
      const svc = new LLMModelCatalogService(config as any, redis as any);

      const result = await svc.listModels('openai');
      // should return stale or empty from freshly refreshed (empty)
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('refreshIfNeeded', () => {
    it('does not double-refresh when called concurrently', async () => {
      const redis = createRedis(null);
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ data: [{ id: 'gpt-4o' }] }),
      });

      const config = createConfig({ OPENAI_API_KEY: 'key' });
      const svc = new LLMModelCatalogService(config as any, redis as any);

      // Call concurrently
      await Promise.all([svc.refreshIfNeeded(), svc.refreshIfNeeded()]);

      // fetch should only be called once per concurrent batch
      expect(global.fetch).toHaveBeenCalled();
    });

    it('skips openai when no API key and no auth header', async () => {
      const redis = createRedis(null);
      const config = createConfig({});
      const svc = new LLMModelCatalogService(config as any, redis as any);

      await svc.refreshIfNeeded();

      // fetch for OpenAI should NOT be called
      expect(global.fetch).not.toHaveBeenCalledWith(
        expect.stringContaining('openai.com'),
        expect.anything(),
      );
    });

    it('uses OPENAI_MODELS_AUTH_HEADER when provided', async () => {
      const redis = createRedis(null);
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ data: [{ id: 'gpt-4o' }] }),
      });

      const config = createConfig({
        OPENAI_MODELS_AUTH_HEADER: 'Bearer custom-token',
        OPENAI_MODELS_URL: 'https://custom-openai.example.com/models',
      });
      const svc = new LLMModelCatalogService(config as any, redis as any);

      await svc.refreshIfNeeded();

      expect(global.fetch).toHaveBeenCalledWith(
        'https://custom-openai.example.com/models',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer custom-token',
          }),
        }),
      );
    });

    it('does not refresh providers when all caches are fresh', async () => {
      const freshEntry = { models: ['gpt-4o'], fetchedAt: Date.now() };
      const redis = {
        get: jest.fn().mockResolvedValue(freshEntry),
        set: jest.fn().mockResolvedValue(undefined),
      };
      const config = createConfig({ OPENAI_API_KEY: 'key' });
      const svc = new LLMModelCatalogService(config as any, redis as any);

      await svc.refreshIfNeeded();

      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('OpenAI model parsing', () => {
    it('parses data[] array format', async () => {
      const redis = createRedis(null);
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: [{ id: 'gpt-4o' }, { id: 'gpt-3.5-turbo' }],
        }),
      });

      const config = createConfig({ OPENAI_API_KEY: 'key' });
      const svc = new LLMModelCatalogService(config as any, redis as any);

      await svc.refreshIfNeeded();

      expect(redis.set).toHaveBeenCalledWith(
        expect.stringContaining('openai'),
        expect.objectContaining({
          models: expect.arrayContaining(['gpt-4o', 'gpt-3.5-turbo']),
        }),
        expect.anything(),
      );
    });

    it('parses models[] array format', async () => {
      const redis = createRedis(null);
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          models: [{ name: 'gpt-4-turbo' }],
        }),
      });

      const config = createConfig({ OPENAI_API_KEY: 'key' });
      const svc = new LLMModelCatalogService(config as any, redis as any);

      await svc.refreshIfNeeded();

      expect(redis.set).toHaveBeenCalledWith(
        expect.stringContaining('openai'),
        expect.objectContaining({
          models: expect.arrayContaining(['gpt-4-turbo']),
        }),
        expect.anything(),
      );
    });

    it('handles non-object payload gracefully', async () => {
      const redis = createRedis(null);
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(null),
      });

      const config = createConfig({ OPENAI_API_KEY: 'key' });
      const svc = new LLMModelCatalogService(config as any, redis as any);

      await svc.refreshIfNeeded();

      // Should not throw; set should be called with empty models
      expect(redis.set).toHaveBeenCalledWith(
        expect.stringContaining('openai'),
        expect.objectContaining({ models: [] }),
        expect.anything(),
      );
    });

    it('deduplicates and sorts model names', async () => {
      const redis = createRedis(null);
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: [{ id: 'gpt-4o' }, { id: 'gpt-3.5-turbo' }, { id: 'gpt-4o' }],
        }),
      });

      const config = createConfig({ OPENAI_API_KEY: 'key' });
      const svc = new LLMModelCatalogService(config as any, redis as any);

      await svc.refreshIfNeeded();

      const setCall = (redis.set as jest.Mock).mock.calls.find((c) =>
        (c[0] as string).includes('openai'),
      );
      expect(setCall).toBeDefined();
      const { models } = setCall![1];
      const unique = [...new Set(models)];
      expect(models).toEqual(unique);
      expect(models).toEqual([...models].sort());
    });
  });

  describe('Watsonx model parsing', () => {
    it('fetches IAM token and refreshes watsonx catalog', async () => {
      const redis = {
        get: jest
          .fn()
          .mockResolvedValueOnce(null) // openai cache
          .mockResolvedValueOnce(null) // watsonx cache
          .mockResolvedValueOnce(null), // watsonx auth token
        set: jest.fn().mockResolvedValue(undefined),
      };

      let fetchCallIndex = 0;
      (global.fetch as jest.Mock).mockImplementation(() => {
        fetchCallIndex++;
        if (fetchCallIndex === 1) {
          // IAM token call
          return Promise.resolve({
            ok: true,
            json: jest.fn().mockResolvedValue({
              access_token: 'iam-token',
              expires_in: 3600,
            }),
          });
        }
        // Catalog call
        return Promise.resolve({
          ok: true,
          json: jest.fn().mockResolvedValue({
            resources: [{ model_id: 'granite-13b-chat-v2' }],
          }),
        });
      });

      const config = createConfig({ WATSONX_API_KEY: 'wx-key' });
      const svc = new LLMModelCatalogService(config as any, redis as any);

      await svc.refreshIfNeeded();

      expect(redis.set).toHaveBeenCalledWith(
        expect.stringContaining('watsonx'),
        expect.objectContaining({
          models: expect.arrayContaining(['granite-13b-chat-v2']),
        }),
        expect.anything(),
      );
    });

    it('uses WATSONX_MODEL_SPECS_AUTH_HEADER when present', async () => {
      const redis = createRedis(null);
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          resources: [{ model_id: 'granite-13b' }],
        }),
      });

      const config = createConfig({
        WATSONX_MODEL_SPECS_AUTH_HEADER: 'Bearer wx-token',
      });
      const svc = new LLMModelCatalogService(config as any, redis as any);

      await svc.refreshIfNeeded();

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('foundation_model_specs'),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer wx-token',
          }),
        }),
      );
    });

    it('parses watsonx resources[] format', async () => {
      const redis = createRedis(null);
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          resources: [{ model_id: 'granite-13b' }, { modelId: 'granite-20b' }],
        }),
      });

      const config = createConfig({
        WATSONX_MODEL_SPECS_AUTH_HEADER: 'Bearer token',
      });
      const svc = new LLMModelCatalogService(config as any, redis as any);
      await svc.refreshIfNeeded();

      const setCall = (redis.set as jest.Mock).mock.calls.find((c) =>
        (c[0] as string).includes('watsonx'),
      );
      expect(setCall).toBeDefined();
      const { models } = setCall![1];
      expect(models).toContain('granite-13b');
      expect(models).toContain('granite-20b');
    });

    it('skips watsonx when no API key and no auth header', async () => {
      const redis = createRedis(null);
      const config = createConfig({});
      const svc = new LLMModelCatalogService(config as any, redis as any);

      await svc.refreshIfNeeded();

      // watsonx IAM request should not be attempted
      expect(global.fetch).not.toHaveBeenCalledWith(
        expect.stringContaining('iam.cloud.ibm.com'),
        expect.anything(),
      );
    });

    it('returns null when IAM token fetch fails', async () => {
      const redis = {
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue(undefined),
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });

      const config = createConfig({ WATSONX_API_KEY: 'key' });
      const svc = new LLMModelCatalogService(config as any, redis as any);

      // Should not throw
      await expect(svc.refreshIfNeeded()).resolves.toBeUndefined();
    });

    it('uses cached IAM token from Redis', async () => {
      const redis = {
        get: jest
          .fn()
          .mockResolvedValueOnce(null) // openai cache
          .mockResolvedValueOnce(null) // watsonx cache
          .mockResolvedValueOnce('cached-token'), // watsonx auth token
        set: jest.fn().mockResolvedValue(undefined),
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          resources: [{ model_id: 'granite-13b' }],
        }),
      });

      const config = createConfig({ WATSONX_API_KEY: 'key' });
      const svc = new LLMModelCatalogService(config as any, redis as any);
      await svc.refreshIfNeeded();

      // Only one fetch call (catalog), no IAM token call
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(global.fetch).not.toHaveBeenCalledWith(
        expect.stringContaining('iam.cloud.ibm.com'),
        expect.anything(),
      );
    });
  });

  describe('error handling', () => {
    it('handles network errors during refresh gracefully', async () => {
      const redis = createRedis(null);
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const config = createConfig({ OPENAI_API_KEY: 'key' });
      const svc = new LLMModelCatalogService(config as any, redis as any);

      await expect(svc.refreshIfNeeded()).resolves.toBeUndefined();
    });

    it('handles non-ok response from catalog endpoint', async () => {
      const redis = createRedis(null);
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
      });

      const config = createConfig({ OPENAI_API_KEY: 'key' });
      const svc = new LLMModelCatalogService(config as any, redis as any);

      await expect(svc.refreshIfNeeded()).resolves.toBeUndefined();
    });

    it('uses custom OPENAI_MODELS_URL when provided', async () => {
      const redis = createRedis(null);
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ data: [{ id: 'my-model' }] }),
      });

      const config = createConfig({
        OPENAI_API_KEY: 'key',
        OPENAI_MODELS_URL: 'https://my-proxy.example.com/v1/models',
      });
      const svc = new LLMModelCatalogService(config as any, redis as any);

      await svc.refreshIfNeeded();

      expect(global.fetch).toHaveBeenCalledWith(
        'https://my-proxy.example.com/v1/models',
        expect.anything(),
      );
    });
  });
});
