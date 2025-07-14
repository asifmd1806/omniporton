import type { MessageExtractor, ExtractedSegment, ToolCall } from './MessageExtractor';

export class ClaudeExtractor implements MessageExtractor {
  readonly name = 'ClaudeExtractor';
  readonly supportedFormats = ['anthropic_tool_use', 'json', 'xml', 'text'];
  
  extract(response: any): ExtractedSegment[] {
    const segments: ExtractedSegment[] = [];
    
    // Handle raw Claude API response
    if (response.content) {
      for (const content of response.content) {
        if (content.type === 'text') {
          segments.push({
            type: 'content',
            data: content.text,
            metadata: {
              provider: 'claude',
              format: 'text',
              confidence: 1.0,
              raw: content
            }
          });
        } else if (content.type === 'tool_use') {
          segments.push({
            type: 'tool_call',
            data: {
              id: content.id,
              name: content.name,
              arguments: content.input || {},
              type: 'tool',
              format: 'anthropic_tool_use'
            },
            metadata: {
              provider: 'claude',
              format: 'anthropic_tool_use',
              confidence: 1.0,
              raw: content
            }
          });
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
            provider: 'claude',
            format: toolCall.format || 'anthropic_tool_use',
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
              provider: 'claude',
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
            provider: 'claude',
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
    
    // Extract Claude tool use XML format
    const xmlPattern = /<tool_use>([\s\S]*?)<\/tool_use>/g;
    let match;
    
    while ((match = xmlPattern.exec(text)) !== null) {
      try {
        const toolContent = match[1];
        const nameMatch = toolContent.match(/<name>(.*?)<\/name>/);
        const inputMatch = toolContent.match(/<input>([\s\S]*?)<\/input>/);
        
        if (nameMatch) {
          let arguments_obj = {};
          if (inputMatch) {
            try {
              arguments_obj = JSON.parse(inputMatch[1]);
            } catch (e) {
              // If not JSON, treat as string
              arguments_obj = { input: inputMatch[1] };
            }
          }
          
          toolCalls.push({
            id: this.generateToolCallId(),
            name: nameMatch[1],
            arguments: arguments_obj,
            type: 'tool',
            format: 'anthropic_tool_use',
            raw: match[0]
          });
        }
      } catch (e) {
        // Ignore invalid XML
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
    
    // Extract Claude's thinking/reasoning tags
    const thinkingPattern = /<thinking>([\s\S]*?)<\/thinking>/g;
    while ((match = thinkingPattern.exec(text)) !== null) {
      // This is reasoning content, not a tool call
      // We might want to handle this differently in the future
    }
    
    return toolCalls;
  }
  
  extractContent(response: any): string {
    if (typeof response === 'string') {
      return response;
    }
    
    if (response.content) {
      let content = '';
      for (const item of response.content) {
        if (item.type === 'text') {
          content += item.text;
        }
      }
      return content;
    }
    
    if (response.text) {
      return response.text;
    }
    
    return '';
  }
  
  hasToolCalls(response: any): boolean {
    if (typeof response === 'string') {
      return this.extractToolCalls(response).length > 0;
    }
    
    if (response.content) {
      for (const item of response.content) {
        if (item.type === 'tool_use') {
          return true;
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
    return `claude_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}