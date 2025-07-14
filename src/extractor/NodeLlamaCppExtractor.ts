import { MessageExtractor, ExtractedSegment, ToolCall } from './MessageExtractor';
import { parseToolCallPayload } from './streaming/toolCallParser';

export class NodeLlamaCppExtractor implements MessageExtractor {
  readonly name = 'NodeLlamaCppExtractor';
  readonly supportedFormats = ['json', 'xml', 'function_calling', 'tool_use', 'tool'];

  extract(response: any): ExtractedSegment[] {
    if (!response) {
      return [];
    }

    const text = response.text || response.content || response.response || '';
    if (!text) return [];

    const segments: ExtractedSegment[] = [];
    
    try {
      // Check for function/tool call patterns in the response
      const functionCallMatches = this.extractFunctionCalls(text);
      const toolCallMatches = this.extractToolCallMatches(text);
      
      if (functionCallMatches.length > 0 || toolCallMatches.length > 0) {
        // Process mixed content with tool calls
        segments.push(...this.processMixedContent(text, [...functionCallMatches, ...toolCallMatches]));
      } else {
        // Pure text content
        segments.push({
          type: 'content',
          data: text.trim()
        });
      }
    } catch (error) {
      console.warn('Error extracting segments from node-llama-cpp response:', error);
      // Fallback to treating as plain text
      segments.push({
        type: 'content',
        data: text.trim()
      });
    }

    return segments;
  }

  public extractFunctionCalls(text: string): Array<{ match: RegExpMatchArray; type: 'function' }> {
    const patterns = [
      // JSON function call format
      /"function_call":\s*\{[^}]*"name":\s*"([^"]+)"[^}]*"arguments":\s*(\{[^}]*\})\}/g,
      // XML-style function calls
      /<function_call[^>]*name=["']([^"']+)["'][^>]*>(.*?)<\/function_call>/gs,
      // Simple function call format
      /function_call\(\s*name=["']([^"']+)["'],?\s*args=(\{[^}]*\})\s*\)/g
    ];

    const matches: Array<{ match: RegExpMatchArray; type: 'function' }> = [];
    
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        matches.push({ match, type: 'function' });
      }
    }

    return matches;
  }

  public extractToolCalls(text: string): ToolCall[] {
    const toolMatches = this.extractToolCallMatches(text);
    return toolMatches.map(({ match, type }) => this.parseToolCall(match, type)).filter(Boolean) as ToolCall[];
  }

  private extractToolCallMatches(text: string): Array<{ match: RegExpMatchArray; type: 'tool' }> {
    const patterns = [
      // XML-style tool calls (Claude/Anthropic format)
      /<tool_use[^>]*>\s*<tool_name>([^<]+)<\/tool_name>\s*<parameters>(.*?)<\/parameters>\s*<\/tool_use>/gs,
      // JSON tool call format
      /"tool_calls":\s*\[\s*\{[^}]*"name":\s*"([^"]+)"[^}]*"arguments":\s*(\{[^}]*\})[^}]*\}\s*\]/g,
      // Simple tool call format
      /tool_call\(\s*name=["']([^"']+)["'],?\s*args=(\{[^}]*\})\s*\)/g
    ];

    const matches: Array<{ match: RegExpMatchArray; type: 'tool' }> = [];
    
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        matches.push({ match, type: 'tool' });
      }
    }

    return matches;
  }

  private processMixedContent(
    text: string, 
    allMatches: Array<{ match: RegExpMatchArray; type: 'function' | 'tool' }>
  ): ExtractedSegment[] {
    const segments: ExtractedSegment[] = [];
    
    // Sort matches by position
    allMatches.sort((a, b) => (a.match.index || 0) - (b.match.index || 0));
    
    let lastIndex = 0;
    
    for (const { match, type } of allMatches) {
      const matchStart = match.index || 0;
      
      // Add text content before this match
      if (matchStart > lastIndex) {
        const beforeText = text.slice(lastIndex, matchStart).trim();
        if (beforeText) {
          segments.push({
            type: 'content',
            data: beforeText
          });
        }
      }
      
      // Add tool/function call
      try {
        const toolCall = this.parseToolCall(match, type);
        if (toolCall) {
          segments.push({
            type: 'tool_call',
            data: toolCall
          });
        }
      } catch (error) {
        console.warn('Failed to parse tool call:', error);
        // Include the raw text if parsing fails
        segments.push({
          type: 'content',
          data: match[0]
        });
      }
      
      lastIndex = matchStart + match[0].length;
    }
    
    // Add remaining text after last match
    if (lastIndex < text.length) {
      const afterText = text.slice(lastIndex).trim();
      if (afterText) {
        segments.push({
          type: 'content',
          data: afterText
        });
      }
    }
    
    return segments;
  }

  private parseToolCall(match: RegExpMatchArray, type: 'function' | 'tool'): ToolCall | null {
    try {
      const [fullMatch, name, argsStr] = match;
      
      if (!name) return null;
      
      let arguments_obj = {};
      
      // Parse arguments
      if (argsStr) {
        try {
          // Try to parse as JSON
          arguments_obj = JSON.parse(argsStr);
        } catch {
          // If JSON parsing fails, try to extract key-value pairs
          try {
            arguments_obj = this.parseSimpleArguments(argsStr);
          } catch {
            console.warn('Could not parse tool call arguments:', argsStr);
            arguments_obj = { raw: argsStr };
          }
        }
      }
      
      const toolCall: ToolCall = {
        id: `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: name.trim(),
        arguments: arguments_obj
      };
      
      // Add type-specific properties
      if (type === 'function') {
        (toolCall as any).type = 'function';
      } else {
        (toolCall as any).type = 'tool_use';
      }
      
      return toolCall;
    } catch (error) {
      console.warn('Error parsing tool call:', error);
      return null;
    }
  }

  private parseSimpleArguments(argsStr: string): Record<string, any> {
    const args: Record<string, any> = {};
    
    // Handle simple key=value format
    const pairs = argsStr.split(',');
    for (const pair of pairs) {
      const [key, ...valueParts] = pair.split('=');
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').trim();
        const trimmedKey = key.trim();
        
        // Try to parse value as number or boolean
        if (value === 'true') {
          args[trimmedKey] = true;
        } else if (value === 'false') {
          args[trimmedKey] = false;
        } else if (/^\d+$/.test(value)) {
          args[trimmedKey] = parseInt(value, 10);
        } else if (/^\d*\.\d+$/.test(value)) {
          args[trimmedKey] = parseFloat(value);
        } else {
          // Remove quotes if present
          args[trimmedKey] = value.replace(/^["']|["']$/g, '');
        }
      }
    }
    
    return args;
  }

  // Additional method for handling structured output from local models
  extractStructuredOutput(text: string): any {
    try {
      // Try to extract JSON from the response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      // Try to extract XML-like structures
      const xmlMatch = text.match(/<output>([\s\S]*?)<\/output>/i);
      if (xmlMatch) {
        try {
          return JSON.parse(xmlMatch[1]);
        } catch {
          return { content: xmlMatch[1] };
        }
      }
      
      return null;
    } catch (error) {
      console.warn('Could not extract structured output:', error);
      return null;
    }
  }
}