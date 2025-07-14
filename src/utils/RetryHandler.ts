import { Logger } from './Logger';

export interface RetryOptions {
  maxAttempts?: number;
  baseDelay?: number;
  maxDelay?: number;
  backoffFactor?: number;
  jitter?: boolean;
  retryableStatusCodes?: number[];
  retryableErrorMessages?: string[];
}

export interface RetryContext {
  attempt: number;
  totalAttempts: number;
  lastError?: Error;
  delay: number;
}

export class RetryHandler {
  protected logger: Logger;
  protected options: Required<RetryOptions>;

  constructor(options: RetryOptions = {}) {
    this.options = {
      maxAttempts: options.maxAttempts ?? 3,
      baseDelay: options.baseDelay ?? 1000,
      maxDelay: options.maxDelay ?? 30000,
      backoffFactor: options.backoffFactor ?? 2,
      jitter: options.jitter ?? true,
      retryableStatusCodes: options.retryableStatusCodes ?? [429, 502, 503, 504],
      retryableErrorMessages: options.retryableErrorMessages ?? [
        'network error',
        'timeout',
        'connection reset',
        'econnreset',
        'etimedout',
        'enotfound',
        'rate limit exceeded',
        'too many requests'
      ]
    };
    this.logger = new Logger('RetryHandler');
  }

  async execute<T>(
    operation: () => Promise<T>,
    context: { operationName: string; metadata?: Record<string, any> } = { operationName: 'unknown' }
  ): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.options.maxAttempts; attempt++) {
      try {
        const result = await operation();
        
        if (attempt > 1) {
          this.logger.info(`Operation succeeded after ${attempt} attempts`, {
            operationName: context.operationName,
            attempt,
            totalAttempts: this.options.maxAttempts,
            ...context.metadata
          });
        }
        
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        const isRetryable = this.isRetryableError(lastError);
        const isLastAttempt = attempt === this.options.maxAttempts;
        
        if (!isRetryable || isLastAttempt) {
          this.logger.error(`Operation failed${isLastAttempt ? ' after max attempts' : ' with non-retryable error'}`, {
            operationName: context.operationName,
            attempt,
            totalAttempts: this.options.maxAttempts,
            error: lastError.message,
            retryable: isRetryable,
            ...context.metadata
          });
          throw lastError;
        }
        
        const delay = this.calculateDelay(attempt);
        
        this.logger.warn(`Operation failed, retrying in ${delay}ms`, {
          operationName: context.operationName,
          attempt,
          totalAttempts: this.options.maxAttempts,
          error: lastError.message,
          retryDelay: delay,
          ...context.metadata
        });
        
        await this.sleep(delay);
      }
    }
    
    throw lastError || new Error('Max retry attempts exceeded');
  }

  private isRetryableError(error: Error): boolean {
    const errorMessage = error.message.toLowerCase();
    
    // Check for retryable error messages
    if (this.options.retryableErrorMessages.some(msg => errorMessage.includes(msg))) {
      return true;
    }
    
    // Check for HTTP status codes in error message
    if (this.options.retryableStatusCodes.some(code => errorMessage.includes(code.toString()))) {
      return true;
    }
    
    // Check for fetch/network errors
    if (error.name === 'TypeError' && (
      errorMessage.includes('fetch') || 
      errorMessage.includes('network') ||
      errorMessage.includes('failed to fetch')
    )) {
      return true;
    }
    
    return false;
  }

  private calculateDelay(attempt: number): number {
    const exponentialDelay = this.options.baseDelay * Math.pow(this.options.backoffFactor, attempt - 1);
    const cappedDelay = Math.min(exponentialDelay, this.options.maxDelay);
    
    if (this.options.jitter) {
      // Add jitter to prevent thundering herd (±25% of delay)
      const jitterRange = cappedDelay * 0.25;
      const jitter = (Math.random() - 0.5) * 2 * jitterRange;
      return Math.max(0, cappedDelay + jitter);
    }
    
    return cappedDelay;
  }

  protected sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Static helper for quick retry with default options
  static async retry<T>(
    operation: () => Promise<T>,
    options: RetryOptions = {}
  ): Promise<T> {
    const handler = new RetryHandler(options);
    return handler.execute(operation);
  }
}

// HTTP-specific retry handler for API providers
export class HTTPRetryHandler extends RetryHandler {
  constructor(options: RetryOptions = {}) {
    super({
      retryableStatusCodes: [429, 502, 503, 504, 522, 524],
      retryableErrorMessages: [
        'network error',
        'timeout',
        'connection reset',
        'econnreset',
        'etimedout',
        'enotfound',
        'rate limit exceeded',
        'too many requests',
        'service unavailable',
        'bad gateway',
        'gateway timeout'
      ],
      ...options
    });
  }

  // Parse retry-after header for rate limiting
  async executeWithRetryAfter<T>(
    operation: () => Promise<T>,
    getRetryAfter: () => number | null,
    context: { operationName: string; metadata?: Record<string, any> } = { operationName: 'unknown' }
  ): Promise<T> {
    return this.execute(async () => {
      try {
        return await operation();
      } catch (error) {
        // Check if this is a rate limit error and if we have retry-after header
        if (error instanceof Error && error.message.includes('429')) {
          const retryAfter = getRetryAfter();
          if (retryAfter && retryAfter > 0) {
            const retryAfterMs = retryAfter * 1000;
            this.logger.info(`Rate limited, waiting ${retryAfterMs}ms as requested by server`, {
              operationName: context.operationName,
              retryAfterSeconds: retryAfter,
              ...context.metadata
            });
            await this.sleep(retryAfterMs);
            return await operation();
          }
        }
        throw error;
      }
    }, context);
  }
}