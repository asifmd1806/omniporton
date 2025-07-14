import { LLMProvider, ProviderResponse, StreamChunk, CompletionParams } from './LLMProvider';
import { HTTPRetryHandler, RetryOptions } from '../utils/RetryHandler';

export interface APIProviderConfig {
  apiKey?: string;
  baseURL?: string;
  timeout?: number;
  retry?: RetryOptions;
  headers?: Record<string, string>;
}

export abstract class BaseAPIProvider implements LLMProvider {
  protected config: APIProviderConfig;
  protected retryHandler: HTTPRetryHandler;
  
  abstract readonly name: string;
  readonly type: 'api' = 'api';

  constructor(config: APIProviderConfig) {
    this.config = {
      timeout: 30000,
      retry: {
        maxAttempts: 3,
        baseDelay: 1000,
        maxDelay: 30000,
        backoffFactor: 2,
        jitter: true
      },
      ...config
    };
    
    this.retryHandler = new HTTPRetryHandler(this.config.retry);
  }

  abstract completion(params: CompletionParams): Promise<ProviderResponse>;
  
  abstract stream?(params: CompletionParams, onChunk: (chunk: StreamChunk) => void): Promise<void>;

  // Common HTTP request method with retry logic
  protected async makeRequest(
    url: string,
    options: RequestInit,
    operationName: string = 'API request'
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);
    
    try {
      let lastResponse: Response | null = null;
      
      const response = await this.retryHandler.executeWithRetryAfter(
        async () => {
          const response = await fetch(url, {
            ...options,
            signal: controller.signal,
            headers: {
              'Content-Type': 'application/json',
              ...this.config.headers,
              ...options.headers
            }
          });
          
          lastResponse = response;
          
          if (!response.ok) {
            const errorText = await response.text();
            let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
            
            try {
              const errorData = JSON.parse(errorText);
              errorMessage = this.extractErrorMessage(errorData) || errorMessage;
            } catch {
              // If parsing fails, use the raw text
              errorMessage = errorText || errorMessage;
            }
            
            throw new Error(errorMessage);
          }
          
          return response;
        },
        () => lastResponse ? this.parseRetryAfter(lastResponse) : null,
        {
          operationName,
          metadata: {
            url,
            method: options.method || 'GET',
            provider: this.name
          }
        }
      );
      
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // Parse retry-after header (can be overridden by providers)
  protected parseRetryAfter(response: Response): number | null {
    const retryAfter = response.headers.get('retry-after');
    if (!retryAfter) return null;
    
    const seconds = parseInt(retryAfter, 10);
    return isNaN(seconds) ? null : seconds;
  }

  // Extract error message from provider-specific error response
  protected extractErrorMessage(errorData: any): string | null {
    // Common error message patterns
    if (errorData.error?.message) return errorData.error.message;
    if (errorData.message) return errorData.message;
    if (errorData.detail) return errorData.detail;
    if (errorData.error_description) return errorData.error_description;
    
    return null;
  }

  // Helper method for streaming requests with retry
  protected async streamRequest(
    url: string,
    options: RequestInit,
    onChunk: (chunk: StreamChunk) => void,
    operationName: string = 'Stream request'
  ): Promise<void> {
    const response = await this.makeRequest(url, options, operationName);
    
    if (!response.body) {
      throw new Error('No response body for streaming');
    }
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          onChunk({ finished: true });
          break;
        }
        
        const chunk = decoder.decode(value, { stream: true });
        this.processStreamChunk(chunk, onChunk);
      }
    } finally {
      reader.releaseLock();
    }
  }

  // Process individual stream chunks (should be implemented by providers)
  protected abstract processStreamChunk(chunk: string, onChunk: (chunk: StreamChunk) => void): void;

  // Default implementations for optional methods
  supportsTools(): boolean {
    return false;
  }
  
  supportsStreaming(): boolean {
    return typeof this.stream === 'function';
  }
  
  supportsMultiModal(): boolean {
    return false;
  }

  configure(options: Record<string, any>): void {
    this.config = { ...this.config, ...options };
    
    // Update retry handler if retry options changed
    if (options.retry) {
      this.retryHandler = new HTTPRetryHandler({
        ...this.config.retry,
        ...options.retry
      });
    }
  }
}