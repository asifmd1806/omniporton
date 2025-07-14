import { MessageExtractor, ExtractedSegment, ToolCall } from './MessageExtractor';

export class OpenAIExtractor implements MessageExtractor {
  readonly name = 'OpenAIExtractor';
  readonly supportedFormats = ['openai_tools', 'function_calling'];

  extract(response: any): ExtractedSegment[] {
    const segments: ExtractedSegment[] = [];
    
    if (!response) return segments;

    // Handle OpenAI API response format
    if (response.choices) {
      const choice = response.choices[0];
      const message = choice.message;
      
      // Extract content
      if (message.content) {
        segments.push({
          type: 'content',
          data: message.content,
          metadata: { 
            provider: this.name, 
            format: 'text',
            raw: response
          }
        });
      }
      
      // Extract tool calls
      if (message.tool_calls) {
        for (const toolCall of message.tool_calls) {
          segments.push({
            type: 'tool_call',
            data: this.normalizeToolCall(toolCall),
            metadata: { 
              provider: this.name, 
              format: 'openai_tools',
              raw: toolCall
            }
          });
        }
      }
      
      // Handle function calls (deprecated OpenAI format)
      if (message.function_call) {
        segments.push({
          type: 'tool_call',
          data: {
            id: `call_${Date.now()}`,
            name: message.function_call.name,
            arguments: JSON.parse(message.function_call.arguments || '{}'),
            type: 'function',
            format: 'function_calling',
            raw: message.function_call
          },
          metadata: { 
            provider: this.name, 
            format: 'function_calling',
            raw: message.function_call
          }
        });
      }
    } 
    // Handle streaming chunk format
    else if (response.tool_calls) {
      for (const toolCall of response.tool_calls) {
        segments.push({
          type: 'tool_call',
          data: this.normalizeToolCall(toolCall),
          metadata: { 
            provider: this.name, 
            format: 'openai_tools',
            raw: toolCall
          }
        });
      }
    }
    // Handle simple text response
    else if (typeof response === 'string') {
      segments.push({
        type: 'content',
        data: response,
        metadata: { provider: this.name, format: 'text' }
      });
    }

    return segments;
  }

  private normalizeToolCall(openaiToolCall: any): ToolCall {
    return {
      id: openaiToolCall.id,
      name: openaiToolCall.function?.name || openaiToolCall.name,
      arguments: typeof openaiToolCall.function?.arguments === 'string' 
        ? JSON.parse(openaiToolCall.function.arguments)
        : openaiToolCall.function?.arguments || openaiToolCall.arguments || {},
      type: openaiToolCall.type || 'function',
      format: 'openai_tools',
      raw: openaiToolCall
    };
  }

  extractToolCalls(text: string): ToolCall[] {
    // OpenAI doesn't embed tool calls in text, they're in separate fields
    return [];
  }

  extractContent(response: any): string {
    if (typeof response === 'string') return response;
    
    if (response.choices?.[0]?.message?.content) {
      return response.choices[0].message.content;
    }
    
    if (response.content) return response.content;
    
    return '';
  }

  hasToolCalls(response: any): boolean {
    if (response.choices?.[0]?.message?.tool_calls) return true;
    if (response.choices?.[0]?.message?.function_call) return true;
    if (response.tool_calls) return true;
    return false;
  }

  validateToolCall(toolCall: any): boolean {
    return !!(toolCall.id && toolCall.function?.name);
  }
}