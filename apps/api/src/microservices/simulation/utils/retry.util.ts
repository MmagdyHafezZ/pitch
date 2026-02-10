/**
 * Retry utility for handling transient failures with exponential backoff
 */

export interface RetryOptions {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  shouldRetry?: (error: Error) => boolean;
  onRetry?: (attempt: number, error: Error) => void;
}

const DEFAULT_OPTIONS: RetryOptions = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  shouldRetry: (error: Error) => {
    // Retry on network errors, timeouts, and rate limits
    const message = error.message.toLowerCase();
    return (
      message.includes('timeout') ||
      message.includes('econnrefused') ||
      message.includes('econnreset') ||
      message.includes('etimedout') ||
      message.includes('rate limit') ||
      message.includes('429') ||
      message.includes('503') ||
      message.includes('502')
    );
  },
};

/**
 * Execute an async operation with exponential backoff retry
 *
 * @param operation - The async operation to execute
 * @param options - Retry configuration options
 * @returns Promise resolving to the operation result
 *
 * @example
 * ```typescript
 * const result = await withRetry(
 *   () => this.llmRouter.stream({ sessionId, userId, messages, config }),
 *   {
 *     maxRetries: 2,
 *     initialDelay: 1000,
 *     maxDelay: 5000,
 *     onRetry: (attempt, error) => {
 *       logger.warn(`Retry attempt ${attempt} after error: ${error.message}`);
 *     }
 *   }
 * );
 * ```
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: Partial<RetryOptions> = {},
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: Error | undefined;
  let delay = opts.initialDelay;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      // Don't retry if we've exhausted attempts
      if (attempt === opts.maxRetries) {
        throw lastError;
      }

      // Check if we should retry this error
      if (opts.shouldRetry && !opts.shouldRetry(lastError)) {
        throw lastError;
      }

      // Call retry callback if provided
      if (opts.onRetry) {
        opts.onRetry(attempt + 1, lastError);
      }

      // Wait with exponential backoff
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay = Math.min(delay * 2, opts.maxDelay);
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError || new Error('Retry failed with unknown error');
}

/**
 * Execute an async operation with circuit breaker pattern
 *
 * Circuit states:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Requests fail fast without executing
 * - HALF_OPEN: Test if service recovered by allowing one request
 */
export class CircuitBreaker<T> {
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private failureCount = 0;
  private successCount = 0;
  private nextAttempt = Date.now();

  constructor(
    private readonly operation: () => Promise<T>,
    private readonly options: {
      failureThreshold: number;
      successThreshold: number;
      timeout: number;
      resetTimeout: number;
      fallback?: () => T | Promise<T>;
    },
  ) {}

  async execute(): Promise<T> {
    // Check if circuit is open
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        if (this.options.fallback) {
          return await this.options.fallback();
        }
        throw new Error('Circuit breaker is OPEN');
      }
      // Try to recover
      this.state = 'HALF_OPEN';
    }

    try {
      const result = await Promise.race([
        this.operation(),
        new Promise<T>((_, reject) =>
          setTimeout(
            () => reject(new Error('Circuit breaker timeout')),
            this.options.timeout,
          ),
        ),
      ]);

      // Success
      this.onSuccess();
      return result;
    } catch (error) {
      // Failure
      this.onFailure();

      if (this.options.fallback) {
        return await this.options.fallback();
      }

      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;

    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount >= this.options.successThreshold) {
        this.state = 'CLOSED';
        this.successCount = 0;
      }
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.successCount = 0;

    if (this.failureCount >= this.options.failureThreshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.options.resetTimeout;
    }
  }

  getState(): string {
    return this.state;
  }
}
