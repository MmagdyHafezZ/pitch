export type LLMRouteTarget = {
  provider: string;
  model: string;
  weight?: number;
  tags?: string[];
};

export type LLMRoutingRule = {
  when: {
    modalities?: Array<'text' | 'image' | 'audio'>;
    requires?: Array<'streaming' | 'tools' | 'vision' | 'audio'>;
    provider?: string;
    model?: string;
  };
  route: LLMRouteTarget;
};

export type LLMRoutingStrategy = {
  mode?: 'manual' | 'auto';
  select?: 'balanced' | 'cost' | 'latency' | 'quality';
  retryOn?: Array<'RATE_LIMIT' | 'TIMEOUT' | 'API_ERROR' | 'UNKNOWN_ERROR'>;
  maxAttempts?: number;
};

export type LLMRoutingConfig = {
  version: 1;
  mode: 'manual' | 'auto';
  defaultRoute: LLMRouteTarget;
  fallbacks?: LLMRouteTarget[];
  providers?: Record<
    string,
    {
      defaultModel?: string;
      models?: string[];
    }
  >;
  aliases?: Record<string, LLMRouteTarget>;
  rules?: LLMRoutingRule[];
  strategy?: LLMRoutingStrategy;
};

export type LLMRoutingHints = {
  mode?: 'manual' | 'auto';
  strategy?: LLMRoutingStrategy['select'];
  require?: Array<'streaming' | 'tools' | 'vision' | 'audio'>;
  candidates?: LLMRouteTarget[];
  fallbacks?: LLMRouteTarget[];
};
