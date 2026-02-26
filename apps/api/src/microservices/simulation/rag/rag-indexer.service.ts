import { Injectable, Logger } from '@nestjs/common';
import { RagService } from './rag.service';

interface PersonaData {
  id: string;
  name: string | null;
  traits?: unknown;
}

interface ScenarioData {
  id: string;
  name: string | null;
  description?: string | null;
  config?: unknown;
}

@Injectable()
export class RagIndexerService {
  private readonly logger = new Logger(RagIndexerService.name);

  constructor(private readonly ragService: RagService) {}

  /**
   * Chunk a document into overlapping windows and index each chunk.
   * Uses 300-word windows with 50-word overlap.
   * Chunks shorter than 20 words are merged into the previous chunk.
   */
  async indexDocument(params: {
    text: string;
    orgId: string;
    refType: 'Doc' | 'Message' | 'Persona' | 'Scenario';
    refId: string;
    source?: string;
    sessionId?: string;
    namespace?: string;
  }): Promise<void> {
    const namespace = params.namespace ?? 'kb';
    const chunks = this.chunkText(params.text);

    await Promise.all(
      chunks.map((chunk, i) =>
        this.ragService.indexChunk({
          text: chunk,
          namespace,
          refType: params.refType,
          refId: `${params.refId}__${i}`,
          metadata: {
            orgId: params.orgId,
            source: params.source,
            sessionId: params.sessionId,
            chunkIndex: i,
            totalChunks: chunks.length,
          },
        }),
      ),
    );

    this.logger.debug(
      `Indexed ${chunks.length} chunk(s) for ${params.refType}:${params.refId}`,
    );
  }

  /**
   * Index a persona definition. Idempotent — skips if already indexed.
   */
  async maybeIndexPersona(persona: PersonaData, orgId: string): Promise<void> {
    const alreadyIndexed = await this.ragService.isIndexed(
      'Persona',
      persona.id,
    );
    if (alreadyIndexed) return;

    const text = JSON.stringify({
      name: persona.name,
      traits: persona.traits,
    });

    await this.indexDocument({
      text,
      orgId,
      refType: 'Persona',
      refId: persona.id,
      source: `persona:${persona.name ?? persona.id}`,
      namespace: 'persona',
    });
  }

  /**
   * Index a scenario definition. Idempotent — skips if already indexed.
   */
  async maybeIndexScenario(
    scenario: ScenarioData,
    orgId: string,
  ): Promise<void> {
    const alreadyIndexed = await this.ragService.isIndexed(
      'Scenario',
      scenario.id,
    );
    if (alreadyIndexed) return;

    const text = JSON.stringify({
      name: scenario.name,
      description: scenario.description,
      config: scenario.config,
    });

    await this.indexDocument({
      text,
      orgId,
      refType: 'Scenario',
      refId: scenario.id,
      source: `scenario:${scenario.name ?? scenario.id}`,
      namespace: 'scenario',
    });
  }

  /**
   * Index a single conversation turn (no chunking — turns are short by design).
   */
  async indexTurn(params: {
    turnId: string;
    text: string;
    role: string;
    sessionId: string;
    orgId: string;
  }): Promise<void> {
    if (!params.text.trim()) return;

    await this.ragService.indexChunk({
      text: params.text,
      namespace: 'history',
      refType: 'Message',
      refId: params.turnId,
      metadata: {
        orgId: params.orgId,
        sessionId: params.sessionId,
        role: params.role,
      },
    });
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  /**
   * Split text into overlapping 300-word chunks with 50-word overlap.
   * Respects sentence boundaries when possible.
   */
  private chunkText(text: string): string[] {
    const sentences = this.splitSentences(text.trim());
    const chunks: string[] = [];
    let current: string[] = [];
    let wordCount = 0;

    for (const sentence of sentences) {
      const words = sentence.split(/\s+/).filter(Boolean);
      current.push(sentence);
      wordCount += words.length;

      if (wordCount >= 300) {
        chunks.push(current.join(' '));

        // Carry last 50 words as overlap prefix for the next chunk
        const allWords = current.join(' ').split(/\s+/).filter(Boolean);
        const tail = allWords.slice(-50).join(' ');
        current = tail ? [tail] : [];
        wordCount = tail ? tail.split(/\s+/).filter(Boolean).length : 0;
      }
    }

    if (current.length > 0) {
      const remaining = current.join(' ');
      const wordLen = remaining.split(/\s+/).filter(Boolean).length;

      if (wordLen < 20 && chunks.length > 0) {
        // Too short to be its own chunk — append to last
        chunks[chunks.length - 1] += ' ' + remaining;
      } else {
        chunks.push(remaining);
      }
    }

    return chunks.filter(Boolean);
  }

  private splitSentences(text: string): string[] {
    // Split on sentence-ending punctuation followed by whitespace or end of string
    const raw = text.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g) ?? [text];
    return raw.map((s) => s.trim()).filter(Boolean);
  }
}
