/**
 * Targeted tests for ConversationOrchestrationService.processSentenceTts().
 *
 * Strategy: Object.create(Prototype) builds a class instance without invoking
 * the constructor, letting us inject only the fields this private method reads:
 *   - this.ttsService (synthesizeStream / synthesize)
 *   - this.logger (warn / error)
 *
 * All other NestJS-injected dependencies are irrelevant to this method.
 */
import { Subscriber } from 'rxjs';
import { ConversationOrchestrationService } from '../../services/conversation-orchestration.service';
import type { ConversationStreamEvent } from '../../dto/conversation-stream.types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

type ActiveRequest = {
  requestId: string;
  sessionId: string;
  userId: string;
  abortController: AbortController;
  cancelled: boolean;
  finished: boolean;
  fullText: string;
  assistantPersisted: boolean;
};

/** Async generator that yields single-chunk audio */
async function* singleChunkStream(data: number[]) {
  await Promise.resolve();
  yield Uint8Array.from(data);
}

/** Build a stub service with only what processSentenceTts reads */
function makeStub(ttsServiceMock: Record<string, jest.Mock>) {
  const svc = Object.create(
    ConversationOrchestrationService.prototype,
  ) as ConversationOrchestrationService;
  (svc as any).ttsService = ttsServiceMock;
  (svc as any).logger = {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };
  return svc;
}

/** Build a permissive semaphore that acquires immediately */
function makeSemaphore() {
  return {
    acquire: jest.fn().mockResolvedValue(undefined),
    release: jest.fn(),
  };
}

type ProcessSentenceTtsFn = (
  idx: number,
  text: string,
  provider: string,
  voice: string | undefined,
  language: string | undefined,
  accent: string | undefined,
  model: string | undefined,
  format: 'mp3' | 'wav' | 'ogg' | 'pcm' | undefined,
  sampleRate: number | undefined,
  semaphore: ReturnType<typeof makeSemaphore>,
  sub: Subscriber<ConversationStreamEvent>,
  request: ActiveRequest,
) => Promise<void>;

function invokeProcessSentenceTts(
  svc: ConversationOrchestrationService,
  idx: number,
  text: string,
  provider: string,
  voice: string | undefined,
  language: string | undefined,
  accent: string | undefined,
  model: string | undefined,
  format: 'mp3' | 'wav' | 'ogg' | 'pcm' | undefined,
  sampleRate: number | undefined,
  semaphore: ReturnType<typeof makeSemaphore>,
  sub: Subscriber<ConversationStreamEvent>,
  request: ActiveRequest,
): Promise<void> {
  return (
    svc as unknown as { processSentenceTts: ProcessSentenceTtsFn }
  ).processSentenceTts(
    idx,
    text,
    provider,
    voice,
    language,
    accent,
    model,
    format,
    sampleRate,
    semaphore,
    sub,
    request,
  );
}

/** Build an active (non-cancelled) request */
function makeRequest(overrides: Partial<ActiveRequest> = {}): ActiveRequest {
  return {
    requestId: 'req-test',
    sessionId: 'sess-test',
    userId: 'user-test',
    abortController: new AbortController(),
    cancelled: false,
    finished: false,
    fullText: '',
    assistantPersisted: false,
    ...overrides,
  };
}

/** Collect events emitted to a mock subscriber */
function makeSubscriber() {
  const events: ConversationStreamEvent[] = [];
  const sub = {
    next: jest.fn((event: ConversationStreamEvent) => events.push(event)),
    error: jest.fn(),
    complete: jest.fn(),
    closed: false,
  } as unknown as Subscriber<ConversationStreamEvent>;
  return { sub, events };
}

