import { withRetry, CircuitBreaker } from '../retry.util';

describe('withRetry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should succeed on first attempt', async () => {
    const operation = jest.fn().mockResolvedValue('success');

    const result = await withRetry(operation);

    expect(result).toBe('success');
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('should retry on failure and eventually succeed', async () => {
    const operation = jest
      .fn()
      .mockRejectedValueOnce(new Error('timeout'))
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValue('success');

    const promise = withRetry(operation, {
      maxRetries: 3,
      initialDelay: 100,
      maxDelay: 1000,
    });

    // Fast-forward through retries
    await jest.advanceTimersByTimeAsync(100); // First retry delay
    await jest.advanceTimersByTimeAsync(200); // Second retry delay (exponential)

    const result = await promise;

    expect(result).toBe('success');
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it('should fail after max retries', async () => {
    const error = new Error('timeout');
    const operation = jest.fn().mockRejectedValue(error);

    const promise = withRetry(operation, {
      maxRetries: 2,
      initialDelay: 100,
      maxDelay: 1000,
    });
    const rejection = expect(promise).rejects.toThrow('timeout');

    // Fast-forward through all retries
    await jest.advanceTimersByTimeAsync(100); // First retry
    await jest.advanceTimersByTimeAsync(200); // Second retry

    await rejection;
    expect(operation).toHaveBeenCalledTimes(3); // Initial + 2 retries
  });

  it('should respect maxDelay cap', async () => {
    const operation = jest
      .fn()
      .mockRejectedValueOnce(new Error('timeout'))
      .mockRejectedValueOnce(new Error('timeout'))
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValue('success');

    const onRetry = jest.fn();

    const promise = withRetry(operation, {
      maxRetries: 3,
      initialDelay: 1000,
      maxDelay: 2000,
      onRetry,
    });

    // Delays: 1000ms, 2000ms (capped), 2000ms (capped)
    await jest.advanceTimersByTimeAsync(1000);
    await jest.advanceTimersByTimeAsync(2000);
    await jest.advanceTimersByTimeAsync(2000);

    const result = await promise;

    expect(result).toBe('success');
    expect(onRetry).toHaveBeenCalledTimes(3);
  });

  it('should not retry non-retryable errors', async () => {
    const error = new Error('ValidationError');
    const operation = jest.fn().mockRejectedValue(error);

    await expect(
      withRetry(operation, {
        maxRetries: 3,
        initialDelay: 100,
        shouldRetry: (err) => err.message.includes('timeout'),
      }),
    ).rejects.toThrow('ValidationError');

    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('should call onRetry callback', async () => {
    const operation = jest
      .fn()
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValue('success');

    const onRetry = jest.fn();

    const promise = withRetry(operation, {
      maxRetries: 2,
      initialDelay: 100,
      onRetry,
    });

    await jest.advanceTimersByTimeAsync(100);

    const result = await promise;

    expect(result).toBe('success');
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error));
  });

  it('should use default options', async () => {
    const operation = jest
      .fn()
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockResolvedValue('success');

    const promise = withRetry(operation);

    await jest.advanceTimersByTimeAsync(1000); // Default initialDelay

    const result = await promise;

    expect(result).toBe('success');
  });
});

describe('CircuitBreaker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should allow requests when CLOSED', async () => {
    const operation = jest.fn().mockResolvedValue('success');
    const breaker = new CircuitBreaker(operation, {
      failureThreshold: 3,
      successThreshold: 2,
      timeout: 5000,
      resetTimeout: 10000,
    });

    const result = await breaker.execute();

    expect(result).toBe('success');
    expect(breaker.getState()).toBe('CLOSED');
  });

  it('should open circuit after threshold failures', async () => {
    const operation = jest
      .fn()
      .mockRejectedValue(new Error('Service unavailable'));
    const fallback = jest.fn().mockReturnValue('fallback value');

    const breaker = new CircuitBreaker(operation, {
      failureThreshold: 3,
      successThreshold: 2,
      timeout: 5000,
      resetTimeout: 10000,
      fallback,
    });

    // Cause 3 failures
    await breaker.execute();
    await breaker.execute();
    await breaker.execute();

    expect(breaker.getState()).toBe('OPEN');

    // Next call should use fallback without calling operation
    const result = await breaker.execute();
    expect(result).toBe('fallback value');
    expect(operation).toHaveBeenCalledTimes(3); // No new calls
  });

  it('should transition to HALF_OPEN after reset timeout', async () => {
    const operation = jest
      .fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockRejectedValueOnce(new Error('fail'))
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('success');

    const breaker = new CircuitBreaker(operation, {
      failureThreshold: 3,
      successThreshold: 1,
      timeout: 5000,
      resetTimeout: 10000,
    });

    // Open the circuit
    await breaker.execute().catch(() => {});
    await breaker.execute().catch(() => {});
    await breaker.execute().catch(() => {});

    expect(breaker.getState()).toBe('OPEN');

    // Fast-forward past reset timeout
    jest.advanceTimersByTime(10000);

    // Should transition to HALF_OPEN and try operation
    const result = await breaker.execute();

    expect(result).toBe('success');
    expect(breaker.getState()).toBe('CLOSED');
  });

  it('should timeout slow operations', async () => {
    const operation = jest.fn(
      () => new Promise((resolve) => setTimeout(resolve, 10000)),
    );
    const fallback = jest.fn().mockReturnValue('timeout fallback');

    const breaker = new CircuitBreaker(operation, {
      failureThreshold: 3,
      successThreshold: 2,
      timeout: 1000,
      resetTimeout: 10000,
      fallback,
    });

    const promise = breaker.execute();

    await jest.advanceTimersByTimeAsync(1000);

    const result = await promise;

    expect(result).toBe('timeout fallback');
  });

  it('should throw if circuit is OPEN and no fallback', async () => {
    const operation = jest
      .fn()
      .mockRejectedValue(new Error('Service unavailable'));

    const breaker = new CircuitBreaker(operation, {
      failureThreshold: 2,
      successThreshold: 2,
      timeout: 5000,
      resetTimeout: 10000,
    });

    // Open the circuit
    await breaker.execute().catch(() => {});
    await breaker.execute().catch(() => {});

    expect(breaker.getState()).toBe('OPEN');

    // Should throw without fallback
    await expect(breaker.execute()).rejects.toThrow('Circuit breaker is OPEN');
  });

  it('should reset failure count on success', async () => {
    const operation = jest
      .fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce('success')
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('success');

    const breaker = new CircuitBreaker(operation, {
      failureThreshold: 3,
      successThreshold: 2,
      timeout: 5000,
      resetTimeout: 10000,
    });

    // Fail once
    await breaker.execute().catch(() => {});
    // Succeed (resets count)
    await breaker.execute();
    // Fail again
    await breaker.execute().catch(() => {});
    // Succeed
    await breaker.execute();

    // Circuit should still be CLOSED since failures were interspersed with successes
    expect(breaker.getState()).toBe('CLOSED');
  });
});
