import { SimulationRedisService } from '../../services/redis/redis.service';
import {
  RedisKeys,
  RedisTTL,
  ISessionCache,
  ISessionContext,
  ISSEChannelState,
  IWebRTCState,
  ISTTPartial,
  IIdempotencyRecord,
  ITurnContext,
  ILLMStreamState,
  IVADState,
  IConversationMessage,
  ISessionMemberIteration,
  IVideoAudioAsset,
  IVideoJob,
  IPersonaPreviewAudioAsset,
} from '../../services/redis/redis-key-patterns';
import type { IMoodState } from '../../services/conversation-tools.service';

function createMockRedis() {
  return {
    setex: jest.fn().mockResolvedValue('OK'),
    get: jest.fn().mockResolvedValue(null),
    del: jest.fn().mockResolvedValue(1),
    expire: jest.fn().mockResolvedValue(1),
    incr: jest.fn().mockResolvedValue(1),
    ttl: jest.fn().mockResolvedValue(60),
    set: jest.fn().mockResolvedValue('OK'),
    keys: jest.fn().mockResolvedValue([]),
    ping: jest.fn().mockResolvedValue('PONG'),
  };
}

describe('SimulationRedisService', () => {
  let service: SimulationRedisService;
  let redis: ReturnType<typeof createMockRedis>;

  beforeEach(() => {
    redis = createMockRedis();
    service = new SimulationRedisService(redis as never);
    jest.clearAllMocks();
  });

  // ── Session Cache ──────────────────────────────────────────────────────────

  describe('setSessionCache', () => {
    it('stores session data with correct key and TTL', async () => {
      const data: ISessionCache = {
        id: 's1',
        userId: 'u1',
        orgId: 'o1',
        mode: 'text',
        status: 'active',
        createdAt: '2025-01-01T00:00:00Z',
        lastActivityAt: '2025-01-01T00:00:00Z',
      };

      await service.setSessionCache('s1', data);

      expect(redis.setex).toHaveBeenCalledWith(
        RedisKeys.session('s1'),
        RedisTTL.SESSION_CACHE,
        JSON.stringify(data),
      );
    });
  });

  describe('getSessionCache', () => {
    it('returns parsed data when key exists', async () => {
      const data: ISessionCache = {
        id: 's1',
        userId: 'u1',
        orgId: 'o1',
        mode: 'voice',
        status: 'active',
        createdAt: '2025-01-01T00:00:00Z',
        lastActivityAt: '2025-01-01T00:00:00Z',
      };
      redis.get.mockResolvedValue(JSON.stringify(data));

      const result = await service.getSessionCache('s1');

      expect(redis.get).toHaveBeenCalledWith(RedisKeys.session('s1'));
      expect(result).toEqual(data);
    });

    it('returns null when key does not exist', async () => {
      redis.get.mockResolvedValue(null);
      const result = await service.getSessionCache('s1');
      expect(result).toBeNull();
    });
  });

  describe('deleteSessionCache', () => {
    it('deletes the session key', async () => {
      await service.deleteSessionCache('s1');
      expect(redis.del).toHaveBeenCalledWith(RedisKeys.session('s1'));
    });
  });

  describe('extendSessionTTL', () => {
    it('sets expire on the session key', async () => {
      await service.extendSessionTTL('s1');
      expect(redis.expire).toHaveBeenCalledWith(
        RedisKeys.session('s1'),
        RedisTTL.SESSION_CACHE,
      );
    });
  });

  // ── Session Context ────────────────────────────────────────────────────────

  describe('setSessionContext', () => {
    it('stores context with correct key and TTL', async () => {
      const ctx: ISessionContext = { sessionId: 's1' };
      await service.setSessionContext('s1', ctx);

      expect(redis.setex).toHaveBeenCalledWith(
        RedisKeys.sessionContext('s1'),
        RedisTTL.SESSION_CONTEXT,
        JSON.stringify(ctx),
      );
    });
  });

  describe('getSessionContext', () => {
    it('returns parsed context when exists', async () => {
      const ctx: ISessionContext = {
        sessionId: 's1',
        metadata: { foo: 'bar' },
      };
      redis.get.mockResolvedValue(JSON.stringify(ctx));

      const result = await service.getSessionContext('s1');
      expect(result).toEqual(ctx);
    });

    it('returns null when missing', async () => {
      const result = await service.getSessionContext('s1');
      expect(result).toBeNull();
    });
  });

  describe('deleteSessionContext', () => {
    it('deletes the context key', async () => {
      await service.deleteSessionContext('s1');
      expect(redis.del).toHaveBeenCalledWith(RedisKeys.sessionContext('s1'));
    });
  });

  // ── Persona / Scenario Cache ───────────────────────────────────────────────

  describe('setPersonaCache / getPersonaCache', () => {
    it('round-trips persona data', async () => {
      const data = { name: 'Test Persona' };
      await service.setPersonaCache('p1', data);
      expect(redis.setex).toHaveBeenCalledWith(
        RedisKeys.persona('p1'),
        RedisTTL.PERSONA_CACHE,
        JSON.stringify(data),
      );

      redis.get.mockResolvedValue(JSON.stringify(data));
      const result = await service.getPersonaCache('p1');
      expect(result).toEqual(data);
    });

    it('returns null for missing persona', async () => {
      const result = await service.getPersonaCache('missing');
      expect(result).toBeNull();
    });
  });

  describe('setScenarioCache / getScenarioCache', () => {
    it('round-trips scenario data', async () => {
      const data = { title: 'Test Scenario' };
      await service.setScenarioCache('sc1', data);
      expect(redis.setex).toHaveBeenCalledWith(
        RedisKeys.scenario('sc1'),
        RedisTTL.SCENARIO_CACHE,
        JSON.stringify(data),
      );

      redis.get.mockResolvedValue(JSON.stringify(data));
      const result = await service.getScenarioCache('sc1');
      expect(result).toEqual(data);
    });

    it('returns null for missing scenario', async () => {
      const result = await service.getScenarioCache('missing');
      expect(result).toBeNull();
    });
  });

  // ── SSE ────────────────────────────────────────────────────────────────────

  describe('SSE channel state', () => {
    const state: ISSEChannelState = {
      sessionId: 's1',
      isActive: true,
      lastEventId: 'evt-1',
      connectedAt: '2025-01-01T00:00:00Z',
      lastPingAt: '2025-01-01T00:00:00Z',
    };

    it('stores and retrieves SSE channel state', async () => {
      await service.setSSEChannelState('s1', state);
      expect(redis.setex).toHaveBeenCalledWith(
        RedisKeys.sseChannel('s1'),
        RedisTTL.SSE_STATE,
        JSON.stringify(state),
      );

      redis.get.mockResolvedValue(JSON.stringify(state));
      const result = await service.getSSEChannelState('s1');
      expect(result).toEqual(state);
    });

    it('returns null when SSE state missing', async () => {
      expect(await service.getSSEChannelState('s1')).toBeNull();
    });
  });

  describe('SSE last event ID', () => {
    it('stores and retrieves event ID', async () => {
      await service.setSSELastEventId('s1', 'evt-42');
      expect(redis.setex).toHaveBeenCalledWith(
        RedisKeys.sseLastEventId('s1'),
        RedisTTL.SSE_STATE,
        'evt-42',
      );

      redis.get.mockResolvedValue('evt-42');
      const result = await service.getSSELastEventId('s1');
      expect(result).toBe('evt-42');
    });

    it('returns null when missing', async () => {
      expect(await service.getSSELastEventId('s1')).toBeNull();
    });
  });

  // ── WebRTC ─────────────────────────────────────────────────────────────────

  describe('WebRTC state', () => {
    const state: IWebRTCState = {
      callId: 'c1',
      sessionId: 's1',
      status: 'connected',
      tracks: ['audio', 'video'],
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
    };

    it('stores and retrieves WebRTC state', async () => {
      await service.setWebRTCState('c1', state);
      expect(redis.setex).toHaveBeenCalledWith(
        RedisKeys.webrtcState('c1'),
        RedisTTL.WEBRTC_STATE,
        JSON.stringify(state),
      );

      redis.get.mockResolvedValue(JSON.stringify(state));
      expect(await service.getWebRTCState('c1')).toEqual(state);
    });

    it('returns null for missing WebRTC state', async () => {
      expect(await service.getWebRTCState('c1')).toBeNull();
    });
  });

  describe('WebRTC offer', () => {
    it('stores and retrieves SDP offer', async () => {
      await service.setWebRTCOffer('c1', 'sdp-offer');
      expect(redis.setex).toHaveBeenCalledWith(
        RedisKeys.webrtcOffer('c1'),
        RedisTTL.WEBRTC_STATE,
        'sdp-offer',
      );

      redis.get.mockResolvedValue('sdp-offer');
      expect(await service.getWebRTCOffer('c1')).toBe('sdp-offer');
    });
  });

  describe('WebRTC answer', () => {
    it('stores and retrieves SDP answer', async () => {
      await service.setWebRTCAnswer('c1', 'sdp-answer');
      redis.get.mockResolvedValue('sdp-answer');
      expect(await service.getWebRTCAnswer('c1')).toBe('sdp-answer');
    });
  });

  describe('deleteWebRTCState', () => {
    it('deletes state, offer, and answer keys', async () => {
      await service.deleteWebRTCState('c1');
      expect(redis.del).toHaveBeenCalledWith(
        RedisKeys.webrtcState('c1'),
        RedisKeys.webrtcOffer('c1'),
        RedisKeys.webrtcAnswer('c1'),
      );
    });
  });

  // ── STT Partial ────────────────────────────────────────────────────────────

  describe('STT partial', () => {
    const partial: ISTTPartial = {
      callId: 'c1',
      text: 'hello world',
      isFinal: false,
      timestamp: '2025-01-01T00:00:00Z',
    };

    it('stores and retrieves STT partial', async () => {
      await service.setSTTPartial('c1', partial);
      expect(redis.setex).toHaveBeenCalledWith(
        RedisKeys.sttPartial('c1'),
        RedisTTL.STT_PARTIAL,
        JSON.stringify(partial),
      );

      redis.get.mockResolvedValue(JSON.stringify(partial));
      expect(await service.getSTTPartial('c1')).toEqual(partial);
    });

    it('returns null when missing', async () => {
      expect(await service.getSTTPartial('c1')).toBeNull();
    });

    it('deletes STT partial', async () => {
      await service.deleteSTTPartial('c1');
      expect(redis.del).toHaveBeenCalledWith(RedisKeys.sttPartial('c1'));
    });
  });

  // ── Rate Limiting ──────────────────────────────────────────────────────────

  describe('incrementRateLimitOrg', () => {
    it('increments counter and sets expiry on first call', async () => {
      redis.incr.mockResolvedValue(1);
      redis.ttl.mockResolvedValue(60);

      const result = await service.incrementRateLimitOrg('org1', '1min', 100);

      expect(redis.incr).toHaveBeenCalledWith(
        RedisKeys.rateLimitOrg('org1', '1min'),
      );
      expect(redis.expire).toHaveBeenCalledWith(
        RedisKeys.rateLimitOrg('org1', '1min'),
        RedisTTL.RATE_LIMIT_1MIN,
      );
      expect(result.count).toBe(1);
      expect(result.limit).toBe(100);
    });

    it('does not set expiry on subsequent calls', async () => {
      redis.incr.mockResolvedValue(5);
      redis.ttl.mockResolvedValue(30);

      await service.incrementRateLimitOrg('org1', '1min', 100);

      expect(redis.expire).not.toHaveBeenCalled();
    });

    it('uses 1-hour TTL for non-1min windows', async () => {
      redis.incr.mockResolvedValue(1);
      redis.ttl.mockResolvedValue(3600);

      await service.incrementRateLimitOrg('org1', '1hour', 500);

      expect(redis.expire).toHaveBeenCalledWith(
        RedisKeys.rateLimitOrg('org1', '1hour'),
        RedisTTL.RATE_LIMIT_1HOUR,
      );
    });
  });

  describe('incrementRateLimitUser', () => {
    it('increments user rate limit counter', async () => {
      redis.incr.mockResolvedValue(1);
      redis.ttl.mockResolvedValue(60);

      const result = await service.incrementRateLimitUser('u1', '1min', 50);

      expect(redis.incr).toHaveBeenCalledWith(
        RedisKeys.rateLimitUser('u1', '1min'),
      );
      expect(result.count).toBe(1);
      expect(result.limit).toBe(50);
    });

    it('uses hour TTL for non-1min windows', async () => {
      redis.incr.mockResolvedValue(1);
      redis.ttl.mockResolvedValue(3600);

      await service.incrementRateLimitUser('u1', '1hour', 200);

      expect(redis.expire).toHaveBeenCalledWith(
        RedisKeys.rateLimitUser('u1', '1hour'),
        RedisTTL.RATE_LIMIT_1HOUR,
      );
    });
  });

  // ── Idempotency ────────────────────────────────────────────────────────────

  describe('idempotency key', () => {
    const record: IIdempotencyRecord = {
      key: 'req-1',
      requestHash: 'abc123',
      responseStatus: 200,
      responseBody: { ok: true },
      createdAt: '2025-01-01T00:00:00Z',
      expiresAt: '2025-01-02T00:00:00Z',
    };

    it('stores idempotency record', async () => {
      await service.setIdempotencyKey('req-1', record);
      expect(redis.setex).toHaveBeenCalledWith(
        RedisKeys.idempotencyKey('req-1'),
        RedisTTL.IDEMPOTENCY_KEY,
        JSON.stringify(record),
      );
    });

    it('retrieves idempotency record', async () => {
      redis.get.mockResolvedValue(JSON.stringify(record));
      expect(await service.getIdempotencyKey('req-1')).toEqual(record);
    });

    it('returns null for missing key', async () => {
      expect(await service.getIdempotencyKey('missing')).toBeNull();
    });
  });

  // ── Job Lock ───────────────────────────────────────────────────────────────

  describe('acquireJobLock', () => {
    it('acquires lock when key does not exist (NX succeeds)', async () => {
      redis.set.mockResolvedValue('OK');

      const acquired = await service.acquireJobLock('tts', 'job1', 'w1');

      expect(redis.set).toHaveBeenCalledWith(
        RedisKeys.jobLock('tts', 'job1'),
        expect.any(String),
        'EX',
        RedisTTL.JOB_LOCK,
        'NX',
      );
      expect(acquired).toBe(true);
    });

    it('fails to acquire when lock already exists', async () => {
      redis.set.mockResolvedValue(null);

      const acquired = await service.acquireJobLock('tts', 'job1', 'w1');
      expect(acquired).toBe(false);
    });

    it('uses custom TTL when provided', async () => {
      redis.set.mockResolvedValue('OK');
      await service.acquireJobLock('tts', 'job1', 'w1', 120);

      expect(redis.set).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        'EX',
        120,
        'NX',
      );
    });
  });

  describe('releaseJobLock', () => {
    it('deletes the lock key', async () => {
      await service.releaseJobLock('tts', 'job1');
      expect(redis.del).toHaveBeenCalledWith(RedisKeys.jobLock('tts', 'job1'));
    });
  });

  describe('heartbeatJobLock', () => {
    it('returns false when lock does not exist', async () => {
      redis.get.mockResolvedValue(null);
      expect(await service.heartbeatJobLock('tts', 'job1', 'w1')).toBe(false);
    });

    it('returns false when locked by different worker', async () => {
      redis.get.mockResolvedValue(JSON.stringify({ lockedBy: 'other-worker' }));
      expect(await service.heartbeatJobLock('tts', 'job1', 'w1')).toBe(false);
    });

    it('refreshes heartbeat and returns true when owner matches', async () => {
      redis.get.mockResolvedValue(
        JSON.stringify({
          jobType: 'tts',
          jobId: 'job1',
          lockedBy: 'w1',
          heartbeatAt: '2025-01-01T00:00:00Z',
        }),
      );

      const result = await service.heartbeatJobLock('tts', 'job1', 'w1');
      expect(result).toBe(true);
      expect(redis.setex).toHaveBeenCalledWith(
        RedisKeys.jobLock('tts', 'job1'),
        RedisTTL.JOB_LOCK,
        expect.stringContaining('"lockedBy":"w1"'),
      );
    });
  });

  // ── Turn Context ───────────────────────────────────────────────────────────

  describe('turn context', () => {
    const ctx: ITurnContext = {
      sessionId: 's1',
      turnId: 't1',
      role: 'user',
      text: 'Hello',
    };

    it('stores turn context', async () => {
      await service.setTurnContext('s1', 't1', ctx);
      expect(redis.setex).toHaveBeenCalledWith(
        RedisKeys.turnContext('s1', 't1'),
        RedisTTL.TURN_CONTEXT,
        JSON.stringify(ctx),
      );
    });

    it('retrieves turn context', async () => {
      redis.get.mockResolvedValue(JSON.stringify(ctx));
      expect(await service.getTurnContext('s1', 't1')).toEqual(ctx);
    });

    it('returns null when missing', async () => {
      expect(await service.getTurnContext('s1', 't1')).toBeNull();
    });

    it('deletes turn context', async () => {
      await service.deleteTurnContext('s1', 't1');
      expect(redis.del).toHaveBeenCalledWith(RedisKeys.turnContext('s1', 't1'));
    });
  });

  // ── LLM Stream State ──────────────────────────────────────────────────────

  describe('LLM stream state', () => {
    const state: ILLMStreamState = {
      sessionId: 's1',
      turnId: 't1',
      provider: 'openai',
      model: 'gpt-4',
      isActive: true,
      partialContent: 'partial',
      totalTokens: 100,
      startedAt: '2025-01-01T00:00:00Z',
      lastChunkAt: '2025-01-01T00:00:00Z',
    };

    it('stores LLM stream state', async () => {
      await service.setLLMStreamState('s1', 't1', state);
      expect(redis.setex).toHaveBeenCalledWith(
        RedisKeys.llmStream('s1', 't1'),
        RedisTTL.LLM_STREAM,
        JSON.stringify(state),
      );
    });

    it('retrieves LLM stream state', async () => {
      redis.get.mockResolvedValue(JSON.stringify(state));
      expect(await service.getLLMStreamState('s1', 't1')).toEqual(state);
    });

    it('returns null when missing', async () => {
      expect(await service.getLLMStreamState('s1', 't1')).toBeNull();
    });

    it('deletes LLM stream state', async () => {
      await service.deleteLLMStreamState('s1', 't1');
      expect(redis.del).toHaveBeenCalledWith(RedisKeys.llmStream('s1', 't1'));
    });
  });

  // ── VAD State ──────────────────────────────────────────────────────────────

  describe('VAD state', () => {
    const state: IVADState = {
      callId: 'c1',
      isSpeaking: true,
      silenceDurationMs: 0,
      speechDurationMs: 1500,
      lastActivityAt: '2025-01-01T00:00:00Z',
      threshold: 0.5,
    };

    it('stores VAD state', async () => {
      await service.setVADState('c1', state);
      expect(redis.setex).toHaveBeenCalledWith(
        RedisKeys.vadState('c1'),
        RedisTTL.VAD_STATE,
        JSON.stringify(state),
      );
    });

    it('retrieves VAD state', async () => {
      redis.get.mockResolvedValue(JSON.stringify(state));
      expect(await service.getVADState('c1')).toEqual(state);
    });

    it('returns null when missing', async () => {
      expect(await service.getVADState('c1')).toBeNull();
    });

    it('deletes VAD state', async () => {
      await service.deleteVADState('c1');
      expect(redis.del).toHaveBeenCalledWith(RedisKeys.vadState('c1'));
    });
  });

  // ── Session Full ───────────────────────────────────────────────────────────

  describe('session full', () => {
    const data = { id: 's1', scenario: {}, persona: {} };

    it('stores full session', async () => {
      await service.setSessionFull('s1', data);
      expect(redis.setex).toHaveBeenCalledWith(
        RedisKeys.sessionFull('s1'),
        RedisTTL.SESSION_FULL,
        JSON.stringify(data),
      );
    });

    it('retrieves full session', async () => {
      redis.get.mockResolvedValue(JSON.stringify(data));
      expect(await service.getSessionFull('s1')).toEqual(data);
    });

    it('returns null when missing', async () => {
      expect(await service.getSessionFull('s1')).toBeNull();
    });

    it('deletes full session', async () => {
      await service.deleteSessionFull('s1');
      expect(redis.del).toHaveBeenCalledWith(RedisKeys.sessionFull('s1'));
    });
  });

  // ── Iteration History ──────────────────────────────────────────────────────

  describe('iteration history', () => {
    const messages: IConversationMessage[] = [
      { role: 'user', content: 'Hi' },
      { role: 'assistant', content: 'Hello' },
    ];

    it('stores iteration history', async () => {
      await service.setIterationHistory('iter1', messages);
      expect(redis.setex).toHaveBeenCalledWith(
        RedisKeys.iterationHistory('iter1'),
        RedisTTL.ITERATION_HISTORY,
        JSON.stringify(messages),
      );
    });

    it('retrieves iteration history', async () => {
      redis.get.mockResolvedValue(JSON.stringify(messages));
      expect(await service.getIterationHistory('iter1')).toEqual(messages);
    });

    it('returns null when missing', async () => {
      expect(await service.getIterationHistory('iter1')).toBeNull();
    });

    it('appends a message to existing history', async () => {
      redis.get.mockResolvedValue(JSON.stringify(messages));

      const newMsg: IConversationMessage = { role: 'user', content: 'How?' };
      await service.appendIterationMessage('iter1', newMsg);

      expect(redis.setex).toHaveBeenCalledWith(
        RedisKeys.iterationHistory('iter1'),
        RedisTTL.ITERATION_HISTORY,
        JSON.stringify([...messages, newMsg]),
      );
    });

    it('creates new history when appending to non-existent iteration', async () => {
      redis.get.mockResolvedValue(null);

      const msg: IConversationMessage = { role: 'user', content: 'First' };
      await service.appendIterationMessage('iter2', msg);

      expect(redis.setex).toHaveBeenCalledWith(
        RedisKeys.iterationHistory('iter2'),
        RedisTTL.ITERATION_HISTORY,
        JSON.stringify([msg]),
      );
    });

    it('deletes iteration history', async () => {
      await service.deleteIterationHistory('iter1');
      expect(redis.del).toHaveBeenCalledWith(
        RedisKeys.iterationHistory('iter1'),
      );
    });
  });

  // ── Session Member Iteration ───────────────────────────────────────────────

  describe('session member iteration', () => {
    const data: ISessionMemberIteration = {
      sessionMemberId: 'sm1',
      iterationId: 'iter1',
      lastTurnOrder: 3,
    };

    it('stores member iteration mapping', async () => {
      await service.setSessionMemberIteration('s1', 'u1', data);
      expect(redis.setex).toHaveBeenCalledWith(
        RedisKeys.sessionMemberIteration('s1', 'u1'),
        RedisTTL.SESSION_MEMBER_ITER,
        JSON.stringify(data),
      );
    });

    it('retrieves member iteration mapping', async () => {
      redis.get.mockResolvedValue(JSON.stringify(data));
      expect(await service.getSessionMemberIteration('s1', 'u1')).toEqual(data);
    });

    it('returns null when missing', async () => {
      expect(await service.getSessionMemberIteration('s1', 'u1')).toBeNull();
    });

    it('deletes member iteration mapping', async () => {
      await service.deleteSessionMemberIteration('s1', 'u1');
      expect(redis.del).toHaveBeenCalledWith(
        RedisKeys.sessionMemberIteration('s1', 'u1'),
      );
    });
  });

  // ── Video Audio Asset ──────────────────────────────────────────────────────

  describe('video audio asset', () => {
    const asset: IVideoAudioAsset = {
      sessionId: 's1',
      token: 'tok',
      contentType: 'audio/wav',
      audioBase64: 'base64data',
      createdAt: '2025-01-01T00:00:00Z',
    };

    it('stores video audio asset', async () => {
      await service.setVideoAudioAsset('job1', asset);
      expect(redis.setex).toHaveBeenCalledWith(
        RedisKeys.videoAudioAsset('job1'),
        RedisTTL.VIDEO_AUDIO_ASSET,
        JSON.stringify(asset),
      );
    });

    it('retrieves video audio asset', async () => {
      redis.get.mockResolvedValue(JSON.stringify(asset));
      expect(await service.getVideoAudioAsset('job1')).toEqual(asset);
    });

    it('returns null when missing', async () => {
      expect(await service.getVideoAudioAsset('job1')).toBeNull();
    });

    it('deletes video audio asset', async () => {
      await service.deleteVideoAudioAsset('job1');
      expect(redis.del).toHaveBeenCalledWith(RedisKeys.videoAudioAsset('job1'));
    });
  });

  // ── Video Job ──────────────────────────────────────────────────────────────

  describe('video job', () => {
    const job: IVideoJob = {
      jobId: 'job1',
      sessionId: 's1',
      requestId: 'req1',
      provider: 'heygen',
      text: 'Hello world',
      fallbackAttempted: false,
      createdAt: '2025-01-01T00:00:00Z',
    };

    it('stores video job', async () => {
      await service.setVideoJob('job1', job);
      expect(redis.setex).toHaveBeenCalledWith(
        RedisKeys.videoJob('job1'),
        RedisTTL.VIDEO_JOB,
        JSON.stringify(job),
      );
    });

    it('retrieves video job', async () => {
      redis.get.mockResolvedValue(JSON.stringify(job));
      expect(await service.getVideoJob('job1')).toEqual(job);
    });

    it('returns null when missing', async () => {
      expect(await service.getVideoJob('job1')).toBeNull();
    });

    it('deletes video job', async () => {
      await service.deleteVideoJob('job1');
      expect(redis.del).toHaveBeenCalledWith(RedisKeys.videoJob('job1'));
    });
  });

  // ── Persona Preview Audio ──────────────────────────────────────────────────

  describe('persona preview audio', () => {
    const asset: IPersonaPreviewAudioAsset = {
      personaId: 'p1',
      voiceName: 'alloy',
      text: 'Preview text',
      contentType: 'audio/mp3',
      audioBase64: 'base64preview',
      createdAt: '2025-01-01T00:00:00Z',
    };

    it('stores persona preview audio', async () => {
      await service.setPersonaPreviewAudio('p1', asset);
      expect(redis.setex).toHaveBeenCalledWith(
        RedisKeys.personaPreviewAudio('p1'),
        RedisTTL.PERSONA_PREVIEW_AUDIO,
        JSON.stringify(asset),
      );
    });

    it('retrieves persona preview audio', async () => {
      redis.get.mockResolvedValue(JSON.stringify(asset));
      expect(await service.getPersonaPreviewAudio('p1')).toEqual(asset);
    });

    it('returns null when missing', async () => {
      expect(await service.getPersonaPreviewAudio('p1')).toBeNull();
    });

    it('deletes persona preview audio', async () => {
      await service.deletePersonaPreviewAudio('p1');
      expect(redis.del).toHaveBeenCalledWith(
        RedisKeys.personaPreviewAudio('p1'),
      );
    });
  });

  // ── Mood State ─────────────────────────────────────────────────────────────

  describe('mood state', () => {
    const mood: IMoodState = {
      mood: 'frustrated',
      intensity: 7,
      trigger: 'repeated question',
      setAt: '2025-01-01T00:00:00Z',
    };

    it('stores mood state', async () => {
      await service.setMoodState('s1', mood);
      expect(redis.setex).toHaveBeenCalledWith(
        RedisKeys.sessionMood('s1'),
        RedisTTL.SESSION_MOOD,
        JSON.stringify(mood),
      );
    });

    it('retrieves mood state', async () => {
      redis.get.mockResolvedValue(JSON.stringify(mood));
      expect(await service.getMoodState('s1')).toEqual(mood);
    });

    it('returns null when missing', async () => {
      expect(await service.getMoodState('s1')).toBeNull();
    });
  });

  // ── Batch operations ──────────────────────────────────────────────────────

  describe('clearSessionData', () => {
    it('deletes all session-related keys', async () => {
      await service.clearSessionData('s1');
      expect(redis.del).toHaveBeenCalledWith(
        RedisKeys.session('s1'),
        RedisKeys.sessionContext('s1'),
        RedisKeys.sseChannel('s1'),
        RedisKeys.sseLastEventId('s1'),
      );
    });
  });

  describe('clearCallData', () => {
    it('deletes all call-related keys', async () => {
      await service.clearCallData('c1');
      expect(redis.del).toHaveBeenCalledWith(
        RedisKeys.webrtcState('c1'),
        RedisKeys.webrtcOffer('c1'),
        RedisKeys.webrtcAnswer('c1'),
        RedisKeys.sttPartial('c1'),
        RedisKeys.vadState('c1'),
      );
    });
  });

  // ── Utility ────────────────────────────────────────────────────────────────

  describe('getKeysByPattern', () => {
    it('delegates to redis.keys', async () => {
      redis.keys.mockResolvedValue(['sim:session:s1', 'sim:session:s2']);
      const result = await service.getKeysByPattern('sim:session:*');
      expect(redis.keys).toHaveBeenCalledWith('sim:session:*');
      expect(result).toEqual(['sim:session:s1', 'sim:session:s2']);
    });
  });

  describe('ping', () => {
    it('returns true on PONG', async () => {
      redis.ping.mockResolvedValue('PONG');
      expect(await service.ping()).toBe(true);
    });

    it('returns false on non-PONG response', async () => {
      redis.ping.mockResolvedValue('ERROR');
      expect(await service.ping()).toBe(false);
    });

    it('returns false on error', async () => {
      redis.ping.mockRejectedValue(new Error('Connection refused'));
      expect(await service.ping()).toBe(false);
    });
  });
});
