import type { LLMProvider, CompletionParams, ProviderResponse, StreamChunk } from './LLMProvider';
import type { ChatMessage } from '../chat/types';
import { HTTPRetryHandler } from '../utils/RetryHandler';
import { toClaudeFormat } from '../providers/multimodal';

export interface ClaudeConfig {
  apiKey: string;
  model: string;
  baseURL?: string;
  version?: string;
  maxTokens?: number;
}

export class ClaudeProvider implements LLMProvider {
  private config: ClaudeConfig;
  private retryHandler: HTTPRetryHandler;
  
  readonly name = 'claude';
  readonly type: 'api' = 'api';
  
  constructor(config: ClaudeConfig) {
    this.config = {
      baseURL: 'https://api.anthropic.com',
      version: '2023-06-01',
      maxTokens: 4096,
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
    const { system, messages } = this.formatMessages(params.messages);
    const requestBody: any = {
      model: this.config.model,
      messages,
      system,
      max_tokens: params.max_tokens || this.config.maxTokens,
      temperature: params.temperature,
      top_p: params.top_p,
      stop_sequences: params.stop,
    };

    // Only add tools and tool_choice if tools are provided and not empty
    if (params.tools && params.tools.length > 0) {
      requestBody.tools = this.formatTools(params.tools);
      requestBody.tool_choice = this.formatToolChoice(params.tool_choice);
    }

    const response = await this.makeRequest('messages', requestBody);
    
    let textContent = '';
    let toolCalls: any[] = [];
    
    if (response.content) {
      for (const content of response.content) {
        if (content.type === 'text') {
          textContent += content.text;
        } else if (content.type === 'tool_use') {
          toolCalls.push({
            id: content.id,
            name: content.name,
            arguments: content.input || {},
            type: 'tool',
            format: 'anthropic_tool_use'
          });
        }
      }
    }
    
    return {
      content: textContent,
      raw: {
        ...response,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined
      },
      finished: response.stop_reason === 'end_turn' || response.stop_reason === 'max_tokens',
      usage: response.usage ? {
        prompt_tokens: response.usage.input_tokens,
        completion_tokens: response.usage.output_tokens,
        total_tokens: response.usage.input_tokens + response.usage.output_tokens
      } : undefined
    };
  }
  
  async stream(params: CompletionParams, onChunk: (chunk: StreamChunk) => void): Promise<void> {
    const { system, messages } = this.formatMessages(params.messages);
    const requestBody: any = {
      model: this.config.model,
      messages,
      system,
      max_tokens: params.max_tokens || this.config.maxTokens,
      temperature: params.temperature,
      top_p: params.top_p,
      stop_sequences: params.stop,
      stream: true,
    };

    // Only add tools and tool_choice if tools are provided and not empty
    if (params.tools && params.tools.length > 0) {
      requestBody.tools = this.formatTools(params.tools);
      requestBody.tool_choice = this.formatToolChoice(params.tool_choice);
    }

    const response = await this.retryHandler.execute(
      async () => {
        const response = await fetch(`${this.config.baseURL}/v1/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.config.apiKey,
            'anthropic-version': this.config.version || '2023-06-01',
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unknown error');
          throw new Error(`Claude API error: ${response.status} ${response.statusText} - ${errorText}`);
        }

        return response;
      },
      {
        operationName: 'Claude API streaming',
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
          
          const data = line.slice(6); // Remove 'data: ' prefix
          if (data === '[DONE]') {
            onChunk({
              content: '',
              raw: { type: 'message_stop' },
              finished: true
            });
            break;
          }
          
          try {
            const parsed = JSON.parse(data);
            
            if (parsed.type === 'content_block_start') {
              if (parsed.content_block.type === 'text') {
                // Text content block started
                continue;
              } else if (parsed.content_block.type === 'tool_use') {
                // Tool use block started
                onChunk({
                  content: '',
                  raw: {
                    ...parsed,
                    toolCall: {
                      id: parsed.content_block.id,
                      name: parsed.content_block.name,
                      arguments: parsed.content_block.input || {},
                      type: 'tool',
                      format: 'anthropic_tool_use'
                    }
                  },
                  finished: false
                });
              }
            } else if (parsed.type === 'content_block_delta') {
              if (parsed.delta.type === 'text_delta') {
                onChunk({
                  content: parsed.delta.text,
                  token: parsed.delta.text,
                  raw: parsed,
                  finished: false
                });
              }
            } else if (parsed.type === 'message_stop') {
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
  
  private extractTextContent(content: string | import('../chat/types').MessageContent): string {
    if (typeof content === 'string') {
      return content;
    }
    
    if (Array.isArray(content)) {
      return content
        .filter(item => item.type === 'text')
        .map(item => (item as any).text)
        .join('');
    }
    
    if (content.type === 'text') {
      return (content as any).text;
    }
    
    // For non-text content (media), return empty string or description
    return '';
  }

  private formatMessages(messages: ChatMessage[]) {
    const systemMessages: string[] = [];
    const chatMessages: any[] = [];
    
    for (const message of messages) {
      if (message.role === 'system') {
        systemMessages.push(this.extractTextContent(message.content));
      } else if (message.role === 'user') {
        chatMessages.push({
          role: 'user',
          content: toClaudeFormat(message.content)
        });
      } else if (message.role === 'assistant') {
        chatMessages.push({
          role: 'assistant',
          content: toClaudeFormat(message.content)
        });
      } else if (message.role === 'tool') {
        const toolMessage = message as any;
        chatMessages.push({
          role: 'user',
          content: [{
            type: 'tool_result',
            tool_use_id: toolMessage.name, // This should be the tool call ID
            content: message.content
          }]
        });
      }
    }
    
    return {
      system: systemMessages.join('\n') || undefined,
      messages: chatMessages
    };
  }
  
  private formatTools(tools: any[]) {
    return tools.map(tool => ({
      name: tool.name || tool.function?.name,
      description: tool.description || tool.function?.description,
      input_schema: tool.parameters || tool.function?.parameters || {
        type: 'object',
        properties: {},
        required: []
      }
    }));
  }
  
  private formatToolChoice(toolChoice?: 'auto' | 'none' | 'required' | string) {
    if (!toolChoice || toolChoice === 'auto') {
      return { type: 'auto' };
    }
    if (toolChoice === 'none') {
      return { type: 'none' };
    }
    if (toolChoice === 'required') {
      return { type: 'any' };
    }
    if (typeof toolChoice === 'string') {
      return { type: 'tool', name: toolChoice };
    }
    return { type: 'auto' };
  }
  
  private async makeRequest(endpoint: string, body: any) {
    return this.retryHandler.execute(
      async () => {
        const response = await fetch(`${this.config.baseURL}/v1/${endpoint}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.config.apiKey,
            'anthropic-version': this.config.version || '2023-06-01',
          },
          body: JSON.stringify(body),
        });
        
        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new Error(`Claude API error: ${response.status} ${response.statusText} - ${error.error?.message || 'Unknown error'}`);
        }
        
        return response.json();
      },
      {
        operationName: 'Claude API request',
        metadata: { 
          model: this.config.model,
          endpoint: `${this.config.baseURL}/v1/${endpoint}`
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