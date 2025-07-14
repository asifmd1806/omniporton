import type { MessageExtractor, ExtractedSegment, ToolCall } from './MessageExtractor';

export class GeminiExtractor implements MessageExtractor {
  readonly name = 'GeminiExtractor';
  readonly supportedFormats = ['gemini_function_call', 'json', 'text'];
  
  extract(response: any): ExtractedSegment[] {
    const segments: ExtractedSegment[] = [];
    
    // Handle raw Gemini API response
    if (response.candidates) {
      for (const candidate of response.candidates) {
        if (candidate.content?.parts) {
          for (const part of candidate.content.parts) {
            if (part.text) {
              segments.push({
                type: 'content',
                data: part.text,
                metadata: {
                  provider: 'gemini',
                  format: 'text',
                  confidence: 1.0,
                  raw: part
                }
              });
            }
            
            if (part.functionCall) {
              segments.push({
                type: 'tool_call',
                data: {
                  id: this.generateToolCallId(),
                  name: part.functionCall.name,
                  arguments: part.functionCall.args || {},
                  type: 'function',
                  format: 'gemini_function_call'
                },
                metadata: {
                  provider: 'gemini',
                  format: 'gemini_function_call',
                  confidence: 1.0,
                  raw: part
                }
              });
            }
          }
        }
      }
    }
    
    // Handle tool calls from provider response
    if (response.toolCalls) {
      for (const toolCall of response.toolCalls) {
        segments.push({
          type: 'tool_call',
          data: toolCall,
          metadata: {
            provider: 'gemini',
            format: toolCall.format || 'gemini_function_call',
            confidence: 1.0,
            raw: toolCall
          }
        });
      }
    }
    
    // Handle plain text content
    if (typeof response === 'string') {
      const toolCalls = this.extractToolCalls(response);
      if (toolCalls.length > 0) {
        for (const toolCall of toolCalls) {
          segments.push({
            type: 'tool_call',
            data: toolCall,
            metadata: {
              provider: 'gemini',
              format: toolCall.format || 'json',
              confidence: 0.8,
              raw: response
            }
          });
        }
      } else {
        segments.push({
          type: 'content',
          data: response,
          metadata: {
            provider: 'gemini',
            format: 'text',
            confidence: 1.0,
            raw: response
          }
        });
      }
    }
    
    return segments;
  }
  
  extractToolCalls(text: string): ToolCall[] {
    const toolCalls: ToolCall[] = [];
    
    // Extract Gemini function calls
    const geminiPattern = /\{[\s\S]*?"functionCall"[\s\S]*?\}/g;
    let match;
    
    while ((match = geminiPattern.exec(text)) !== null) {
      try {
        const parsed = JSON.parse(match[0]);
        if (parsed.functionCall) {
          toolCalls.push({
            id: this.generateToolCallId(),
            name: parsed.functionCall.name,
            arguments: parsed.functionCall.args || {},
            type: 'function',
            format: 'gemini_function_call',
            raw: match[0]
          });
        }
      } catch (e) {
        // Ignore invalid JSON
      }
    }
    
    // Extract standard JSON function calls
    const jsonPattern = /\{[\s\S]*?"name"[\s\S]*?"arguments"[\s\S]*?\}/g;
    while ((match = jsonPattern.exec(text)) !== null) {
      try {
        const parsed = JSON.parse(match[0]);
        if (parsed.name && parsed.arguments) {
          toolCalls.push({
            id: parsed.id || this.generateToolCallId(),
            name: parsed.name,
            arguments: parsed.arguments,
            type: parsed.type || 'function',
            format: 'json',
            raw: match[0]
          });
        }
      } catch (e) {
        // Ignore invalid JSON
      }
    }
    
    return toolCalls;
  }
  
  extractContent(response: any): string {
    if (typeof response === 'string') {
      return response;
    }
    
    if (response.candidates) {
      let content = '';
      for (const candidate of response.candidates) {
        if (candidate.content?.parts) {
          for (const part of candidate.content.parts) {
            if (part.text) {
              content += part.text;
            }
          }
        }
      }
      return content;
    }
    
    if (response.content) {
      return response.content;
    }
    
    return '';
  }
  
  hasToolCalls(response: any): boolean {
    if (typeof response === 'string') {
      return this.extractToolCalls(response).length > 0;
    }
    
    if (response.candidates) {
      for (const candidate of response.candidates) {
        if (candidate.content?.parts) {
          for (const part of candidate.content.parts) {
            if (part.functionCall) {
              return true;
            }
          }
        }
      }
    }
    
    if (response.toolCalls && response.toolCalls.length > 0) {
      return true;
    }
    
    return false;
  }
  
  validateToolCall(toolCall: any): boolean {
    return !!(
      toolCall &&
      typeof toolCall === 'object' &&
      toolCall.name &&
      typeof toolCall.name === 'string' &&
      toolCall.arguments &&
      typeof toolCall.arguments === 'object'
    );
  }
  
  private generateToolCallId(): string {
    return `gemini_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}