import { RedisKeys, RedisTTL } from '../../services/redis/redis-key-patterns';

describe('RedisKeys', () => {
  describe('session keys', () => {
    it('generates session key', () => {
      expect(RedisKeys.session('abc')).toBe('sim:session:abc');
    });

    it('generates session context key', () => {
      expect(RedisKeys.sessionContext('abc')).toBe('sim:session:abc:context');
    });

    it('generates session full key', () => {
      expect(RedisKeys.sessionFull('abc')).toBe('sim:session:abc:full');
    });

    it('generates session mood key', () => {
      expect(RedisKeys.sessionMood('abc')).toBe('sim:session:abc:mood');
    });
  });

  describe('persona / scenario keys', () => {
    it('generates persona key', () => {
      expect(RedisKeys.persona('p1')).toBe('sim:persona:p1');
    });

    it('generates scenario key', () => {
      expect(RedisKeys.scenario('sc1')).toBe('sim:scenario:sc1');
    });

    it('generates persona preview audio key', () => {
      expect(RedisKeys.personaPreviewAudio('p1')).toBe(
        'sim:persona:p1:preview-audio',
      );
    });
  });

  describe('SSE keys', () => {
    it('generates SSE channel key', () => {
      expect(RedisKeys.sseChannel('s1')).toBe('sim:sse:s1');
    });

    it('generates SSE last event ID key', () => {
      expect(RedisKeys.sseLastEventId('s1')).toBe('sim:sse:s1:lastEventId');
    });
  });

  describe('WebSocket keys', () => {
    it('generates WS connection key', () => {
      expect(RedisKeys.wsConnection('s1')).toBe('sim:ws:s1');
    });

    it('generates WS request state key', () => {
      expect(RedisKeys.wsRequestState('r1')).toBe('sim:ws:request:r1');
    });
  });

  describe('WebRTC keys', () => {
    it('generates offer key', () => {
      expect(RedisKeys.webrtcOffer('c1')).toBe('sim:webrtc:c1:offer');
    });

    it('generates answer key', () => {
      expect(RedisKeys.webrtcAnswer('c1')).toBe('sim:webrtc:c1:answer');
    });

    it('generates ICE candidate key with index', () => {
      expect(RedisKeys.webrtcIceCandidate('c1', 0)).toBe('sim:webrtc:c1:ice:0');
      expect(RedisKeys.webrtcIceCandidate('c1', 5)).toBe('sim:webrtc:c1:ice:5');
    });

    it('generates state key', () => {
      expect(RedisKeys.webrtcState('c1')).toBe('sim:webrtc:c1:state');
    });
  });

  describe('STT keys', () => {
    it('generates partial key', () => {
      expect(RedisKeys.sttPartial('c1')).toBe('sim:stt:c1:partial');
    });

    it('generates buffer key', () => {
      expect(RedisKeys.sttBuffer('c1')).toBe('sim:stt:c1:buffer');
    });
  });

  describe('rate limit keys', () => {
    it('generates org rate limit key', () => {
      expect(RedisKeys.rateLimitOrg('org1', '1min')).toBe(
        'sim:ratelimit:org:org1:1min',
      );
    });

    it('generates user rate limit key', () => {
      expect(RedisKeys.rateLimitUser('u1', '1hour')).toBe(
        'sim:ratelimit:user:u1:1hour',
      );
    });
  });

  describe('idempotency key', () => {
    it('generates idempotency key', () => {
      expect(RedisKeys.idempotencyKey('abc')).toBe('sim:idempotency:abc');
    });
  });

  describe('job lock key', () => {
    it('generates job lock key', () => {
      expect(RedisKeys.jobLock('tts', 'job1')).toBe('sim:lock:tts:job1');
    });
  });

  describe('turn context key', () => {
    it('generates turn context key', () => {
      expect(RedisKeys.turnContext('s1', 't1')).toBe('sim:turn:s1:t1:ctx');
    });
  });

  describe('LLM keys', () => {
    it('generates LLM stream key', () => {
      expect(RedisKeys.llmStream('s1', 't1')).toBe('sim:llm:s1:t1:stream');
    });

    it('generates LLM pricing key', () => {
      expect(RedisKeys.llmPricing('openai')).toBe('sim:llm:pricing:openai');
    });

    it('generates LLM catalog key', () => {
      expect(RedisKeys.llmCatalog('openai')).toBe('sim:llm:catalog:openai');
    });

    it('generates LLM auth token key', () => {
      expect(RedisKeys.llmAuthToken('anthropic')).toBe(
        'sim:llm:auth:anthropic',
      );
    });
  });

  describe('VAD state key', () => {
    it('generates VAD state key', () => {
      expect(RedisKeys.vadState('c1')).toBe('sim:vad:c1:state');
    });
  });

  describe('iteration history key', () => {
    it('generates iteration history key', () => {
      expect(RedisKeys.iterationHistory('iter1')).toBe(
        'sim:iteration:iter1:history',
      );
    });
  });

  describe('session member iteration key', () => {
    it('generates session member iteration key', () => {
      expect(RedisKeys.sessionMemberIteration('s1', 'u1')).toBe(
        'sim:smiter:s1:u1',
      );
    });
  });

  describe('video keys', () => {
    it('generates video audio asset key', () => {
      expect(RedisKeys.videoAudioAsset('job1')).toBe('sim:video:job1:audio');
    });

    it('generates video job key', () => {
      expect(RedisKeys.videoJob('job1')).toBe('sim:video:job1:job');
    });
  });
});

