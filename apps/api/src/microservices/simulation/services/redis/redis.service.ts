import { Injectable, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';
import {
  RedisKeys,
  RedisTTL,
  ISessionCache,
  ISessionContext,
  ISSEChannelState,
  IWebRTCState,
  ISTTPartial,
  IRateLimitCounter,
  IIdempotencyRecord,
  IJobLock,
  ITurnContext,
  ILLMStreamState,
  IVADState,
} from './redis-key-patterns';

/**
 * SimulationRedisService
 *
 * Provides typed Redis operations for the Simulation microservice.
 * All data stored in Redis is ephemeral and can be reconstructed from PostgreSQL/MongoDB.
 *
 * Usage:
 * - Inject this service into controllers/services
 * - Use typed methods for specific data patterns
 * - All methods handle serialization/deserialization automatically
 * - All keys have TTL set automatically
 */
@Injectable()
export class SimulationRedisService {
  private readonly logger = new Logger(SimulationRedisService.name);

  constructor(private readonly redis: Redis) {}

  async setSessionCache(sessionId: string, data: ISessionCache): Promise<void> {
    const key = RedisKeys.session(sessionId);
    await this.redis.setex(key, RedisTTL.SESSION_CACHE, JSON.stringify(data));
    this.logger.debug(`Session cache set: ${key}`);
  }

  async getSessionCache(sessionId: string): Promise<ISessionCache | null> {
    const key = RedisKeys.session(sessionId);
    const data = await this.redis.get(key);
    if (!data) return null;
    return JSON.parse(data) as ISessionCache;
  }

  async deleteSessionCache(sessionId: string): Promise<void> {
    const key = RedisKeys.session(sessionId);
    await this.redis.del(key);
    this.logger.debug(`Session cache deleted: ${key}`);
  }

  async extendSessionTTL(sessionId: string): Promise<void> {
    const key = RedisKeys.session(sessionId);
    await this.redis.expire(key, RedisTTL.SESSION_CACHE);
  }

  async setSessionContext(
    sessionId: string,
    context: ISessionContext,
  ): Promise<void> {
    const key = RedisKeys.sessionContext(sessionId);
    await this.redis.setex(
      key,
      RedisTTL.SESSION_CONTEXT,
      JSON.stringify(context),
    );
  }

  async getSessionContext(sessionId: string): Promise<ISessionContext | null> {
    const key = RedisKeys.sessionContext(sessionId);
    const data = await this.redis.get(key);
    if (!data) return null;
    return JSON.parse(data) as ISessionContext;
  }

  async deleteSessionContext(sessionId: string): Promise<void> {
    const key = RedisKeys.sessionContext(sessionId);
    await this.redis.del(key);
  }

  async setPersonaCache(
    personaId: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    const key = RedisKeys.persona(personaId);
    await this.redis.setex(key, RedisTTL.PERSONA_CACHE, JSON.stringify(data));
  }

  async getPersonaCache(
    personaId: string,
  ): Promise<Record<string, unknown> | null> {
    const key = RedisKeys.persona(personaId);
    const data = await this.redis.get(key);
    if (!data) return null;
    return JSON.parse(data) as Record<string, unknown>;
  }

  async setScenarioCache(
    scenarioId: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    const key = RedisKeys.scenario(scenarioId);
    await this.redis.setex(key, RedisTTL.SCENARIO_CACHE, JSON.stringify(data));
  }

  async getScenarioCache(
    scenarioId: string,
  ): Promise<Record<string, unknown> | null> {
    const key = RedisKeys.scenario(scenarioId);
    const data = await this.redis.get(key);
    if (!data) return null;
    return JSON.parse(data) as Record<string, unknown>;
  }

  async setSSEChannelState(
    sessionId: string,
    state: ISSEChannelState,
  ): Promise<void> {
    const key = RedisKeys.sseChannel(sessionId);
    await this.redis.setex(key, RedisTTL.SSE_STATE, JSON.stringify(state));
  }

  async getSSEChannelState(
    sessionId: string,
  ): Promise<ISSEChannelState | null> {
    const key = RedisKeys.sseChannel(sessionId);
    const data = await this.redis.get(key);
    if (!data) return null;
    return JSON.parse(data) as ISSEChannelState;
  }

  async setSSELastEventId(sessionId: string, eventId: string): Promise<void> {
    const key = RedisKeys.sseLastEventId(sessionId);
    await this.redis.setex(key, RedisTTL.SSE_STATE, eventId);
  }

  async getSSELastEventId(sessionId: string): Promise<string | null> {
    const key = RedisKeys.sseLastEventId(sessionId);
    return await this.redis.get(key);
  }

  async setWebRTCState(callId: string, state: IWebRTCState): Promise<void> {
    const key = RedisKeys.webrtcState(callId);
    await this.redis.setex(key, RedisTTL.WEBRTC_STATE, JSON.stringify(state));
  }

  async getWebRTCState(callId: string): Promise<IWebRTCState | null> {
    const key = RedisKeys.webrtcState(callId);
    const data = await this.redis.get(key);
    if (!data) return null;
    return JSON.parse(data) as IWebRTCState;
  }

  async setWebRTCOffer(callId: string, sdp: string): Promise<void> {
    const key = RedisKeys.webrtcOffer(callId);
    await this.redis.setex(key, RedisTTL.WEBRTC_STATE, sdp);
  }

  async getWebRTCOffer(callId: string): Promise<string | null> {
    const key = RedisKeys.webrtcOffer(callId);
    return await this.redis.get(key);
  }

  async setWebRTCAnswer(callId: string, sdp: string): Promise<void> {
    const key = RedisKeys.webrtcAnswer(callId);
    await this.redis.setex(key, RedisTTL.WEBRTC_STATE, sdp);
  }

  async getWebRTCAnswer(callId: string): Promise<string | null> {
    const key = RedisKeys.webrtcAnswer(callId);
    return await this.redis.get(key);
  }

  async deleteWebRTCState(callId: string): Promise<void> {
    const keys = [
      RedisKeys.webrtcState(callId),
      RedisKeys.webrtcOffer(callId),
      RedisKeys.webrtcAnswer(callId),
    ];
    await this.redis.del(...keys);
  }

  async setSTTPartial(callId: string, partial: ISTTPartial): Promise<void> {
    const key = RedisKeys.sttPartial(callId);
    await this.redis.setex(key, RedisTTL.STT_PARTIAL, JSON.stringify(partial));
  }

  async getSTTPartial(callId: string): Promise<ISTTPartial | null> {
    const key = RedisKeys.sttPartial(callId);
    const data = await this.redis.get(key);
    if (!data) return null;
    return JSON.parse(data) as ISTTPartial;
  }

  async deleteSTTPartial(callId: string): Promise<void> {
    const key = RedisKeys.sttPartial(callId);
    await this.redis.del(key);
  }

  async incrementRateLimitOrg(
    orgId: string,
    window: string,
    limit: number,
  ): Promise<IRateLimitCounter> {
    const key = RedisKeys.rateLimitOrg(orgId, window);
    const ttl =
      window === '1min' ? RedisTTL.RATE_LIMIT_1MIN : RedisTTL.RATE_LIMIT_1HOUR;

    const count = await this.redis.incr(key);
    if (count === 1) {
      await this.redis.expire(key, ttl);
    }

    const ttlRemaining = await this.redis.ttl(key);
    const now = new Date();
    const windowEnd = new Date(now.getTime() + ttlRemaining * 1000);

    return {
      count,
      windowStart: new Date(windowEnd.getTime() - ttl * 1000).toISOString(),
      windowEnd: windowEnd.toISOString(),
      limit,
    };
  }

  async incrementRateLimitUser(
    userId: string,
    window: string,
    limit: number,
  ): Promise<IRateLimitCounter> {
    const key = RedisKeys.rateLimitUser(userId, window);
    const ttl =
      window === '1min' ? RedisTTL.RATE_LIMIT_1MIN : RedisTTL.RATE_LIMIT_1HOUR;

    const count = await this.redis.incr(key);
    if (count === 1) {
      await this.redis.expire(key, ttl);
    }

    const ttlRemaining = await this.redis.ttl(key);
    const now = new Date();
    const windowEnd = new Date(now.getTime() + ttlRemaining * 1000);

    return {
      count,
      windowStart: new Date(windowEnd.getTime() - ttl * 1000).toISOString(),
      windowEnd: windowEnd.toISOString(),
      limit,
    };
  }

  async setIdempotencyKey(
    key: string,
    record: IIdempotencyRecord,
  ): Promise<void> {
    const redisKey = RedisKeys.idempotencyKey(key);
    await this.redis.setex(
      redisKey,
      RedisTTL.IDEMPOTENCY_KEY,
      JSON.stringify(record),
    );
  }

  async getIdempotencyKey(key: string): Promise<IIdempotencyRecord | null> {
    const redisKey = RedisKeys.idempotencyKey(key);
    const data = await this.redis.get(redisKey);
    if (!data) return null;
    return JSON.parse(data) as IIdempotencyRecord;
  }

  async acquireJobLock(
    jobType: string,
    jobId: string,
    workerId: string,
    ttl: number = RedisTTL.JOB_LOCK,
  ): Promise<boolean> {
    const key = RedisKeys.jobLock(jobType, jobId);
    const now = new Date().toISOString();

    const lock: IJobLock = {
      jobType,
      jobId,
      lockedBy: workerId,
      lockedAt: now,
      expiresAt: new Date(Date.now() + ttl * 1000).toISOString(),
      heartbeatAt: now,
    };

    const result = await this.redis.set(
      key,
      JSON.stringify(lock),
      'EX',
      ttl,
      'NX',
    );

    return result === 'OK';
  }

  async releaseJobLock(jobType: string, jobId: string): Promise<void> {
    const key = RedisKeys.jobLock(jobType, jobId);
    await this.redis.del(key);
  }

  async heartbeatJobLock(
    jobType: string,
    jobId: string,
    workerId: string,
  ): Promise<boolean> {
    const key = RedisKeys.jobLock(jobType, jobId);
    const data = await this.redis.get(key);

    if (!data) return false;

    const lock = JSON.parse(data) as IJobLock;
    if (lock.lockedBy !== workerId) {
      return false;
    }

    lock.heartbeatAt = new Date().toISOString();
    await this.redis.setex(key, RedisTTL.JOB_LOCK, JSON.stringify(lock));

    return true;
  }

  async setTurnContext(
    sessionId: string,
    turnId: string,
    context: ITurnContext,
  ): Promise<void> {
    const key = RedisKeys.turnContext(sessionId, turnId);
    await this.redis.setex(key, RedisTTL.TURN_CONTEXT, JSON.stringify(context));
  }

  async getTurnContext(
    sessionId: string,
    turnId: string,
  ): Promise<ITurnContext | null> {
    const key = RedisKeys.turnContext(sessionId, turnId);
    const data = await this.redis.get(key);
    if (!data) return null;
    return JSON.parse(data) as ITurnContext;
  }

  async deleteTurnContext(sessionId: string, turnId: string): Promise<void> {
    const key = RedisKeys.turnContext(sessionId, turnId);
    await this.redis.del(key);
  }

  async setLLMStreamState(
    sessionId: string,
    turnId: string,
    state: ILLMStreamState,
  ): Promise<void> {
    const key = RedisKeys.llmStream(sessionId, turnId);
    await this.redis.setex(key, RedisTTL.LLM_STREAM, JSON.stringify(state));
  }

  async getLLMStreamState(
    sessionId: string,
    turnId: string,
  ): Promise<ILLMStreamState | null> {
    const key = RedisKeys.llmStream(sessionId, turnId);
    const data = await this.redis.get(key);
    if (!data) return null;
    return JSON.parse(data) as ILLMStreamState;
  }

  async deleteLLMStreamState(sessionId: string, turnId: string): Promise<void> {
    const key = RedisKeys.llmStream(sessionId, turnId);
    await this.redis.del(key);
  }

  async setVADState(callId: string, state: IVADState): Promise<void> {
    const key = RedisKeys.vadState(callId);
    await this.redis.setex(key, RedisTTL.VAD_STATE, JSON.stringify(state));
  }

  async getVADState(callId: string): Promise<IVADState | null> {
    const key = RedisKeys.vadState(callId);
    const data = await this.redis.get(key);
    if (!data) return null;
    return JSON.parse(data) as IVADState;
  }

  async deleteVADState(callId: string): Promise<void> {
    const key = RedisKeys.vadState(callId);
    await this.redis.del(key);
  }

  /**
   * Clear all session-related keys (cache, context, SSE, etc.)
   */
  async clearSessionData(sessionId: string): Promise<void> {
    const keys = [
      RedisKeys.session(sessionId),
      RedisKeys.sessionContext(sessionId),
      RedisKeys.sseChannel(sessionId),
      RedisKeys.sseLastEventId(sessionId),
    ];

    await this.redis.del(...keys);
    this.logger.debug(`Session data cleared for: ${sessionId}`);
  }

  /**
   * Clear all call-related keys (WebRTC, STT, VAD)
   */
  async clearCallData(callId: string): Promise<void> {
    const keys = [
      RedisKeys.webrtcState(callId),
      RedisKeys.webrtcOffer(callId),
      RedisKeys.webrtcAnswer(callId),
      RedisKeys.sttPartial(callId),
      RedisKeys.vadState(callId),
    ];

    await this.redis.del(...keys);
    this.logger.debug(`Call data cleared for: ${callId}`);
  }

  /**
   * Get all keys matching a pattern (for debugging)
   */
  async getKeysByPattern(pattern: string): Promise<string[]> {
    return await this.redis.keys(pattern);
  }

  /**
   * Health check: ping Redis
   */
  async ping(): Promise<boolean> {
    try {
      const result = await this.redis.ping();
      return result === 'PONG';
    } catch (error) {
      this.logger.error('Redis ping failed', error);
      return false;
    }
  }
}
