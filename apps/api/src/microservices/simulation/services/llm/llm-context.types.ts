export type LLMRequestContext = {
  requestId?: string;
  userId?: string;
  orgId?: string;
  purpose?:
    | 'chat'
    | 'tool_call'
    | 'evaluation'
    | 'enrichment'
    | 'hints'
    | 'other';
  traceId?: string;
};
