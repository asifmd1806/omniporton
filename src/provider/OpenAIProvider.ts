import { LLMProvider, ProviderResponse, StreamChunk, CompletionParams } from './LLMProvider';
import { HTTPRetryHandler } from '../utils/RetryHandler';
import { toOpenAIFormat } from '../providers/multimodal';
import type { ChatMessage } from '../chat/types';

export interface OpenAIConfig {
  apiKey: string;
  baseURL?: string;
  model: string;
  organization?: string;
}

export class OpenAIProvider implements LLMProvider {
  readonly name = 'openai';
  readonly type = 'api' as const;
  private retryHandler: HTTPRetryHandler;

  constructor(private config: OpenAIConfig) {
    this.retryHandler = new HTTPRetryHandler({
      maxAttempts: 3,
      baseDelay: 1000,
      maxDelay: 30000,
      backoffFactor: 2,
      jitter: true
    });
  }

  async completion(params: CompletionParams): Promise<ProviderResponse> {
    const response = await this.makeRequest({
      model: this.config.model,
      messages: this.formatMessages(params.messages),
      max_tokens: params.max_tokens,
      temperature: params.temperature,
      top_p: params.top_p,
      stop: params.stop,
      tools: params.tools,
      tool_choice: params.tool_choice,
      stream: false
    });

    const choice = response.choices[0];
    
    return {
      content: choice.message.content || '',
      raw: response,
      finished: choice.finish_reason !== null,
      usage: response.usage
    };
  }

  async stream(params: CompletionParams, onChunk: (chunk: StreamChunk) => void): Promise<void> {
    const response = await this.retryHandler.execute(
      async () => {
        const response = await fetch(this.getEndpoint(), {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({
            model: this.config.model,
            messages: this.formatMessages(params.messages),
            max_tokens: params.max_tokens,
            temperature: params.temperature,
            top_p: params.top_p,
            stop: params.stop,
            tools: params.tools,
            tool_choice: params.tool_choice,
            stream: true
          })
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unknown error');
          throw new Error(`OpenAI API error: ${response.status} ${response.statusText} - ${errorText}`);
        }

        return response;
      },
      {
        operationName: 'OpenAI API streaming',
        metadata: { 
          model: this.config.model,
          streaming: true
        }
      }
    );

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const chunk = JSON.parse(data);
              const delta = chunk.choices[0]?.delta;
              
              if (delta?.content) {
                onChunk({
                  content: delta.content,
                  raw: chunk,
                  finished: chunk.choices[0]?.finish_reason !== null
                });
              }

              if (delta?.tool_calls) {
                // Handle tool calls in streaming
                onChunk({
                  content: '',
                  raw: { ...chunk, tool_calls: delta.tool_calls },
                  finished: false
                });
              }
            } catch (e) {
              console.warn('Failed to parse streaming chunk:', e);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  private async makeRequest(data: any): Promise<any> {
    return this.retryHandler.execute(
      async () => {
        const response = await fetch(this.getEndpoint(), {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify(data)
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unknown error');
          throw new Error(`OpenAI API error: ${response.status} ${response.statusText} - ${errorText}`);
        }

        return response.json();
      },
      {
        operationName: 'OpenAI API completion',
        metadata: { 
          model: this.config.model,
          endpoint: this.getEndpoint()
        }
      }
    );
  }

  private getEndpoint(): string {
    const baseURL = this.config.baseURL || 'https://api.openai.com/v1';
    return `${baseURL}/chat/completions`;
  }

  private getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.config.apiKey}`,
      ...(this.config.organization && { 'OpenAI-Organization': this.config.organization })
    };
  }

  supportsTools(): boolean {
    return true;
  }

  supportsStreaming(): boolean {
    return true;
  }

  configure(options: Record<string, any>): void {
    Object.assign(this.config, options);
  }

  private formatMessages(messages: ChatMessage[]): any[] {
    return messages.map(message => {
      const formattedContent = toOpenAIFormat(message.content);
      
      const result: any = {
        role: message.role,
        content: formattedContent
      };
      
      // Handle tool message properties
      if (message.role === 'tool' && 'name' in message) {
        result.name = message.name;
      }
      if (message.role === 'tool' && 'args' in message && message.args) {
        result.args = message.args;
      }
      
      return result;
    });
  }
}