import type { MessageExtractor, ExtractedSegment, ToolCall } from '../MessageExtractor';
import { StreamingToolCallBuffer, StreamingToolCallBufferOptions } from './streamingToolCallBuffer';

export interface StreamingExtractorOptions {
  baseExtractor: MessageExtractor;
  bufferOptions?: Partial<StreamingToolCallBufferOptions>;
}

export class StreamingExtractor implements MessageExtractor {
  readonly name: string;
  readonly supportedFormats: string[];
  
  private buffer: StreamingToolCallBuffer;
  private baseExtractor: MessageExtractor;
  private contentBuffer = '';
  private lastVisibleIndex = 0;

  constructor(options: StreamingExtractorOptions) {
    this.baseExtractor = options.baseExtractor;
    this.name = `Streaming${options.baseExtractor.name}`;
    this.supportedFormats = options.baseExtractor.supportedFormats;
    
    this.buffer = new StreamingToolCallBuffer({
      protocol: 'auto',
      format: 'auto',
      ...options.bufferOptions
    });
  }

  extract(response: any): ExtractedSegment[] {
    // For non-streaming responses, delegate to base extractor
    return this.baseExtractor.extract(response);
  }

  pushToken(token: string): ExtractedSegment[] {
    const segments: ExtractedSegment[] = [];
    
    // Push token to buffer and check for tool calls
    const detectedToolCalls = this.buffer.push(token);
    
    // Update content buffer
    this.contentBuffer = this.buffer.getVisibleContent();
    
    // Extract new content since last time
    const newContent = this.contentBuffer.slice(this.lastVisibleIndex);
    if (newContent.length > 0) {
      segments.push({
        type: 'content',
        data: newContent,
        metadata: {
          provider: this.name,
          format: 'text'
        }
      });
      this.lastVisibleIndex = this.contentBuffer.length;
    }

    // Process detected tool calls
    if (detectedToolCalls?.length) {
      for (const toolCall of detectedToolCalls) {
        segments.push({
          type: 'tool_call',
          data: this.normalizeToolCall(toolCall),
          metadata: {
            provider: this.name,
            format: toolCall.format || 'json',
            raw: toolCall
          }
        });
      }
    }

    return segments;
  }

  private normalizeToolCall(rawToolCall: any): ToolCall {
    return {
      id: rawToolCall.id || rawToolCall.tool_call_id || `call_${Date.now()}`,
      name: rawToolCall.name || rawToolCall.function?.name,
      arguments: rawToolCall.arguments || rawToolCall.function?.arguments || rawToolCall.parameters || {},
      type: rawToolCall.type || 'function',
      format: rawToolCall.format || 'json',
      raw: rawToolCall
    };
  }

  getBufferedContent(): string {
    return this.contentBuffer;
  }

  finalize(): ExtractedSegment[] {
    // Push empty string to finalize any remaining buffered tool calls
    return this.pushToken('');
  }

  reset(): void {
    this.contentBuffer = '';
    this.lastVisibleIndex = 0;
    this.buffer = new StreamingToolCallBuffer({
      protocol: this.buffer['protocol'],
      format: this.buffer['format']
    });
  }

  extractToolCalls?(text: string): ToolCall[] {
    return this.baseExtractor.extractToolCalls?.(text) || [];
  }

  extractContent?(response: any): string {
    return this.baseExtractor.extractContent?.(response) || '';
  }

  hasToolCalls?(response: any): boolean {
    return this.baseExtractor.hasToolCalls?.(response) || false;
  }

  validateToolCall?(toolCall: any): boolean {
    return this.baseExtractor.validateToolCall?.(toolCall) || true;
  }
}