import { Injectable, Logger, Inject } from '@nestjs/common';
import { createHash } from 'crypto';
import OpenAI from 'openai';
import type { Redis } from 'ioredis';
import { REDIS_CLIENT } from '@pitch/shared-backend/redis/constants';
import { SimulationPrismaService } from '../prisma/simulation-prisma.service';
import type { RetrievedChunk } from './dto/retrieve.dto';

const EMBED_CACHE_TTL = 60; // seconds

interface EmbeddingRowRaw {
  id: string;
  namespace: string;
  refType: string;
  refId: string;
  metadata: Record<string, unknown> | null;
  score: number;
}

@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name);
  private readonly openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly prisma: SimulationPrismaService,
  ) {}

  /**
   * Generate a 1536-dim embedding for the given text.
   * Results are cached in Redis for 60s to avoid redundant OpenAI calls
   * for repeated queries within the same conversation turn.
   */
  async embed(text: string): Promise<number[]> {
    const hash = createHash('sha256').update(text).digest('hex');
    const cacheKey = `rag:emb:${hash}`;

    const cached = await this.redis.get(cacheKey).catch(() => null);
    if (cached) {
      return JSON.parse(cached) as number[];
    }

    const response = await this.openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text.slice(0, 8191), // API limit
    });

    const embedding = response.data[0]?.embedding ?? [];

    void this.redis
      .setex(cacheKey, EMBED_CACHE_TTL, JSON.stringify(embedding))
      .catch(() => {});

    return embedding;
  }

  /**
   * Store a text chunk as a vector embedding row.
   * Metadata must include { text } and optionally { source, orgId }.
   */
  async indexChunk(params: {
    text: string;
    namespace: string;
    refType: string;
    refId: string;
    metadata?: Record<string, unknown>;
  }): Promise<string> {
    const { text, namespace, refType, refId, metadata = {} } = params;
    const embedding = await this.embed(text);
    const vectorStr = `[${embedding.join(',')}]`;
    const id = `emb_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const meta = JSON.stringify({ ...metadata, text });

    await this.prisma.client.$executeRaw`
      INSERT INTO "EmbeddingRow" (id, embedding, namespace, "refType", "refId", metadata, "createdAt")
      VALUES (${id}, ${vectorStr}::vector, ${namespace}, ${refType}, ${refId}, ${meta}::jsonb, NOW())
    `;

    return id;
  }

  /**
   * Retrieve top-K chunks most similar to the query across the given namespaces.
   * Uses cosine similarity: score = 1 - cosine_distance.
   */
  async retrieve(params: {
    query: string;
    namespaces: string[];
    topK?: number;
    minScore?: number;
  }): Promise<RetrievedChunk[]> {
    const { query, namespaces, topK = 3, minScore = 0.75 } = params;

    if (!query.trim() || namespaces.length === 0) return [];

    const embedding = await this.embed(query);
    const vectorStr = `[${embedding.join(',')}]`;

    const rows = await this.prisma.client.$queryRaw<EmbeddingRowRaw[]>`
      SELECT
        id,
        namespace,
        "refType",
        "refId",
        metadata,
        1 - (embedding <=> ${vectorStr}::vector) AS score
      FROM "EmbeddingRow"
      WHERE namespace = ANY(${namespaces}::text[])
        AND 1 - (embedding <=> ${vectorStr}::vector) >= ${minScore}
      ORDER BY embedding <=> ${vectorStr}::vector
      LIMIT ${topK}
    `;

    return rows.map((row) => {
      const meta = row.metadata ?? {};
      return {
        id: row.id,
        score: Number(row.score),
        namespace: row.namespace,
        refType: row.refType,
        refId: row.refId,
        text: typeof meta.text === 'string' ? meta.text : '',
        source: typeof meta.source === 'string' ? meta.source : undefined,
      };
    });
  }

  /**
   * Check whether any embedding rows exist for a given refType + refId pair.
   * Used to implement idempotent indexing of personas and scenarios.
   */
  async isIndexed(refType: string, refId: string): Promise<boolean> {
    const rows = await this.prisma.client.$queryRaw<{ id: string }[]>`
      SELECT id FROM "EmbeddingRow"
      WHERE "refType" = ${refType} AND "refId" = ${refId}
      LIMIT 1
    `;
    return rows.length > 0;
  }

  /**
   * Delete all embedding rows for a given refType + refId pair.
   */
  async deleteByRef(refType: string, refId: string): Promise<void> {
    await this.prisma.client.$executeRaw`
      DELETE FROM "EmbeddingRow"
      WHERE "refType" = ${refType} AND "refId" = ${refId}
    `;
  }

  /**
   * List all embedding rows for a given orgId + refType (from metadata).
   * Used by the KB management API.
   */
  async listByOrg(
    orgId: string,
    refType?: string,
  ): Promise<
    Array<{
      id: string;
      refType: string;
      refId: string;
      metadata: Record<string, unknown> | null;
      createdAt: Date;
    }>
  > {
    if (refType) {
      return this.prisma.client.$queryRaw`
        SELECT id, "refType", "refId", metadata, "createdAt"
        FROM "EmbeddingRow"
        WHERE metadata->>'orgId' = ${orgId}
          AND "refType" = ${refType}
        ORDER BY "createdAt" DESC
      `;
    }
    return this.prisma.client.$queryRaw`
      SELECT id, "refType", "refId", metadata, "createdAt"
      FROM "EmbeddingRow"
      WHERE metadata->>'orgId' = ${orgId}
      ORDER BY "createdAt" DESC
    `;
  }
}
