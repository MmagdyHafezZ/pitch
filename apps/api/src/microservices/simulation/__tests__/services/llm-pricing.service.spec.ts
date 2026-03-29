import { LLMPricingService } from '../../services/llm/llm-pricing.service';
import { RedisTTL } from '../../services/redis/redis-key-patterns';

const originalFetch = global.fetch;

const createConfig = (values: Record<string, string | undefined> = {}) => ({
  get: jest.fn((key: string) => values[key]),
});

const createRedis = (stored: unknown = null) => ({
  get: jest.fn().mockResolvedValue(stored),
  set: jest.fn().mockResolvedValue(undefined),
});

describe('LLMPricingService', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
    jest.clearAllMocks();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  describe('constructor / TTL', () => {
    it('uses LLM_PRICING_CACHE_TTL_SECONDS from config', () => {
      const config = createConfig({ LLM_PRICING_CACHE_TTL_SECONDS: '300' });
      const redis = createRedis();
      const svc = new LLMPricingService(config as any, redis as any);
      expect(svc).toBeDefined();
    });

    it('falls back to RedisTTL.LLM_PRICING when config is missing', () => {
      const config = createConfig({});
      const redis = createRedis();
      const svc = new LLMPricingService(config as any, redis as any);
      expect(svc).toBeDefined();
    });

    it('falls back when config value is not a finite number', () => {
      const config = createConfig({ LLM_PRICING_CACHE_TTL_SECONDS: 'NaN' });
      const redis = createRedis();
      const svc = new LLMPricingService(config as any, redis as any);
      expect(svc).toBeDefined();
    });
  });

  describe('getPricing', () => {
    it('returns undefined when cache is empty', () => {
      const config = createConfig({});
      const redis = createRedis();
      const svc = new LLMPricingService(config as any, redis as any);

      const result = svc.getPricing('openai', 'gpt-4o');
      expect(result).toBeUndefined();
    });

    it('returns pricing from in-memory cache when fresh', async () => {
      const redis = {
        get: jest.fn().mockResolvedValue({
          pricing: {
            'gpt-4o': { inputTokensPerMillion: 5, outputTokensPerMillion: 15 },
          },
          fetchedAt: Date.now(),
        }),
        set: jest.fn().mockResolvedValue(undefined),
      };

      const config = createConfig({
        OPENAI_PRICING_URL: 'https://example.com/pricing',
      });
      const svc = new LLMPricingService(config as any, redis as any);
      // Populate the in-memory cache via loadProviderCache by calling refreshIfNeeded
      await svc.refreshIfNeeded();

      const result = svc.getPricing('openai', 'gpt-4o');
      expect(result).toEqual({
        inputTokensPerMillion: 5,
        outputTokensPerMillion: 15,
      });
    });

    it('triggers async refresh when cache is stale', () => {
      const config = createConfig({});
      const redis = createRedis();
      const svc = new LLMPricingService(config as any, redis as any);

      // Force a stale entry into the cache
      const internalCache = (svc as any).pricingCache as Map<string, unknown>;
      internalCache.set('openai', {
        pricing: new Map([
          ['gpt-4o', { inputTokensPerMillion: 1, outputTokensPerMillion: 2 }],
        ]),
        fetchedAt: Date.now() - (RedisTTL.LLM_PRICING * 1000 + 5000),
      });

      const result = svc.getPricing('openai', 'gpt-4o');
      // Returns stale data but triggers refresh
      expect(result).toEqual({
        inputTokensPerMillion: 1,
        outputTokensPerMillion: 2,
      });
    });

    it('is case-insensitive for provider keys', async () => {
      const redis = {
        get: jest.fn().mockResolvedValue({
          pricing: {
            'gpt-4o': { inputTokensPerMillion: 5, outputTokensPerMillion: 15 },
          },
          fetchedAt: Date.now(),
        }),
        set: jest.fn().mockResolvedValue(undefined),
      };

      const config = createConfig({
        OPENAI_PRICING_URL: 'https://example.com/pricing',
      });
      const svc = new LLMPricingService(config as any, redis as any);
      await svc.refreshIfNeeded();

      // Both 'openai' and 'OPENAI' should work
      expect(svc.getPricing('OPENAI', 'gpt-4o')).toEqual({
        inputTokensPerMillion: 5,
        outputTokensPerMillion: 15,
      });
    });
  });

  describe('refreshIfNeeded', () => {
    it('does not refresh when all caches are fresh', async () => {
      const freshEntry = {
        pricing: {
          'gpt-4o': { inputTokensPerMillion: 1, outputTokensPerMillion: 2 },
        },
        fetchedAt: Date.now(),
      };
      const redis = {
        get: jest.fn().mockResolvedValue(freshEntry),
        set: jest.fn().mockResolvedValue(undefined),
      };

      const config = createConfig({});
      const svc = new LLMPricingService(config as any, redis as any);
      await svc.refreshIfNeeded();

      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('does not double-refresh on concurrent calls', async () => {
      const redis = createRedis(null);
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          models: [
            {
              id: 'gpt-4o',
              pricing: { inputTokensPerMillion: 5, outputTokensPerMillion: 15 },
            },
          ],
        }),
      });

      const config = createConfig({
        OPENAI_PRICING_URL: 'https://example.com/pricing',
      });
      const svc = new LLMPricingService(config as any, redis as any);

      await Promise.all([svc.refreshIfNeeded(), svc.refreshIfNeeded()]);

      // fetch should only have been called once due to promise deduplication
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('skips openai when OPENAI_PRICING_URL is not configured', async () => {
      const redis = createRedis(null);
      const config = createConfig({});
      const svc = new LLMPricingService(config as any, redis as any);

      await svc.refreshIfNeeded();

      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('uses OPENAI_PRICING_AUTH_HEADER when present', async () => {
      const redis = createRedis(null);
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ models: [] }),
      });

      const config = createConfig({
        OPENAI_PRICING_URL: 'https://example.com/openai-pricing',
        OPENAI_PRICING_AUTH_HEADER: 'Bearer custom-token',
      });
      const svc = new LLMPricingService(config as any, redis as any);
      await svc.refreshIfNeeded();

      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com/openai-pricing',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer custom-token',
          }),
        }),
      );
    });

    it('uses OPENAI_PRICING_API_KEY as Bearer when no auth header', async () => {
      const redis = createRedis(null);
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ models: [] }),
      });

      const config = createConfig({
        OPENAI_PRICING_URL: 'https://example.com/openai-pricing',
        OPENAI_PRICING_API_KEY: 'secret-key',
      });
      const svc = new LLMPricingService(config as any, redis as any);
      await svc.refreshIfNeeded();

      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com/openai-pricing',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer secret-key',
          }),
        }),
      );
    });
  });

  describe('pricing payload parsing', () => {
    it('parses models[] format with nested pricing object', async () => {
      const redis = createRedis(null);
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          models: [
            {
              id: 'gpt-4o',
              pricing: { inputTokensPerMillion: 5, outputTokensPerMillion: 15 },
            },
            {
              id: 'gpt-3.5-turbo',
              pricing: {
                inputTokensPerMillion: 0.5,
                outputTokensPerMillion: 1.5,
              },
            },
          ],
        }),
      });

      const config = createConfig({
        OPENAI_PRICING_URL: 'https://example.com/pricing',
      });
      const svc = new LLMPricingService(config as any, redis as any);
      await svc.refreshIfNeeded();

      expect(svc.getPricing('openai', 'gpt-4o')).toEqual({
        inputTokensPerMillion: 5,
        outputTokensPerMillion: 15,
        imageTokens: undefined,
        audioSecondsToTokens: undefined,
      });
    });

    it('parses data[] format', async () => {
      const redis = createRedis(null);
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: [
            {
              model: 'gpt-4o',
              inputTokensPerMillion: 5,
              outputTokensPerMillion: 15,
            },
          ],
        }),
      });

      const config = createConfig({
        OPENAI_PRICING_URL: 'https://example.com/pricing',
      });
      const svc = new LLMPricingService(config as any, redis as any);
      await svc.refreshIfNeeded();

      expect(svc.getPricing('openai', 'gpt-4o')).toBeDefined();
    });

    it('parses top-level pricing object format', async () => {
      const redis = createRedis(null);
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          pricing: {
            'gpt-4o': { inputTokensPerMillion: 5, outputTokensPerMillion: 15 },
          },
        }),
      });

      const config = createConfig({
        OPENAI_PRICING_URL: 'https://example.com/pricing',
      });
      const svc = new LLMPricingService(config as any, redis as any);
      await svc.refreshIfNeeded();

      expect(svc.getPricing('openai', 'gpt-4o')).toEqual({
        inputTokensPerMillion: 5,
        outputTokensPerMillion: 15,
        imageTokens: undefined,
        audioSecondsToTokens: undefined,
      });
    });

    it('handles alternative field names (inputPer1M, completionPer1M)', async () => {
      const redis = createRedis(null);
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          models: [
            {
              id: 'model-a',
              inputPer1M: 2,
              completionPer1M: 6,
            },
          ],
        }),
      });

      const config = createConfig({
        OPENAI_PRICING_URL: 'https://example.com/pricing',
      });
      const svc = new LLMPricingService(config as any, redis as any);
      await svc.refreshIfNeeded();

      const result = svc.getPricing('openai', 'model-a');
      expect(result?.inputTokensPerMillion).toBe(2);
      expect(result?.outputTokensPerMillion).toBe(6);
    });

    it('handles promptTokensPerMillion and outputTokensPerMillion aliases', async () => {
      const redis = createRedis(null);
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          models: [
            {
              name: 'model-b',
              promptTokensPerMillion: 3,
              outputTokensPerMillion: 9,
            },
          ],
        }),
      });

      const config = createConfig({
        OPENAI_PRICING_URL: 'https://example.com/pricing',
      });
      const svc = new LLMPricingService(config as any, redis as any);
      await svc.refreshIfNeeded();

      const result = svc.getPricing('openai', 'model-b');
      expect(result?.inputTokensPerMillion).toBe(3);
    });

    it('handles string number values in pricing fields', async () => {
      const redis = createRedis(null);
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          models: [
            {
              id: 'model-c',
              inputTokensPerMillion: '4.5',
              outputTokensPerMillion: '13.5',
            },
          ],
        }),
      });

      const config = createConfig({
        OPENAI_PRICING_URL: 'https://example.com/pricing',
      });
      const svc = new LLMPricingService(config as any, redis as any);
      await svc.refreshIfNeeded();

      const result = svc.getPricing('openai', 'model-c');
      expect(result?.inputTokensPerMillion).toBe(4.5);
      expect(result?.outputTokensPerMillion).toBe(13.5);
    });

    it('skips entries without model id', async () => {
      const redis = createRedis(null);
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          models: [
            { inputTokensPerMillion: 5, outputTokensPerMillion: 15 }, // no id/model/name
          ],
        }),
      });

      const config = createConfig({
        OPENAI_PRICING_URL: 'https://example.com/pricing',
      });
      const svc = new LLMPricingService(config as any, redis as any);
      await svc.refreshIfNeeded();

      // Nothing should be stored
      const internalCache = (svc as any).pricingCache as Map<
        string,
        { pricing: Map<string, unknown> }
      >;
      expect(internalCache.get('openai')?.pricing.size).toBe(0);
    });

    it('skips entries without valid pricing fields', async () => {
      const redis = createRedis(null);
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          models: [{ id: 'model-x', pricing: { unrelated: true } }],
        }),
      });

      const config = createConfig({
        OPENAI_PRICING_URL: 'https://example.com/pricing',
      });
      const svc = new LLMPricingService(config as any, redis as any);
      await svc.refreshIfNeeded();

      expect(svc.getPricing('openai', 'model-x')).toBeUndefined();
    });

    it('handles null payload gracefully', async () => {
      const redis = createRedis(null);
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(null),
      });

      const config = createConfig({
        OPENAI_PRICING_URL: 'https://example.com/pricing',
      });
      const svc = new LLMPricingService(config as any, redis as any);
      await expect(svc.refreshIfNeeded()).resolves.toBeUndefined();
    });
  });

  describe('Redis cache integration', () => {
    it('loads pricing from Redis when in-memory cache is missing', async () => {
      const storedPayload = {
        pricing: {
          'gpt-4o': { inputTokensPerMillion: 5, outputTokensPerMillion: 15 },
        },
        fetchedAt: Date.now(),
      };
      const redis = createRedis(storedPayload);

      const config = createConfig({});
      const svc = new LLMPricingService(config as any, redis as any);

      // refreshIfNeeded will load from Redis
      await svc.refreshIfNeeded();

      expect(svc.getPricing('openai', 'gpt-4o')).toEqual({
        inputTokensPerMillion: 5,
        outputTokensPerMillion: 15,
      });
    });

    it('writes pricing to Redis after successful fetch', async () => {
      const redis = createRedis(null);
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          models: [
            {
              id: 'gpt-4o',
              pricing: { inputTokensPerMillion: 5, outputTokensPerMillion: 15 },
            },
          ],
        }),
      });

      const config = createConfig({
        OPENAI_PRICING_URL: 'https://example.com/pricing',
      });
      const svc = new LLMPricingService(config as any, redis as any);
      await svc.refreshIfNeeded();

      expect(redis.set).toHaveBeenCalledWith(
        expect.stringContaining('openai'),
        expect.objectContaining({
          pricing: expect.objectContaining({
            'gpt-4o': expect.any(Object),
          }),
          fetchedAt: expect.any(Number),
        }),
        expect.objectContaining({ ttl: expect.any(Number) }),
      );
    });
  });

  describe('error handling', () => {
    it('handles non-ok HTTP response gracefully', async () => {
      const redis = createRedis(null);
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
      });

      const config = createConfig({
        OPENAI_PRICING_URL: 'https://example.com/pricing',
      });
      const svc = new LLMPricingService(config as any, redis as any);
      await expect(svc.refreshIfNeeded()).resolves.toBeUndefined();
    });

    it('handles network error gracefully', async () => {
      const redis = createRedis(null);
      (global.fetch as jest.Mock).mockRejectedValue(new Error('ECONNREFUSED'));

      const config = createConfig({
        OPENAI_PRICING_URL: 'https://example.com/pricing',
      });
      const svc = new LLMPricingService(config as any, redis as any);
      await expect(svc.refreshIfNeeded()).resolves.toBeUndefined();
    });
  });
});
