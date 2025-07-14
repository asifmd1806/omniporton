import type { LLMProvider, CompletionParams, ProviderResponse, StreamChunk } from './LLMProvider';
import type { ChatMessage } from '../chat/types';
import { HTTPRetryHandler } from '../utils/RetryHandler';

export interface GroqConfig {
  apiKey: string;
  model: string;
  baseURL?: string;
}

export class GroqProvider implements LLMProvider {
  private config: GroqConfig;
  private retryHandler: HTTPRetryHandler;
  
  readonly name = 'groq';
  readonly type: 'api' = 'api';
  
  constructor(config: GroqConfig) {
    this.config = {
      baseURL: 'https://api.groq.com',
      ...config
    };
    
    this.retryHandler = new HTTPRetryHandler({
      maxAttempts: 3,
      baseDelay: 1000,
      maxDelay: 30000,
      backoffFactor: 2,
      jitter: true
    });
  }
  
  async completion(params: CompletionParams): Promise<ProviderResponse> {
    const requestBody = {
      model: this.config.model,
      messages: this.formatMessages(params.messages),
      max_tokens: params.max_tokens,
      temperature: params.temperature,
      top_p: params.top_p,
      stop: params.stop,
      tools: params.tools ? this.formatTools(params.tools) : undefined,
      tool_choice: params.tool_choice === 'none' ? 'none' : 'auto',
      stream: false,
    };

    const response = await this.makeRequest('chat/completions', requestBody);
    
    if (!response.choices || response.choices.length === 0) {
      throw new Error('No choices returned from Groq API');
    }
    
    const choice = response.choices[0];
    const message = choice.message;
    
    let toolCalls: any[] = [];
    if (message.tool_calls) {
      toolCalls = message.tool_calls.map((toolCall: any) => ({
        id: toolCall.id,
        name: toolCall.function.name,
        arguments: JSON.parse(toolCall.function.arguments || '{}'),
        type: 'function',
        format: 'groq_function_call'
      }));
    }
    
    return {
      content: message.content || '',
      raw: {
        ...response,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined
      },
      finished: choice.finish_reason === 'stop' || choice.finish_reason === 'length',
      usage: response.usage ? {
        prompt_tokens: response.usage.prompt_tokens,
        completion_tokens: response.usage.completion_tokens,
        total_tokens: response.usage.total_tokens
      } : undefined
    };
  }
  
  async stream(params: CompletionParams, onChunk: (chunk: StreamChunk) => void): Promise<void> {
    const requestBody = {
      model: this.config.model,
      messages: this.formatMessages(params.messages),
      max_tokens: params.max_tokens,
      temperature: params.temperature,
      top_p: params.top_p,
      stop: params.stop,
      tools: params.tools ? this.formatTools(params.tools) : undefined,
      tool_choice: params.tool_choice === 'none' ? 'none' : 'auto',
      stream: true,
    };

    const response = await this.retryHandler.execute(
      async () => {
        const response = await fetch(`${this.config.baseURL}/openai/v1/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.config.apiKey}`,
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unknown error');
          throw new Error(`Groq API error: ${response.status} ${response.statusText} - ${errorText}`);
        }

        return response;
      },
      {
        operationName: 'Groq API streaming',
        metadata: { 
          model: this.config.model,
          streaming: true
        }
      }
    );

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

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
          if (line.trim() === '' || !line.startsWith('data: ')) continue;
          
          const data = line.slice(6);
          if (data === '[DONE]') {
            onChunk({
              content: '',
              raw: { type: 'done' },
              finished: true
            });
            break;
          }
          
          try {
            const parsed = JSON.parse(data);
            
            if (parsed.choices && parsed.choices[0]) {
              const choice = parsed.choices[0];
              const delta = choice.delta;
              
              if (delta.content) {
                onChunk({
                  content: delta.content,
                  token: delta.content,
                  raw: parsed,
                  finished: false
                });
              }
              
              if (delta.tool_calls) {
                for (const toolCall of delta.tool_calls) {
                  if (toolCall.function) {
                    onChunk({
                      content: '',
                      raw: {
                        ...parsed,
                        toolCall: {
                          id: toolCall.id,
                          name: toolCall.function.name,
                          arguments: JSON.parse(toolCall.function.arguments || '{}'),
                          type: 'function',
                          format: 'groq_function_call'
                        }
                      },
                      finished: false
                    });
                  }
                }
              }
              
              if (choice.finish_reason === 'stop' || choice.finish_reason === 'length') {
                onChunk({
                  content: '',
                  raw: parsed,
                  finished: true
                });
                break;
              }
            }
          } catch (e) {
            console.warn('Failed to parse streaming response:', e);
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
  
  private formatMessages(messages: ChatMessage[]) {
    return messages.map(message => {
      if (message.role === 'tool') {
        const toolMessage = message as any;
        return {
          role: 'tool',
          content: message.content,
          tool_call_id: toolMessage.name // This should be the tool call ID
        };
      }
      return {
        role: message.role,
        content: message.content
      };
    });
  }
  
  private formatTools(tools: any[]) {
    return tools.map(tool => ({
      type: 'function',
      function: {
        name: tool.name || tool.function?.name,
        description: tool.description || tool.function?.description,
        parameters: tool.parameters || tool.function?.parameters
      }
    }));
  }
  
  private async makeRequest(endpoint: string, body: any) {
    return this.retryHandler.execute(
      async () => {
        const response = await fetch(`${this.config.baseURL}/openai/v1/${endpoint}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.config.apiKey}`,
          },
          body: JSON.stringify(body),
        });
        
        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new Error(`Groq API error: ${response.status} ${response.statusText} - ${error.error?.message || 'Unknown error'}`);
        }
        
        return response.json();
      },
      {
        operationName: 'Groq API request',
        metadata: { 
          model: this.config.model,
          endpoint: `${this.config.baseURL}/openai/v1/${endpoint}`
        }
      }
    );
  }
  
  supportsTools(): boolean {
    return true;
  }
  
  supportsStreaming(): boolean {
    return true;
  }
  
  configure(options: Record<string, any>): void {
    this.config = { ...this.config, ...options };
  }
}