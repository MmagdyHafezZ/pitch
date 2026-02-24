export type LLMRequestContext = {
  requestId?: string;
  userId?: string;
  orgId?: string;
  purpose?:
    | 'chat'
    | 'tool_call'
    | 'evaluation'
    | 'enrichment'
    | 'scenario_generation'
    | 'conversation'
    | 'conversation_stream'
    | 'hints'
    | 'stage_detection'
    | 'other';
  traceId?: string;
};