describe('RedisTTL', () => {
  it('SESSION_CACHE is 24 hours', () => {
    expect(RedisTTL.SESSION_CACHE).toBe(86400);
  });

  it('SESSION_CONTEXT is 24 hours', () => {
    expect(RedisTTL.SESSION_CONTEXT).toBe(86400);
  });

  it('PERSONA_CACHE is 1 hour', () => {
    expect(RedisTTL.PERSONA_CACHE).toBe(3600);
  });

  it('SCENARIO_CACHE is 1 hour', () => {
    expect(RedisTTL.SCENARIO_CACHE).toBe(3600);
  });

  it('SSE_STATE is 1 hour', () => {
    expect(RedisTTL.SSE_STATE).toBe(3600);
  });

  it('RATE_LIMIT_1MIN is 60 seconds', () => {
    expect(RedisTTL.RATE_LIMIT_1MIN).toBe(60);
  });

  it('RATE_LIMIT_1HOUR is 1 hour', () => {
    expect(RedisTTL.RATE_LIMIT_1HOUR).toBe(3600);
  });

  it('JOB_LOCK is 10 minutes', () => {
    expect(RedisTTL.JOB_LOCK).toBe(600);
  });

  it('SESSION_FULL is 10 minutes', () => {
    expect(RedisTTL.SESSION_FULL).toBe(600);
  });

  it('ITERATION_HISTORY is 30 minutes', () => {
    expect(RedisTTL.ITERATION_HISTORY).toBe(1800);
  });

  it('SESSION_MEMBER_ITER is 30 minutes', () => {
    expect(RedisTTL.SESSION_MEMBER_ITER).toBe(1800);
  });

  it('VIDEO_AUDIO_ASSET is 30 minutes', () => {
    expect(RedisTTL.VIDEO_AUDIO_ASSET).toBe(1800);
  });

  it('VIDEO_JOB is 24 hours', () => {
    expect(RedisTTL.VIDEO_JOB).toBe(86400);
  });

  it('PERSONA_PREVIEW_AUDIO is 30 days', () => {
    expect(RedisTTL.PERSONA_PREVIEW_AUDIO).toBe(2592000);
  });

  it('SESSION_MOOD is 30 minutes', () => {
    expect(RedisTTL.SESSION_MOOD).toBe(1800);
  });

  it('has all expected keys', () => {
    const keys = Object.keys(RedisTTL);
    expect(keys).toContain('SESSION_CACHE');
    expect(keys).toContain('WEBRTC_STATE');
    expect(keys).toContain('STT_PARTIAL');
    expect(keys).toContain('IDEMPOTENCY_KEY');
    expect(keys).toContain('TURN_CONTEXT');
    expect(keys).toContain('LLM_STREAM');
    expect(keys).toContain('VAD_STATE');
    expect(keys).toContain('LLM_PRICING');
    expect(keys).toContain('LLM_MODEL_CATALOG');
    expect(keys).toContain('WS_CONNECTION');
    expect(keys).toContain('WS_REQUEST');
  });
});
