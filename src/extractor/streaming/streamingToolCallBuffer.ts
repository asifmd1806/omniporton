/**
 * StreamingToolCallBuffer: Protocol-aware, streaming-safe tool call detection and buffering.
 *
 * Usage:
 *   const buffer = new StreamingToolCallBuffer({ protocol: 'function_calling', format: 'json' });
 *   for (const chunk of streamedOutput) {
 *     const toolCalls = buffer.push(chunk);
 *     if (toolCalls) {
 *       for (const call of toolCalls) { ... }
 *     }
 *   }
 */
import { parseToolCallPayload } from './toolCallParser';

export interface StreamingToolCallBufferOptions {
  protocol: 'function_calling' | 'tool_use' | 'tool' | 'auto';
  format?: 'json' | 'xml' | 'yaml' | 'auto';
}

export class StreamingToolCallBuffer {
  private buffer = '';
  private format: StreamingToolCallBufferOptions['format'];
  private protocol: StreamingToolCallBufferOptions['protocol'];

  constructor(opts: StreamingToolCallBufferOptions) {
    this.format = opts.format || 'auto';
    this.protocol = opts.protocol;
  }

  /**
   * Push a new chunk/token into the buffer. Returns an array of parsed tool calls if a complete one is detected, or null otherwise.
   */
  push(chunk: string): any[] | null {
    this.buffer += chunk;
    const toolCalls: any[] = [];
    let match: RegExpMatchArray | null = null;
    let found = false;
    // Protocol-specific block detection
    const patterns: Record<string, RegExp[]> = {
      function_calling: [/<function_call>([\s\S]*?)<\/function_call>/g],
      tool_use: [/<tool_use>([\s\S]*?)<\/tool_use>/g],
      tool: [/<tool_call>([\s\S]*?)<\/tool_call>/g, /<function_call>([\s\S]*?)<\/function_call>/g],
      auto: [/<function_call>([\s\S]*?)<\/function_call>/g, /<tool_use>([\s\S]*?)<\/tool_use>/g, /<tool_call>([\s\S]*?)<\/tool_call>/g],
    };
    const pats = patterns[this.protocol] || patterns['auto'];
    for (const pat of pats) {
      while ((match = pat.exec(this.buffer))) {
        try {
          const parsed = parseToolCallPayload(match[1], this.format);
          toolCalls.push(parsed);
          found = true;
        } catch (e) {
          // Ignore parse errors for incomplete blocks
        }
      }
    }
    // Remove processed blocks from buffer
    if (found) {
      this.buffer = this.buffer.replace(/<function_call>[\s\S]*?<\/function_call>/g, '')
        .replace(/<tool_use>[\s\S]*?<\/tool_use>/g, '')
        .replace(/<tool_call>[\s\S]*?<\/tool_call>/g, '');
      return toolCalls.length > 0 ? toolCalls : null;
    }
    // No fallback to raw JSON objects outside of tool call tags
    return null;
  }

  /** Get the current buffer state (for debugging or error handling) */
  getRawBuffer() {
    return this.buffer;
  }

  /**
   * Returns the visible assistant content (excluding any part of the buffer that is inside an un-closed tool call tag).
   * This is useful for streaming UIs that should not render the JSON/XML payload meant for the tool.
   */
  getVisibleContent(): string {
    // Find the first occurrence of an opening tag that is not yet closed
    const openTagRegex = /<function_call>|<tool_use>|<tool_call>/g;
    const match = openTagRegex.exec(this.buffer);
    if (!match) return this.buffer; // No opening tag: everything is visible
    const idx = match.index;
    return this.buffer.slice(0, idx);
  }
} 