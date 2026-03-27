import { Injectable, Logger } from '@nestjs/common';
import { SimulationPrismaService } from '../../prisma/simulation-prisma.service';
import { LLMRoutingConfig } from './llm-routing.types';

type RoutingScope = 'global' | 'org' | 'user';

type RoutingLookup = {
  scope?: RoutingScope;
  orgId?: string;
  userId?: string;
};

type RoutingUpsert = {
  scope?: RoutingScope;
  orgId?: string;
  userId?: string;
  name?: string;
  isActive?: boolean;
  config: Record<string, unknown>;
};

const DEFAULT_ROUTING_CONFIG: LLMRoutingConfig = {
  version: 1,
  mode: 'manual',
  defaultRoute: {
    provider: 'openai',
    model: 'gpt-4o',
  },
  fallbacks: [
    {
      provider: 'watsonx',
      model: 'granite-13b-chat-v2',
    },
  ],
  providers: {
    openai: {
      defaultModel: 'gpt-4o',
    },
    watsonx: {
      defaultModel: 'granite-13b-chat-v2',
    },
  },
  strategy: {
    mode: 'manual',
    select: 'balanced',
    retryOn: ['RATE_LIMIT', 'TIMEOUT', 'API_ERROR', 'UNKNOWN_ERROR'],
    maxAttempts: 2,
  },
};

/** In-memory TTL cache entry for routing configs */
type CacheEntry = { config: LLMRoutingConfig; expiresAt: number };

/** Routing config TTL — 60s is safe since config changes are admin-only */
const CONFIG_CACHE_TTL_MS = 60_000;

@Injectable()
export class LLMRoutingConfigService {
  private readonly logger = new Logger(LLMRoutingConfigService.name);
  private readonly configCache = new Map<string, CacheEntry>();

  constructor(private readonly prisma: SimulationPrismaService) {}

  async getActiveConfig(lookup: RoutingLookup = {}): Promise<LLMRoutingConfig> {
    const cacheKey = `${lookup.scope ?? 'auto'}:${lookup.orgId ?? ''}:${lookup.userId ?? ''}`;
    const cached = this.configCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.config;
    }

    const config = await this.fetchActiveConfig(lookup);
    this.configCache.set(cacheKey, {
      config,
      expiresAt: Date.now() + CONFIG_CACHE_TTL_MS,
    });
    return config;
  }

  private async fetchActiveConfig(
    lookup: RoutingLookup,
  ): Promise<LLMRoutingConfig> {
    const { scope, orgId, userId } = lookup;
    const scopedUserId = scope === 'user' ? userId : undefined;

    if (scope) {
      const config = await this.findByScope(scope, orgId, scopedUserId);
      return this.normalizeConfig(config?.config ?? DEFAULT_ROUTING_CONFIG);
    }

    if (userId) {
      const config = await this.findByScope('user', orgId, userId);
      if (config) {
        return this.normalizeConfig(config.config);
      }
    }

    if (orgId) {
      const config = await this.findByScope('org', orgId);
      if (config) {
        return this.normalizeConfig(config.config);
      }
    }

    const globalConfig = await this.findByScope('global');
    return this.normalizeConfig(globalConfig?.config ?? DEFAULT_ROUTING_CONFIG);
  }

  /** Invalidate cached config for a scope — call after any upsert */
  invalidateCache(scope?: RoutingScope, orgId?: string, userId?: string): void {
    const prefix = `${scope ?? 'auto'}:${orgId ?? ''}:${userId ?? ''}`;
    for (const key of this.configCache.keys()) {
      if (key.startsWith(prefix.slice(0, prefix.length))) {
        this.configCache.delete(key);
      }
    }
  }

  async upsertConfig(payload: RoutingUpsert): Promise<LLMRoutingConfig> {
    const scope = payload.scope ?? 'global';
    const name = payload.name ?? 'default';
    const isActive = payload.isActive ?? true;
    const config = this.normalizeConfig(payload.config);
    const orgId = scope === 'global' ? null : (payload.orgId ?? null);
    const userId = scope === 'user' ? (payload.userId ?? null) : null;

    const existing = await this.prisma.client.llmRoutingConfig.findFirst({
      where: {
        scope,
        orgId,
        userId,
      },
    });

    if (existing) {
      await this.prisma.client.llmRoutingConfig.update({
        where: { id: existing.id },
        data: {
          name,
          isActive,
          config,
        },
      });
    } else {
      await this.prisma.client.llmRoutingConfig.create({
        data: {
          scope,
          orgId,
          userId,
          name,
          isActive,
          config,
        },
      });
    }

    this.invalidateCache(scope, orgId ?? undefined, userId ?? undefined);
    return config;
  }

  normalizeForAdmin(raw: unknown): LLMRoutingConfig {
    return this.normalizeConfig(raw);
  }

  private async findByScope(
    scope: RoutingScope,
    orgId?: string,
    userId?: string,
  ) {
    const scopedOrgId = scope === 'global' ? null : (orgId ?? null);
    const scopedUserId = scope === 'user' ? (userId ?? null) : null;
    return this.prisma.client.llmRoutingConfig.findFirst({
      where: {
        scope,
        orgId: scopedOrgId,
        userId: scopedUserId,
        isActive: true,
      },
    });
  }

  private normalizeConfig(raw: unknown): LLMRoutingConfig {
    if (!raw || typeof raw !== 'object') {
      return DEFAULT_ROUTING_CONFIG;
    }

    const config = raw as Partial<LLMRoutingConfig>;

    if (!config.defaultRoute || !config.defaultRoute.provider) {
      this.logger.warn('Invalid routing config, using defaults');
      return DEFAULT_ROUTING_CONFIG;
    }

    const normalizedAliases: Record<string, any> | undefined = config.aliases
      ? Object.fromEntries(
          Object.entries(config.aliases).map(([key, value]) => [
            key.toLowerCase(),
            value,
          ]),
        )
      : undefined;

    const normalizedProviders: Record<string, any> | undefined =
      config.providers
        ? Object.fromEntries(
            Object.entries(config.providers).map(([key, value]) => [
              key.toLowerCase(),
              value,
            ]),
          )
        : undefined;

    const defaultRoute = {
      ...DEFAULT_ROUTING_CONFIG.defaultRoute,
      ...config.defaultRoute,
    };

    if (defaultRoute.provider) {
      defaultRoute.provider = defaultRoute.provider.toLowerCase();
    }
    if (!defaultRoute.model) {
      defaultRoute.model = DEFAULT_ROUTING_CONFIG.defaultRoute.model;
    }

    const normalizedFallbacks = config.fallbacks?.map((fallback) => ({
      ...fallback,
      provider: fallback.provider?.toLowerCase?.() ?? fallback.provider,
    }));

    return {
      ...DEFAULT_ROUTING_CONFIG,
      ...config,
      version: 1,
      defaultRoute,
      fallbacks: normalizedFallbacks ?? DEFAULT_ROUTING_CONFIG.fallbacks,
      providers: normalizedProviders ?? DEFAULT_ROUTING_CONFIG.providers,
      aliases: normalizedAliases,
      strategy: {
        ...DEFAULT_ROUTING_CONFIG.strategy,
        ...config.strategy,
      },
    };
  }
}