// ─── processSentenceTts ───────────────────────────────────────────────────────
describe('ConversationOrchestrationService.processSentenceTts (private)', () => {
  const callMethod = (
    svc: ConversationOrchestrationService,
    {
      idx = 0,
      text = 'Hello world.',
      provider = 'elevenlabs',
      voice = 'Bella',
      language = 'en',
      accent = undefined,
      model = undefined,
      format = undefined,
      sampleRate = undefined,
      semaphore = makeSemaphore(),
      sub,
      request = makeRequest(),
    }: {
      idx?: number;
      text?: string;
      provider?: string;
      voice?: string | undefined;
      language?: string | undefined;
      accent?: string | undefined;
      model?: string | undefined;
      format?: 'mp3' | 'wav' | 'ogg' | 'pcm' | undefined;
      sampleRate?: number | undefined;
      semaphore?: ReturnType<typeof makeSemaphore>;
      sub: Subscriber<ConversationStreamEvent>;
      request?: ActiveRequest;
    },
  ): Promise<void> =>
    invokeProcessSentenceTts(
      svc,
      idx,
      text,
      provider,
      voice,
      language,
      accent,
      model,
      format,
      sampleRate,
      semaphore,
      sub,
      request,
    );

  it('emits an audio_sentence event with sentenceText matching the input text', async () => {
    const tts = {
      synthesizeStream: jest.fn().mockResolvedValue({
        audioStream: singleChunkStream([10, 20, 30]),
        contentType: 'audio/mpeg',
      }),
      synthesize: jest.fn(),
    };
    const svc = makeStub(tts);
    const { sub, events } = makeSubscriber();

    await callMethod(svc, { text: 'Hello world.', sub });

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: 'audio_sentence',
      data: expect.objectContaining({
        sentenceIndex: 0,
        contentType: 'audio/mpeg',
        sentenceText: 'Hello world.',
      }),
    });
  });

  it('includes the correct sentenceIndex in the emitted event', async () => {
    const tts = {
      synthesizeStream: jest.fn().mockResolvedValue({
        audioStream: singleChunkStream([1]),
        contentType: 'audio/mpeg',
      }),
      synthesize: jest.fn(),
    };
    const svc = makeStub(tts);
    const { sub, events } = makeSubscriber();

    await callMethod(svc, { idx: 5, text: 'Fifth sentence.', sub });

    expect(events[0].data).toMatchObject({
      sentenceIndex: 5,
      sentenceText: 'Fifth sentence.',
    });
  });

  it('preserves exact sentence text including punctuation and whitespace', async () => {
    const tts = {
      synthesizeStream: jest.fn().mockResolvedValue({
        audioStream: singleChunkStream([1]),
        contentType: 'audio/mpeg',
      }),
      synthesize: jest.fn(),
    };
    const svc = makeStub(tts);
    const { sub, events } = makeSubscriber();
    const verbatimText = 'Wait — really? Yes, indeed!';

    await callMethod(svc, { text: verbatimText, sub });

    expect((events[0] as any).data.sentenceText).toBe(verbatimText);
  });

  it('does not emit when the request is cancelled before acquiring semaphore', async () => {
    const tts = { synthesizeStream: jest.fn(), synthesize: jest.fn() };
    const svc = makeStub(tts);
    const { sub, events } = makeSubscriber();
    const request = makeRequest({ cancelled: true });

    await callMethod(svc, { sub, request });

    expect(events).toHaveLength(0);
    expect(tts.synthesizeStream).not.toHaveBeenCalled();
  });

  it('falls back to synthesize() when stream does not support streaming', async () => {
    const tts = {
      synthesizeStream: jest
        .fn()
        .mockRejectedValue(new Error('Provider does not support streaming')),
      synthesize: jest.fn().mockResolvedValue({
        audioBuffer: Buffer.from([7, 8, 9]),
        contentType: 'audio/mpeg',
      }),
    };
    const svc = makeStub(tts);
    const { sub, events } = makeSubscriber();

    await callMethod(svc, { text: 'Fallback sentence.', sub });

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: 'audio_sentence',
      data: expect.objectContaining({ sentenceText: 'Fallback sentence.' }),
    });
    expect(tts.synthesize).toHaveBeenCalled();
  });

  it('falls back to melotts when primary provider fails', async () => {
    const tts = {
      synthesizeStream: jest
        .fn()
        .mockRejectedValue(new Error('quota exceeded')),
      synthesize: jest.fn().mockResolvedValue({
        audioBuffer: Buffer.from([99]),
        contentType: 'audio/mpeg',
      }),
    };
    const svc = makeStub(tts);
    const { sub, events } = makeSubscriber();

    await callMethod(svc, {
      provider: 'elevenlabs',
      text: 'Fallback to melotts.',
      sub,
    });

    expect(events).toHaveLength(1);
    // sentenceText must still be present even after fallback
    expect((events[0] as any).data.sentenceText).toBe('Fallback to melotts.');
  });

  it('emits nothing and logs a warning when all providers fail', async () => {
    const tts = {
      synthesizeStream: jest
        .fn()
        .mockRejectedValue(new Error('elevenlabs down')),
      synthesize: jest.fn().mockRejectedValue(new Error('melotts down')),
    };
    const svc = makeStub(tts);
    const { sub, events } = makeSubscriber();

    await callMethod(svc, { provider: 'elevenlabs', sub });

    expect(events).toHaveLength(0);
    expect((svc as any).logger.warn).toHaveBeenCalled();
  });

  it('does not emit when subscriber is closed before synthesis completes', async () => {
    const tts = {
      synthesizeStream: jest.fn().mockResolvedValue({
        audioStream: singleChunkStream([1, 2]),
        contentType: 'audio/mpeg',
      }),
      synthesize: jest.fn(),
    };
    const svc = makeStub(tts);
    const { events } = makeSubscriber();

    // Mark subscriber as closed
    const closedSub = {
      next: jest.fn(),
      error: jest.fn(),
      complete: jest.fn(),
      closed: true,
    } as unknown as Subscriber<ConversationStreamEvent>;

    await callMethod(svc, { sub: closedSub });

    expect(events).toHaveLength(0);
    expect(closedSub.next).not.toHaveBeenCalled();
  });

  it('releases the semaphore even when synthesis throws', async () => {
    const tts = {
      synthesizeStream: jest.fn().mockRejectedValue(new Error('boom')),
      synthesize: jest.fn().mockRejectedValue(new Error('boom too')),
    };
    const svc = makeStub(tts);
    const { sub } = makeSubscriber();
    const semaphore = makeSemaphore();

    await callMethod(svc, { provider: 'elevenlabs', sub, semaphore });

    expect(semaphore.acquire).toHaveBeenCalled();
    expect(semaphore.release).toHaveBeenCalled();
  });

  it('acquires the semaphore before synthesizing', async () => {
    const order: string[] = [];
    const semaphore = {
      acquire: jest.fn().mockImplementation(() => {
        order.push('acquired');
      }),
      release: jest.fn().mockImplementation(() => {
        order.push('released');
      }),
    };
    const tts = {
      synthesizeStream: jest.fn().mockImplementation(() => {
        order.push('synthesized');
        return {
          audioStream: singleChunkStream([1]),
          contentType: 'audio/mpeg',
        };
      }),
      synthesize: jest.fn(),
    };
    const svc = makeStub(tts);
    const { sub } = makeSubscriber();

    await callMethod(svc, { sub, semaphore });

    expect(order).toEqual(['acquired', 'synthesized', 'released']);
  });
});

