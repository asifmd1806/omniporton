import type { LLMProvider, CompletionParams, ProviderResponse, StreamChunk } from './LLMProvider';
import type { ChatMessage } from '../chat/types';
import { HTTPRetryHandler } from '../utils/RetryHandler';
import { toGeminiFormat } from '../providers/multimodal';

export interface GeminiConfig {
  apiKey: string;
  model: string;
  baseURL?: string;
  projectId?: string;
  location?: string;
}

export class GeminiProvider implements LLMProvider {
  private config: GeminiConfig;
  private retryHandler: HTTPRetryHandler;
  
  readonly name = 'gemini';
  readonly type: 'api' = 'api';
  
  constructor(config: GeminiConfig) {
    this.config = {
      baseURL: 'https://generativelanguage.googleapis.com/v1beta',
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
    const formattedMessages = this.formatMessages(params.messages);
    const requestBody = {
      contents: formattedMessages,
      generationConfig: {
        temperature: params.temperature,
        topP: params.top_p,
        maxOutputTokens: params.max_tokens,
        stopSequences: params.stop,
      },
      tools: params.tools ? this.formatTools(params.tools) : undefined,
      toolConfig: params.tool_choice && params.tool_choice !== 'auto' ? {
        functionCallingConfig: {
          mode: params.tool_choice === 'none' ? 'NONE' : 'AUTO'
        }
      } : undefined,
    };

    const response = await this.makeRequest('generateContent', requestBody);
    
    if (!response.candidates || response.candidates.length === 0) {
      throw new Error('No candidates returned from Gemini API');
    }
    
    const candidate = response.candidates[0];
    const content = candidate.content;
    
    let textContent = '';
    let toolCalls: any[] = [];
    
    if (content.parts) {
      for (const part of content.parts) {
        if (part.text) {
          textContent += part.text;
        }
        if (part.functionCall) {
          toolCalls.push({
            id: this.generateToolCallId(),
            name: part.functionCall.name,
            arguments: part.functionCall.args || {},
            type: 'function',
            format: 'gemini_function_call'
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
      finished: candidate.finishReason === 'STOP' || candidate.finishReason === 'MAX_TOKENS',
      usage: response.usageMetadata ? {
        prompt_tokens: response.usageMetadata.promptTokenCount,
        completion_tokens: response.usageMetadata.candidatesTokenCount,
        total_tokens: response.usageMetadata.totalTokenCount
      } : undefined
    };
  }
  
  async stream(params: CompletionParams, onChunk: (chunk: StreamChunk) => void): Promise<void> {
    const formattedMessages = this.formatMessages(params.messages);
    const requestBody = {
      contents: formattedMessages,
      generationConfig: {
        temperature: params.temperature,
        topP: params.top_p,
        maxOutputTokens: params.max_tokens,
        stopSequences: params.stop,
      },
      tools: params.tools ? this.formatTools(params.tools) : undefined,
      toolConfig: params.tool_choice && params.tool_choice !== 'auto' ? {
        functionCallingConfig: {
          mode: params.tool_choice === 'none' ? 'NONE' : 'AUTO'
        }
      } : undefined,
    };

    const response = await this.retryHandler.execute(
      async () => {
        const response = await fetch(`${this.config.baseURL}/models/${this.config.model}:streamGenerateContent?key=${this.config.apiKey}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unknown error');
          throw new Error(`Gemini API error: ${response.status} ${response.statusText} - ${errorText}`);
        }

        return response;
      },
      {
        operationName: 'Gemini API streaming',
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
          if (line.trim() === '') continue;
          
          try {
            const data = JSON.parse(line);
            if (data.candidates && data.candidates[0]) {
              const candidate = data.candidates[0];
              const content = candidate.content;
              
              if (content?.parts) {
                for (const part of content.parts) {
                  if (part.text) {
                    onChunk({
                      content: part.text,
                      token: part.text,
                      raw: data,
                      finished: false
                    });
                  }
                  if (part.functionCall) {
                    onChunk({
                      content: '',
                      raw: {
                        ...data,
                        toolCall: {
                          id: this.generateToolCallId(),
                          name: part.functionCall.name,
                          arguments: part.functionCall.args || {},
                          type: 'function',
                          format: 'gemini_function_call'
                        }
                      },
                      finished: false
                    });
                  }
                }
              }
              
              if (candidate.finishReason === 'STOP' || candidate.finishReason === 'MAX_TOKENS') {
                onChunk({
                  content: '',
                  raw: data,
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
    const contents: any[] = [];
    
    for (const message of messages) {
      if (message.role === 'system') {
        // Gemini doesn't have system messages, so we'll add it as user context
        contents.push({
          role: 'user',
          parts: [{ text: `System: ${message.content}` }]
        });
      } else if (message.role === 'user') {
        contents.push({
          role: 'user',
          parts: toGeminiFormat(message.content)
        });
      } else if (message.role === 'assistant') {
        contents.push({
          role: 'model',
          parts: toGeminiFormat(message.content)
        });
      } else if (message.role === 'tool') {
        const toolMessage = message as any;
        contents.push({
          role: 'function',
          parts: [{
            functionResponse: {
              name: toolMessage.name,
              response: {
                content: message.content
              }
            }
          }]
        });
      }
    }
    
    return contents;
  }
  
  private formatTools(tools: any[]) {
    return tools.map(tool => ({
      functionDeclarations: [{
        name: tool.name || tool.function?.name,
        description: tool.description || tool.function?.description,
        parameters: tool.parameters || tool.function?.parameters
      }]
    }));
  }
  
  private async makeRequest(endpoint: string, body: any) {
    return this.retryHandler.execute(
      async () => {
        const response = await fetch(`${this.config.baseURL}/models/${this.config.model}:${endpoint}?key=${this.config.apiKey}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        });
        
        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new Error(`Gemini API error: ${response.status} ${response.statusText} - ${error.error?.message || 'Unknown error'}`);
        }
        
        return response.json();
      },
      {
        operationName: 'Gemini API request',
        metadata: { 
          model: this.config.model,
          endpoint: `${this.config.baseURL}/models/${this.config.model}:${endpoint}`
        }
      }
    );
  }
  
  private generateToolCallId(): string {
    return `gemini_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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