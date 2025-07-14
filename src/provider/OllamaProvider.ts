import type { LLMProvider, CompletionParams, ProviderResponse, StreamChunk } from './LLMProvider';
import type { ChatMessage } from '../chat/types';

export interface OllamaConfig {
  baseURL?: string;
  model: string;
  temperature?: number;
  topP?: number;
  contextLength?: number;
}

export class OllamaProvider implements LLMProvider {
  private config: OllamaConfig;
  
  readonly name = 'ollama';
  readonly type: 'api' = 'api';
  
  constructor(config: OllamaConfig) {
    this.config = {
      baseURL: 'http://localhost:11434',
      temperature: 0.7,
      topP: 0.9,
      contextLength: 4096,
      ...config
    };
  }
  
  async completion(params: CompletionParams): Promise<ProviderResponse> {
    const requestBody = {
      model: this.config.model,
      messages: this.formatMessages(params.messages),
      options: {
        temperature: params.temperature ?? this.config.temperature,
        top_p: params.top_p ?? this.config.topP,
        num_ctx: this.config.contextLength,
        stop: params.stop,
      },
      tools: params.tools ? this.formatTools(params.tools) : undefined,
      stream: false,
    };

    const response = await this.makeRequest('api/chat', requestBody);
    
    if (!response.message) {
      throw new Error('No message returned from Ollama API');
    }
    
    const message = response.message;
    let toolCalls: any[] = [];
    
    // Check for tool calls in the response
    if (message.tool_calls) {
      toolCalls = message.tool_calls.map((toolCall: any) => ({
        id: toolCall.id || `call_${Date.now()}`,
        name: toolCall.function?.name || toolCall.name,
        arguments: toolCall.function?.arguments || toolCall.arguments || {},
        type: 'function',
        format: 'ollama_function_call'
      }));
    }
    
    return {
      content: message.content || '',
      raw: {
        ...response,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined
      },
      finished: response.done === true,
      usage: response.prompt_eval_count ? {
        prompt_tokens: response.prompt_eval_count,
        completion_tokens: response.eval_count,
        total_tokens: (response.prompt_eval_count || 0) + (response.eval_count || 0)
      } : undefined
    };
  }
  
  async stream(params: CompletionParams, onChunk: (chunk: StreamChunk) => void): Promise<void> {
    const requestBody = {
      model: this.config.model,
      messages: this.formatMessages(params.messages),
      options: {
        temperature: params.temperature ?? this.config.temperature,
        top_p: params.top_p ?? this.config.topP,
        num_ctx: this.config.contextLength,
        stop: params.stop,
      },
      tools: params.tools ? this.formatTools(params.tools) : undefined,
      stream: true,
    };

    const response = await fetch(`${this.config.baseURL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
    }

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
          if (line.trim() === '') continue;
          
          try {
            const parsed = JSON.parse(line);
            
            if (parsed.message) {
              const message = parsed.message;
              
              if (message.content) {
                onChunk({
                  content: message.content,
                  token: message.content,
                  raw: parsed,
                  finished: false
                });
              }
              
              if (message.tool_calls) {
                for (const toolCall of message.tool_calls) {
                  onChunk({
                    content: '',
                    raw: {
                      ...parsed,
                      toolCall: {
                        id: toolCall.id || `call_${Date.now()}`,
                        name: toolCall.function?.name || toolCall.name,
                        arguments: toolCall.function?.arguments || toolCall.arguments || {},
                        type: 'function',
                        format: 'ollama_function_call'
                      }
                    },
                    finished: false
                  });
                }
              }
            }
            
            if (parsed.done === true) {
              onChunk({
                content: '',
                raw: parsed,
                finished: true
              });
              break;
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
          name: toolMessage.name
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
    const response = await fetch(`${this.config.baseURL}/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(`Ollama API error: ${response.status} ${response.statusText} - ${error.error || 'Unknown error'}`);
    }
    
    return response.json();
  }
  
  supportsTools(): boolean {
    return true;
  }
  
  supportsStreaming(): boolean {
    return true;
  }

  supportsMultiModal(): boolean {
    // Depends on the specific model (e.g., llava supports vision)
    return true;
  }
  
  configure(options: Record<string, any>): void {
    this.config = { ...this.config, ...options };
  }
}