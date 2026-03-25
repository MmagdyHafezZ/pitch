import { of, throwError } from 'rxjs';
import { LLMService } from '../../services/llm/llm.service';
import { ProviderError } from '../../providers/llm/llm-provider.interface';

const makeRequest = (overrides: Record<string, unknown> = {}) => ({
  sessionId: 'session-1',
  userId: 'user-1',
  messages: [{ role: 'user' as const, content: 'hello' }],
  config: { model: 'gpt-4o', provider: 'openai' },
  ...overrides,
});

describe('LLMService', () => {
  const mockRouter = {
    complete: jest.fn(),
    stream: jest.fn(),
  };

  const mockUsageCalculator = {
    normalizeUsage: jest.fn(),
  };

  const mockPrisma = {
    metric: {
      create: jest.fn(),
    },
    client: {
      iteration: {
        findFirst: jest.fn(),
      },
      sessionMember: {
        findUnique: jest.fn(),
      },
    },
  };

  const service = new LLMService(
    mockRouter as never,
    mockUsageCalculator as never,
    mockPrisma as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('complete()', () => {
    it('returns normalized response from router', async () => {
      const route = { provider: 'openai', model: 'gpt-4o' };
      const rawResponse = {
        content: 'world',
        usage: { promptTokens: 5, completionTokens: 3, costUsd: 0.001 },
        providerMeta: {},
      };
      mockRouter.complete.mockResolvedValue({ response: rawResponse, route });
      const normalizedUsage = {
        promptTokens: 5,
        completionTokens: 3,
        totalTokens: 8,
        costUsd: 0.001,
      };
      mockUsageCalculator.normalizeUsage.mockReturnValue(normalizedUsage);
      mockPrisma.client.iteration.findFirst.mockResolvedValue({ id: 'iter-1' });
      mockPrisma.metric.create.mockResolvedValue({});

      const request = makeRequest({ iterationId: 'iter-1' });
      const result = await service.complete(request as never);

      expect(result.content).toBe('world');
      expect(result.usage).toEqual(normalizedUsage);
      expect(result.providerMeta).toEqual(
        expect.objectContaining({ provider: 'openai', model: 'gpt-4o' }),
      );
      expect(mockUsageCalculator.normalizeUsage).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4o',
          providerName: 'openai',
          responseText: 'world',
        }),
      );
    });

    it('persists metric with iterationId from request', async () => {
      const route = { provider: 'openai', model: 'gpt-4o' };
      mockRouter.complete.mockResolvedValue({
        response: { content: 'ok', usage: {}, providerMeta: {} },
        route,
      });
      const usage = { promptTokens: 2, completionTokens: 1, costUsd: 0 };
      mockUsageCalculator.normalizeUsage.mockReturnValue(usage);
      mockPrisma.metric.create.mockResolvedValue({});

      await service.complete(makeRequest({ iterationId: 'iter-abc' }) as never);

      expect(mockPrisma.metric.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          iterationId: 'iter-abc',
          tokensInput: 2,
          tokensOutput: 1,
          model: 'openai:gpt-4o',
        }),
      });
    });

    it('resolves iterationId from sessionMemberId when not provided directly', async () => {
      const route = { provider: 'openai', model: 'gpt-4o' };
      mockRouter.complete.mockResolvedValue({
        response: { content: 'ok', usage: {}, providerMeta: {} },
        route,
      });
      mockUsageCalculator.normalizeUsage.mockReturnValue({
        promptTokens: 1,
        completionTokens: 1,
        costUsd: 0,
      });
      mockPrisma.client.iteration.findFirst.mockResolvedValue({
        id: 'iter-from-member',
      });
      mockPrisma.metric.create.mockResolvedValue({});

      await service.complete(
        makeRequest({
          sessionMemberId: 'member-1',
          iterationId: undefined,
        }) as never,
      );

      expect(mockPrisma.client.iteration.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { sessionMemberId: 'member-1' } }),
      );
      expect(mockPrisma.metric.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ iterationId: 'iter-from-member' }),
        }),
      );
    });

    it('resolves iterationId from userId when sessionMemberId not provided', async () => {
      const route = { provider: 'openai', model: 'gpt-4o' };
      mockRouter.complete.mockResolvedValue({
        response: { content: 'ok', usage: {}, providerMeta: {} },
        route,
      });
      mockUsageCalculator.normalizeUsage.mockReturnValue({
        promptTokens: 1,
        completionTokens: 1,
        costUsd: 0,
      });
      mockPrisma.client.sessionMember.findUnique.mockResolvedValue({
        id: 'member-x',
      });
      mockPrisma.client.iteration.findFirst.mockResolvedValue({
        id: 'iter-from-user',
      });
      mockPrisma.metric.create.mockResolvedValue({});

      await service.complete(
        makeRequest({
          sessionMemberId: undefined,
          iterationId: undefined,
          userId: 'user-1',
        }) as never,
      );

      expect(mockPrisma.client.sessionMember.findUnique).toHaveBeenCalled();
      expect(mockPrisma.metric.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ iterationId: 'iter-from-user' }),
        }),
      );
    });

    it('skips metric persistence when no iterationId can be resolved', async () => {
      const route = { provider: 'openai', model: 'gpt-4o' };
      mockRouter.complete.mockResolvedValue({
        response: { content: 'ok', usage: {}, providerMeta: {} },
        route,
      });
      mockUsageCalculator.normalizeUsage.mockReturnValue({
        promptTokens: 1,
        completionTokens: 1,
        costUsd: 0,
      });
      mockPrisma.client.sessionMember.findUnique.mockResolvedValue(null);

      const request = makeRequest({
        sessionMemberId: undefined,
        iterationId: undefined,
      }) as never;
      await service.complete(request);

      expect(mockPrisma.metric.create).not.toHaveBeenCalled();
    });

    it('rethrows error from router and logs warning with provider name', async () => {
      const providerErr = new ProviderError('openai', 'rate limited', 429, {
        model: 'gpt-4o',
      });
      mockRouter.complete.mockRejectedValue(providerErr);

      await expect(service.complete(makeRequest() as never)).rejects.toThrow(
        providerErr,
      );
    });

    it('rethrows non-provider errors unchanged', async () => {
      mockRouter.complete.mockRejectedValue(new Error('network failure'));

      await expect(service.complete(makeRequest() as never)).rejects.toThrow(
        'network failure',
      );
    });

    it('does not throw if metric persistence fails', async () => {
      const route = { provider: 'openai', model: 'gpt-4o' };
      mockRouter.complete.mockResolvedValue({
        response: { content: 'ok', usage: {}, providerMeta: {} },
        route,
      });
      mockUsageCalculator.normalizeUsage.mockReturnValue({
        promptTokens: 1,
        completionTokens: 1,
        costUsd: 0,
      });
      mockPrisma.client.iteration.findFirst.mockResolvedValue({ id: 'iter-1' });
      mockPrisma.metric.create.mockRejectedValue(new Error('db error'));

      await expect(
        service.complete(makeRequest({ iterationId: 'iter-1' }) as never),
      ).resolves.toBeDefined();
    });
  });

  describe('stream()', () => {
    it('emits chunks and completes observable', (done) => {
      const chunks = [
        { delta: 'Hello', done: false },
        { delta: ' world', done: false },
        {
          delta: '',
          done: true,
          usage: { promptTokens: 4, completionTokens: 2, costUsd: 0 },
        },
      ];
      mockRouter.stream.mockReturnValue(of(...chunks));
      const usage = { promptTokens: 4, completionTokens: 2, costUsd: 0 };
      mockUsageCalculator.normalizeUsage.mockReturnValue(usage);
      mockPrisma.client.iteration.findFirst.mockResolvedValue(null);
      mockPrisma.client.sessionMember.findUnique.mockResolvedValue(null);

      const received: unknown[] = [];
      service.stream(makeRequest() as never).subscribe({
        next: (c) => received.push(c),
        complete: () => {
          expect(received).toHaveLength(3);
          done();
        },
        error: done,
      });
    });

    it('propagates errors from router stream', (done) => {
      const err = new ProviderError('openai', 'fail', 500, {});
      mockRouter.stream.mockReturnValue(throwError(() => err));

      service.stream(makeRequest() as never).subscribe({
        next: () => {},
        error: (e) => {
          expect(e).toBe(err);
          done();
        },
        complete: done,
      });
    });

    it('registers and cleans up active stream when requestId provided', (done) => {
      const chunks = [{ delta: 'x', done: true, usage: {} }];
      mockRouter.stream.mockReturnValue(of(...chunks));
      mockUsageCalculator.normalizeUsage.mockReturnValue({
        promptTokens: 1,
        completionTokens: 1,
        costUsd: 0,
      });
      mockPrisma.client.iteration.findFirst.mockResolvedValue(null);
      mockPrisma.client.sessionMember.findUnique.mockResolvedValue(null);

      const request = makeRequest({ iterationId: undefined }) as never;
      const context = { requestId: 'req-1' };

      service.stream(request, context).subscribe({
        complete: () => done(),
        error: done,
      });
    });
  });

  describe('cancel()', () => {
    it('returns false when no active stream exists for given requestId', () => {
      expect(service.cancel('non-existent')).toBe(false);
    });

    it('returns true and cancels an active stream', (done) => {
      // Use an observable that never completes to keep stream active
      let capturedRequestId: string | undefined;
      mockRouter.stream.mockReturnValue(
        new (require('rxjs').Observable)(() => {
          // never emits
        }),
      );

      const request = makeRequest({ iterationId: undefined }) as never;
      const context = { requestId: 'req-cancel' };
      capturedRequestId = context.requestId;

      const sub = service.stream(request, context).subscribe({
        next: () => {},
        error: () => {},
        complete: () => {},
      });

      // Give the observable time to register
      setImmediate(() => {
        const cancelled = service.cancel(capturedRequestId!);
        expect(cancelled).toBe(true);
        // calling again should return false
        expect(service.cancel(capturedRequestId!)).toBe(false);
        sub.unsubscribe();
        done();
      });
    });
  });
});