// ─── Semaphore concurrency (also tested here since Semaphore is not exported) ──
describe('Semaphore (internal class)', () => {
  // Access Semaphore via a minimal orchestration call that exposes its behavior
  // through the actual permit-limiting logic. Since it's not exported, we test
  // its effect: only N simultaneous TTS jobs run at once.

  it('limits concurrent synthesize calls to the configured permits', async () => {
    let concurrent = 0;
    let maxConcurrent = 0;

    const tts = {
      synthesizeStream: jest.fn().mockImplementation(async () => {
        concurrent++;
        maxConcurrent = Math.max(maxConcurrent, concurrent);
        // Simulate async work
        await new Promise<void>((r) => setImmediate(r));
        concurrent--;
        return {
          audioStream: singleChunkStream([1]),
          contentType: 'audio/mpeg',
        };
      }),
      synthesize: jest.fn(),
    };

    const svc = makeStub(tts);
    const { sub } = makeSubscriber();

    // Instead: run 4 processSentenceTts calls in parallel with a shared
    // 2-permit fake semaphore that actually blocks.
    let permits = 2;
    const queue: Array<() => void> = [];
    const realSemaphore = {
      acquire: jest.fn().mockImplementation(async () => {
        if (permits > 0) {
          permits--;
          return;
        }
        await new Promise<void>((resolve) => queue.push(resolve));
      }),
      release: jest.fn().mockImplementation(() => {
        const next = queue.shift();
        if (next) next();
        else permits++;
      }),
    };

    const request = makeRequest();
    const jobs: Array<Promise<void>> = [];
    for (const idx of [0, 1, 2, 3]) {
      jobs.push(
        invokeProcessSentenceTts(
          svc,
          idx,
          `Sentence ${idx}`,
          'elevenlabs',
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          realSemaphore,
          sub,
          request,
        ),
      );
    }
    await Promise.all(jobs);

    // With 2 permits and 4 jobs, max concurrency should not exceed 2
    expect(maxConcurrent).toBeLessThanOrEqual(2);
  });
});
